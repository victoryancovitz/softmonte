/**
 * GET /api/cron/sync-ponto-diario
 *
 * Endpoint executado pelo Vercel Cron 1x por dia (definido em vercel.json).
 * Sincroniza as batidas de ontem e recalcula o efetivo_diario.
 *
 * Autenticação: header `Authorization: Bearer ${CRON_SECRET}` (Vercel injeta
 * automaticamente o secret configurado nas Env Vars no header).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { autenticarViaEnv, listarBatidas, type SecullumBatida } from '@/lib/ponto/secullum'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function onlyDigits(s: string | null | undefined): string {
  return (s || '').replace(/\D/g, '')
}

function parseBatida(b: SecullumBatida): { data: string; hora: string } | null {
  if (b.data && b.hora) return { data: b.data.slice(0, 10), hora: b.hora.slice(0, 5) }
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

function parseFonteDados(b: SecullumBatida): { tipo: number | null; origem: number | null } {
  const fd = (b as any).FonteDados ?? (b as any).fonteDados ?? null
  if (!fd) return { tipo: null, origem: null }
  return {
    tipo: typeof fd.Tipo === 'number' ? fd.Tipo : (typeof fd.tipo === 'number' ? fd.tipo : null),
    origem: typeof fd.Origem === 'number' ? fd.Origem : (typeof fd.origem === 'number' ? fd.origem : null),
  }
}

function ontem(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  // Validação do segredo do cron
  const auth = req.headers.get('authorization')
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json({ error: 'CRON_SECRET não configurado no ambiente' }, { status: 500 })
  }
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const data = ontem()
  const supabase = createServerClient()

  // Log inicial
  const { data: logRow } = await supabase.from('ponto_sync_log').insert({
    periodo_inicio: data,
    periodo_fim: data,
    trigger: 'cron',
    status: 'running',
  }).select().single()
  const logId = logRow?.id as string | undefined
  const finishLog = async (patch: Record<string, any>) => {
    if (logId) await supabase.from('ponto_sync_log').update({ ...patch, finished_at: new Date().toISOString() }).eq('id', logId)
  }

  // 1. Autentica + busca batidas
  let session, batidas: SecullumBatida[]
  try {
    session = await autenticarViaEnv()
    batidas = await listarBatidas(session, { dataInicio: data, dataFim: data })
  } catch (e: any) {
    await finishLog({ status: 'error', erro: e?.message || String(e) })
    return NextResponse.json({ error: e?.message || 'Erro sync cron' }, { status: 502 })
  }

  if (batidas.length === 0) {
    await finishLog({ status: 'ok', total_batidas: 0 })
    return NextResponse.json({ ok: true, data, total_batidas: 0, mensagem: 'Nenhuma batida ontem' })
  }

  // 2. Mapeia CPF/PIS
  const cpfs = Array.from(new Set(batidas.map(b => onlyDigits(b.funcionarioCpf || (b as any).cpf)).filter(Boolean)))
  const pisList = Array.from(new Set(batidas.map(b => onlyDigits(b.funcionarioPis || (b as any).pis)).filter(Boolean)))
  const cpfToFunc = new Map<string, string>()
  const pisToFunc = new Map<string, string>()
  if (cpfs.length > 0) {
    const { data: fs } = await supabase.from('funcionarios').select('id,cpf').in('cpf', cpfs)
    ;(fs || []).forEach((f: any) => { if (f.cpf) cpfToFunc.set(onlyDigits(f.cpf), f.id) })
  }
  if (pisList.length > 0) {
    const { data: fs } = await supabase.from('funcionarios').select('id,pis').in('pis', pisList)
    ;(fs || []).forEach((f: any) => { if (f.pis) pisToFunc.set(onlyDigits(f.pis), f.id) })
  }

  // 3. Rows
  const rows: any[] = []
  const seqMap = new Map<string, number>()
  let ignoradas = 0, semMatch = 0
  for (const b of batidas) {
    const p = parseBatida(b)
    if (!p) { ignoradas++; continue }
    const cpf = onlyDigits(b.funcionarioCpf || (b as any).cpf)
    const pis = onlyDigits(b.funcionarioPis || (b as any).pis)
    const funcId = (cpf && cpfToFunc.get(cpf)) || (pis && pisToFunc.get(pis)) || null
    if (!funcId) { semMatch++; continue }
    const key = `${funcId}|${p.data}|${p.hora}`
    const seq = (seqMap.get(key) || 0) + 1
    seqMap.set(key, seq)
    const { tipo, origem: fo } = parseFonteDados(b)
    rows.push({
      funcionario_id: funcId,
      data: p.data,
      hora: p.hora,
      sequencia: seq,
      origem: 'secullum_api',
      origem_id: b.id != null ? String(b.id) : null,
      payload_cru: b,
      fonte_tipo: tipo,
      fonte_origem: fo,
    })
  }

  // 4. Upsert
  let novas = 0
  const erros: string[] = []
  if (rows.length > 0) {
    const { error, count } = await supabase.from('ponto_marcacoes').upsert(rows, {
      onConflict: 'funcionario_id,data,hora,sequencia',
      ignoreDuplicates: true,
      count: 'exact',
    })
    if (error) erros.push(error.message)
    else novas = count || 0
  }

  // 5. Chama o endpoint de cálculo de efetivo (internamente via fetch pra reusar a lógica)
  let efetivoOk = false
  let efetivoMsg = ''
  try {
    const origin = req.headers.get('x-forwarded-host')
      ? `https://${req.headers.get('x-forwarded-host')}`
      : new URL(req.url).origin
    const r = await fetch(`${origin}/api/ponto/calcular-efetivo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cron-secret': expected },
      body: JSON.stringify({ dataInicio: data, dataFim: data }),
    })
    const j = await r.json()
    efetivoOk = !!j.ok
    efetivoMsg = j.mensagem || `${j.criados_ou_atualizados ?? 0} dia(s) processado(s)`
  } catch (e: any) {
    efetivoMsg = 'falha no cálculo: ' + (e?.message || String(e))
  }

  const status = erros.length === 0 && efetivoOk ? 'ok' : 'error'
  await finishLog({
    status,
    total_batidas: batidas.length,
    novas,
    ignoradas,
    sem_match: semMatch,
    erro: erros.length > 0 ? erros.join('; ') : (efetivoOk ? null : efetivoMsg),
  })

  return NextResponse.json({
    ok: status === 'ok',
    data,
    total_batidas: batidas.length,
    novas,
    ignoradas,
    sem_match: semMatch,
    efetivo_calculado: efetivoOk,
    efetivo_mensagem: efetivoMsg,
    erros,
  })
}
