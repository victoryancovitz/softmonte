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

/**
 * Formato real da Secullum: cada registro é um CARTÃO DIÁRIO com até 5 pares.
 *
 * {
 *   Id: 30924,
 *   FuncionarioId: 23,
 *   Data: "2026-01-07T00:00:00",
 *   Entrada1: "07:30" | "AFASTAM" | "FERIAS" | "PENDENT" | null,
 *   Saida1: "12:30" | ...,
 *   Entrada2: "13:30",
 *   Saida2: "17:30",
 *   ...até Entrada5/Saida5
 *   Funcionario: { NumeroPis: "123...", NumeroFolha: "1024", NumeroIdentificador: "1024" },
 *   FonteDadosEntrada1: { Tipo: 0, Origem: 1 } | null,
 *   ...
 * }
 */

const MARCACAO_LABELS = ['Entrada1','Saida1','Entrada2','Saida2','Entrada3','Saida3','Entrada4','Saida4','Entrada5','Saida5'] as const

/** Verifica se um valor é um horário HH:mm (não "AFASTAM", "FERIAS", "PENDENT", null, etc) */
function isTime(val: any): boolean {
  if (typeof val !== 'string') return false
  return /^\d{1,2}:\d{2}(:\d{2})?$/.test(val.trim())
}

