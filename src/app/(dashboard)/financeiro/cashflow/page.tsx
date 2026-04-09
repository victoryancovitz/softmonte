'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import BackButton from '@/components/BackButton'
import { TrendingUp, TrendingDown, AlertCircle } from 'lucide-react'

export default function CashflowPage() {
  const [eventos, setEventos] = useState<any[]>([])
  const [saldoInicial, setSaldoInicial] = useState(0)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    (async () => {
      const [{ data: cf }, { data: contas }] = await Promise.all([
        supabase.from('vw_cashflow_projetado').select('*').order('data').limit(500),
        supabase.from('vw_contas_saldo').select('*'),
      ])
      setEventos(cf || [])
      const saldoTotal = (contas || []).reduce((s: number, c: any) => s + Number(c.saldo || 0), 0)
      setSaldoInicial(saldoTotal)
      setLoading(false)
    })()
  }, [])

  const fmt = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  // Agrupamento por dia com saldo acumulado
  const hoje = new Date().toISOString().slice(0, 10)
  const futuros = eventos.filter(e => e.data >= hoje)
  const byDay = new Map<string, any[]>()
  futuros.forEach(e => {
    if (!byDay.has(e.data)) byDay.set(e.data, [])
    byDay.get(e.data)!.push(e)
  })
  const datas = Array.from(byDay.keys()).sort()
  let saldo = saldoInicial
  const dias = datas.map(d => {
    const evs = byDay.get(d)!
    const entra = evs.filter(e => Number(e.valor) > 0).reduce((s, e) => s + Number(e.valor), 0)
    const sai = evs.filter(e => Number(e.valor) < 0).reduce((s, e) => s + Number(e.valor), 0)
    saldo += entra + sai
    return { data: d, entra, sai, saldo, eventos: evs }
  })

  const entradaTotal = dias.reduce((s, d) => s + d.entra, 0)
  const saidaTotal = dias.reduce((s, d) => s + d.sai, 0)
  const saldoFinal = saldoInicial + entradaTotal + saidaTotal
  const temEstouro = dias.some(d => d.saldo < 0)

  // Chart
  const chartW = 900, chartH = 260, padL = 60, padR = 20, padT = 20, padB = 40
  const innerW = chartW - padL - padR
  const innerH = chartH - padT - padB
  const maxSaldo = Math.max(saldoInicial, ...dias.map(d => d.saldo), 1)
  const minSaldo = Math.min(0, ...dias.map(d => d.saldo))
  const range = maxSaldo - minSaldo
  const yZero = padT + innerH * (maxSaldo / range)

  const points = dias.map((d, i) => {
    const x = padL + (innerW * i) / Math.max(dias.length - 1, 1)
    const y = padT + innerH * ((maxSaldo - d.saldo) / range)
    return { x, y, ...d }
  })

  if (loading) return <div className="p-6 text-gray-400 text-sm">Carregando...</div>

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/financeiro" />
        <Link href="/financeiro" className="text-gray-400 hover:text-gray-600">Financeiro</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700">Fluxo de Caixa Projetado</span>
      </div>

      <h1 className="text-xl font-bold font-display text-brand mb-1">Fluxo de Caixa Projetado</h1>
      <p className="text-sm text-gray-500 mb-6">Próximos 90 dias com receitas a receber, folha prevista e saídas em aberto.</p>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-gray-100 border-l-4 border-l-blue-500 p-4">
          <div className="text-[11px] font-semibold text-gray-400 uppercase">Saldo inicial</div>
          <div className="text-lg font-bold text-gray-900 font-display">{fmt(saldoInicial)}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 border-l-4 border-l-green-500 p-4">
          <div className="text-[11px] font-semibold text-gray-400 uppercase">Entradas previstas</div>
          <div className="text-lg font-bold text-green-700 font-display">{fmt(entradaTotal)}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 border-l-4 border-l-red-500 p-4">
          <div className="text-[11px] font-semibold text-gray-400 uppercase">Saídas previstas</div>
          <div className="text-lg font-bold text-red-700 font-display">{fmt(saidaTotal)}</div>
        </div>
        <div className={`bg-white rounded-xl border border-gray-100 border-l-4 ${saldoFinal >= 0 ? 'border-l-green-500' : 'border-l-red-500'} p-4`}>
          <div className="text-[11px] font-semibold text-gray-400 uppercase">Saldo projetado</div>
          <div className={`text-lg font-bold font-display ${saldoFinal >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(saldoFinal)}</div>
        </div>
      </div>

      {saldoInicial === 0 && eventos.length === 0 && (
        <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
          <div>
            <div className="font-bold text-amber-700 text-sm">Nenhuma conta corrente cadastrada</div>
            <div className="text-amber-600 text-xs mt-0.5">
              Saldo inicial R$0,00. Cadastre contas correntes em{' '}
              <Link href="/financeiro/contas" className="underline font-semibold hover:text-amber-800">Financeiro &rarr; Contas Correntes</Link>{' '}
              para que o saldo inicial seja calculado automaticamente.
            </div>
          </div>
        </div>
      )}

      {temEstouro && (
        <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
          <div>
            <div className="font-bold text-red-700 text-sm">Alerta: saldo projetado ficará negativo em algum momento</div>
            <div className="text-red-600 text-xs mt-0.5">Reveja cronograma de pagamentos ou antecipe recebíveis.</div>
          </div>
        </div>
      )}

      {/* Gráfico de linha */}
      {dias.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-5">
          <h3 className="text-sm font-bold text-brand mb-3">Saldo acumulado dia a dia</h3>
          <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full" style={{ minWidth: 600 }}>
            {/* Grid */}
            {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
              const y = padT + innerH * (1 - t)
              const val = minSaldo + range * t
              return (
                <g key={i}>
                  <line x1={padL} y1={y} x2={chartW - padR} y2={y} stroke="#f1f5f9" />
                  <text x={padL - 8} y={y + 3} textAnchor="end" fontSize="9" fill="#94a3b8">
                    {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val.toFixed(0)}
                  </text>
                </g>
              )
            })}
            {/* Linha zero */}
            <line x1={padL} y1={yZero} x2={chartW - padR} y2={yZero} stroke="#ef4444" strokeWidth="1" strokeDasharray="4 4" />
            {/* Linha de saldo */}
            <polyline
              points={points.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none" stroke="#0F3757" strokeWidth="2"
            />
            {/* Pontos */}
            {points.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="3" fill={p.saldo >= 0 ? '#0F3757' : '#ef4444'}>
                <title>{new Date(p.data + 'T12:00').toLocaleDateString('pt-BR')}: {fmt(p.saldo)}</title>
              </circle>
            ))}
            {/* Labels X esparsos */}
            {points.filter((_, i) => i % Math.ceil(points.length / 8) === 0).map((p, i) => (
              <text key={i} x={p.x} y={chartH - padB + 15} textAnchor="middle" fontSize="9" fill="#64748b">
                {new Date(p.data + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
              </text>
            ))}
          </svg>
        </div>
      )}

      {/* Lista detalhada */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {['Data', 'Descrição', 'Categoria', 'Entrada', 'Saída', 'Saldo'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dias.flatMap(d => d.eventos.map((e: any, i: number) => (
              <tr key={`${d.data}-${i}`} className="border-b border-gray-50">
                <td className="px-4 py-2 text-xs text-gray-500">{i === 0 ? new Date(d.data + 'T12:00').toLocaleDateString('pt-BR') : ''}</td>
                <td className="px-4 py-2 text-gray-700">{e.descricao}</td>
                <td className="px-4 py-2 text-[11px] text-gray-500">{e.categoria}</td>
                <td className="px-4 py-2 text-right text-green-700 font-semibold">{Number(e.valor) > 0 ? fmt(Number(e.valor)) : ''}</td>
                <td className="px-4 py-2 text-right text-red-700 font-semibold">{Number(e.valor) < 0 ? fmt(Math.abs(Number(e.valor))) : ''}</td>
                <td className={`px-4 py-2 text-right font-bold ${i === d.eventos.length - 1 ? (d.saldo >= 0 ? 'text-green-700' : 'text-red-700') : 'text-gray-300'}`}>
                  {i === d.eventos.length - 1 ? fmt(d.saldo) : ''}
                </td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
