import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'
import RefreshButton from './RefreshButton'
import { Target, DollarSign, AlertTriangle, Users, Calendar, ArrowRight } from 'lucide-react'

const fmt = (v: any) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtK = (v: any) => fmt(v) // valores completos, sem abreviação

export default async function DiretoriaPage() {
  const supabase = createClient()

  // === FETCH ALL DATA IN PARALLEL ===
  const hoje = new Date()
  const hojeStr = hoje.toISOString().slice(0, 10)
  const em30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  const mesInicio = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`
  const ha90d = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)

  const [
    { data: dreMes }, { data: dre }, { data: cashflow }, { data: alertas },
    { data: rescPendentes }, { data: rescMes }, { data: rescPrevistas },
    { data: obrasAtivas }, { data: contasSaldo }, { data: lancamentos },
    { data: funcAtivos }, { data: pontoMes }, { data: bmsAprovados },
    { data: bmItensAll }, { data: funcoes }, { data: desligados90 },
    { data: receitasAbertas }, { data: prazosLegais }, { data: bmsMesAtual }, { data: billingRates }, { data: folhasFechadas },
  ] = await Promise.all([
    supabase.from('vw_dre_obra_mes').select('*').limit(500),
    supabase.from('vw_dre_obra').select('*').limit(500),
    supabase.from('vw_cashflow_projetado').select('*').limit(500),
    supabase.from('vw_alertas').select('*').order('dias_restantes').limit(20),
    supabase.from('rescisoes').select('*, funcionarios(nome)').in('status', ['rascunho', 'homologada']).is('deleted_at', null),
    supabase.from('vw_rescisoes_mes').select('*').limit(12),
    supabase.from('vw_rescisoes_previstas').select('*').limit(100),
    supabase.from('obras').select('*').eq('status', 'ativo').is('deleted_at', null),
    supabase.from('vw_contas_saldo').select('*'),
    supabase.from('financeiro_lancamentos').select('id, tipo, valor, status, is_provisao, data_vencimento').is('deleted_at', null).limit(5000),
    supabase.from('funcionarios').select('id, nome, cargo, status, salario_base, vt_mensal, vr_diario, va_mensal, funcao_id, deleted_at').is('deleted_at', null),
    supabase.from('ponto_marcacoes').select('funcionario_id, data').gte('data', mesInicio).lte('data', hojeStr),
    supabase.from('boletins_medicao').select('id, numero, valor_aprovado, created_at, aprovado_em, obra_id, data_inicio, data_fim').eq('status', 'aprovado').is('deleted_at', null),
    supabase.from('bm_itens').select('boletim_id, hh_total, funcao_nome'),
    supabase.from('funcoes').select('id, nome, custo_hora, salario_base, jornada_horas_mes, ativo').eq('ativo', true),
    supabase.from('funcionarios').select('id').gte('deleted_at', ha90d),
    // Queries for "Decisões Pendentes"
    supabase.from('financeiro_lancamentos').select('id, valor, data_vencimento').eq('tipo', 'receita').neq('status', 'pago').is('deleted_at', null),
    supabase.from('vw_prazos_legais').select('funcionario_id, nome, alerta_tipo, prazo_experiencia_2').limit(100),
    supabase.from('boletins_medicao').select('id').gte('data_inicio', mesInicio).is('deleted_at', null),
    supabase.from('contrato_composicao').select('funcao_nome, custo_hora_contratado').eq('ativo', true),
    supabase.from('folha_fechamentos').select('valor_total_bruto, valor_total_encargos, valor_total_beneficios, valor_total').is('deleted_at', null),
  ])

  const funcs = funcAtivos ?? []
  const obra = (obrasAtivas ?? [])[0]
  const MESES = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

  // === SEÇÃO 1: SAÚDE FINANCEIRA ===
  // Receita real: dos lançamentos financeiros (BMs aprovados geram lançamentos)
  const totReceita = (lancamentos ?? []).filter((l: any) => l.tipo === 'receita').reduce((s: number, l: any) => s + Number(l.valor), 0)
  // Custo MO: da view DRE (baseada em ponto/faltas reais)
  const totCusto = (folhasFechadas ?? []).reduce((s: number, f: any) => s + Number(f.valor_total || 0), 0)
  const margemBruta = totReceita - totCusto
  const margemPct = totReceita > 0 ? (margemBruta / totReceita * 100) : 0
  const alvoMedio = (dre ?? []).length > 0 ? (dre ?? []).reduce((s: number, o: any) => s + Number(o.margem_alvo_pct || 0), 0) / (dre ?? []).length : 25
  const margemOk = margemPct >= alvoMedio

  // 3 Margens para o card
  const custoFolhaSemProv = (folhasFechadas ?? []).reduce((s: number, f: any) => s + Number(f.valor_total_bruto || 0) + Number(f.valor_total_encargos || 0) + Number(f.valor_total_beneficios || 0), 0)
  const custoFolhaComProv = (folhasFechadas ?? []).reduce((s: number, f: any) => s + Number(f.valor_total || 0), 0)
  const margemRealDir = totReceita > 0 ? ((totReceita - custoFolhaSemProv) / totReceita * 100) : null
  const margemRealProvDir = totReceita > 0 ? ((totReceita - custoFolhaComProv) / totReceita * 100) : null
  // Margem teórica: da view breakeven
  const margemTeoricaDir = (dre ?? []).length > 0 ? Number((dre ?? [])[0]?.margem_pct || 0) : null

  const cf30 = (cashflow ?? []).filter((e: any) => e.data >= hojeStr && e.data <= em30)
  // Separar dados REAIS (lançamentos) de PROJEÇÕES (forecast/folha estimada)
  const cf30Reais = cf30.filter((e: any) => e.origem === 'lancamento')
  const cf30Projetados = cf30.filter((e: any) => e.origem !== 'lancamento')
  const entrada30 = cf30Reais.filter((e: any) => Number(e.valor) > 0).reduce((s: number, e: any) => s + Number(e.valor), 0)
  const saida30 = cf30Reais.filter((e: any) => Number(e.valor) < 0).reduce((s: number, e: any) => s + Number(e.valor), 0)
  const entradaProj = cf30Projetados.filter((e: any) => Number(e.valor) > 0).reduce((s: number, e: any) => s + Number(e.valor), 0)
  const saidaProj = cf30Projetados.filter((e: any) => Number(e.valor) < 0).reduce((s: number, e: any) => s + Number(e.valor), 0)
  const saldoContas = (contasSaldo ?? []).reduce((s: number, c: any) => s + Number(c.saldo || 0), 0)
  // BMs a receber nos próximos 30 dias
  const receitaProx30 = (lancamentos ?? []).filter((l: any) => l.tipo === 'receita' && l.status !== 'pago' && l.data_vencimento && l.data_vencimento >= hojeStr && l.data_vencimento <= em30).reduce((s: number, l: any) => s + Number(l.valor), 0)
  const saldo30 = saldoContas + entrada30 + saida30 + entradaProj + saidaProj + receitaProx30
  const saldo30Ok = saldo30 >= 0
  const temDadosReais = entrada30 !== 0 || saida30 !== 0 || receitaProx30 > 0

  const receitaPaga = (lancamentos ?? []).filter((l: any) => l.tipo === 'receita' && l.status === 'pago').reduce((s: number, l: any) => s + Number(l.valor), 0)
  const receitaAberto = (lancamentos ?? []).filter((l: any) => l.tipo === 'receita' && l.status === 'em_aberto').reduce((s: number, l: any) => s + Number(l.valor), 0)
  const despesaPaga = (lancamentos ?? []).filter((l: any) => l.tipo === 'despesa' && !l.is_provisao && l.status === 'pago').reduce((s: number, l: any) => s + Number(l.valor), 0)
  const despesaAberto = (lancamentos ?? []).filter((l: any) => l.tipo === 'despesa' && !l.is_provisao && l.status === 'em_aberto').reduce((s: number, l: any) => s + Number(l.valor), 0)
  const provisoes = (lancamentos ?? []).filter((l: any) => l.tipo === 'despesa' && l.is_provisao).reduce((s: number, l: any) => s + Number(l.valor), 0)
  const resultadoTotal = (receitaPaga + receitaAberto) - (despesaPaga + despesaAberto + provisoes)

  const proxContrato = (obrasAtivas ?? []).filter((o: any) => o.data_prev_fim).sort((a: any, b: any) => a.data_prev_fim.localeCompare(b.data_prev_fim))[0]
  const diasParaFim = proxContrato ? Math.ceil((new Date(proxContrato.data_prev_fim).getTime() - Date.now()) / 86400000) : null

  // === SEÇÃO CONTRATO: KPIs ===
  const diasUteisMes = obra?.dias_uteis_mes || 21
  const bmIds = new Set((bmsAprovados ?? []).map((b: any) => b.id))
  const itensBmAprovados = (bmItensAll ?? []).filter((i: any) => bmIds.has(i.boletim_id))
  const receitaBmTotal = (bmsAprovados ?? []).reduce((s: number, b: any) => s + Number(b.valor_aprovado || 0), 0)

  // === SEÇÃO 3: EQUIPE ===
  const alocados = funcs.filter((f: any) => f.status === 'alocado').length
  const disponiveis = funcs.filter((f: any) => f.status === 'disponivel').length
  const turnover90 = funcs.length > 0 ? ((desligados90 ?? []).length / funcs.length * 100) : 0
  const alertasExp = (alertas ?? []).filter((a: any) => a.tipo?.includes('experiencia')).length
  const alertasTotal = (alertas ?? []).length

  // === SEÇÃO 4: CONTRATO ATIVO ===
  const hhConsumidas = itensBmAprovados.reduce((s: number, i: any) => s + Number(i.hh_total || 0), 0)
  const hhContratadas = obra?.hh_contratados || 0
  const pctHH = hhContratadas > 0 ? (hhConsumidas / hhContratadas * 100) : 0
  const receitaRealizada = receitaBmTotal
  const valorContrato = Number(obra?.valor_contrato || 0)
  const pctReceita = valorContrato > 0 ? (receitaRealizada / valorContrato * 100) : 0

  // Margem por função — usar billing rate do contrato (não funcoes.custo_hora)
  const funcMap = new Map((funcoes ?? []).map((fn: any) => [fn.id, fn]))
  const billingMap: Record<string, number[]> = {}
  ;(billingRates ?? []).forEach((b: any) => {
    const nome = (b.funcao_nome || '').toUpperCase().trim()
    if (!billingMap[nome]) billingMap[nome] = []
    billingMap[nome].push(Number(b.custo_hora_contratado || 0))
  })
  const billingMediaMap: Record<string, number> = {}
  Object.entries(billingMap).forEach(([k, vals]) => {
    billingMediaMap[k] = vals.reduce((a, b) => a + b, 0) / vals.length
  })

  const margemFuncao: { nome: string; hc: number; venda: number; custo: number; margem: number }[] = []
  const byFuncao: Record<string, any[]> = {}
  funcs.forEach((f: any) => { if (f.funcao_id) { if (!byFuncao[f.funcao_id]) byFuncao[f.funcao_id] = []; byFuncao[f.funcao_id].push(f) } })
  Object.entries(byFuncao).forEach(([fid, fs]) => {
    const fn = funcMap.get(fid)
    if (!fn) return
    const nomeFn = (fn.nome || '').toUpperCase().trim()
    const billingHH = billingMediaMap[nomeFn] || 0
    if (!billingHH) return
    const avgSal = fs.reduce((s: number, f: any) => s + Number(f.salario_base || 0), 0) / fs.length
    const custoR = (avgSal * 1.72) / (fn.jornada_horas_mes || 220)
    const marg = billingHH > 0 ? ((billingHH - custoR) / billingHH * 100) : 0
    margemFuncao.push({ nome: fn.nome, hc: fs.length, venda: Math.round(billingHH * 100) / 100, custo: Math.round(custoR * 100) / 100, margem: Math.round(marg * 10) / 10 })
  })
  margemFuncao.sort((a, b) => b.margem - a.margem)

  // === DECISÕES PENDENTES ===
  // Contratos sem decisão de renovação
  const contratosPendentes = (prazosLegais ?? [])
    .filter((p: any) => p.alerta_tipo === 'experiencia_2_vencendo')
    .map((p: any) => ({ ...p, dias: p.prazo_experiencia_2 ? Math.ceil((new Date(p.prazo_experiencia_2).getTime() - Date.now()) / 86400000) : 99 }))
    .sort((a: any, b: any) => a.dias - b.dias)
    .slice(0, 5)

  // Obra encerrando
  const obraEncerrando = (obrasAtivas ?? []).find((o: any) => o.data_prev_fim && Math.ceil((new Date(o.data_prev_fim).getTime() - Date.now()) / 86400000) <= 45)
  const diasObraEncerrando = obraEncerrando ? Math.ceil((new Date(obraEncerrando.data_prev_fim).getTime() - Date.now()) / 86400000) : null

  // BM do mês atual não criado
  const bmMesAtualCriado = (bmsMesAtual ?? []).length > 0
  const diaAtual = hoje.getDate()

  // Receita em aberto com próximo vencimento
  const receitasOrdenadas = (receitasAbertas ?? []).filter((r: any) => r.data_vencimento).sort((a: any, b: any) => a.data_vencimento.localeCompare(b.data_vencimento))
  const proxVencimentoReceita = receitasOrdenadas[0]?.data_vencimento || null

  // Alertas breakdown
  const alertasPorTipo: Record<string, number> = {}
  ;(alertas ?? []).forEach((a: any) => {
    const t = (a.tipo || '').includes('experiencia') ? 'contratos' : (a.tipo || '').includes('aso') ? 'asos' : (a.tipo || '').includes('nr') ? 'nrs' : 'outros'
    alertasPorTipo[t] = (alertasPorTipo[t] || 0) + 1
  })

  // === HELPERS ===
  function colorPct(v: number, green: number, amber: number) {
    if (v >= green) return 'text-green-700'
    if (v >= amber) return 'text-amber-700'
    return 'text-red-700'
  }
  function bgPct(v: number, green: number, amber: number) {
    if (v >= green) return 'bg-green-500'
    if (v >= amber) return 'bg-amber-500'
    return 'bg-red-500'
  }

  const kpiCards = [
    { label: 'Receita recebida', value: receitaPaga, color: 'text-green-600', bg: 'bg-green-50', hover: 'hover:bg-green-100', href: '/financeiro?tab=lancamentos&tipo=receita&status=pago' },
    { label: 'Receita em aberto', value: receitaAberto, color: 'text-emerald-600', bg: 'bg-emerald-50', hover: 'hover:bg-emerald-100', href: '/financeiro?tab=lancamentos&tipo=receita&status=em_aberto',
      sub: proxVencimentoReceita ? (proxVencimentoReceita < hojeStr ? `Vencido em ${new Date(proxVencimentoReceita + 'T12:00').toLocaleDateString('pt-BR')}` : `Vence em ${new Date(proxVencimentoReceita + 'T12:00').toLocaleDateString('pt-BR')}`) : undefined,
      subColor: proxVencimentoReceita && proxVencimentoReceita < hojeStr ? 'text-red-600' : 'text-gray-400' },
    { label: 'Despesa paga', value: despesaPaga, color: 'text-red-600', bg: 'bg-red-50', hover: 'hover:bg-red-100', href: '/financeiro?tab=lancamentos&tipo=despesa&status=pago' },
    { label: 'Despesa em aberto', value: despesaAberto, color: 'text-orange-600', bg: 'bg-orange-50', hover: 'hover:bg-orange-100', href: '/financeiro?tab=lancamentos&tipo=despesa&status=em_aberto' },
    { label: 'Provisões futuras', value: provisoes, color: 'text-purple-600', bg: 'bg-purple-50', hover: 'hover:bg-purple-100', href: '/financeiro?tab=lancamentos&is_provisao=true' },
    { label: 'Resultado total', value: resultadoTotal, color: resultadoTotal >= 0 ? 'text-green-700' : 'text-red-700', bg: resultadoTotal >= 0 ? 'bg-green-50' : 'bg-red-50', hover: resultadoTotal >= 0 ? 'hover:bg-green-100' : 'hover:bg-red-100', href: '/financeiro/dre' },
  ]

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div />
        <RefreshButton />
      </div>

      {/* ══════ SEÇÃO 1: SAÚDE FINANCEIRA ══════ */}
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Saúde Financeira</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <Link href="/rh/rentabilidade" title="Ver análise de margem"
          className={`block rounded-2xl shadow-sm border p-5 transition-shadow hover:shadow-md ${margemOk ? 'bg-gradient-to-br from-green-50 to-white border-green-200' : 'bg-gradient-to-br from-red-50 to-white border-red-200'}`}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Margem Real Acumulada</div>
              <div className={`text-4xl font-bold font-display mt-1 ${totReceita === 0 ? 'text-gray-300' : margemOk ? 'text-green-700' : 'text-red-700'}`}>{totReceita > 0 ? `${margemPct.toFixed(1)}%` : '—'}</div>
              <div className="text-xs text-gray-500 mt-1">{totReceita > 0 ? `Alvo: ${alvoMedio.toFixed(0)}% · Resultado: ${fmt(margemBruta)}` : 'Nenhum faturamento registrado ainda'}</div>
            </div>
            <Target className={`w-8 h-8 ${margemOk ? 'text-green-500' : 'text-red-500'}`} />
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${margemOk ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: `${Math.min(margemPct / alvoMedio * 100, 100)}%` }} />
          </div>
          <div className="mt-3 text-xs text-gray-500 flex justify-between">
            <span>Receita: <strong>{fmtK(totReceita)}</strong></span>
            <span>Custo MO: <strong>{fmtK(totCusto)}</strong></span>
          </div>
          {/* 3 Margens pills */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {margemTeoricaDir != null && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold" title="Billing rate vs custo projetado">Teórica {margemTeoricaDir.toFixed(0)}%</span>}
            {margemRealDir != null && <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${margemRealDir >= 20 ? 'bg-green-50 text-green-700' : margemRealDir >= 10 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`} title="Receita BMs − folha sem provisões">Real {margemRealDir.toFixed(1)}%</span>}
            {margemRealProvDir != null && <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${margemRealProvDir >= 20 ? 'bg-green-50 text-green-700' : margemRealProvDir >= 10 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`} title="Receita BMs − folha completa c/ provisões">C/Prov {margemRealProvDir.toFixed(1)}%</span>}
          </div>
          <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand">Ver análise de margem <ArrowRight className="w-3 h-3" /></span>
        </Link>

        <Link href="/financeiro/cashflow" title="Ver Fluxo de Caixa"
          className={`block rounded-2xl shadow-sm border p-5 transition-shadow hover:shadow-md ${saldo30Ok ? 'bg-gradient-to-br from-blue-50 to-white border-blue-200' : 'bg-gradient-to-br from-red-50 to-white border-red-200'}`}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Caixa Projetado (30 dias)</div>
              <div className={`text-4xl font-bold font-display mt-1 ${saldo30Ok ? 'text-blue-700' : 'text-red-700'}`}>{fmtK(saldo30)}</div>
              <div className="text-xs text-gray-500 mt-1">Saldo atual: {fmtK(saldoContas)}</div>
            </div>
            <DollarSign className={`w-8 h-8 ${saldo30Ok ? 'text-blue-500' : 'text-red-500'}`} />
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="p-2 bg-white/60 rounded-lg">
              <div className="text-[10px] text-gray-400 font-semibold uppercase">Entradas</div>
              <div className="text-sm font-bold text-green-700">{fmtK(entrada30)}</div>
              {receitaProx30 > 0 && <div className="text-[9px] text-green-600">+{fmt(receitaProx30)} a receber</div>}
              {entradaProj > 0 && <div className="text-[9px] text-gray-400">+{fmt(entradaProj)} projetado</div>}
            </div>
            <div className="p-2 bg-white/60 rounded-lg">
              <div className="text-[10px] text-gray-400 font-semibold uppercase">Saídas</div>
              <div className="text-sm font-bold text-red-700">{fmtK(Math.abs(saida30))}</div>
              {saidaProj < 0 && <div className="text-[9px] text-gray-400">+{fmtK(Math.abs(saidaProj))} estimado</div>}
            </div>
          </div>
          {!temDadosReais && (cf30Projetados.length > 0) && (
            <div className="text-[9px] text-amber-600 mt-2">Valores baseados em projeções (folha estimada). Dados reais aparecem com lançamentos.</div>
          )}
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand">Ver fluxo completo <ArrowRight className="w-3 h-3" /></span>
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        {kpiCards.map((k: any) => (
          <Link key={k.label} href={k.href} className={`${k.bg} ${k.hover} rounded-xl p-3 transition-all hover:shadow-md`}>
            <div className="text-xs text-gray-500 mb-1 leading-tight">{k.label}</div>
            <div className={`text-base font-bold ${k.color}`}>{fmt(k.value)}</div>
            {k.sub && <div className={`text-[10px] mt-0.5 ${k.subColor || 'text-gray-400'}`}>{k.sub}</div>}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
        <Link href="/obras" className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md hover:border-brand/30 transition-all">
          <div className="flex items-center gap-2 mb-1"><Users className="w-4 h-4 text-violet-500" /><span className="text-[10px] font-bold text-gray-400 uppercase">Obras ativas</span></div>
          <div className="text-2xl font-bold text-gray-900 font-display">{(obrasAtivas ?? []).length}</div>
        </Link>
        <Link href="/rh/vencimentos?categoria=contratos" className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md hover:border-brand/30 transition-all">
          <div className="flex items-center gap-2 mb-1"><Calendar className="w-4 h-4 text-amber-500" /><span className="text-[10px] font-bold text-gray-400 uppercase">Próximo fim de contrato</span></div>
          <div className="text-sm font-bold text-gray-900">
            {proxContrato ? (<><div>{proxContrato.nome}</div><div className={`text-xs font-normal ${(diasParaFim ?? 99) <= 30 ? 'text-red-600' : 'text-gray-500'}`}>{diasParaFim !== null ? (diasParaFim >= 0 ? `${diasParaFim} dias` : `vencido há ${-diasParaFim!}d`) : '—'}</div></>) : '—'}
          </div>
        </Link>
        <Link href="/rh/vencimentos" className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md hover:border-brand/30 transition-all">
          <div className="flex items-center gap-2 mb-1"><AlertTriangle className="w-4 h-4 text-red-500" /><span className="text-[10px] font-bold text-gray-400 uppercase">Alertas críticos</span></div>
          <div className="text-2xl font-bold text-red-700 font-display">{alertasTotal}</div>
          <div className="text-[10px] text-gray-500 mt-1">
            {alertasPorTipo.contratos ? `${alertasPorTipo.contratos} contratos` : ''}
            {alertasPorTipo.contratos && (alertasPorTipo.asos || alertasPorTipo.nrs) ? ' · ' : ''}
            {alertasPorTipo.asos ? `${alertasPorTipo.asos} ASOs` : ''}
            {alertasPorTipo.asos && alertasPorTipo.nrs ? ' · ' : ''}
            {alertasPorTipo.nrs ? `${alertasPorTipo.nrs} NRs` : ''}
            {alertasPorTipo.outros ? ` + ${alertasPorTipo.outros} outros` : ''}
          </div>
        </Link>
      </div>

      {/* ══════ SEÇÃO 2: CONTRATO ATIVO ══════ */}
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Contrato Ativo</p>

      {obra ? (
        <Link href={`/obras/${obra.id}`} className="block bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-all mb-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-bold text-gray-900">{obra.nome}</div>
              <div className="text-xs text-gray-500">{obra.cliente} · {obra.numero_contrato || 'Sem nº'}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-green-100 text-green-700">Ativo</span>
              {obra.data_prev_fim && (
                <span className={`text-xs font-semibold ${diasParaFim !== null && diasParaFim <= 30 ? 'text-red-600' : 'text-gray-500'}`}>
                  {diasParaFim !== null ? `${diasParaFim}d restantes` : ''}
                </span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* HH */}
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase mb-2">HH Consumidas</div>
              <div className="text-xl font-bold text-gray-900">{hhConsumidas.toLocaleString('pt-BR')} <span className="text-sm font-normal text-gray-400">/ {hhContratadas > 0 ? hhContratadas.toLocaleString('pt-BR') : 'A definir'}</span></div>
              {hhContratadas > 0 && (
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mt-2">
                  <div className={`h-full rounded-full ${bgPct(100 - pctHH, 50, 20)}`} style={{ width: `${Math.min(pctHH, 100)}%` }} />
                </div>
              )}
              <div className="text-xs text-gray-400 mt-1">{pctHH.toFixed(1)}% consumido</div>
            </div>
            {/* Financeiro */}
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase mb-2">Receita Realizada</div>
              <div className="text-xl font-bold text-green-700">{fmtK(receitaRealizada)} <span className="text-sm font-normal text-gray-400">/ {valorContrato > 0 ? fmtK(valorContrato) : 'A definir'}</span></div>
              {valorContrato > 0 && (
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mt-2">
                  <div className="h-full rounded-full bg-green-500" style={{ width: `${Math.min(pctReceita, 100)}%` }} />
                </div>
              )}
              <div className="text-xs text-gray-400 mt-1">{pctReceita.toFixed(1)}% faturado · Faltam {fmtK(Math.max(0, valorContrato - receitaRealizada))}</div>
            </div>
            {/* Margem por função */}
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase mb-2">Margem por Função</div>
              {margemFuncao.length > 0 ? (
                <table className="w-full text-xs">
                  <thead><tr className="text-gray-400"><th className="text-left pb-1">Função</th><th className="text-center pb-1">Qtd</th><th className="text-right pb-1">R$/HH fat.</th><th className="text-right pb-1">R$/HH custo</th><th className="text-right pb-1">Margem%</th></tr></thead>
                  <tbody>
                    {margemFuncao.slice(0, 6).map(mf => (
                      <tr key={mf.nome} className="border-t border-gray-50">
                        <td className="py-1 font-medium text-gray-700 truncate max-w-[100px]">{mf.nome}</td>
                        <td className="py-1 text-center text-gray-500">{mf.hc}</td>
                        <td className="py-1 text-right text-gray-500">{mf.venda.toFixed(0)}</td>
                        <td className="py-1 text-right text-gray-500">{mf.custo.toFixed(0)}</td>
                        <td className={`py-1 text-right font-bold ${mf.margem >= 20 ? 'text-green-700' : mf.margem >= 0 ? 'text-amber-700' : 'text-red-700'}`}>{mf.margem.toFixed(0)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <div className="text-gray-400 text-xs">Sem dados de custo</div>}
            </div>
          </div>
        </Link>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-10 text-center text-gray-400 text-sm mb-5">
          Nenhum contrato ativo.
        </div>
      )}

      {/* ══════ SEÇÃO 3: EQUIPE ══════ */}
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Equipe</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Link href="/funcionarios" className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-all">
          <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Headcount</div>
          <div className="text-3xl font-bold text-gray-900 font-display">{funcs.length}</div>
          <div className="text-xs text-gray-500 mt-1">{alocados} alocados · {disponiveis} disponíveis</div>
        </Link>
        <Link href="/rh/desligamentos" className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-all">
          <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Turnover 90 dias</div>
          <div className={`text-3xl font-bold font-display ${colorPct(15 - turnover90, 10, 0)}`}>{turnover90.toFixed(1)}%</div>
          <div className="text-xs text-gray-500 mt-1">{(desligados90 ?? []).length} desligado(s) nos últimos 90 dias</div>
        </Link>
        <Link href="/rh/vencimentos" className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-all">
          <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Pendências RH</div>
          <div className="text-2xl font-bold text-red-700 font-display">{alertasTotal}</div>
          <div className="text-xs text-gray-500 mt-1 space-y-0.5">
            {alertasPorTipo.contratos ? <div>{alertasPorTipo.contratos} contrato(s) de experiência</div> : null}
            {(alertasPorTipo.asos || alertasPorTipo.nrs) ? <div>{alertasPorTipo.asos || 0} ASOs · {alertasPorTipo.nrs || 0} NRs</div> : null}
            {alertasPorTipo.outros ? <div>{alertasPorTipo.outros} outro(s)</div> : null}
          </div>
          <span className="text-[10px] text-brand font-semibold mt-2 inline-block">Ver todas →</span>
        </Link>
      </div>

      {/* ══════ SEÇÃO 4: DECISÕES PENDENTES ══════ */}
      {(contratosPendentes.length > 0 || obraEncerrando || (!bmMesAtualCriado && diaAtual >= 15)) && (
        <>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Decisões Pendentes</p>
          <div className="space-y-3 mb-5">
            {contratosPendentes.length > 0 && (
              <Link href="/rh/vencimentos?categoria=contratos"
                className="block bg-white border-l-4 border-l-amber-500 rounded-xl shadow-sm p-5 hover:shadow-md transition-all">
                <div className="text-sm font-bold text-gray-900 mb-1">Decisão de contrato pendente</div>
                <div className="text-xs text-gray-600">
                  {contratosPendentes.map((c: any, i: number) => (
                    <span key={c.funcionario_id}>{i > 0 ? ' · ' : ''}{c.nome?.split(' ')[0]} ({c.dias}d)</span>
                  ))}
                </div>
                <span className="text-xs font-semibold text-brand mt-2 inline-block">Decidir →</span>
              </Link>
            )}
            {obraEncerrando && (
              <Link href={`/obras/${obraEncerrando.id}`}
                className={`block bg-white border-l-4 ${diasObraEncerrando !== null && diasObraEncerrando <= 20 ? 'border-l-red-500' : 'border-l-amber-500'} rounded-xl shadow-sm p-5 hover:shadow-md transition-all`}>
                <div className="text-sm font-bold text-gray-900 mb-1">{obraEncerrando.nome} encerra em {diasObraEncerrando} dias</div>
                <div className="text-xs text-gray-500">Renovação ou encerramento deve ser comunicado ao cliente</div>
                <span className="text-xs font-semibold text-brand mt-2 inline-block">Ver contrato →</span>
              </Link>
            )}
            {!bmMesAtualCriado && diaAtual >= 15 && (
              <Link href="/boletins/nova"
                className="block bg-white border-l-4 border-l-gray-400 rounded-xl shadow-sm p-5 hover:shadow-md transition-all">
                <div className="text-sm font-bold text-gray-900 mb-1">BM do mês atual ainda não foi criado</div>
                <div className="text-xs text-gray-500">Já estamos no dia {diaAtual} — considere criar o BM deste período</div>
                <span className="text-xs font-semibold text-brand mt-2 inline-block">Criar BM →</span>
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  )
}
