/**
 * POST /api/ponto/sync-secullum
 *
 * Sincroniza batidas brutas do cartão de ponto da API Secullum Ponto Web
 * para a tabela public.ponto_marcacoes.
 *
 * Body JSON: {
 *   dataInicio: "YYYY-MM-DD",
 *   dataFim: "YYYY-MM-DD",
 *   empresaDocumento?: string,  // CNPJ/CPF pra filtrar por empresa específica
 *   trigger?: 'manual' | 'cron' | 'debug'
 * }
 *
 * Auth: admin | rh | CRON_SECRET header
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { requireRoleApi } from '@/lib/require-role'
import {
  autenticarViaEnv,
  listarBatidas,
  SecullumError,
  type SecullumBatida,
} from '@/lib/ponto/secullum'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function onlyDigits(s: string | null | undefined): string {
  return (s || '').replace(/\D/g, '')
}

/** Extrai data e hora lidando com os múltiplos formatos possíveis da API */
function parseBatida(b: SecullumBatida): { data: string; hora: string } | null {
  if (b.data && b.hora) {
    return {
      data: b.data.slice(0, 10),
      hora: b.hora.slice(0, 5),
    }
  }
  if (b.dataHora) {
    const d = new Date(b.dataHora)
    if (isNaN(d.getTime())) return null
    const yyyy = d.getUTCFullYear()
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(d.getUTCDate()).padStart(2, '0')
    const hh = String(d.getUTCHours()).padStart(2, '0')
    const mi = String(d.getUTCMinutes()).padStart(2, '0')
    return { data: `${yyyy}-${mm}-${dd}`, hora: `${hh}:${mi}` }
  }
  return null
}

/** Extrai FonteDados.Tipo e FonteDados.Origem, lidando com variações de casing */
function parseFonteDados(b: SecullumBatida): { tipo: number | null; origem: number | null } {
  const fd = (b as any).FonteDados ?? (b as any).fonteDados ?? null
  if (!fd) return { tipo: null, origem: null }
  const tipo = fd.Tipo ?? fd.tipo ?? null
  const origem = fd.Origem ?? fd.origem ?? null
  return {
    tipo: typeof tipo === 'number' ? tipo : null,
    origem: typeof origem === 'number' ? origem : null,
  }
}

