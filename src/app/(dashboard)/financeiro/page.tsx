'use client'
import { Suspense, useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import ConfirmButton from '@/components/ConfirmButton'
import SearchInput from '@/components/SearchInput'
import { useToast } from '@/components/Toast'
import { exportarExcel, exportarPDF } from '@/lib/exportLancamentos'

const FluxoCaixaChart = dynamic(() => import('./components/FluxoCaixaChart'), { ssr: false, loading: () => <div className="h-40 animate-pulse bg-gray-100 rounded-xl" /> })
const LancamentoModal = dynamic(() => import('./components/LancamentoModal'), { ssr: false, loading: () => null })
const LoteBar = dynamic(() => import('./components/LoteBar'), { ssr: false, loading: () => null })
import FiltrosAvancados, { type FilterState, FILTER_INITIAL } from './components/FiltrosAvancados'
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const CAT_COLORS: Record<string, string> = {
  'Salário Base': '#6366f1',
  'FGTS': '#8b5cf6',
  'Vale-Transporte': '#0ea5e9',
  'Treinamentos Obrigatórios': '#f59e0b',
  'Acordos Trabalhistas': '#ef4444',
  'Rescisões Extraordinárias': '#f97316',
  'Receita HH Homem-Hora': '#10b981',
}

export default function FinanceiroPageWrapper() {
  return (
    <Suspense fallback={<div className="p-6 text-gray-400 text-sm">Carregando...</div>}>
      <FinanceiroPage />
    </Suspense>
  )
}

function FinanceiroPage() {
  const searchParams = useSearchParams()
  const [obras, setObras] = useState<any[]>([])
  const [obraId, setObraId] = useState<string>('all')
  const [lancamentos, setLancamentos] = useState<any[]>([])
  const [fluxo, setFluxo] = useState<any[]>([])
  const [showProvisões, setShowProvisões] = useState(true)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'fluxo' | 'lancamentos'>('fluxo')
  const [busca, setBusca] = useState('')
  // Filtros vindos da URL (clicados do Sumário Executivo)
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroProvisao, setFiltroProvisao] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingLanc, setEditingLanc] = useState<any | null>(null)
  const [statusTab, setStatusTab] = useState<'todos' | 'em_aberto' | 'vence_hoje' | 'vencidos' | 'pago'>('todos')
  const [payPopover, setPayPopover] = useState<string | null>(null)
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10))
  const [payConta, setPayConta] = useState('')
  const [contas, setContas] = useState<any[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [fornecedores, setFornecedores] = useState<any[]>([])
  const [showFiltros, setShowFiltros] = useState(false)
  const [advFilters, setAdvFilters] = useState<FilterState>({ ...FILTER_INITIAL })
  const [alertasCoerencia, setAlertasCoerencia] = useState<string[]>([])
  const [filtroCCId, setFiltroCCId] = useState('')
  const [centrosCusto, setCentrosCusto] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const PAGE_SIZE = 100
  const [filtroAno, setFiltroAno] = useState(new Date().getFullYear().toString())
  const [filtroMes, setFiltroMes] = useState('todos')

  const toggleSelect = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleTodos = (ids: string[]) => setSelected(prev => prev.size === ids.length ? new Set() : new Set(ids))

  const supabase = createClient()
  const toast = useToast()

  // Aplica filtros da URL ao montar
  useEffect(() => {
    const urlTab = searchParams.get('tab')
    const urlTipo = searchParams.get('tipo')
    const urlStatus = searchParams.get('status')
    const urlProv = searchParams.get('is_provisao')
    if (urlTab === 'lancamentos') setTab('lancamentos')
    if (urlTipo) setFiltroTipo(urlTipo)
    if (urlStatus) setFiltroStatus(urlStatus)
    if (urlProv === 'true') setFiltroProvisao(true)
  }, [searchParams])

  useEffect(() => {
    supabase.from('obras').select('id,nome,conta_recebimento_id,conta_pagamento_id').is('deleted_at', null).order('nome').then(({ data }) => setObras(data ?? []))
    supabase.from('contas_correntes').select('id,nome,banco,is_padrao,proprietario,saldo_atual').eq('ativo', true).is('deleted_at', null).order('is_padrao', { ascending: false }).order('nome').then(({ data }) => setContas((data ?? []).filter((c: any) => c.proprietario !== 'socio')))
    supabase.from('fornecedores').select('id, nome').is('deleted_at', null).order('nome').then(({ data }) => setFornecedores(data ?? []))
    supabase.from('centros_custo').select('id, codigo, nome, tipo').is('deleted_at', null).eq('ativo', true).order('codigo').then(({ data }) => setCentrosCusto(data ?? []))
  }, [])

  useEffect(() => {
    loadData()
  }, [obraId, showProvisões, page, filtroAno, filtroMes])

  function verificarCoerencia(dados: any[]): string[] {
    const alertas: string[] = []
    const hoje = new Date().toISOString().slice(0, 10)
    const trintaDiasAtras = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

    const vencidosAntigos = dados.filter(l => l.status === 'em_aberto' && l.data_vencimento && l.data_vencimento < trintaDiasAtras && !l.is_provisao)
    if (vencidosAntigos.length > 0) {
      alertas.push(`${vencidosAntigos.length} lançamento(s) vencido(s) há mais de 30 dias — total ${fmt(vencidosAntigos.reduce((s: number, l: any) => s + Number(l.valor), 0))}`)
    }

    const semCategoria = dados.filter(l => !l.categoria && l.status !== 'cancelado')
    if (semCategoria.length > 0) {
      alertas.push(`${semCategoria.length} lançamento(s) sem categoria definida`)
    }

    const grupos = new Map<string, any[]>()
    dados.filter(l => l.parcela_grupo_id).forEach(l => {
      if (!grupos.has(l.parcela_grupo_id)) grupos.set(l.parcela_grupo_id, [])
      grupos.get(l.parcela_grupo_id)!.push(l)
    })
    let parcelasIncompletas = 0
    grupos.forEach((parcelas, _grupoId) => {
      const esperado = parcelas[0]?.parcela_total
      if (esperado && parcelas.length < esperado) parcelasIncompletas++
    })
    if (parcelasIncompletas > 0) {
      alertas.push(`${parcelasIncompletas} grupo(s) de parcelamento com parcelas faltando`)
    }

    return alertas
  }

  async function loadData() {
    setLoading(true)
    let q = supabase.from('financeiro_lancamentos').select('*, obras(nome), centros_custo(codigo, nome, tipo)', { count: 'exact' }).is('deleted_at', null).order('data_competencia', { ascending: false })
    if (obraId && obraId !== 'all') q = q.eq('obra_id', obraId)
    if (!showProvisões) q = q.eq('is_provisao', false)
    // Filtros de período
    if (filtroAno !== 'todos') {
      const ano = Number(filtroAno)
      if (filtroMes !== 'todos') {
        const mes = Number(filtroMes)
        const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`
        const fimDate = new Date(ano, mes, 0) // último dia do mês
        const fim = `${ano}-${String(mes).padStart(2, '0')}-${String(fimDate.getDate()).padStart(2, '0')}`
        q = q.gte('data_competencia', inicio).lte('data_competencia', fim)
      } else {
        q = q.gte('data_competencia', `${ano}-01-01`).lte('data_competencia', `${ano}-12-31`)
      }
    }
    q = q.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
    const { data, count } = await q
    setLancamentos(data ?? [])
    setTotalCount(count ?? 0)

    setAlertasCoerencia(verificarCoerencia(data ?? []))

    const hojeLocal = new Date().toISOString().slice(0, 10)
    const byMes: Record<string, { mes: string; receita_pago: number; receita_aberto: number; despesa_pago: number; despesa_aberto: number; despesa_vencido: number; provisao: number }> = {}
    ;(data ?? []).forEach((l: any) => {
      const mes = l.data_competencia?.slice(0, 7) ?? 'sem-data'
      if (!byMes[mes]) byMes[mes] = { mes, receita_pago: 0, receita_aberto: 0, despesa_pago: 0, despesa_aberto: 0, despesa_vencido: 0, provisao: 0 }
      const v = Number(l.valor)
      if (l.tipo === 'receita' && l.natureza !== 'financiamento') {
        if (l.status === 'pago') byMes[mes].receita_pago += v
        else byMes[mes].receita_aberto += v
      } else if (l.tipo === 'despesa') {
        if (l.is_provisao) byMes[mes].provisao += v
        else if (l.status === 'pago') byMes[mes].despesa_pago += v
        else if (l.data_vencimento && l.data_vencimento < hojeLocal) byMes[mes].despesa_vencido += v
        else byMes[mes].despesa_aberto += v
      }
    })

    let acum = 0
    const fluxoMes = Object.values(byMes).sort((a, b) => a.mes.localeCompare(b.mes)).map(m => {
      const totalRec = m.receita_pago + m.receita_aberto
      const totalDesp = m.despesa_pago + m.despesa_aberto + m.provisao
      const resultado = totalRec - totalDesp
      acum += resultado
      return { ...m, totalRec, totalDesp, resultado, acum }
    })
    setFluxo(fluxoMes)
    setLoading(false)
  }

  function abrirNovo() {
    setEditingLanc(null)
    setShowModal(true)
  }

  function abrirEditar(l: any) {
    setEditingLanc(l)
    setShowModal(true)
  }

  // Keyboard shortcuts
  useKeyboardShortcut('n', useCallback(() => abrirNovo(), []))
  useKeyboardShortcut('Escape', useCallback(() => {
    if (showModal) setShowModal(false)
    if (payPopover) setPayPopover(null)
  }, [showModal, payPopover]))
  useKeyboardShortcut('/', useCallback(() => {
    const input = document.querySelector<HTMLInputElement>('input[placeholder*="Buscar"]')
    if (input) input.focus()
  }, []))

  // KPIs
  const receitaPaga = lancamentos.filter(l => l.tipo === 'receita' && l.status === 'pago' && l.natureza !== 'financiamento').reduce((s, l) => s + Number(l.valor), 0)
  const receitaAberto = lancamentos.filter(l => l.tipo === 'receita' && l.status === 'em_aberto' && l.natureza !== 'financiamento').reduce((s, l) => s + Number(l.valor), 0)
  const despesaPaga = lancamentos.filter(l => l.tipo === 'despesa' && !l.is_provisao && l.status === 'pago').reduce((s, l) => s + Number(l.valor), 0)
  const despesaAberto = lancamentos.filter(l => l.tipo === 'despesa' && !l.is_provisao && l.status === 'em_aberto').reduce((s, l) => s + Number(l.valor), 0)
  const provisoes = lancamentos.filter(l => l.tipo === 'despesa' && l.is_provisao).reduce((s, l) => s + Number(l.valor), 0)
  const resultadoRealizado = receitaPaga - despesaPaga
  const resultadoTotal = (receitaPaga + receitaAberto) - (despesaPaga + despesaAberto + provisoes)

  // Chart dimensions
  const chartH = 180
  const maxVal = Math.max(...fluxo.map(m => Math.max(m.totalRec, m.totalDesp)), 1)
  const barW = fluxo.length > 0 ? Math.min(30, Math.floor(560 / fluxo.length / 2 - 4)) : 20

  // Categories breakdown
  const cats: Record<string, number> = {}
  lancamentos.filter(l => l.tipo === 'despesa').forEach(l => {
    const cat = l.categoria || 'Outros'
    cats[cat] = (cats[cat] || 0) + Number(l.valor)
  })
  const catsSorted = Object.entries(cats).sort((a, b) => b[1] - a[1])
  const totalDesp = Object.values(cats).reduce((s, v) => s + v, 0)

  // Filtered lancamentos for the table
  const lancamentosFiltrados = lancamentos.filter(l => {
    if (busca && !l.nome?.toLowerCase().includes(busca.toLowerCase()) && !l.categoria?.toLowerCase().includes(busca.toLowerCase()) && !l.tipo?.toLowerCase().includes(busca.toLowerCase()) && !l.fornecedor?.toLowerCase().includes(busca.toLowerCase())) return false
    if (filtroTipo && l.tipo !== filtroTipo) return false
    if (filtroStatus && l.status !== filtroStatus) return false
    if (filtroProvisao && !l.is_provisao) return false
    const hoje = new Date().toISOString().slice(0, 10)
    if (statusTab === 'em_aberto' && (l.status !== 'em_aberto' || l.is_provisao)) return false
    if (statusTab === 'vence_hoje' && !(l.status === 'em_aberto' && l.data_vencimento === hoje)) return false
    if (statusTab === 'vencidos' && !(l.status === 'em_aberto' && l.data_vencimento && l.data_vencimento < hoje)) return false
    if (statusTab === 'pago' && l.status !== 'pago') return false
    // Advanced filters
    if (filtroCCId && l.centro_custo_id !== filtroCCId && !(l.centro_custo || '').toLowerCase().includes((centrosCusto.find(c => c.id === filtroCCId)?.nome || '').toLowerCase())) return false
    if (advFilters.categoria && l.categoria !== advFilters.categoria) return false
    if (advFilters.centroCusto && !(l.centro_custo || '').toLowerCase().includes(advFilters.centroCusto.toLowerCase())) return false
    if (advFilters.fornecedor && !(l.fornecedor || '').toLowerCase().includes(advFilters.fornecedor.toLowerCase())) return false
    if (advFilters.de && l.data_competencia && l.data_competencia < advFilters.de) return false
    if (advFilters.ate && l.data_competencia && l.data_competencia > advFilters.ate) return false
    if (advFilters.valorMin && Number(l.valor) < Number(advFilters.valorMin)) return false
    if (advFilters.valorMax && Number(l.valor) > Number(advFilters.valorMax)) return false
    return true
  })

  // Totalizadores
  const totalReceitaFiltrada = lancamentosFiltrados.filter(l => l.tipo === 'receita' && l.natureza !== 'financiamento').reduce((s, l) => s + Number(l.valor), 0)
  const totalDespesaFiltrada = lancamentosFiltrados.filter(l => l.tipo === 'despesa' && !l.is_provisao).reduce((s, l) => s + Number(l.valor), 0)
  const saldoFiltrado = totalReceitaFiltrada - totalDespesaFiltrada

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold font-display">Lançamentos Financeiros</h1>
          <p className="text-sm text-gray-500 mt-0.5">Receitas, despesas e fluxo de caixa por obra {totalCount > 0 && <span className="text-gray-400">— {totalCount.toLocaleString('pt-BR')} lançamento{totalCount !== 1 ? 's' : ''} no total</span>}</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={obraId} onChange={e => { setObraId(e.target.value); setPage(1) }}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
            <option value="all">Todas as obras</option>
            {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
          <select value={filtroCCId} onChange={e => setFiltroCCId(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
            <option value="">Todos os CCs</option>
            {centrosCusto.map(cc => <option key={cc.id} value={cc.id}>{cc.codigo} — {cc.nome}</option>)}
          </select>
          <select value={filtroAno} onChange={e => { setFiltroAno(e.target.value); setPage(1) }}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
            <option value="todos">Todos os anos</option>
            <option value="2026">2026</option>
            <option value="2025">2025</option>
            <option value="2024">2024</option>
          </select>
          <select value={filtroMes} onChange={e => { setFiltroMes(e.target.value); setPage(1) }}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
            <option value="todos">Todos os meses</option>
            {['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'].map((m, i) => (
              <option key={i+1} value={String(i+1)}>{m}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={showProvisões} onChange={e => { setShowProvisões(e.target.checked); setPage(1) }}
              className="rounded border-gray-300 text-brand" />
            Provisões
          </label>
          <button onClick={abrirNovo}
            className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark">
            + Lançamento
          </button>
        </div>
      </div>

      {/* Sub-links */}
      <div className="flex flex-wrap gap-2 mb-5">
        <Link href="/financeiro/contas" className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50">
          Contas Correntes
        </Link>
        <Link href="/financeiro/cashflow" className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50">
          Fluxo de Caixa
        </Link>
        <Link href="/financeiro/ofx" className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50">
          Conciliação OFX
        </Link>
      </div>

      {/* Coherence alerts */}
      {alertasCoerencia.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
          <div className="flex items-start gap-3">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="flex-shrink-0 mt-0.5 text-amber-500">
              <path d="M10 2l8 14H2L10 2z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round"/>
              <path d="M10 8v4M10 14.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <div className="flex-1">
              <div className="text-sm font-semibold text-amber-800 mb-1">Alertas de coerência</div>
              <ul className="space-y-0.5">
                {alertasCoerencia.map((a, i) => (
                  <li key={i} className="text-xs text-amber-700">{a}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Cards por conta bancária */}
      {contas.length > 0 && (
        <div className="flex gap-3 mb-4 overflow-x-auto pb-1">
          {contas.map(c => {
            const saldo = Number(c.saldo_atual || 0)
            const bancoColor: Record<string, string> = { 'BTG': 'border-blue-400 bg-blue-50', 'Santander': 'border-red-400 bg-red-50', 'Itaú': 'border-orange-400 bg-orange-50', 'Bradesco': 'border-pink-400 bg-pink-50', 'Banco do Brasil': 'border-yellow-400 bg-yellow-50', 'Caixa': 'border-cyan-400 bg-cyan-50', 'Sicoob': 'border-green-400 bg-green-50' }
            const bc = Object.entries(bancoColor).find(([k]) => (c.banco || '').toLowerCase().includes(k.toLowerCase()))?.[1] || 'border-gray-200 bg-gray-50'
            return (
              <Link key={c.id} href="/financeiro/contas" className={`flex-shrink-0 rounded-xl border-l-4 p-3 min-w-[160px] hover:shadow-md transition-all ${bc}`}>
                <div className="text-[10px] font-bold text-gray-500 uppercase truncate">{c.banco ? `${c.banco} — ` : ''}{c.nome}{c.is_padrao ? ' ★' : ''}</div>
                <div className={`text-lg font-bold mt-0.5 ${saldo >= 0 ? 'text-gray-900' : 'text-red-700'}`}>{fmt(saldo)}</div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Status tabs */}
      {(() => {
        const hoje = new Date().toISOString().slice(0, 10)
        const abertos = lancamentos.filter(l => l.status === 'em_aberto' && !l.is_provisao).length
        const venceHoje = lancamentos.filter(l => l.status === 'em_aberto' && l.data_vencimento === hoje).length
        const vencidos = lancamentos.filter(l => l.status === 'em_aberto' && l.data_vencimento && l.data_vencimento < hoje).length
        const pagos = lancamentos.filter(l => l.status === 'pago').length
        const tabs = [
          { key: 'todos' as const, label: 'Todos', count: lancamentos.length, color: 'text-gray-600' },
          { key: 'em_aberto' as const, label: 'Em aberto', count: abertos, color: 'text-amber-600' },
          { key: 'vence_hoje' as const, label: 'Vence hoje', count: venceHoje, color: 'text-orange-600' },
          { key: 'vencidos' as const, label: 'Vencidos', count: vencidos, color: 'text-red-600' },
          { key: 'pago' as const, label: 'Pagos', count: pagos, color: 'text-green-600' },
        ]
        return (
          <div className="flex gap-1 mb-4 bg-gray-50 p-1 rounded-lg overflow-x-auto">
            {tabs.map(t => (
              <button key={t.key} onClick={() => setStatusTab(t.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${statusTab === t.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                {t.label}
                {t.count > 0 && <span className={`text-[10px] font-bold ${statusTab === t.key ? t.color : 'text-gray-400'}`}>{t.count}</span>}
              </button>
            ))}
          </div>
        )
      })()}

      {/* KPIs with tooltips */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        {[
          { label: 'Receita recebida', value: receitaPaga, color: 'text-green-600', bg: 'bg-green-50', tip: `${lancamentos.filter(l => l.tipo === 'receita' && l.status === 'pago').length} lançamentos pagos\nBMs aprovados e recebidos` },
          { label: 'Receita em aberto', value: receitaAberto, color: 'text-emerald-600', bg: 'bg-emerald-50', tip: `${lancamentos.filter(l => l.tipo === 'receita' && l.status !== 'pago').length} BMs ainda não recebidos` },
          { label: 'Despesa paga', value: despesaPaga, color: 'text-red-600', bg: 'bg-red-50', tip: `Folha + outras despesas já liquidadas` },
          { label: 'Despesa em aberto', value: despesaAberto, color: 'text-orange-600', bg: 'bg-orange-50', tip: `${lancamentos.filter(l => l.tipo === 'despesa' && l.status === 'em_aberto' && !l.is_provisao).length} lançamentos pendentes` },
          { label: 'Provisões futuras', value: provisoes, color: 'text-purple-600', bg: 'bg-purple-50', tip: `13°, férias e FGTS acumulados\nNão saiu do caixa — reserva contábil` },
          { label: 'Resultado total', value: resultadoTotal, color: resultadoTotal >= 0 ? 'text-green-700' : 'text-red-700', bg: resultadoTotal >= 0 ? 'bg-green-50' : 'bg-red-50', tip: `Receita − Despesa − Provisões\n${resultadoTotal >= 0 ? 'Empresa gerando valor' : 'Resultado negativo no período'}` },
        ].map(k => (
          <div key={k.label} className={`${k.bg} rounded-xl p-3 relative group cursor-default`}>
            <div className="text-xs text-gray-500 mb-1 leading-tight">{k.label}</div>
            <div className={`text-base font-bold ${k.color}`}>{fmt(k.value)}</div>
            <div className="absolute bottom-full left-0 mb-2 z-30 bg-[#0f1e2e] text-white text-[11px] rounded-lg px-3 py-2 shadow-xl border border-white/10 min-w-[200px] pointer-events-none whitespace-pre-line opacity-0 group-hover:opacity-100 transition-opacity">{k.tip}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5 mb-5">
        {/* Fluxo de caixa chart */}
        <FluxoCaixaChart fluxo={fluxo} chartH={chartH} maxVal={maxVal} barW={barW} />

        {/* Despesas por categoria */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-sm font-semibold mb-4">Despesas por Categoria</h2>
          <div className="space-y-2.5">
            {catsSorted.map(([cat, val]) => (
              <div key={cat}>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-gray-600 truncate">{cat}</span>
                  <span className="font-medium text-gray-900 ml-2 flex-shrink-0">{(val / 1000).toFixed(0)}k</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${(val / totalDesp) * 100}%`, backgroundColor: CAT_COLORS[cat] ?? '#6b7280' }}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabela de fluxo mensal */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto mb-5">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <div className="flex gap-3">
            {(['fluxo', 'lancamentos'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`text-sm font-medium px-3 py-1 rounded-lg transition-colors ${tab === t ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                {t === 'fluxo' ? 'Fluxo mensal' : 'Lançamentos'}
              </button>
            ))}
          </div>
          {tab === 'lancamentos' && (
            <div className="flex items-center gap-2">
              <button onClick={() => exportarExcel(lancamentosFiltrados, `lancamentos-${new Date().toISOString().slice(0, 10)}`)}
                className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50 flex items-center gap-1">
                <span>📊</span> Excel
              </button>
              <button onClick={() => exportarPDF(lancamentosFiltrados)}
                className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50 flex items-center gap-1">
                <span>🖨️</span> PDF
              </button>
            </div>
          )}
        </div>

        {tab === 'lancamentos' && (
          <div className="px-5 pt-3 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex-1 min-w-[200px]"><SearchInput value={busca} onChange={setBusca} placeholder="Buscar lançamento..." /></div>
              {/* Seleção rápida por folha */}
              {(() => {
                const mesesFolha = new Map<string, string[]>()
                lancamentos.filter(l => l.status === 'em_aberto' && l.origem === 'folha_fechamento').forEach(l => {
                  const match = l.nome?.match(/(\d{2}\/\d{4})/)
                  if (match) { const k = match[1]; if (!mesesFolha.has(k)) mesesFolha.set(k, []); mesesFolha.get(k)!.push(l.id) }
                })
                return Array.from(mesesFolha.entries()).map(([mes, ids]) => (
                  <button key={mes} onClick={() => setSelected(new Set(ids))}
                    className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-600 hover:border-brand hover:text-brand transition-colors whitespace-nowrap">
                    Folha {mes} ({ids.length})
                  </button>
                ))
              })()}
              <FiltrosAvancados
                filters={advFilters}
                onChange={setAdvFilters}
                visible={showFiltros}
                onToggle={() => setShowFiltros(f => !f)}
              />
            </div>

            {(filtroTipo || filtroStatus || filtroProvisao) && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-500">Filtros ativos:</span>
                {filtroTipo && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${filtroTipo === 'receita' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {filtroTipo === 'receita' ? 'Receita' : 'Despesa'}
                  </span>
                )}
                {filtroStatus && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-medium">
                    {filtroStatus === 'pago' ? 'Pago' : filtroStatus === 'em_aberto' ? 'Em aberto' : filtroStatus}
                  </span>
                )}
                {filtroProvisao && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">Provisão</span>
                )}
                <button onClick={() => { setFiltroTipo(''); setFiltroStatus(''); setFiltroProvisao(false) }}
                  className="text-xs text-brand hover:underline font-medium ml-1">Limpar filtros</button>
              </div>
            )}
          </div>
        )}

        {tab === 'fluxo' ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Mês','Receita','Despesa Paga','Em aberto','Provisão','Resultado Mês','Acumulado'].map(h => (
                  <th key={h} className="text-right first:text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fluxo.map(m => (
                <tr key={m.mes} className="border-b border-gray-50 hover:bg-gray-50/80">
                  <td className="px-4 py-2.5 font-medium text-sm">
                    {new Date(m.mes + '-01').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '').replace(' ', "'")}
                  </td>
                  <td className="px-4 py-2.5 text-right text-green-600">{m.totalRec > 0 ? fmt(m.totalRec) : '—'}</td>
                  <td className="px-4 py-2.5 text-right text-red-600">{m.despesa_pago > 0 ? fmt(m.despesa_pago) : '—'}</td>
                  <td className="px-4 py-2.5 text-right text-orange-500">{m.despesa_aberto > 0 ? fmt(m.despesa_aberto) : '—'}</td>
                  <td className="px-4 py-2.5 text-right text-purple-600">{m.provisao > 0 ? fmt(m.provisao) : '—'}</td>
                  <td className={`px-4 py-2.5 text-right font-semibold ${m.resultado >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {fmt(m.resultado)}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-bold ${m.acum >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {fmt(m.acum)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="w-8 px-2">
                  {(() => {
                    const idsVisiveis = lancamentosFiltrados.filter(l => l.status === 'em_aberto').map(l => l.id)
                    return <input type="checkbox" checked={selected.size > 0 && selected.size === idsVisiveis.length && idsVisiveis.length > 0} onChange={() => toggleTodos(idsVisiveis)} className="rounded border-gray-300 text-brand focus:ring-brand cursor-pointer" />
                  })()}
                </th>
                {['Data','Descrição','Fornecedor','Obra','CC','Tipo','Valor','Status',''].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lancamentosFiltrados.map(l => {
                const hoje = new Date().toISOString().slice(0, 10)
                const isVencido = l.status === 'em_aberto' && l.data_vencimento && l.data_vencimento < hoje && !l.is_provisao
                const isVenceHoje = l.status === 'em_aberto' && l.data_vencimento === hoje
                const rowBg = isVencido ? 'bg-red-50/40' : isVenceHoje ? 'bg-amber-50/40' : ''
                return (
                <tr key={l.id} className={`border-b border-gray-50 hover:bg-gray-50/80 ${selected.has(l.id) ? 'bg-brand/5' : rowBg}`}>
                  <td className="w-8 px-2">
                    {l.status === 'em_aberto' && <input type="checkbox" checked={selected.has(l.id)} onChange={() => toggleSelect(l.id)} className="rounded border-gray-300 text-brand focus:ring-brand cursor-pointer" />}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{new Date(l.data_competencia+'T12:00:00').toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-2.5 font-medium">
                    <div className="flex items-center gap-1.5">
                      {l.nome}
                      {l.origem === 'bm_aprovado' && <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold">BM</span>}
                      {l.origem === 'folha_fechamento' && <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold">Folha</span>}
                      {l.origem === 'cotacao' && <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-bold">Compras</span>}
                      {(!l.origem || l.origem === 'manual') && <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-bold">Manual</span>}
                      {l.is_provisao && <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-600 font-bold">Provisão</span>}
                      {l.is_parcelado && l.parcela_numero && l.parcela_total && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold">
                          {String(l.parcela_numero).padStart(2, '0')}/{String(l.parcela_total).padStart(2, '0')}
                        </span>
                      )}
                      {l.is_recorrente && <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 font-bold">↻</span>}
                      {l.anexo_url && (
                        <a href={l.anexo_url} target="_blank" rel="noopener noreferrer" className="text-[9px] hover:opacity-70" title="Ver anexo">📎</a>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs truncate max-w-[120px]">{l.fornecedor || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{l.obras?.nome || '—'}</td>
                  <td className="px-4 py-2.5">
                    {(() => {
                      const ccCode = l.centros_custo?.codigo ?? l.centro_custo ?? null
                      if (!ccCode) return <span className="text-gray-300 text-xs">—</span>
                      const ccTipo = l.centros_custo?.tipo
                      const ccColors: Record<string, string> = { obra: 'bg-blue-100 text-blue-700', administrativo: 'bg-purple-100 text-purple-700', suporte_obra: 'bg-amber-100 text-amber-700', equipamento: 'bg-gray-100 text-gray-600' }
                      return <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${ccColors[ccTipo] || 'bg-gray-100 text-gray-600'}`} title={l.centros_custo ? `${l.centros_custo.codigo} — ${l.centros_custo.nome}` : l.centro_custo}>{ccCode}</span>
                    })()}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${l.tipo === 'receita' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {l.tipo === 'receita' ? 'Receita' : 'Despesa'}
                    </span>
                  </td>
                  <td className={`px-4 py-2.5 font-semibold ${l.tipo === 'receita' ? 'text-green-700' : 'text-red-700'}`}>
                    {l.tipo === 'receita' ? '+' : '-'}{fmt(l.valor)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${l.status === 'pago' ? 'bg-green-100 text-green-700' : l.status === 'cancelado' ? 'bg-gray-100 text-gray-500' : 'bg-yellow-100 text-yellow-700'}`}>
                      {l.status === 'em_aberto' ? 'Em aberto' : l.status === 'pago' ? 'Pago' : l.status === 'cancelado' ? 'Cancelado' : l.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className={`flex gap-2 justify-end items-center ${selected.size > 0 ? 'opacity-30 pointer-events-none' : ''}`}>
                      <button onClick={() => abrirEditar(l)}
                        className="text-[11px] font-medium px-2.5 py-1 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50"
                        title="Editar">
                        Editar
                      </button>
                      {l.status === 'em_aberto' && !l.is_provisao && (
                        <div className="relative">
                          <button
                            onClick={() => { setPayPopover(payPopover === l.id ? null : l.id); setPayDate(new Date().toISOString().slice(0, 10)); setPayConta(l.conta_id || contas.find(c => c.is_padrao)?.id || '') }}
                            className={`text-[11px] font-semibold px-2.5 py-1 rounded-md border transition-colors ${
                              l.tipo === 'receita'
                                ? 'border-green-200 text-green-700 hover:bg-green-50'
                                : 'border-red-200 text-red-700 hover:bg-red-50'
                            }`}
                            title={l.tipo === 'receita' ? 'Marcar como recebida' : 'Marcar como paga'}
                          >
                            {l.tipo === 'receita' ? '✓ Receber' : '✓ Pagar'}
                          </button>
                          {payPopover === l.id && (
                            <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-3 w-56">
                              <div className="text-xs font-semibold text-gray-700 mb-2">{l.tipo === 'receita' ? 'Registrar recebimento' : 'Registrar pagamento'}</div>
                              <div className="space-y-2">
                                <div>
                                  <label className="block text-[10px] text-gray-400 mb-0.5">Data</label>
                                  <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className="w-full px-2 py-1 border border-gray-200 rounded text-xs" />
                                </div>
                                <div>
                                  <label className="block text-[10px] text-gray-400 mb-0.5">Conta</label>
                                  <select value={payConta} onChange={e => setPayConta(e.target.value)} className="w-full px-2 py-1 border border-gray-200 rounded text-xs">
                                    <option value="">—</option>
                                    {contas.map(c => <option key={c.id} value={c.id}>{c.is_padrao ? '★ ' : ''}{c.banco ? `${c.banco} — ` : ''}{c.nome}</option>)}
                                  </select>
                                </div>
                                <div className="flex gap-1.5 pt-1">
                                  <button onClick={() => setPayPopover(null)} className="flex-1 px-2 py-1 text-[10px] border border-gray-200 rounded hover:bg-gray-50">Cancelar</button>
                                  <button onClick={async () => {
                                    const { data: { user } } = await supabase.auth.getUser()
                                    const upd: any = { status: 'pago', data_pagamento: payDate, updated_by: user?.id ?? null }
                                    if (payConta) upd.conta_id = payConta
                                    const { error } = await supabase.from('financeiro_lancamentos').update(upd).eq('id', l.id)
                                    if (error) { toast.error('Erro: ' + error.message); return }
                                    setLancamentos(prev => prev.map(x => x.id === l.id ? { ...x, status: 'pago', data_pagamento: payDate, conta_id: payConta || x.conta_id } : x))
                                    toast.success(l.tipo === 'receita' ? 'Receita marcada como recebida' : 'Despesa marcada como paga')
                                    setPayPopover(null)
                                  }} className={`flex-1 px-2 py-1 text-[10px] text-white rounded font-semibold ${l.tipo === 'receita' ? 'bg-green-600' : 'bg-red-600'}`}>
                                    Confirmar
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      {l.status === 'pago' && (
                        <button
                          onClick={async () => {
                            const { data: { user } } = await supabase.auth.getUser()
                            const { error } = await supabase.from('financeiro_lancamentos').update({
                              status: 'em_aberto',
                              data_pagamento: null,
                              updated_by: user?.id ?? null,
                            }).eq('id', l.id)
                            if (error) { toast.error('Erro: ' + error.message); return }
                            setLancamentos(prev => prev.map(x => x.id === l.id ? { ...x, status: 'em_aberto', data_pagamento: null } : x))
                            toast.success('Reaberto')
                          }}
                          className="text-[11px] font-medium px-2.5 py-1 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50"
                          title="Reabrir"
                        >
                          ↺ Reabrir
                        </button>
                      )}
                      <ConfirmButton label="Excluir" onConfirm={async () => {
                        const { data: { user } } = await supabase.auth.getUser()
                        const { error } = await supabase.from('financeiro_lancamentos').update({
                          deleted_at: new Date().toISOString(),
                          deleted_by: user?.id ?? null,
                        }).eq('id', l.id)
                        if (error) { toast.error('Erro ao excluir: ' + error.message); return }
                        setLancamentos(prev => prev.filter(x => x.id !== l.id))
                        toast.success('Lançamento excluído')
                      }} />
                      {l.parcela_grupo_id && (
                        <ConfirmButton label="Excluir série" onConfirm={async () => {
                          const { data: { user } } = await supabase.auth.getUser()
                          const { error } = await supabase.from('financeiro_lancamentos').update({
                            deleted_at: new Date().toISOString(),
                            deleted_by: user?.id ?? null,
                          }).eq('parcela_grupo_id', l.parcela_grupo_id).eq('status', 'em_aberto')
                          if (error) { toast.error('Erro: ' + error.message); return }
                          setLancamentos(prev => prev.filter(x => !(x.parcela_grupo_id === l.parcela_grupo_id && x.status === 'em_aberto')))
                          toast.success('Parcelas em aberto da série excluídas')
                        }} />
                      )}
                    </div>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>

          {/* Totalizadores */}
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center gap-6 text-xs flex-wrap">
            <span className="text-gray-500">{lancamentosFiltrados.length} de {totalCount} lançamento{totalCount !== 1 ? 's' : ''}</span>
            <span className="text-green-700 font-semibold">Receita: {fmt(totalReceitaFiltrada)}</span>
            <span className="text-red-700 font-semibold">Despesa: {fmt(totalDespesaFiltrada)}</span>
            <span className={`font-bold ${saldoFiltrado >= 0 ? 'text-green-700' : 'text-red-700'}`}>Saldo: {fmt(saldoFiltrado)}</span>
          </div>

          {/* Pagination */}
          {totalCount > PAGE_SIZE && (
            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-center gap-4 text-sm">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium"
              >
                Anterior
              </button>
              <span className="text-xs text-gray-500">
                Página {page} de {Math.ceil(totalCount / PAGE_SIZE)}
              </span>
              <button
                onClick={() => setPage(p => Math.min(Math.ceil(totalCount / PAGE_SIZE), p + 1))}
                disabled={page >= Math.ceil(totalCount / PAGE_SIZE)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium"
              >
                Próxima
              </button>
            </div>
          )}
          </>
        )}
      </div>

      {/* Alerta de provisões */}
      {showProvisões && provisoes > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="flex-shrink-0 mt-0.5 text-amber-500">
            <path d="M10 2l8 14H2L10 2z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round"/>
            <path d="M10 8v4M10 14.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <div>
            <div className="text-sm font-semibold text-amber-800">Atenção: Provisões futuras de {fmt(provisoes)}</div>
            <div className="text-xs text-amber-700 mt-0.5">
              Inclui salários, FGTS e demais encargos provisionados para os próximos meses.
              Para equilibrar o resultado, é necessário provisionar as <strong>receitas futuras</strong> correspondentes (próximos BMs).
              <Link href="/financeiro/novo" className="ml-1 underline font-medium">Adicionar receita projetada →</Link>
            </div>
          </div>
        </div>
      )}
      {/* Próximos 30 dias */}
      {(() => {
        const hoje = new Date().toISOString().slice(0, 10)
        const em30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
        const proxReceitas = lancamentos.filter(l => l.tipo === 'receita' && l.status !== 'pago' && l.data_vencimento && l.data_vencimento >= hoje && l.data_vencimento <= em30).sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento)).slice(0, 5)
        const proxDespesas = lancamentos.filter(l => l.tipo === 'despesa' && l.status !== 'pago' && !l.is_provisao && l.data_vencimento && l.data_vencimento >= hoje && l.data_vencimento <= em30).sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento)).slice(0, 5)
        if (proxReceitas.length === 0 && proxDespesas.length === 0) return null
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Próximas Receitas (30d)</h3>
              {proxReceitas.length > 0 ? proxReceitas.map(l => (
                <div key={l.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div><div className="text-sm font-medium text-gray-900">{l.nome}</div><div className="text-[10px] text-gray-400">{l.obras?.nome || '—'}</div></div>
                  <div className="text-right"><div className="text-sm font-bold text-green-700">{fmt(l.valor)}</div><div className="text-[10px] text-gray-400">{new Date(l.data_vencimento + 'T12:00').toLocaleDateString('pt-BR')}</div></div>
                </div>
              )) : <p className="text-xs text-gray-400">Nenhuma receita nos próximos 30 dias</p>}
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Próximas Despesas (30d)</h3>
              {proxDespesas.length > 0 ? proxDespesas.map(l => (
                <div key={l.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div><div className="text-sm font-medium text-gray-900">{l.nome}</div><div className="text-[10px] text-gray-400">{l.obras?.nome || '—'}</div></div>
                  <div className="text-right"><div className="text-sm font-bold text-red-700">{fmt(l.valor)}</div><div className="text-[10px] text-gray-400">{new Date(l.data_vencimento + 'T12:00').toLocaleDateString('pt-BR')}</div></div>
                </div>
              )) : <p className="text-xs text-gray-400">Nenhuma despesa nos próximos 30 dias</p>}
            </div>
          </div>
        )
      })()}

      {/* Batch selection bar + modals */}
      <LoteBar
        selected={selected}
        lancamentos={lancamentos}
        contas={contas}
        onClear={() => setSelected(new Set())}
        onPaid={() => { setSelected(new Set()); loadData() }}
        onDeleted={() => { setSelected(new Set()); loadData() }}
      />

      {/* Modal Novo/Editar Lançamento */}
      <LancamentoModal
        open={showModal}
        onClose={() => setShowModal(false)}
        editingLanc={editingLanc}
        contas={contas}
        fornecedores={fornecedores}
        obras={obras}
        onSaved={loadData}
      />
    </div>
  )
}
