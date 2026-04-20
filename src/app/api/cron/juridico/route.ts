import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // Auth: Vercel cron header or Bearer token
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')
  const vercelCron = req.headers.get('x-vercel-cron')

  if (!vercelCron && (!cronSecret || !authHeader?.includes(cronSecret))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const hoje = new Date().toISOString().split('T')[0]
  const em7dias = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
  const em1dia = new Date(Date.now() + 1 * 86400000).toISOString().split('T')[0]
  const ha90dias = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0]
  const ha30dias = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]

  const stats = { audiencia_7d: 0, audiencia_1d: 0, parcela_7d: 0, sem_movimentacao: 0, prognostico: 0, inadimplente: 0 }

  // Get juridico destinatarios
  const { data: destinatarios } = await supabase
    .from('profiles')
    .select('user_id')
    .in('role', ['juridico', 'admin'])
    .eq('ativo', true)

  const dests = destinatarios ?? []

  // A) Audiência em 7 dias
  const { data: audiencias7d } = await supabase
    .from('processo_audiencias')
    .select('id, data_audiencia, tipo, processo_id, processos_juridicos:processo_id(parte_contraria)')
    .eq('status', 'agendada')
    .gte('data_audiencia', hoje)
    .lte('data_audiencia', em7dias + 'T23:59:59')

  for (const aud of (audiencias7d ?? [])) {
    const { data: ja } = await supabase
      .from('notificacoes')
      .select('id')
      .eq('ref_tabela', 'processo_audiencias')
      .eq('ref_id', aud.id)
      .eq('tipo', 'audiencia_proxima')
      .maybeSingle()
    if (ja) continue

    const dias = Math.ceil((new Date(aud.data_audiencia).getTime() - Date.now()) / 86400000)
    const parte = (aud as any).processos_juridicos?.parte_contraria || 'Processo'
    for (const dest of dests) {
      await supabase.from('notificacoes').insert({
        destinatario_id: dest.user_id,
        tipo: 'audiencia_proxima',
        titulo: `Audiência (${aud.tipo}) em ${dias} dia(s)`,
        mensagem: `${parte} · ${new Date(aud.data_audiencia).toLocaleDateString('pt-BR')}`,
        ref_tabela: 'processo_audiencias',
        ref_id: aud.id,
      })
      stats.audiencia_7d++
    }
  }

  // B) Audiência em 1 dia (urgente)
  const { data: audiencias1d } = await supabase
    .from('processo_audiencias')
    .select('id, data_audiencia, tipo, processo_id, processos_juridicos:processo_id(parte_contraria)')
    .eq('status', 'agendada')
    .gte('data_audiencia', hoje)
    .lte('data_audiencia', em1dia + 'T23:59:59')

  for (const aud of (audiencias1d ?? [])) {
    const { data: ja } = await supabase
      .from('notificacoes')
      .select('id')
      .eq('ref_tabela', 'processo_audiencias')
      .eq('ref_id', aud.id)
      .eq('tipo', 'audiencia_urgente')
      .maybeSingle()
    if (ja) continue

    const parte = (aud as any).processos_juridicos?.parte_contraria || 'Processo'
    for (const dest of dests) {
      await supabase.from('notificacoes').insert({
        destinatario_id: dest.user_id,
        tipo: 'audiencia_urgente',
        titulo: `URGENTE: Audiência amanhã (${aud.tipo})`,
        mensagem: `${parte} · ${new Date(aud.data_audiencia).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`,
        ref_tabela: 'processo_audiencias',
        ref_id: aud.id,
      })
      stats.audiencia_1d++
    }
  }

  // C) Parcela acordo vencendo em 7 dias
  const { data: parcelasProx } = await supabase
    .from('financeiro_lancamentos')
    .select('id, nome, valor, data_vencimento')
    .eq('origem', 'juridico_acordo')
    .eq('status', 'em_aberto')
    .gte('data_vencimento', hoje)
    .lte('data_vencimento', em7dias)

  for (const parc of (parcelasProx ?? [])) {
    const { data: ja } = await supabase
      .from('notificacoes')
      .select('id')
      .eq('ref_tabela', 'financeiro_lancamentos')
      .eq('ref_id', parc.id)
      .eq('tipo', 'acordo_parcela_proxima')
      .maybeSingle()
    if (ja) continue

    const dias = Math.ceil((new Date(parc.data_vencimento).getTime() - Date.now()) / 86400000)
    for (const dest of dests) {
      await supabase.from('notificacoes').insert({
        destinatario_id: dest.user_id,
        tipo: 'acordo_parcela_proxima',
        titulo: `Parcela acordo vence em ${dias} dia(s)`,
        mensagem: `${parc.nome} · R$ ${Number(parc.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        ref_tabela: 'financeiro_lancamentos',
        ref_id: parc.id,
      })
      stats.parcela_7d++
    }
  }

  // D) Processo sem movimentação 90+ dias
  const { data: processosSemMov } = await supabase
    .from('processos_juridicos')
    .select('id, parte_contraria, numero_cnj, updated_at')
    .eq('status', 'ativo')
    .lt('updated_at', ha90dias)

  for (const proc of (processosSemMov ?? [])) {
    const { data: ja } = await supabase
      .from('notificacoes')
      .select('id')
      .eq('ref_tabela', 'processos_juridicos')
      .eq('ref_id', proc.id)
      .eq('tipo', 'processo_sem_movimentacao')
      .gte('created_at', ha30dias)
      .maybeSingle()
    if (ja) continue

    for (const dest of dests) {
      await supabase.from('notificacoes').insert({
        destinatario_id: dest.user_id,
        tipo: 'processo_sem_movimentacao',
        titulo: `Processo sem movimentação há 90+ dias`,
        mensagem: `${proc.parte_contraria || 'Sem parte'} · ${proc.numero_cnj || 'Sem CNJ'}`,
        ref_tabela: 'processos_juridicos',
        ref_id: proc.id,
      })
      stats.sem_movimentacao++
    }
  }

  // E) Prognóstico não avaliado 30+ dias
  const { data: processosSemProg } = await supabase
    .from('processos_juridicos')
    .select('id, parte_contraria, numero_cnj, prognostico_atualizado_em')
    .eq('status', 'ativo')
    .or(`prognostico_atualizado_em.is.null,prognostico_atualizado_em.lt.${ha30dias}`)

  for (const proc of (processosSemProg ?? [])) {
    const { data: ja } = await supabase
      .from('notificacoes')
      .select('id')
      .eq('ref_tabela', 'processos_juridicos')
      .eq('ref_id', proc.id)
      .eq('tipo', 'prognostico_desatualizado')
      .gte('created_at', ha30dias)
      .maybeSingle()
    if (ja) continue

    for (const dest of dests) {
      await supabase.from('notificacoes').insert({
        destinatario_id: dest.user_id,
        tipo: 'prognostico_desatualizado',
        titulo: `Prognóstico desatualizado há 30+ dias`,
        mensagem: `${proc.parte_contraria || 'Sem parte'} · ${proc.numero_cnj || 'Sem CNJ'}`,
        ref_tabela: 'processos_juridicos',
        ref_id: proc.id,
      })
      stats.prognostico++
    }
  }

  // F) Acordo inadimplente 30+ dias atraso
  const { data: parcelasAtrasadas } = await supabase
    .from('financeiro_lancamentos')
    .select('id, nome, valor, data_vencimento, parcela_grupo_id')
    .eq('origem', 'juridico_acordo')
    .eq('status', 'em_aberto')
    .lt('data_vencimento', ha30dias)

  for (const parc of (parcelasAtrasadas ?? [])) {
    const { data: ja } = await supabase
      .from('notificacoes')
      .select('id')
      .eq('ref_tabela', 'financeiro_lancamentos')
      .eq('ref_id', parc.id)
      .eq('tipo', 'acordo_inadimplente')
      .maybeSingle()
    if (ja) continue

    // Mark acordo as inadimplente
    if (parc.parcela_grupo_id) {
      await supabase
        .from('processo_acordos')
        .update({ status: 'inadimplente' })
        .eq('parcela_grupo_id', parc.parcela_grupo_id)
    }

    for (const dest of dests) {
      await supabase.from('notificacoes').insert({
        destinatario_id: dest.user_id,
        tipo: 'acordo_inadimplente',
        titulo: `Acordo inadimplente — parcela atrasada 30+ dias`,
        mensagem: `${parc.nome} · R$ ${Number(parc.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        ref_tabela: 'financeiro_lancamentos',
        ref_id: parc.id,
      })
      stats.inadimplente++
    }
  }

  return NextResponse.json({ ok: true, stats, timestamp: new Date().toISOString() })
}
