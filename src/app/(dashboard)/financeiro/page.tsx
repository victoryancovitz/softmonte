'use client'
import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import ConfirmButton from '@/components/ConfirmButton'
import SearchInput from '@/components/SearchInput'
import { useToast } from '@/components/Toast'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtK = (v: number) => fmt(v)

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
  const [statusTab, setStatusTab] = useState<'todos' | 'em_aberto' | 'vence_hoje' | 'vencidos' | 'pago'>('todos')
  const [payPopover, setPayPopover] = useState<string | null>(null)
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10))
  const [payConta, setPayConta] = useState('')
  const [contas, setContas] = useState<any[]>([])
  const [modalForm, setModalForm] = useState({
    tipo: 'despesa', nome: '', valor: '', categoria: '', obra_id: '',
    data_competencia: new Date().toISOString().slice(0, 7) + '-01',
    data_vencimento: '', observacao: '', is_provisao: false, status: 'em_aberto',
    conta_id: '', forma_pagamento: '', data_pagamento: '',
    is_parcelado: false, parcelas: 1, intervalo_dias: 30,
    is_recorrente: false, frequencia_dias: 30, limite_recorrencias: 12,
  })
  // Pagamento em lote
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pagandoLote, setPagandoLote] = useState(false)
  const [modalLote, setModalLote] = useState(false)
  const [dataLote, setDataLote] = useState(new Date().toISOString().slice(0, 10))
  const [contaLote, setContaLote] = useState('')
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)
  const [excluindoLote, setExcluindoLote] = useState(false)

  const toggleSelect = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleTodos = (ids: string[]) => setSelected(prev => prev.size === ids.length ? new Set() : new Set(ids))

  const [hoveredBar, setHoveredBar] = useState<{ mes: string; receita: number; pago: number; aVencer: number; vencido: number; acumulado: number; x: number } | null>(null)

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
  }, [])

  useEffect(() => {
    loadData()
  }, [obraId, showProvisões])

  async function loadData() {
    setLoading(true)
    let q = supabase.from('financeiro_lancamentos').select('*, obras(nome)').is('deleted_at', null).order('data_competencia').limit(5000)
    if (obraId && obraId !== 'all') q = q.eq('obra_id', obraId)
    if (!showProvisões) q = q.eq('is_provisao', false)
    const { data } = await q
    setLancamentos(data ?? [])

    // Build monthly cash flow
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

  // Pagamento em lote
  async function confirmarPagamentoLote() {
    if (!dataLote || selected.size === 0) return
    setPagandoLote(true)
    try {
      const upd: Record<string, unknown> = { status: 'pago', data_pagamento: dataLote }
      if (contaLote) upd.conta_id = contaLote
      const { error } = await supabase.from('financeiro_lancamentos').update(upd).in('id', Array.from(selected)).eq('status', 'em_aberto')
      if (error) throw error
      const n = selected.size
      toast.success(`${n} lançamento${n > 1 ? 's' : ''} confirmado${n > 1 ? 's' : ''}`)
      setSelected(new Set())
      setModalLote(false)
      loadData()
    } catch (err: any) {
      toast.error('Erro ao processar: ' + (err.message || 'Tente novamente'))
    } finally {
      setPagandoLote(false)
    }
  }

  // Exclusão em lote
  async function confirmarExclusaoLote() {
    if (selected.size === 0) return
    setExcluindoLote(true)
    try {
      const { error } = await supabase.from('financeiro_lancamentos').update({ deleted_at: new Date().toISOString() }).in('id', Array.from(selected))
      if (error) throw error
      const n = selected.size
      toast.success(`${n} lançamento${n > 1 ? 's' : ''} excluído${n > 1 ? 's' : ''}`)
      setSelected(new Set())
      setConfirmandoExclusao(false)
      loadData()
    } catch (err: any) {
      toast.error('Erro ao excluir: ' + (err.message || 'Tente novamente'))
    } finally {
      setExcluindoLote(false)
    }
  }

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

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold font-display">Lançamentos Financeiros</h1>
          <p className="text-sm text-gray-500 mt-0.5">Receitas, despesas e fluxo de caixa por obra</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={obraId} onChange={e => setObraId(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
            <option value="all">Todas as obras</option>
            {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={showProvisões} onChange={e => setShowProvisões(e.target.checked)}
              className="rounded border-gray-300 text-brand" />
            Provisões
          </label>
          <button onClick={() => { setModalForm(f => ({ ...f, tipo: 'despesa', nome: '', valor: '', categoria: '', obra_id: '', data_vencimento: '', observacao: '', is_provisao: false, status: 'em_aberto', conta_id: '', forma_pagamento: '', data_pagamento: '', is_parcelado: false, parcelas: 1, is_recorrente: false, frequencia_dias: 30, limite_recorrencias: 12 })); setShowModal(true) }}
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
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">Fluxo de Caixa Mensal</h2>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-400 inline-block"/>&nbsp;Receita</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-400 inline-block"/>&nbsp;Pago</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-400 inline-block"/>&nbsp;A vencer</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-rose-600 inline-block"/>&nbsp;Vencido</span>
              <span className="flex items-center gap-1"><span className="w-3 h-1 border-t-2 border-dashed border-brand inline-block"/>&nbsp;Acumulado</span>
            </div>
          </div>
          {fluxo.length > 0 ? (
            <div className="relative">
            <svg width="100%" viewBox={`0 0 600 ${chartH + 60}`} className="overflow-visible">
              {/* Grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map(p => (
                <g key={p}>
                  <line x1="40" y1={chartH - p * chartH + 10} x2="590" y2={chartH - p * chartH + 10}
                    stroke="#f3f4f6" strokeWidth="1"/>
                  <text x="35" y={chartH - p * chartH + 14} textAnchor="end" fontSize="8" fill="#9ca3af">
                    {fmtK(maxVal * p)}
                  </text>
                </g>
              ))}
              {/* Zero line */}
              <line x1="40" y1={chartH + 10} x2="590" y2={chartH + 10} stroke="#e5e7eb" strokeWidth="1"/>

              {fluxo.map((m, i) => {
                const xStep = 550 / Math.max(fluxo.length, 1)
                const x = 40 + i * xStep + xStep / 2
                const recH = Math.min((m.totalRec / maxVal) * chartH, chartH)
                const despH = Math.min((m.totalDesp / maxVal) * chartH, chartH)
                const mes = m.mes.slice(5, 7) + '/' + m.mes.slice(2, 4)
                return (
                  <g key={m.mes}>
                    {/* Hit area for tooltip */}
                    <rect x={x - barW - 6} y={0} width={barW * 2 + 12} height={chartH + 30} fill="transparent"
                      onMouseEnter={() => setHoveredBar({ mes, receita: m.totalRec, pago: m.despesa_pago, aVencer: m.despesa_aberto, vencido: m.despesa_vencido || 0, acumulado: m.acum, x })}
                      onMouseLeave={() => setHoveredBar(null)} style={{ cursor: 'pointer' }} />
                    {/* Receita bar */}
                    <rect x={x - barW - 2} y={chartH - recH + 10} width={barW} height={recH}
                      fill="#34d399" rx="2" opacity="0.85" style={{ pointerEvents: 'none' }}/>
                    {/* Despesa stacked: pago + a vencer + vencido */}
                    {(() => {
                      const pagoH = Math.min((m.despesa_pago / maxVal) * chartH, chartH)
                      const aVencerH = Math.min((m.despesa_aberto / maxVal) * chartH, chartH)
                      const vencidoH = Math.min(((m.despesa_vencido || 0) / maxVal) * chartH, chartH)
                      return <>
                        <rect x={x + 2} y={chartH - pagoH - aVencerH - vencidoH + 10} width={barW} height={vencidoH}
                          fill="#e11d48" rx="0" opacity="0.9"/>
                        <rect x={x + 2} y={chartH - pagoH - aVencerH + 10} width={barW} height={aVencerH}
                          fill="#fbbf24" rx="0" opacity="0.85"/>
                        <rect x={x + 2} y={chartH - pagoH + 10} width={barW} height={pagoH}
                          fill="#f87171" rx="2" opacity="0.85"/>
                      </>
                    })()}
                    {/* Month label */}
                    <text x={x} y={chartH + 26} textAnchor="middle" fontSize="8" fill="#6b7280">{mes}</text>
                  </g>
                )
              })}

              {/* Accumulated line */}
              {fluxo.length > 1 && (() => {
                const maxAcum = Math.max(...fluxo.map(m => Math.abs(m.acum)), 1)
                const midY = chartH / 2 + 10
                const pts = fluxo.map((m, i) => {
                  const xStep = 550 / Math.max(fluxo.length, 1)
                  const x = 40 + i * xStep + xStep / 2
                  const y = midY - (m.acum / maxAcum) * (chartH / 2 - 5)
                  return `${x},${y}`
                }).join(' ')
                return (
                  <polyline points={pts} fill="none" stroke="#c07000" strokeWidth="2"
                    strokeDasharray="4,3" strokeLinecap="round"/>
                )
              })()}
            </svg>
            {hoveredBar && (
              <div className="absolute z-20 pointer-events-none bg-[#0f1e2e] text-white rounded-xl shadow-2xl border border-white/10 p-3 text-xs min-w-[180px]" style={{ left: Math.min(hoveredBar.x * 100 / 600, 65) + '%', top: 20 }}>
                <p className="font-bold text-brand mb-2 text-sm">{hoveredBar.mes}</p>
                <div className="space-y-1.5">
                  <div className="flex justify-between gap-4"><span className="text-green-400">Receita</span><span className="font-semibold">{fmt(hoveredBar.receita)}</span></div>
                  <div className="flex justify-between gap-4"><span className="text-red-400">Pago</span><span className="font-semibold">{fmt(hoveredBar.pago)}</span></div>
                  {hoveredBar.aVencer > 0 && <div className="flex justify-between gap-4"><span className="text-amber-400">A vencer</span><span>{fmt(hoveredBar.aVencer)}</span></div>}
                  {hoveredBar.vencido > 0 && <div className="flex justify-between gap-4"><span className="text-rose-400">Vencido</span><span>{fmt(hoveredBar.vencido)}</span></div>}
                  <div className="border-t border-white/10 pt-1.5 mt-1">
                    <div className="flex justify-between gap-4"><span className="text-gray-400">Saldo mês</span><span className={`font-bold ${hoveredBar.receita - hoveredBar.pago >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(hoveredBar.receita - hoveredBar.pago)}</span></div>
                    <div className="flex justify-between gap-4"><span className="text-gray-400">Acumulado</span><span className={`font-semibold ${hoveredBar.acumulado >= 0 ? 'text-green-300' : 'text-red-300'}`}>{fmt(hoveredBar.acumulado)}</span></div>
                  </div>
                </div>
              </div>
            )}
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-400 text-sm">Sem dados</div>
          )}
        </div>

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
        <div className="px-5 py-3 border-b border-gray-100 flex gap-3">
          {(['fluxo', 'lancamentos'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`text-sm font-medium px-3 py-1 rounded-lg transition-colors ${tab === t ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              {t === 'fluxo' ? 'Fluxo mensal' : 'Lançamentos'}
            </button>
          ))}
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
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="w-8 px-2">
                  {(() => {
                    const idsVisiveis = lancamentos.filter(l => {
                      if (busca && !l.nome?.toLowerCase().includes(busca.toLowerCase()) && !l.categoria?.toLowerCase().includes(busca.toLowerCase())) return false
                      if (filtroTipo && l.tipo !== filtroTipo) return false
                      if (filtroStatus && l.status !== filtroStatus) return false
                      if (filtroProvisao && !l.is_provisao) return false
                      const hj = new Date().toISOString().slice(0, 10)
                      if (statusTab === 'em_aberto' && (l.status !== 'em_aberto' || l.is_provisao)) return false
                      if (statusTab === 'vence_hoje' && !(l.status === 'em_aberto' && l.data_vencimento === hj)) return false
                      if (statusTab === 'vencidos' && !(l.status === 'em_aberto' && l.data_vencimento && l.data_vencimento < hj)) return false
                      if (statusTab === 'pago' && l.status !== 'pago') return false
                      return l.status === 'em_aberto'
                    }).map(l => l.id)
                    return <input type="checkbox" checked={selected.size > 0 && selected.size === idsVisiveis.length && idsVisiveis.length > 0} onChange={() => toggleTodos(idsVisiveis)} className="rounded border-gray-300 text-brand focus:ring-brand cursor-pointer" />
                  })()}
                </th>
                {['Data','Descrição','Obra','Tipo','Valor','Status',''].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lancamentos.filter(l => {
                if (busca && !l.nome?.toLowerCase().includes(busca.toLowerCase()) && !l.categoria?.toLowerCase().includes(busca.toLowerCase()) && !l.tipo?.toLowerCase().includes(busca.toLowerCase())) return false
                if (filtroTipo && l.tipo !== filtroTipo) return false
                if (filtroStatus && l.status !== filtroStatus) return false
                if (filtroProvisao && !l.is_provisao) return false
                // Status tab filter
                const hoje = new Date().toISOString().slice(0, 10)
                if (statusTab === 'em_aberto' && (l.status !== 'em_aberto' || l.is_provisao)) return false
                if (statusTab === 'vence_hoje' && !(l.status === 'em_aberto' && l.data_vencimento === hoje)) return false
                if (statusTab === 'vencidos' && !(l.status === 'em_aberto' && l.data_vencimento && l.data_vencimento < hoje)) return false
                if (statusTab === 'pago' && l.status !== 'pago') return false
                return true
              }).map(l => (
                <tr key={l.id} className={`border-b border-gray-50 hover:bg-gray-50/80 ${selected.has(l.id) ? 'bg-brand/5' : ''}`}>
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
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{l.obras?.nome || '—'}</td>
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
              ))}
            </tbody>
          </table>
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

      {/* Barra flutuante de seleção em lote */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-5 py-3 bg-[#0f1e2e] rounded-xl shadow-2xl border border-brand/30">
          <div className="text-white text-sm">
            <span className="font-bold text-brand">{selected.size}</span>{' '}lançamento{selected.size > 1 ? 's' : ''}
            <span className="ml-2 text-gray-400">= {lancamentos.filter(l => selected.has(l.id)).reduce((s, l) => s + Number(l.valor), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          </div>
          <div className="w-px h-6 bg-white/20" />
          <button onClick={() => setSelected(new Set())} className="text-gray-400 hover:text-white text-sm transition-colors">Limpar</button>
          {(() => {
            const sel = lancamentos.filter(l => selected.has(l.id))
            const temR = sel.some(l => l.tipo === 'receita')
            const temD = sel.some(l => l.tipo === 'despesa')
            const label = temR && temD ? 'Confirmar liquidação' : temR ? `Confirmar recebimento (${selected.size})` : `Confirmar pagamento (${selected.size})`
            const cls = temR && !temD ? 'bg-green-600 hover:bg-green-700' : 'bg-brand hover:bg-brand-dark'
            return <button onClick={() => { setDataLote(new Date().toISOString().slice(0, 10)); setContaLote(''); setModalLote(true) }} className={`${cls} text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors`}>{label}</button>
          })()}
          <div className="w-px h-6 bg-white/20" />
          <button onClick={() => setConfirmandoExclusao(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-red-400 hover:text-white hover:bg-red-600/80 transition-colors border border-red-500/30 hover:border-red-500">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10"/></svg>
            Excluir ({selected.size})
          </button>
        </div>
      )}

      {/* Modal confirmação lote */}
      {modalLote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              {(() => { const sel = lancamentos.filter(l => selected.has(l.id)); const temR = sel.some(l => l.tipo === 'receita'); const temD = sel.some(l => l.tipo === 'despesa'); return temR && temD ? 'Liquidar lançamentos' : temR ? 'Confirmar recebimentos' : 'Confirmar pagamentos' })()}
            </h3>
            <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm space-y-1">
              {(() => {
                const sel = lancamentos.filter(l => selected.has(l.id))
                const despesas = sel.filter(l => l.tipo === 'despesa')
                const receitas = sel.filter(l => l.tipo === 'receita')
                const sumD = despesas.reduce((s, l) => s + Number(l.valor), 0)
                const sumR = receitas.reduce((s, l) => s + Number(l.valor), 0)
                return <>
                  {despesas.length > 0 && <div className="flex justify-between"><span className="text-gray-500">{despesas.length} despesa{despesas.length > 1 ? 's' : ''}</span><span className="font-semibold text-red-600">−{fmt(sumD)}</span></div>}
                  {receitas.length > 0 && <div className="flex justify-between"><span className="text-gray-500">{receitas.length} receita{receitas.length > 1 ? 's' : ''}</span><span className="font-semibold text-green-600">+{fmt(sumR)}</span></div>}
                  <div className="border-t pt-1 flex justify-between font-bold"><span>Total</span><span>{fmt(sumD + sumR)}</span></div>
                </>
              })()}
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Data de pagamento / recebimento</label>
              <input type="date" value={dataLote} onChange={e => setDataLote(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-1">Conta bancária <span className="text-gray-400 font-normal">(opcional)</span></label>
              <select value={contaLote} onChange={e => setContaLote(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand">
                <option value="">— Manter conta atual —</option>
                {contas.map(c => <option key={c.id} value={c.id}>{c.is_padrao ? '★ ' : ''}{c.banco ? `${c.banco} — ` : ''}{c.nome}</option>)}
              </select>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalLote(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancelar</button>
              <button onClick={confirmarPagamentoLote} disabled={pagandoLote} className="flex-1 px-4 py-2 bg-brand text-white rounded-lg text-sm font-semibold hover:bg-brand-dark disabled:opacity-50">{pagandoLote ? 'Processando...' : `Confirmar (${selected.size})`}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmação exclusão em lote */}
      {confirmandoExclusao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <h3 className="text-center text-lg font-bold text-gray-900 mb-1">Excluir {selected.size} lançamento{selected.size > 1 ? 's' : ''}?</h3>
            <p className="text-center text-sm text-gray-500 mb-2">Esta ação não pode ser desfeita.</p>
            {(() => {
              const sel = lancamentos.filter(l => selected.has(l.id))
              const despesas = sel.filter(l => l.tipo === 'despesa')
              const receitas = sel.filter(l => l.tipo === 'receita')
              const pagos = sel.filter(l => l.status === 'pago')
              return (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-5 text-sm space-y-1">
                  {despesas.length > 0 && <div className="flex justify-between text-gray-700"><span>{despesas.length} despesa{despesas.length > 1 ? 's' : ''}</span><span className="font-medium text-red-700">{fmt(despesas.reduce((s, l) => s + Number(l.valor), 0))}</span></div>}
                  {receitas.length > 0 && <div className="flex justify-between text-gray-700"><span>{receitas.length} receita{receitas.length > 1 ? 's' : ''}</span><span className="font-medium text-green-700">{fmt(receitas.reduce((s, l) => s + Number(l.valor), 0))}</span></div>}
                  {pagos.length > 0 && <p className="text-xs text-red-600 font-medium pt-1 border-t border-red-200 mt-1">⚠️ {pagos.length} já pago{pagos.length > 1 ? 's' : ''} — excluir afetará o resultado financeiro</p>}
                </div>
              )
            })()}
            <div className="flex gap-3">
              <button onClick={() => setConfirmandoExclusao(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancelar</button>
              <button onClick={confirmarExclusaoLote} disabled={excluindoLote} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50">{excluindoLote ? 'Excluindo...' : `Excluir (${selected.size})`}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Novo Lançamento */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-black/40" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-md bg-white shadow-2xl overflow-y-auto">
            <div className={`px-6 py-4 flex items-center justify-between ${modalForm.tipo === 'receita' ? 'bg-green-600' : 'bg-red-600'} text-white`}>
              <h2 className="font-bold">
                {modalForm.tipo === 'receita' ? 'Nova Receita' : 'Nova Despesa'}
              </h2>
              <div className="flex items-center gap-3">
                <select value={modalForm.tipo} onChange={e => setModalForm(f => ({ ...f, tipo: e.target.value }))}
                  className="bg-white/20 text-white text-sm rounded px-2 py-1 border-0">
                  <option value="receita" className="text-gray-900">Receita</option>
                  <option value="despesa" className="text-gray-900">Despesa</option>
                </select>
                <button onClick={() => setShowModal(false)} className="text-white/80 hover:text-white text-lg">✕</button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Descrição *</label>
                  <input value={modalForm.nome} onChange={e => setModalForm(f => ({ ...f, nome: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Nome do lançamento" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Valor *</label>
                  <input type="number" step="0.01" value={modalForm.valor} onChange={e => setModalForm(f => ({ ...f, valor: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="0,00" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Categoria</label>
                  <select value={modalForm.categoria} onChange={e => setModalForm(f => ({ ...f, categoria: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                    <option value="">Selecionar...</option>
                    {modalForm.tipo === 'receita'
                      ? ['Faturamento HH', 'Serviços', 'Outras receitas'].map(c => <option key={c} value={c}>{c}</option>)
                      : ['Folha de Pagamento', 'Encargos', 'Aluguel', 'Materiais', 'Compras', 'Impostos', 'Honorários', 'Despesas Financeiras', 'Amortização de Empréstimos', 'Depreciação', 'Custo dos Serviços Prestados', 'Outras despesas'].map(c => <option key={c} value={c}>{c}</option>)
                    }
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Obra</label>
                  <select value={modalForm.obra_id} onChange={e => {
                    const oId = e.target.value
                    setModalForm(f => {
                      const ob = obras.find(o => o.id === oId)
                      const contaId = f.tipo === 'receita' ? ob?.conta_recebimento_id : ob?.conta_pagamento_id
                      return { ...f, obra_id: oId, conta_id: contaId || f.conta_id || contas.find(c => c.is_padrao)?.id || '' }
                    })
                  }} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                    <option value="">Nenhuma</option>
                    {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Competência</label>
                  <input type="date" value={modalForm.data_competencia} onChange={e => setModalForm(f => ({ ...f, data_competencia: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Vencimento</label>
                  <input type="date" value={modalForm.data_vencimento} onChange={e => setModalForm(f => ({ ...f, data_vencimento: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Conta</label>
                  <select value={modalForm.conta_id} onChange={e => setModalForm(f => ({ ...f, conta_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                    <option value="">Selecionar...</option>
                    {contas.map(c => <option key={c.id} value={c.id}>{c.is_padrao ? '★ ' : ''}{c.banco ? `${c.banco} — ` : ''}{c.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Nº Documento</label>
                  <input value={(modalForm as any).numero_documento || ''} onChange={e => setModalForm(f => ({ ...f, numero_documento: e.target.value } as any))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="NF-e, OS, boleto..." />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Observação</label>
                  <textarea value={modalForm.observacao} onChange={e => setModalForm(f => ({ ...f, observacao: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" rows={2} />
                </div>
                <div className="col-span-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={modalForm.is_provisao} onChange={e => setModalForm(f => ({ ...f, is_provisao: e.target.checked }))}
                      className="rounded border-gray-300 text-brand" />
                    É provisão (despesa futura estimada)
                  </label>
                </div>
                {/* Parcelamento */}
                <div className="col-span-2 border-t border-gray-100 pt-3">
                  <label className="flex items-center gap-2 text-sm cursor-pointer mb-2">
                    <input type="checkbox" checked={modalForm.is_parcelado} onChange={e => setModalForm(f => ({ ...f, is_parcelado: e.target.checked }))}
                      className="rounded border-gray-300 text-brand" />
                    Parcelado
                  </label>
                  {modalForm.is_parcelado && (
                    <div className="flex gap-3">
                      <div>
                        <label className="block text-[10px] text-gray-400 mb-0.5">Parcelas</label>
                        <select value={modalForm.parcelas} onChange={e => setModalForm(f => ({ ...f, parcelas: Number(e.target.value) }))}
                          className="px-2 py-1 border border-gray-200 rounded text-sm">
                          {[1,2,3,4,5,6,7,8,9,10,11,12,18,24,36].map(n => <option key={n} value={n}>{n}x</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-400 mb-0.5">Intervalo</label>
                        <select value={modalForm.intervalo_dias} onChange={e => setModalForm(f => ({ ...f, intervalo_dias: Number(e.target.value) }))}
                          className="px-2 py-1 border border-gray-200 rounded text-sm">
                          <option value={7}>Semanal</option>
                          <option value={15}>Quinzenal</option>
                          <option value={30}>Mensal</option>
                          <option value={60}>Bimestral</option>
                          <option value={90}>Trimestral</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
                {/* Recorrência */}
                <div className="col-span-2 border-t border-gray-100 pt-3">
                  <label className="flex items-center gap-2 text-sm cursor-pointer mb-2">
                    <input type="checkbox" checked={modalForm.is_recorrente} onChange={e => setModalForm(f => ({ ...f, is_recorrente: e.target.checked, is_parcelado: false }))}
                      className="rounded border-gray-300 text-brand" />
                    Recorrente (gera automaticamente)
                  </label>
                  {modalForm.is_recorrente && (
                    <div className="flex gap-3">
                      <div>
                        <label className="block text-[10px] text-gray-400 mb-0.5">Frequência</label>
                        <select value={modalForm.frequencia_dias} onChange={e => setModalForm(f => ({ ...f, frequencia_dias: Number(e.target.value) }))}
                          className="px-2 py-1 border border-gray-200 rounded text-sm">
                          <option value={7}>Semanal</option>
                          <option value={15}>Quinzenal</option>
                          <option value={30}>Mensal</option>
                          <option value={60}>Bimestral</option>
                          <option value={90}>Trimestral</option>
                          <option value={180}>Semestral</option>
                          <option value={365}>Anual</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-400 mb-0.5">Limite (repetições)</label>
                        <select value={modalForm.limite_recorrencias} onChange={e => setModalForm(f => ({ ...f, limite_recorrencias: Number(e.target.value) }))}
                          className="px-2 py-1 border border-gray-200 rounded text-sm">
                          {[3,6,12,24,36,48,60].map(n => <option key={n} value={n}>{n}x</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">
                  Cancelar
                </button>
                <button disabled={!modalForm.nome || !modalForm.valor} onClick={async () => {
                  const { data: { user } } = await supabase.auth.getUser()
                  const valorNum = Number(modalForm.valor)
                  if (!valorNum || valorNum <= 0) { toast.error('Valor inválido'); return }

                  if (modalForm.is_recorrente) {
                    const grupoId = crypto.randomUUID()
                    const baseVenc = modalForm.data_vencimento || new Date().toISOString().slice(0, 10)
                    const rows = Array.from({ length: modalForm.limite_recorrencias }, (_, i) => {
                      const venc = new Date(baseVenc + 'T12:00')
                      venc.setDate(venc.getDate() + i * modalForm.frequencia_dias)
                      const comp = new Date(venc)
                      return {
                        tipo: modalForm.tipo, nome: modalForm.nome,
                        valor: valorNum, categoria: modalForm.categoria || null,
                        obra_id: modalForm.obra_id || null, conta_id: modalForm.conta_id || null,
                        data_competencia: comp.toISOString().slice(0, 10),
                        data_vencimento: venc.toISOString().slice(0, 10),
                        observacao: modalForm.observacao || null, is_provisao: modalForm.is_provisao,
                        origem: 'manual', status: 'em_aberto', created_by: user?.id ?? null,
                        is_parcelado: true, parcela_numero: i + 1, parcela_total: modalForm.limite_recorrencias,
                        parcela_grupo_id: grupoId, intervalo_parcelas_dias: modalForm.frequencia_dias,
                        numero_documento: (modalForm as any).numero_documento || null,
                      }
                    })
                    const { error } = await supabase.from('financeiro_lancamentos').insert(rows)
                    if (error) { toast.error('Erro: ' + error.message); return }
                    toast.success(`${modalForm.limite_recorrencias} lançamentos recorrentes criados`)
                  } else if (modalForm.is_parcelado && modalForm.parcelas > 1) {
                    const grupoId = crypto.randomUUID()
                    const valorParcela = Math.round(valorNum / modalForm.parcelas * 100) / 100
                    const baseVenc = modalForm.data_vencimento || new Date().toISOString().slice(0, 10)
                    const rows = Array.from({ length: modalForm.parcelas }, (_, i) => {
                      const venc = new Date(baseVenc + 'T12:00')
                      venc.setDate(venc.getDate() + i * modalForm.intervalo_dias)
                      return {
                        tipo: modalForm.tipo, nome: `${modalForm.nome} (${i + 1}/${modalForm.parcelas})`,
                        valor: valorParcela, categoria: modalForm.categoria || null,
                        obra_id: modalForm.obra_id || null, conta_id: modalForm.conta_id || null,
                        data_competencia: modalForm.data_competencia || null,
                        data_vencimento: venc.toISOString().slice(0, 10),
                        observacao: modalForm.observacao || null, is_provisao: modalForm.is_provisao,
                        origem: 'manual', status: 'em_aberto', created_by: user?.id ?? null,
                        is_parcelado: true, parcela_numero: i + 1, parcela_total: modalForm.parcelas,
                        parcela_grupo_id: grupoId, intervalo_parcelas_dias: modalForm.intervalo_dias,
                        numero_documento: (modalForm as any).numero_documento || null,
                      }
                    })
                    const { error } = await supabase.from('financeiro_lancamentos').insert(rows)
                    if (error) { toast.error('Erro: ' + error.message); return }
                    toast.success(`${modalForm.parcelas} parcelas criadas`)
                  } else {
                    const { error } = await supabase.from('financeiro_lancamentos').insert({
                      tipo: modalForm.tipo, nome: modalForm.nome, valor: valorNum,
                      categoria: modalForm.categoria || null, obra_id: modalForm.obra_id || null,
                      conta_id: modalForm.conta_id || null,
                      data_competencia: modalForm.data_competencia || null,
                      data_vencimento: modalForm.data_vencimento || null,
                      observacao: modalForm.observacao || null, is_provisao: modalForm.is_provisao,
                      origem: 'manual', status: 'em_aberto', created_by: user?.id ?? null,
                      numero_documento: (modalForm as any).numero_documento || null,
                    })
                    if (error) { toast.error('Erro: ' + error.message); return }
                    toast.success('Lançamento criado')
                  }
                  setShowModal(false)
                  loadData()
                }} className={`flex-1 px-4 py-2 text-white rounded-lg text-sm font-medium ${modalForm.tipo === 'receita' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} disabled:opacity-40`}>
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
