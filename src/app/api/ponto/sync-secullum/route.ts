/**
 * POST /api/ponto/sync-secullum
 *
 * Sincroniza batidas brutas do cartão de ponto da API Secullum Ponto Web
 * para a tabela public.ponto_marcacoes.
 *
 * Body JSON: { dataInicio: "YYYY-MM-DD", dataFim: "YYYY-MM-DD" }
 *
 * Requer role: admin | rh
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

/** Extrai data (yyyy-MM-dd) e hora (HH:mm) de uma batida, lidando com os múltiplos
 *  formatos que a API pode retornar (dataHora combinada ou data+hora separados). */
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

export async function POST(req: NextRequest) {
  const roleErr = await requireRoleApi(['admin', 'rh'])
  if (roleErr) return roleErr

  let body: { dataInicio?: string; dataFim?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 })
  }

  const { dataInicio, dataFim } = body
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

  // 1. Autentica no Secullum
  let session
  try {
    session = await autenticarViaEnv()
  } catch (e: any) {
    const msg = e?.message || 'Erro autenticando no Secullum'
    console.error('[sync-secullum] auth error:', msg)
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  // 2. Busca batidas do período
  let batidas: SecullumBatida[]
  try {
    batidas = await listarBatidas(session, { dataInicio, dataFim })
  } catch (e: any) {
    const status = e instanceof SecullumError ? e.status || 502 : 502
    const msg = e?.message || 'Erro buscando batidas na Secullum'
    console.error('[sync-secullum] listarBatidas error:', msg)
    return NextResponse.json({ error: msg }, { status })
  }

  if (batidas.length === 0) {
    return NextResponse.json({
      ok: true,
      periodo: { dataInicio, dataFim },
      total_batidas: 0,
      novas: 0,
      ignoradas: 0,
      sem_match: 0,
      mensagem: 'Nenhuma batida retornada pela Secullum no período',
    })
  }

  // 3. Mapeia CPFs/PIS da Secullum → funcionario_id do Softmonte
  const cpfs = Array.from(
    new Set(
      batidas
        .map(b => onlyDigits(b.funcionarioCpf || (b as any).cpf))
        .filter(Boolean),
    ),
  )
  const pisList = Array.from(
    new Set(
      batidas
        .map(b => onlyDigits(b.funcionarioPis || (b as any).pis))
        .filter(Boolean),
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
  }
  const rows: Row[] = []
  const semMatch: string[] = []
  let ignoradas = 0

  // Contador por (funcionario_id, data, hora) pra calcular sequencia
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
      semMatch.push(b.funcionarioNome || cpf || pis || '(sem id)')
      continue
    }

    const key = `${funcId}|${parsed.data}|${parsed.hora}`
    const seq = (seqMap.get(key) || 0) + 1
    seqMap.set(key, seq)

    rows.push({
      funcionario_id: funcId,
      data: parsed.data,
      hora: parsed.hora,
      sequencia: seq,
      origem: 'secullum_api',
      origem_id: b.id != null ? String(b.id) : null,
      payload_cru: b,
    })
  }

  // 5. Upsert em lotes (pra evitar payloads muito grandes)
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

  return NextResponse.json({
    ok: erros.length === 0,
    periodo: { dataInicio, dataFim },
    total_batidas: batidas.length,
    novas: inseridas,
    ignoradas,
    sem_match: semMatch.length,
    funcionarios_sem_match: semMatch.slice(0, 20), // amostra pra debug
    erros,
    banco_secullum: session.bancoNome,
  })
}
