'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtK = (v: number) => {
  if (Math.abs(v) >= 1000) return (v / 1000).toFixed(0) + 'k'
  return v.toFixed(0)
}

const CAT_COLORS: Record<string, string> = {
  'Salário Base': '#6366f1',
  'FGTS': '#8b5cf6',
  'Vale-Transporte': '#0ea5e9',
  'Treinamentos Obrigatórios': '#f59e0b',
  'Acordos Trabalhistas': '#ef4444',
  'Rescisões Extraordinárias': '#f97316',
  'Receita HH Homem-Hora': '#10b981',
}

export default function FinanceiroPage() {
  const [obras, setObras] = useState<any[]>([])
  const [obraId, setObraId] = useState<string>('all')
  const [lancamentos, setLancamentos] = useState<any[]>([])
  const [fluxo, setFluxo] = useState<any[]>([])
  const [showProvisoes, setShowProvisoes] = useState(true)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'fluxo' | 'lancamentos'>('fluxo')
  const supabase = createClient()

  useEffect(() => {
    supabase.from('obras').select('id,nome').order('nome').then(({ data }) => setObras(data ?? []))
  }, [])

  useEffect(() => {
    loadData()
  }, [obraId, showProvisoes])

  async function loadData() {
    setLoading(true)
    let q = supabase.from('financeiro_lancamentos').select('*').order('data_competencia')
    if (obraId !== 'all') q = q.eq('obra_id', obraId)
    if (!showProvisoes) q = q.eq('is_provisao', false)
    const { data } = await q
    setLancamentos(data ?? [])

    // Build monthly cash flow
    const byMes: Record<string, { mes: string; receita_pago: number; receita_aberto: number; despesa_pago: number; despesa_aberto: number; provisao: number }> = {}
    ;(data ?? []).forEach((l: any) => {
      const mes = l.data_competencia?.slice(0, 7) ?? 'sem-data'
      if (!byMes[mes]) byMes[mes] = { mes, receita_pago: 0, receita_aberto: 0, despesa_pago: 0, despesa_aberto: 0, provisao: 0 }
      const v = Number(l.valor)
      if (l.tipo === 'receita') {
        if (l.status === 'pago') byMes[mes].receita_pago += v
        else byMes[mes].receita_aberto += v
      } else {
        if (l.is_provisao) byMes[mes].provisao += v
        else if (l.status === 'pago') byMes[mes].despesa_pago += v
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

  // KPIs
  const receitaPaga = lancamentos.filter(l => l.tipo === 'receita' && l.status === 'pago').reduce((s, l) => s + Number(l.valor), 0)
  const receitaAberto = lancamentos.filter(l => l.tipo === 'receita' && l.status === 'em_aberto').reduce((s, l) => s + Number(l.valor), 0)
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
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Resultado Financeiro</h1>
          <p className="text-sm text-gray-500 mt-0.5">Fluxo de caixa, receitas e despesas por obra</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={showProvisoes} onChange={e => setShowProvisoes(e.target.checked)}
              className="rounded border-gray-300 text-brand" />
            Incluir provisões
          </label>
          <select value={obraId} onChange={e => setObraId(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
            <option value="all">Todas as obras</option>
            {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
          <Link href="/financeiro/novo" className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark">
            + Lançamento
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-6 gap-3 mb-5">
        {[
          { label: 'Receita recebida', value: receitaPaga, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Receita em aberto', value: receitaAberto, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Despesa paga', value: despesaPaga, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Despesa em aberto', value: despesaAberto, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Provisões futuras', value: provisoes, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Resultado total', value: resultadoTotal, color: resultadoTotal >= 0 ? 'text-green-700' : 'text-red-700', bg: resultadoTotal >= 0 ? 'bg-green-50' : 'bg-red-50' },
        ].map(k => (
          <div key={k.label} className={`${k.bg} rounded-xl p-3`}>
            <div className="text-xs text-gray-500 mb-1 leading-tight">{k.label}</div>
            <div className={`text-base font-bold ${k.color}`}>
              {fmt(k.value)}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-5 mb-5">
        {/* Fluxo de caixa chart */}
        <div className="col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">Fluxo de Caixa Mensal</h2>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-400 inline-block"/>&nbsp;Receita</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-400 inline-block"/>&nbsp;Despesa</span>
              <span className="flex items-center gap-1"><span className="w-3 h-1 border-t-2 border-dashed border-brand inline-block"/>&nbsp;Acumulado</span>
            </div>
          </div>
          {fluxo.length > 0 ? (
            <svg width="100%" viewBox={`0 0 600 ${chartH + 60}`} className="overflow-visible">
              {/* Grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map(p => (
                <g key={p}>
                  <line x1="40" y1={chartH - p * chartH + 10} x2="590" y2={chartH - p * chartH + 10}
                    stroke="#f3f4f6" strokeWidth="1"/>
                  <text x="35" y={chartH - p * chartH + 14} textAnchor="end" fontSize="8" fill="#9ca3af">
                    {fmtK(maxVal * p)}k
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
                    {/* Receita bar */}
                    <rect x={x - barW - 2} y={chartH - recH + 10} width={barW} height={recH}
                      fill="#34d399" rx="2" opacity="0.85"/>
                    {/* Despesa bar */}
                    <rect x={x + 2} y={chartH - despH + 10} width={barW} height={despH}
                      fill="#f87171" rx="2" opacity="0.85"/>
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
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-400 text-sm">Sem dados</div>
          )}
        </div>

        {/* Despesas por categoria */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
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
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-5">
        <div className="px-5 py-3 border-b border-gray-100 flex gap-3">
          {(['fluxo', 'lancamentos'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`text-sm font-medium px-3 py-1 rounded-lg transition-colors ${tab === t ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              {t === 'fluxo' ? 'Fluxo mensal' : 'Lançamentos'}
            </button>
          ))}
        </div>

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
                <tr key={m.mes} className="border-b border-gray-50 hover:bg-gray-50">
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
                {['Data','Descrição','Categoria','Tipo','Valor','Status'].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lancamentos.map(l => (
                <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{new Date(l.data_competencia).toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-2.5 font-medium">
                    {l.nome}
                    {l.is_provisao && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded">provisão</span>}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{l.categoria || '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${l.tipo === 'receita' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {l.tipo}
                    </span>
                  </td>
                  <td className={`px-4 py-2.5 font-semibold ${l.tipo === 'receita' ? 'text-green-700' : 'text-red-700'}`}>
                    {l.tipo === 'receita' ? '+' : '-'}{fmt(l.valor)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${l.status === 'pago' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {l.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Alerta de provisões */}
      {showProvisoes && provisoes > 0 && (
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
    </div>
  )
}
