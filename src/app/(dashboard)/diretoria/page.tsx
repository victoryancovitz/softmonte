import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'
import RefreshButton from './RefreshButton'
import { Target, DollarSign, AlertTriangle, Users, Calendar, ArrowRight, Clock, Gauge, Receipt, Wallet } from 'lucide-react'

const fmt = (v: any) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtK = (v: any) => {
  const n = Number(v || 0)
  if (Math.abs(n) >= 1000000) return `R$ ${(n / 1000000).toFixed(2)}M`
  if (Math.abs(n) >= 1000) return `R$ ${(n / 1000).toFixed(0)}k`
  return fmt(n)
}

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
    { data: bmsSemNfe }, { data: receitasAbertas },
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
    supabase.from('financeiro_lancamentos').select('id, tipo, valor, status, is_provisao').is('deleted_at', null).limit(5000),
    supabase.from('funcionarios').select('id, nome, cargo, status, salario_base, vt_mensal, vr_diario, va_mensal, funcao_id, deleted_at').is('deleted_at', null),
    supabase.from('ponto_marcacoes').select('funcionario_id, data').gte('data', mesInicio).lte('data', hojeStr),
    supabase.from('boletins_medicao').select('id, numero, valor_aprovado, created_at, aprovado_em, obra_id, data_inicio, data_fim').eq('status', 'aprovado').is('deleted_at', null),
    supabase.from('bm_itens').select('boletim_id, hh_total, funcao_nome'),
    supabase.from('funcoes').select('id, nome, custo_hora, salario_base, jornada_horas_mes, ativo').eq('ativo', true),
    supabase.from('funcionarios').select('id').gte('deleted_at', ha90d),
    // Extra queries for "Atenção Hoje"
    supabase.from('boletins_medicao').select('id, numero, valor_aprovado, aprovado_em, nfe_numero, obra_id').eq('status', 'aprovado').is('nfe_numero', null).is('deleted_at', null),
    supabase.from('financeiro_lancamentos').select('id, valor, data_vencimento').eq('tipo', 'receita').neq('status', 'pago').is('deleted_at', null),
  ])

  const funcs = funcAtivos ?? []
  const obra = (obrasAtivas ?? [])[0]
  const MESES = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

  // === SEÇÃO 1: SAÚDE FINANCEIRA ===
  const totReceita = (dreMes ?? []).reduce((s: number, m: any) => s + Number(m.receita_realizada || m.receita_prevista || 0), 0)
  const totCusto = (dreMes ?? []).reduce((s: number, m: any) => s + Number(m.custo_mo_real || 0), 0)
  const margemBruta = totReceita - totCusto
  const margemPct = totReceita > 0 ? (margemBruta / totReceita * 100) : 0
  const alvoMedio = (dre ?? []).length > 0 ? (dre ?? []).reduce((s: number, o: any) => s + Number(o.margem_alvo_pct || 0), 0) / (dre ?? []).length : 25
  const margemOk = margemPct >= alvoMedio

  const cf30 = (cashflow ?? []).filter((e: any) => e.data >= hojeStr && e.data <= em30)
  const entrada30 = cf30.filter((e: any) => Number(e.valor) > 0).reduce((s: number, e: any) => s + Number(e.valor), 0)
  const saida30 = cf30.filter((e: any) => Number(e.valor) < 0).reduce((s: number, e: any) => s + Number(e.valor), 0)
  const saldoContas = (contasSaldo ?? []).reduce((s: number, c: any) => s + Number(c.saldo || 0), 0)
  const saldo30 = saldoContas + entrada30 + saida30
  const saldo30Ok = saldo30 >= 0

  const receitaPaga = (lancamentos ?? []).filter((l: any) => l.tipo === 'receita' && l.status === 'pago').reduce((s: number, l: any) => s + Number(l.valor), 0)
  const receitaAberto = (lancamentos ?? []).filter((l: any) => l.tipo === 'receita' && l.status === 'em_aberto').reduce((s: number, l: any) => s + Number(l.valor), 0)
  const despesaPaga = (lancamentos ?? []).filter((l: any) => l.tipo === 'despesa' && !l.is_provisao && l.status === 'pago').reduce((s: number, l: any) => s + Number(l.valor), 0)
  const despesaAberto = (lancamentos ?? []).filter((l: any) => l.tipo === 'despesa' && !l.is_provisao && l.status === 'em_aberto').reduce((s: number, l: any) => s + Number(l.valor), 0)
  const provisoes = (lancamentos ?? []).filter((l: any) => l.tipo === 'despesa' && l.is_provisao).reduce((s: number, l: any) => s + Number(l.valor), 0)
  const resultadoTotal = (receitaPaga + receitaAberto) - (despesaPaga + despesaAberto + provisoes)

  const proxContrato = (obrasAtivas ?? []).filter((o: any) => o.data_prev_fim).sort((a: any, b: any) => a.data_prev_fim.localeCompare(b.data_prev_fim))[0]
  const diasParaFim = proxContrato ? Math.ceil((new Date(proxContrato.data_prev_fim).getTime() - Date.now()) / 86400000) : null

  // === SEÇÃO 2: KPIs HH ===
  // KPI 1 — Utilização (presença no mês vs disponível)
  const diasUnicosPonto = new Set((pontoMes ?? []).map((p: any) => `${p.funcionario_id}::${p.data}`)).size
  const cargaDia = obra?.carga_horaria_dia || 8
  const diasUteisMes = obra?.dias_uteis_mes || 21
  const hhRealizadas = diasUnicosPonto * cargaDia
  const hhDisponiveis = funcs.length * diasUteisMes * cargaDia
  const utilizacaoPct = hhDisponiveis > 0 ? (hhRealizadas / hhDisponiveis * 100) : 0

  // KPI 2 — Receita por HH
  const bmIds = new Set((bmsAprovados ?? []).map((b: any) => b.id))
  const itensBmAprovados = (bmItensAll ?? []).filter((i: any) => bmIds.has(i.boletim_id))
  const hhFaturadas = itensBmAprovados.reduce((s: number, i: any) => s + Number(i.hh_total || 0), 0)
  const receitaBmTotal = (bmsAprovados ?? []).reduce((s: number, b: any) => s + Number(b.valor_aprovado || 0), 0)
  const receitaPorHH = hhFaturadas > 0 ? receitaBmTotal / hhFaturadas : 0
  const precoMedioContratado = (() => {
    const fn = (funcoes ?? []).filter((f: any) => f.custo_hora)
    return fn.length > 0 ? fn.reduce((s: number, f: any) => s + Number(f.custo_hora), 0) / fn.length : 0
  })()

  // KPI 3 — Ciclo de aprovação
  const bmsComAprovacao = (bmsAprovados ?? []).filter((b: any) => b.aprovado_em && b.created_at)
  const ciclosAprovacao = bmsComAprovacao.map((b: any) => (new Date(b.aprovado_em).getTime() - new Date(b.created_at).getTime()) / 86400000)
  const cicloMedio = ciclosAprovacao.length > 0 ? ciclosAprovacao.reduce((s, d) => s + d, 0) / ciclosAprovacao.length : null
  const cicloMin = ciclosAprovacao.length > 0 ? Math.min(...ciclosAprovacao) : null
  const cicloMax = ciclosAprovacao.length > 0 ? Math.max(...ciclosAprovacao) : null

  // KPI 4 — Custo real MO
  const custoTotal = funcs.reduce((s: number, f: any) => {
    const sal = Number(f.salario_base || 0)
    const jornada = 220
    const custoHora = (sal * 1.72) / jornada + Number(f.vt_mensal || 0) / jornada + Number(f.vr_diario || 0) * diasUteisMes / jornada + Number(f.va_mensal || 0) / jornada
    return s + custoHora
  }, 0)
  const custoMedioHH = funcs.length > 0 ? custoTotal / funcs.length : 0
  const folhaEncargos = funcs.reduce((s: number, f: any) => s + Number(f.salario_base || 0) * 1.72, 0)
  const margemHH = receitaPorHH - custoMedioHH

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

  // Margem por função
  const funcMap = new Map((funcoes ?? []).map((fn: any) => [fn.id, fn]))
  const margemFuncao: { nome: string; hc: number; venda: number; custo: number; margem: number }[] = []
  const byFuncao: Record<string, any[]> = {}
  funcs.forEach((f: any) => { if (f.funcao_id) { if (!byFuncao[f.funcao_id]) byFuncao[f.funcao_id] = []; byFuncao[f.funcao_id].push(f) } })
  Object.entries(byFuncao).forEach(([fid, fs]) => {
    const fn = funcMap.get(fid)
    if (!fn || !fn.custo_hora) return
    const avgSal = fs.reduce((s: number, f: any) => s + Number(f.salario_base || 0), 0) / fs.length
    const custoR = (avgSal * 1.72) / (fn.jornada_horas_mes || 220)
    const marg = fn.custo_hora > 0 ? ((fn.custo_hora - custoR) / fn.custo_hora * 100) : 0
    margemFuncao.push({ nome: fn.nome, hc: fs.length, venda: Number(fn.custo_hora), custo: Math.round(custoR * 100) / 100, margem: Math.round(marg * 10) / 10 })
  })
  margemFuncao.sort((a, b) => b.margem - a.margem)

  // === ATENÇÃO HOJE ===
  const bmSemNf = (bmsSemNfe ?? []).map((b: any) => ({
    ...b,
    diasSemNf: Math.ceil((Date.now() - new Date(b.aprovado_em).getTime()) / 86400000),
  }))
  const receitaVencida = (receitasAbertas ?? []).filter((r: any) => r.data_vencimento && r.data_vencimento < hojeStr)
  const totalVencido = receitaVencida.reduce((s: number, r: any) => s + Number(r.valor || 0), 0)
  const obraVencendo = (obrasAtivas ?? []).find((o: any) => o.data_prev_fim && Math.ceil((new Date(o.data_prev_fim).getTime() - Date.now()) / 86400000) <= 30)
  const diasObraVencendo = obraVencendo ? Math.ceil((new Date(obraVencendo.data_prev_fim).getTime() - Date.now()) / 86400000) : null

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

      {/* ══════ ATENÇÃO HOJE ══════ */}
      {(bmSemNf.length > 0 || totalVencido > 0 || obraVencendo) && (
        <div className="mb-6 space-y-2">
          {bmSemNf.map((b: any) => (
            <Link key={b.id} href={`/boletins/${b.id}`}
              className="flex items-center gap-3 bg-white border-l-4 border-l-red-500 rounded-lg px-4 py-3 hover:shadow-md transition-all">
              <span className="text-red-500 text-lg flex-shrink-0">&#x1F534;</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-900">BM-{String(b.numero).padStart(2, '0')} aprovado há {b.diasSemNf}d sem NF-e emitida</div>
                <div className="text-xs text-gray-500">R$ {Number(b.valor_aprovado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} aguardando faturamento</div>
              </div>
              <span className="text-xs font-semibold text-brand flex-shrink-0">Emitir NF-e →</span>
            </Link>
          ))}
          {totalVencido > 0 && (
            <Link href="/financeiro?tab=lancamentos&tipo=receita&status=em_aberto"
              className="flex items-center gap-3 bg-white border-l-4 border-l-red-500 rounded-lg px-4 py-3 hover:shadow-md transition-all">
              <span className="text-red-500 text-lg flex-shrink-0">&#x1F534;</span>
              <div className="flex-1">
                <div className="text-sm font-semibold text-gray-900">{fmt(totalVencido)} em receita com vencimento em atraso</div>
                <div className="text-xs text-gray-500">{receitaVencida.length} lançamento(s) vencido(s)</div>
              </div>
              <span className="text-xs font-semibold text-brand flex-shrink-0">Ver lançamentos →</span>
            </Link>
          )}
          {obraVencendo && (
            <Link href={`/obras/${obraVencendo.id}`}
              className="flex items-center gap-3 bg-white border-l-4 border-l-amber-500 rounded-lg px-4 py-3 hover:shadow-md transition-all">
              <span className="text-amber-500 text-lg flex-shrink-0">&#x26A0;&#xFE0F;</span>
              <div className="flex-1">
                <div className="text-sm font-semibold text-gray-900">{obraVencendo.nome} vence em {diasObraVencendo} dias</div>
                <div className="text-xs text-gray-500">Contrato encerra em {new Date(obraVencendo.data_prev_fim + 'T12:00').toLocaleDateString('pt-BR')}</div>
              </div>
              <span className="text-xs font-semibold text-brand flex-shrink-0">Ver contrato →</span>
            </Link>
          )}
        </div>
      )}

      {/* ══════ SEÇÃO 1: SAÚDE FINANCEIRA ══════ */}
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Saúde Financeira</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <Link href="/financeiro/dre" title="Ver DRE & Resultado"
          className={`block rounded-2xl shadow-sm border p-5 transition-shadow hover:shadow-md ${margemOk ? 'bg-gradient-to-br from-green-50 to-white border-green-200' : 'bg-gradient-to-br from-red-50 to-white border-red-200'}`}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Margem Real Acumulada</div>
              <div className={`text-4xl font-bold font-display mt-1 ${margemOk ? 'text-green-700' : 'text-red-700'}`}>{margemPct.toFixed(1)}%</div>
              <div className="text-xs text-gray-500 mt-1">Alvo: {alvoMedio.toFixed(0)}% · Resultado: {fmtK(margemBruta)}</div>
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
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand">Ver DRE completo <ArrowRight className="w-3 h-3" /></span>
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
            <div className="p-2 bg-white/60 rounded-lg"><div className="text-[10px] text-gray-400 font-semibold uppercase">Entradas</div><div className="text-sm font-bold text-green-700">{fmtK(entrada30)}</div></div>
            <div className="p-2 bg-white/60 rounded-lg"><div className="text-[10px] text-gray-400 font-semibold uppercase">Saídas</div><div className="text-sm font-bold text-red-700">{fmtK(Math.abs(saida30))}</div></div>
          </div>
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

      {/* ══════ SEÇÃO 2: PERFORMANCE OPERACIONAL HH ══════ */}
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Performance Operacional</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {/* KPI 1 — Utilização */}
        <Link href="/ponto" className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-all">
          <div className="flex items-center gap-2 mb-2"><Gauge className="w-4 h-4 text-brand" /><span className="text-[10px] font-bold text-gray-400 uppercase">Utilização da Equipe</span></div>
          {hhDisponiveis > 0 ? (
            <>
              <div className={`text-3xl font-bold font-display ${colorPct(utilizacaoPct, 90, 75)}`}>{utilizacaoPct.toFixed(1)}%</div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mt-2">
                <div className={`h-full rounded-full ${bgPct(utilizacaoPct, 90, 75)}`} style={{ width: `${Math.min(utilizacaoPct, 100)}%` }} />
              </div>
              <div className="text-xs text-gray-500 mt-2">{hhRealizadas.toLocaleString('pt-BR')} HH de {hhDisponiveis.toLocaleString('pt-BR')} possíveis</div>
            </>
          ) : (
            <div className="text-gray-400 text-sm mt-1" title="Importe o ponto do Secullum para calcular">—</div>
          )}
        </Link>

        {/* KPI 2 — Receita por HH */}
        <Link href="/boletins" className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-all">
          <div className="flex items-center gap-2 mb-2"><Receipt className="w-4 h-4 text-brand" /><span className="text-[10px] font-bold text-gray-400 uppercase">Receita por HH Efetiva</span></div>
          {hhFaturadas > 0 ? (
            <>
              <div className="text-3xl font-bold font-display text-brand">{fmt(receitaPorHH)}</div>
              <div className="text-xs text-gray-500 mt-2">{hhFaturadas.toLocaleString('pt-BR')} HH faturadas · {fmtK(receitaBmTotal)}</div>
              <div className="text-xs text-gray-400 mt-1">Preço médio contratado: {fmt(precoMedioContratado)}/HH</div>
            </>
          ) : (
            <div className="text-gray-400 text-sm mt-1" title="Nenhum BM aprovado ainda">—</div>
          )}
        </Link>

        {/* KPI 3 — Ciclo de aprovação */}
        <Link href="/boletins" className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-all">
          <div className="flex items-center gap-2 mb-2"><Clock className="w-4 h-4 text-brand" /><span className="text-[10px] font-bold text-gray-400 uppercase">Ciclo de Aprovação do BM</span></div>
          {cicloMedio !== null ? (
            <>
              <div className={`text-3xl font-bold font-display ${colorPct(30 - cicloMedio, 15, 0)}`}>{Math.round(cicloMedio)} dias</div>
              <div className="text-xs text-gray-500 mt-2">Baseado em {bmsComAprovacao.length} BM(s) aprovado(s)</div>
              <div className="text-xs text-gray-400 mt-1">Mín: {Math.round(cicloMin!)}d · Máx: {Math.round(cicloMax!)}d</div>
            </>
          ) : (
            <div className="text-gray-400 text-sm mt-1" title="Nenhum BM aprovado ainda">—</div>
          )}
        </Link>

        {/* KPI 4 — Custo real MO */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-2"><Wallet className="w-4 h-4 text-brand" /><span className="text-[10px] font-bold text-gray-400 uppercase">Custo Real de MO</span></div>
          <div className="text-3xl font-bold font-display text-gray-900">{fmt(custoMedioHH)}</div>
          <div className="text-xs text-gray-500 mt-2">Custo médio por HH (salário + encargos + benefícios)</div>
          <div className="text-xs text-gray-400 mt-1">Folha total com encargos: {fmtK(folhaEncargos)}</div>
          {receitaPorHH > 0 && (
            <div className={`mt-2 text-xs font-semibold px-2 py-1 rounded inline-block ${margemHH >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {margemHH >= 0 ? `Margem R$ ${margemHH.toFixed(2)}/HH` : `Margem negativa: -R$ ${Math.abs(margemHH).toFixed(2)}/HH`}
            </div>
          )}
        </div>
      </div>

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
          <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Alertas de Vencimento</div>
          <div className="text-3xl font-bold text-red-700 font-display">{alertasTotal}</div>
          <div className="text-xs text-gray-500 mt-1">{alertasExp} contrato(s) · {alertasTotal - alertasExp} outro(s)</div>
        </Link>
      </div>

      {/* ══════ SEÇÃO 4: CONTRATO ATIVO ══════ */}
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
                  <thead><tr className="text-gray-400"><th className="text-left pb-1">Função</th><th className="text-center pb-1">HC</th><th className="text-right pb-1">Venda</th><th className="text-right pb-1">Custo</th><th className="text-right pb-1">Margem</th></tr></thead>
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

      {/* Atalhos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Link href="/financeiro" className="p-3 bg-white rounded-lg border border-gray-100 hover:border-brand/50 hover:shadow-sm transition-all text-center text-xs font-semibold text-gray-700">Lançamentos</Link>
        <Link href="/financeiro/dre" className="p-3 bg-white rounded-lg border border-gray-100 hover:border-brand/50 hover:shadow-sm transition-all text-center text-xs font-semibold text-gray-700">DRE & Margem</Link>
        <Link href="/rh/folha" className="p-3 bg-white rounded-lg border border-gray-100 hover:border-brand/50 hover:shadow-sm transition-all text-center text-xs font-semibold text-gray-700">Folha</Link>
        <Link href="/forecast" className="p-3 bg-white rounded-lg border border-gray-100 hover:border-brand/50 hover:shadow-sm transition-all text-center text-xs font-semibold text-gray-700">Forecast</Link>
      </div>
    </div>
  )
}
