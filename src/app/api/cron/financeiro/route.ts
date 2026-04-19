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
  let geradas = 0, alertas = 0, atrasos = 0

  // ETAPA A — Gerar próximas ocorrências recorrentes
  const { data: recorrentes } = await supabase
    .from('financeiro_lancamentos')
    .select('*')
    .eq('is_recorrente', true)
    .is('recorrencia_pai_id', null)
    .is('deleted_at', null)

  for (const pai of (recorrentes ?? [])) {
    // Calcular próxima data
    const freq = pai.frequencia || 'mensal'
    const intervalo = freq === 'semanal' ? 7 : freq === 'quinzenal' ? 15 : freq === 'anual' ? 365 : 30

    // Buscar última ocorrência gerada
    const { data: filhos } = await supabase
      .from('financeiro_lancamentos')
      .select('data_vencimento')
      .eq('recorrencia_pai_id', pai.id)
      .is('deleted_at', null)
      .order('data_vencimento', { ascending: false })
      .limit(1)

    const ultimaData = filhos?.[0]?.data_vencimento || pai.data_vencimento
    const proxDate = new Date(ultimaData)
    proxDate.setDate(proxDate.getDate() + intervalo)
    const proxStr = proxDate.toISOString().split('T')[0]

    // Só gerar se próxima data <= hoje + 30 dias
    const limite = new Date()
    limite.setDate(limite.getDate() + 30)
    if (proxDate > limite) continue

    // Verificar se fim de recorrência
    if (pai.data_fim_recorrencia && proxStr > pai.data_fim_recorrencia) continue

    // Verificar se já existe
    const { data: existe } = await supabase
      .from('financeiro_lancamentos')
      .select('id')
      .eq('recorrencia_pai_id', pai.id)
      .eq('data_vencimento', proxStr)
      .is('deleted_at', null)
      .maybeSingle()
    if (existe) continue

    // Criar nova ocorrência
    const { error } = await supabase.from('financeiro_lancamentos').insert({
      obra_id: pai.obra_id,
      tipo: pai.tipo,
      nome: pai.nome,
      categoria: pai.categoria,
      valor: pai.valor_previsto || pai.valor,
      valor_previsto: pai.valor_previsto || pai.valor,
      status: 'em_aberto',
      status_aprovacao: 'pendente_confirmacao',
      data_competencia: proxStr.slice(0, 7) + '-01',
      data_vencimento: proxStr,
      origem: 'recorrencia',
      recorrencia_pai_id: pai.id,
      is_recorrente: false,
      gerado_automaticamente: true,
      centro_custo_id: pai.centro_custo_id,
      fornecedor: pai.fornecedor,
      alertar_dias_antes: pai.alertar_dias_antes,
      variacao_max_pct: pai.variacao_max_pct,
      juros_dia_padrao_pct: pai.juros_dia_padrao_pct,
      multa_padrao_pct: pai.multa_padrao_pct,
    })
    if (!error) geradas++
  }

  // ETAPA B — Alertar vencimentos próximos
  const { data: proxVencimentos } = await supabase
    .from('financeiro_lancamentos')
    .select('id, nome, valor, categoria, data_vencimento, alertar_dias_antes, fornecedor')
    .eq('status', 'em_aberto')
    .is('deleted_at', null)
    .gte('data_vencimento', hoje)
    .lte('data_vencimento', new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0])

  const { data: destinatarios } = await supabase
    .from('profiles')
    .select('user_id')
    .in('role', ['financeiro', 'admin'])
    .eq('ativo', true)

  for (const lanc of (proxVencimentos ?? [])) {
    const { data: jaAlertado } = await supabase
      .from('notificacoes')
      .select('id')
      .eq('ref_tabela', 'financeiro_lancamentos')
      .eq('ref_id', lanc.id)
      .eq('tipo', 'alerta_vencimento')
      .maybeSingle()
    if (jaAlertado) continue

    const dias = Math.ceil((new Date(lanc.data_vencimento).getTime() - Date.now()) / 86400000)
    for (const dest of (destinatarios ?? [])) {
      await supabase.from('notificacoes').insert({
        destinatario_id: dest.user_id,
        tipo: 'alerta_vencimento',
        titulo: `${lanc.fornecedor || lanc.categoria} vence em ${dias} dia(s)`,
        mensagem: `${lanc.nome} · R$ ${Number(lanc.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} · ${lanc.categoria}`,
        ref_tabela: 'financeiro_lancamentos',
        ref_id: lanc.id,
      })
      alertas++
    }
  }

  // ETAPA C — Detectar atrasos
  const { data: atrasados } = await supabase
    .from('financeiro_lancamentos')
    .select('id, nome, valor, data_vencimento, fornecedor, categoria, juros_dia_padrao_pct, multa_padrao_pct')
    .eq('status', 'em_aberto')
    .is('deleted_at', null)
    .lt('data_vencimento', hoje)

  for (const lanc of (atrasados ?? [])) {
    const diasAtraso = Math.ceil((Date.now() - new Date(lanc.data_vencimento).getTime()) / 86400000)
    await supabase.from('financeiro_lancamentos').update({ dias_atraso: diasAtraso }).eq('id', lanc.id)

    const { data: jaAlertado } = await supabase
      .from('notificacoes')
      .select('id')
      .eq('ref_tabela', 'financeiro_lancamentos')
      .eq('ref_id', lanc.id)
      .eq('tipo', 'alerta_atraso')
      .maybeSingle()
    if (jaAlertado) continue

    const jurosSugerido = Number(lanc.valor) * (Number(lanc.juros_dia_padrao_pct) || 0.033) / 100 * diasAtraso
    const multaSugerida = Number(lanc.valor) * (Number(lanc.multa_padrao_pct) || 2) / 100

    for (const dest of (destinatarios ?? [])) {
      await supabase.from('notificacoes').insert({
        destinatario_id: dest.user_id,
        tipo: 'alerta_atraso',
        titulo: `${lanc.fornecedor || lanc.categoria} atrasado há ${diasAtraso} dia(s)`,
        mensagem: `${lanc.nome} · R$ ${Number(lanc.valor).toFixed(2)} · Juros: R$ ${jurosSugerido.toFixed(2)} + Multa: R$ ${multaSugerida.toFixed(2)}`,
        ref_tabela: 'financeiro_lancamentos',
        ref_id: lanc.id,
      })
      atrasos++
    }
  }

  return NextResponse.json({ geradas, alertas, atrasos, timestamp: new Date().toISOString() })
}