export async function POST(req: NextRequest) {
  // Permite chamada via cron usando CRON_SECRET header OU via role admin/rh
  const cronSecret = req.headers.get('x-cron-secret')
  const expectedCron = process.env.CRON_SECRET
  const isCron = !!(expectedCron && cronSecret === expectedCron)

  if (!isCron) {
    const roleErr = await requireRoleApi(['admin', 'rh'])
    if (roleErr) return roleErr
  }

  let body: {
    dataInicio?: string
    dataFim?: string
    empresaDocumento?: string
    trigger?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 })
  }

  const { dataInicio, dataFim, empresaDocumento } = body
  const trigger = body.trigger || (isCron ? 'cron' : 'manual')

  if (!dataInicio || !dataFim || !/^\d{4}-\d{2}-\d{2}$/.test(dataInicio) || !/^\d{4}-\d{2}-\d{2}$/.test(dataFim)) {
    return NextResponse.json(
      { error: 'dataInicio e dataFim são obrigatórios no formato YYYY-MM-DD' },
      { status: 400 },
    )
  }
  if (dataFim < dataInicio) {
    return NextResponse.json({ error: 'dataFim não pode ser anterior a dataInicio' }, { status: 400 })
  }

  const supabase = createServerClient()

  // Captura user atual (pode ser null em cron)
  const { data: { user } } = await supabase.auth.getUser()

  // Cria registro de sync_log inicial
  const { data: logRow } = await supabase.from('ponto_sync_log').insert({
    periodo_inicio: dataInicio,
    periodo_fim: dataFim,
    trigger,
    status: 'running',
    triggered_by: user?.id ?? null,
  }).select().single()
  const logId = logRow?.id as string | undefined

  async function finishLog(patch: Record<string, any>) {
    if (!logId) return
    await supabase.from('ponto_sync_log').update({
      ...patch,
      finished_at: new Date().toISOString(),
    }).eq('id', logId)
  }

  // 1. Autentica no Secullum
  let session
  try {
    session = await autenticarViaEnv()
  } catch (e: any) {
    const msg = e?.message || 'Erro autenticando no Secullum'
    console.error('[sync-secullum] auth error:', msg)
    await finishLog({ status: 'error', erro: msg })
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  // 2. Busca batidas do período
  let batidas: SecullumBatida[]
  try {
    batidas = await listarBatidas(session, { dataInicio, dataFim, empresaDocumento })
  } catch (e: any) {
    const status = e instanceof SecullumError ? e.status || 502 : 502
    const msg = e?.message || 'Erro buscando batidas na Secullum'
    console.error('[sync-secullum] listarBatidas error:', msg)
    await finishLog({ status: 'error', erro: msg })
    return NextResponse.json({ error: msg }, { status })
  }

  if (batidas.length === 0) {
    await finishLog({ status: 'ok', total_batidas: 0, novas: 0, ignoradas: 0, sem_match: 0 })
    return NextResponse.json({
      ok: true,
      periodo: { dataInicio, dataFim },
      total_batidas: 0,
      novas: 0,
      ignoradas: 0,
      sem_match: 0,
      mensagem: 'Nenhuma batida retornada pela Secullum no período',
      banco_secullum: session.bancoNome,
    })
  }

  // 3. Mapeia CPFs/PIS da Secullum → funcionario_id do Softmonte
  const cpfs = Array.from(
    new Set(
      batidas.map(b => onlyDigits(b.funcionarioCpf || (b as any).cpf)).filter(Boolean),
    ),
  )
  const pisList = Array.from(
    new Set(
      batidas.map(b => onlyDigits(b.funcionarioPis || (b as any).pis)).filter(Boolean),
    ),
  )

  const cpfToFuncId = new Map<string, string>()
  const pisToFuncId = new Map<string, string>()

  if (cpfs.length > 0) {
    const { data } = await supabase.from('funcionarios').select('id, cpf').in('cpf', cpfs)
    ;(data || []).forEach((f: any) => {
      if (f.cpf) cpfToFuncId.set(onlyDigits(f.cpf), f.id)
    })
  }
  if (pisList.length > 0) {
    const { data } = await supabase.from('funcionarios').select('id, pis').in('pis', pisList)
    ;(data || []).forEach((f: any) => {
      if (f.pis) pisToFuncId.set(onlyDigits(f.pis), f.id)
    })
  }

  // 4. Prepara rows pra upsert
  type Row = {
    funcionario_id: string
    data: string
    hora: string
    sequencia: number
    origem: string
    origem_id: string | null
    payload_cru: any
    fonte_tipo: number | null
    fonte_origem: number | null
  }
  const rows: Row[] = []
  const semMatchSet = new Set<string>()
  let ignoradas = 0

  const seqMap = new Map<string, number>()

  for (const b of batidas) {
    const parsed = parseBatida(b)
    if (!parsed) {
      ignoradas++
      continue
    }
    const cpf = onlyDigits(b.funcionarioCpf || (b as any).cpf)
    const pis = onlyDigits(b.funcionarioPis || (b as any).pis)
    const funcId = (cpf && cpfToFuncId.get(cpf)) || (pis && pisToFuncId.get(pis)) || null

    if (!funcId) {
      semMatchSet.add(b.funcionarioNome || cpf || pis || '(sem id)')
      continue
    }

    const key = `${funcId}|${parsed.data}|${parsed.hora}`
    const seq = (seqMap.get(key) || 0) + 1
    seqMap.set(key, seq)

    const { tipo, origem: fonteOrigem } = parseFonteDados(b)
    rows.push({
      funcionario_id: funcId,
      data: parsed.data,
      hora: parsed.hora,
      sequencia: seq,
      origem: 'secullum_api',
      origem_id: b.id != null ? String(b.id) : null,
      payload_cru: b,
      fonte_tipo: tipo,
      fonte_origem: fonteOrigem,
    })
  }

  // 5. Upsert em lotes
  const BATCH = 500
  let inseridas = 0
  const erros: string[] = []
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH)
    const { error, count } = await supabase
      .from('ponto_marcacoes')
      .upsert(chunk, {
        onConflict: 'funcionario_id,data,hora,sequencia',
        ignoreDuplicates: true,
        count: 'exact',
      })
    if (error) {
      console.error('[sync-secullum] upsert error:', error)
      erros.push(error.message)
    } else {
      inseridas += count || 0
    }
  }

  const semMatch = Array.from(semMatchSet)
  const finalStatus = erros.length === 0 ? 'ok' : 'error'
  await finishLog({
    status: finalStatus,
    total_batidas: batidas.length,
    novas: inseridas,
    ignoradas,
    sem_match: semMatch.length,
    erro: erros.length > 0 ? erros.join('; ') : null,
  })

  return NextResponse.json({
    ok: erros.length === 0,
    periodo: { dataInicio, dataFim },
    total_batidas: batidas.length,
    novas: inseridas,
    ignoradas,
    sem_match: semMatch.length,
    funcionarios_sem_match: semMatch.slice(0, 20),
    erros,
    banco_secullum: session.bancoNome,
    log_id: logId,
  })
}