/** Extrai data (yyyy-MM-dd) do campo Data que vem como "2026-01-07T00:00:00" */
function parseData(dataStr: string | null | undefined): string | null {
  if (!dataStr) return null
  const s = String(dataStr)
  // ISO: "2026-01-07T00:00:00"
  if (s.includes('T') || s.includes('-')) return s.slice(0, 10)
  // dd/MM/yyyy
  if (s.includes('/')) {
    const parts = s.split('/')
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`
  }
  return null
}

/** Extrai FonteDados de um slot específico (FonteDadosEntrada1, etc) */
function parseFonteDados(b: any, label: string): { tipo: number | null; origem: number | null } {
  const fd = b[`FonteDados${label}`]
  if (!fd || typeof fd !== 'object') return { tipo: null, origem: null }
  return {
    tipo: typeof fd.Tipo === 'number' ? fd.Tipo : null,
    origem: typeof fd.Origem === 'number' ? fd.Origem : null,
  }
}

type Marcacao = {
  data: string
  hora: string
  sequencia: number
  pis: string
  nome: string
  secullumId: number | null
  fonteTipo: number | null
  fonteOrigem: number | null
  payloadCru: any
}

/** Determina o status do dia a partir do cartão Secullum */
function parseStatusDia(cartao: any): string {
  if (cartao.Folga === true) return 'folga'
  if (cartao.Compensado === true) return 'compensado'

  // Checa os slots — se TODOS são AFASTAM, FERIAS, PENDENT, etc.
  const vals: string[] = []
  for (const label of MARCACAO_LABELS) {
    const v = cartao[label]
    if (v != null && v !== '') vals.push(String(v).toUpperCase().trim())
  }

  if (vals.length === 0) return 'sem_marcacao'
  if (vals.every(v => v === 'AFASTAM')) return 'afastamento'
  if (vals.every(v => v === 'FERIAS')) return 'ferias'
  if (vals.every(v => v === 'PENDENT')) return 'pendente'
  if (vals.some(v => isTime(v))) return 'presente'
  // Mix de status texto sem horários
  if (vals.every(v => ['AFASTAM', 'FERIAS', 'PENDENT', 'INTREGR', ''].includes(v))) return 'afastamento'
  return 'sem_marcacao'
}

type DiaStatus = {
  pis: string
  data: string
  status: string
  secullumId: number | null
}

/** Transforma um cartão diário em 0..10 marcações individuais */
function parseDiaBatidas(cartao: any): Marcacao[] {
  const data = parseData(cartao.Data)
  if (!data) return []

  const pis = onlyDigits(cartao.Funcionario?.NumeroPis || cartao.Funcionario?.Pis || '')
  const nome = cartao.Funcionario?.Nome || ''
  const secullumId = typeof cartao.Id === 'number' ? cartao.Id : null

  const marcacoes: Marcacao[] = []
  let seq = 0
  for (const label of MARCACAO_LABELS) {
    const val = cartao[label]
    if (!isTime(val)) continue
    seq++
    const { tipo, origem } = parseFonteDados(cartao, label)
    marcacoes.push({
      data,
      hora: val.trim().slice(0, 5), // "07:30" ou "7:30" → "07:30"/"7:30"
      sequencia: seq,
      pis,
      nome,
      secullumId,
      fonteTipo: tipo,
      fonteOrigem: origem,
      payloadCru: cartao,
    })
  }
  return marcacoes
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

  // 3. Explode cartões diários em marcações + coleta status por dia
  const allMarcacoes: Marcacao[] = []
  const allDiaStatus: DiaStatus[] = []
  let cartoesSemMarcacao = 0
  for (const cartao of batidas) {
    const c = cartao as any
    const data = parseData(c.Data)
    const pis = onlyDigits(c.Funcionario?.NumeroPis || c.Funcionario?.Pis || '')
    const secullumId = typeof c.Id === 'number' ? c.Id : null

    if (data && pis) {
      allDiaStatus.push({ pis, data, status: parseStatusDia(c), secullumId })
    }

    const marcacoes = parseDiaBatidas(c)
    if (marcacoes.length === 0) cartoesSemMarcacao++
    allMarcacoes.push(...marcacoes)
  }

  // 4. Mapeia PIS da Secullum → funcionario_id do Softmonte
  // Coleta PIS tanto das marcações quanto dos status (pra gravar status de afastados também)
  const allPis = new Set([
    ...allMarcacoes.map(m => m.pis).filter(Boolean),
    ...allDiaStatus.map(d => d.pis).filter(Boolean),
  ])
  const pisList = Array.from(allPis)
  const pisToFuncId = new Map<string, string>()
  const funcIdToDeletedAt = new Map<string, string>()

  if (pisList.length > 0) {
    // Match primário: por PIS
    const { data } = await supabase.from('funcionarios').select('id, pis, id_ponto, deleted_at').in('pis', pisList)
    ;(data || []).forEach((f: any) => {
      if (f.pis) {
        pisToFuncId.set(onlyDigits(f.pis), f.id)
        if (f.deleted_at) funcIdToDeletedAt.set(f.id, f.deleted_at.split('T')[0])
      }
    })

    // Fallback 1: por id_ponto (NumeroIdentificador do Secullum)
    // Fallback 2: por nome do funcionário
    // Coleta id_ponto e nome das batidas que não deram match por PIS
    const unmatchedInfo = new Map<string, { idPonto: string | null; nome: string }>()
    for (const cartao of batidas) {
      const c = cartao as any
      const pis = onlyDigits(c.Funcionario?.NumeroPis || c.Funcionario?.Pis || '')
      if (!pis || pisToFuncId.has(pis)) continue
      const idPonto = String(c.Funcionario?.NumeroIdentificador || c.Funcionario?.NumeroFolha || c.FuncionarioId || '')
      const nome = (c.Funcionario?.Nome || '').toUpperCase().trim()
      if (idPonto || nome) unmatchedInfo.set(pis, { idPonto: idPonto || null, nome })
    }

    if (unmatchedInfo.size > 0) {
      // Buscar todos os funcionários para match por id_ponto ou nome
      const { data: allFuncs } = await supabase
        .from('funcionarios')
        .select('id, nome, pis, id_ponto, deleted_at')

      const funcByIdPonto = new Map<string, { id: string; deleted_at: string | null }>()
      const funcByNome = new Map<string, { id: string; deleted_at: string | null }>()
      ;(allFuncs || []).forEach((f: any) => {
        if (f.id_ponto) funcByIdPonto.set(String(f.id_ponto), { id: f.id, deleted_at: f.deleted_at })
        funcByNome.set(f.nome.toUpperCase().trim(), { id: f.id, deleted_at: f.deleted_at })
      })

      for (const [pis, info] of Array.from(unmatchedInfo.entries())) {
        // Tentar match por id_ponto primeiro
        let match = info.idPonto ? funcByIdPonto.get(info.idPonto) : null
        // Fallback: match por nome
        if (!match && info.nome) match = funcByNome.get(info.nome)

        if (match) {
          pisToFuncId.set(pis, match.id)
          if (match.deleted_at) funcIdToDeletedAt.set(match.id, match.deleted_at.split('T')[0])
          // Atualizar PIS no banco para futuros syncs
          await supabase.from('funcionarios').update({ pis }).eq('id', match.id)
        }
      }
    }
  }

  // 5. Prepara rows pra upsert
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
  let ignoradas = cartoesSemMarcacao // cartões sem nenhuma batida real (AFASTAM, FERIAS, etc)
  let ignoradas_pos_desligamento = 0

  for (const m of allMarcacoes) {
    const funcId = (m.pis && pisToFuncId.get(m.pis)) || null

    if (!funcId) {
      semMatchSet.add(m.nome || m.pis || '(sem id)')
      continue
    }

    // Ignorar marcações posteriores ao desligamento do funcionário
    const deletedAt = funcIdToDeletedAt.get(funcId)
    if (deletedAt && m.data > deletedAt) {
      ignoradas_pos_desligamento++
      continue
    }

    rows.push({
      funcionario_id: funcId,
      data: m.data,
      hora: m.hora,
      sequencia: m.sequencia,
      origem: 'secullum_api',
      origem_id: m.secullumId != null ? String(m.secullumId) : null,
      payload_cru: m.payloadCru,
      fonte_tipo: m.fonteTipo,
      fonte_origem: m.fonteOrigem,
    })
  }

  // 6. Upsert ponto_dia_status (status por dia por funcionário)
  const statusRows = allDiaStatus
    .filter(d => pisToFuncId.has(d.pis))
    .map(d => ({
      funcionario_id: pisToFuncId.get(d.pis)!,
      data: d.data,
      status: d.status,
      secullum_cartao_id: d.secullumId,
    }))

  let statusInseridos = 0
  if (statusRows.length > 0) {
    for (let i = 0; i < statusRows.length; i += 500) {
      const chunk = statusRows.slice(i, i + 500)
      const { error: stErr, count } = await supabase
        .from('ponto_dia_status')
        .upsert(chunk, { onConflict: 'funcionario_id,data', count: 'exact' })
      if (stErr) console.error('[sync-secullum] status upsert error:', stErr)
      else statusInseridos += count || 0
    }
  }

  // 7. Upsert marcações em lotes
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
    total_batidas: batidas.length,  // cartões diários do Secullum
    novas: inseridas,               // marcações individuais inseridas
    ignoradas: ignoradas + ignoradas_pos_desligamento,
    sem_match: semMatch.length,     // funcionários sem match (não cartões)
    erro: erros.length > 0 ? erros.join('; ') : null,
  })

  return NextResponse.json({
    ok: erros.length === 0,
    periodo: { dataInicio, dataFim },
    cartoes_diarios: batidas.length,
    total_marcacoes: allMarcacoes.length,
    novas: inseridas,
    status_dias: statusInseridos,
    ignoradas_sem_horario: ignoradas,
    ignoradas_pos_desligamento,
    sem_match: semMatch.length,
    funcionarios_sem_match: semMatch.slice(0, 20),
    erros,
    banco_secullum: session.bancoNome,
    log_id: logId,
    amostra_batida_crua: batidas.length > 0 ? batidas[0] : null,
  })
}
