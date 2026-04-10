'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import BackButton from '@/components/BackButton'
import { TrendingUp, DollarSign, Calendar, ArrowLeft, Check, X } from 'lucide-react'
import SearchInput from '@/components/SearchInput'
import { useToast } from '@/components/Toast'

export default function ForecastPage() {
  const [forecast, setForecast] = useState<any[]>([])
  const [detalhe, setDetalhe] = useState<any[] | null>(null)
  const [obraAtiva, setObraAtiva] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const supabase = createClient()
  const toast = useToast()

  useEffect(() => { loadForecast() }, [])

  async function loadForecast() {
    const { data, error } = await supabase.from('vw_forecast_geral').select('*').limit(500)
    if (error) toast.error('Erro ao carregar forecast: ' + error.message)
    setForecast(data || [])
    setLoading(false)
  }

  async function abrirDetalhe(obra: any) {
    setObraAtiva(obra)
    const { data, error } = await supabase.from('forecast_contrato')
      .select('*').eq('obra_id', obra.obra_id).order('ano').order('mes')
    if (error) { toast.error('Erro: ' + error.message); return }
    setDetalhe(data || [])
  }

  function fecharDetalhe() {
    setObraAtiva(null)
    setDetalhe(null)
  }

  async function toggleCheck(id: string, field: string, current: boolean) {
    const { error } = await supabase.from('forecast_contrato').update({ [field]: !current }).eq('id', id)
    if (error) { toast.error('Erro: ' + error.message); return }
    if (detalhe) {
      setDetalhe(detalhe.map(d => d.id === id ? { ...d, [field]: !current } : d))
    }
  }

  const fmt = (v: number | null) => v != null ? Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'
  const fmtK = (v: number | null) => v != null ? `R$ ${(Number(v) / 1000).toFixed(0)}k` : '—'

  const MESES = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

  // KPIs
  const receitaPrevista = forecast.reduce((s, f) => s + Number(f.receita_total_prevista || 0), 0)
  const receitaRealizada = forecast.reduce((s, f) => s + Number(f.receita_total_realizada || 0), 0)
  const aReceber = forecast.reduce((s, f) => s + Number(f.a_receber || 0), 0)
  // Meses restantes: calcular pela data_prev_fim das obras, não pela tabela forecast
  const mesesRestantes = (() => {
    if (forecast.length === 0) return 0
    // Média dos meses restantes reportados, com fallback para cálculo por data
    const fromTable = forecast.reduce((s, f) => s + Number(f.meses_restantes || 0), 0)
    if (fromTable > 0) return Math.round(fromTable / forecast.length)
    // Fallback: buscar pelo maior mês futuro sem receita realizada
    const mesesFuturos = forecast.reduce((s, f) => {
      const futuro = Number(f.meses_registrados || 0) - (Number(f.receita_total_realizada || 0) > 0 ? 1 : 0)
      return s + Math.max(0, futuro)
    }, 0)
    return mesesFuturos > 0 ? Math.round(mesesFuturos / forecast.length) : Math.max(0, Math.ceil((new Date('2026-04-30').getTime() - Date.now()) / (30 * 86400000)))
  })()

  if (loading) return <div className="p-4 sm:p-6 text-gray-400 text-sm">Carregando...</div>

  // DETALHE MENSAL
  if (obraAtiva && detalhe) {
    const totPrev = detalhe.reduce((s, d) => s + Number(d.receita_prevista || 0), 0)
    const totReal = detalhe.reduce((s, d) => s + Number(d.receita_realizada || 0), 0)
    const mesesMedidos = detalhe.filter(d => Number(d.receita_realizada || 0) > 0).length
    const aReceberObra = detalhe.filter(d => d.bm_aprovado && !d.pagamento_recebido)
      .reduce((s, d) => s + Number(d.receita_realizada || 0), 0)
    const futuro = detalhe.filter(d => !Number(d.receita_realizada))
      .reduce((s, d) => s + Number(d.receita_prevista || 0), 0)
    const pctRealizado = totPrev > 0 ? (totReal / totPrev) * 100 : 0

    // Chart geometry
    const chartW = 720
    const chartH = 240
    const padL = 50, padR = 16, padT = 16, padB = 40
    const innerW = chartW - padL - padR
    const innerH = chartH - padT - padB
    const maxVal = Math.max(
      ...detalhe.map(d => Math.max(Number(d.receita_prevista || 0), Number(d.receita_realizada || 0))),
      1
    )
    const niceMax = Math.ceil(maxVal / 50000) * 50000
    const barGroupW = innerW / Math.max(detalhe.length, 1)
    const barW = Math.min(22, (barGroupW - 8) / 2)

    return (
      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-2 mb-6 text-sm">
          <button onClick={fecharDetalhe} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button onClick={fecharDetalhe} className="text-gray-400 hover:text-gray-600">Forecast</button>
          <span className="text-gray-300">/</span>
          <span className="font-medium text-gray-700">{obraAtiva.obra}</span>
        </div>

        <h1 className="text-xl font-bold font-display text-brand mb-1">{obraAtiva.obra}</h1>
        <p className="text-sm text-gray-500 mb-6">{obraAtiva.cliente} — Forecast mensal detalhado</p>

        {/* KPIs do contrato */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-blue-500 p-4">
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Total Previsto</div>
            <div className="text-lg font-bold text-gray-900 font-display">{fmt(totPrev)}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">{detalhe.length} meses</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-green-500 p-4">
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Realizado</div>
            <div className="text-lg font-bold text-green-700 font-display">{fmt(totReal)}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">{mesesMedidos} {mesesMedidos === 1 ? 'mês medido' : 'meses medidos'}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-violet-500 p-4">
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">% Realizado</div>
            <div className="text-lg font-bold text-violet-700 font-display">{pctRealizado.toFixed(1)}%</div>
            <div className="w-full h-1.5 bg-gray-100 rounded-full mt-1.5 overflow-hidden">
              <div className="h-full bg-violet-500 rounded-full" style={{ width: `${Math.min(pctRealizado, 100)}%` }} />
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-amber-500 p-4">
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">A Receber</div>
            <div className="text-lg font-bold text-amber-700 font-display">{fmt(aReceberObra)}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">BM aprovado, sem pgto</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-gray-400 p-4">
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Saldo Futuro</div>
            <div className="text-lg font-bold text-gray-700 font-display">{fmt(futuro)}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">Meses não medidos</div>
          </div>
        </div>

        {/* Gráfico Previsto x Realizado */}
        {detalhe.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-brand">Previsto × Realizado por mês</h3>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#C9A269]" />Previsto</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#0F3757]" />Realizado</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full" style={{ minWidth: 480 }}>
                {/* Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
                  const y = padT + innerH * (1 - t)
                  const val = niceMax * t
                  return (
                    <g key={i}>
                      <line x1={padL} y1={y} x2={chartW - padR} y2={y} stroke="#f1f5f9" strokeWidth="1" />
                      <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#94a3b8">
                        {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val.toFixed(0)}
                      </text>
                    </g>
                  )
                })}
                {/* Bars */}
                {detalhe.map((d, i) => {
                  const cx = padL + barGroupW * i + barGroupW / 2
                  const prev = Number(d.receita_prevista || 0)
                  const real = Number(d.receita_realizada || 0)
                  const hPrev = (prev / niceMax) * innerH
                  const hReal = (real / niceMax) * innerH
                  const isFuturo = real === 0
                  return (
                    <g key={d.id}>
                      <rect x={cx - barW - 1} y={padT + innerH - hPrev} width={barW} height={hPrev}
                        fill="#C9A269" opacity={isFuturo ? 0.55 : 0.9} rx="2" />
                      {real > 0 && (
                        <rect x={cx + 1} y={padT + innerH - hReal} width={barW} height={hReal}
                          fill="#0F3757" rx="2" />
                      )}
                      <text x={cx} y={chartH - padB + 14} textAnchor="middle" fontSize="10" fill="#475569" fontWeight="600">
                        {MESES[d.mes]}
                      </text>
                      <text x={cx} y={chartH - padB + 25} textAnchor="middle" fontSize="8" fill="#94a3b8">
                        {d.ano}
                      </text>
                    </g>
                  )
                })}
                {/* Eixo X */}
                <line x1={padL} y1={padT + innerH} x2={chartW - padR} y2={padT + innerH} stroke="#cbd5e1" strokeWidth="1" />
              </svg>
            </div>
            <p className="text-[10px] text-gray-400 mt-2 text-center">
              Barras douradas claras = meses ainda não medidos (previsão).
            </p>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Mês/Ano', 'Receita Prevista', 'Receita Realizada', 'Diferença', 'BM Emitido', 'BM Aprovado', 'NF Emitida', 'Pgto Recebido', 'Pgto Previsto'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {detalhe.map(d => {
                const diff = Number(d.receita_realizada || 0) - Number(d.receita_prevista || 0)
                return (
                  <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50/80">
                    <td className="px-4 py-3 font-medium">{MESES[d.mes]}/{d.ano}</td>
                    <td className="px-4 py-3 text-gray-600">{fmt(d.receita_prevista)}</td>
                    <td className="px-4 py-3 font-semibold">{fmt(d.receita_realizada)}</td>
                    <td className={`px-4 py-3 font-semibold ${diff >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {diff !== 0 ? `${diff > 0 ? '+' : ''}${fmt(diff)}` : '—'}
                    </td>
                    {(['bm_emitido', 'bm_aprovado', 'nf_emitida', 'pagamento_recebido'] as const).map(field => (
                      <td key={field} className="px-4 py-3 text-center">
                        <button onClick={() => toggleCheck(d.id, field, d[field])}
                          className={`w-6 h-6 rounded flex items-center justify-center border transition-all ${
                            d[field] ? 'bg-green-600 border-green-600 text-white' : 'border-gray-300 text-gray-300 hover:border-gray-400'
                          }`}>
                          {d[field] && <Check className="w-3.5 h-3.5" />}
                        </button>
                      </td>
                    ))}
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {d.data_pagamento_prevista ? new Date(d.data_pagamento_prevista + 'T12:00').toLocaleDateString('pt-BR') : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {detalhe.length > 0 && (
              <tfoot>
                <tr className="bg-brand/5 border-t-2 border-brand/20 font-bold">
                  <td className="px-4 py-3 text-brand">TOTAL</td>
                  <td className="px-4 py-3 text-brand">{fmt(totPrev)}</td>
                  <td className="px-4 py-3 text-green-700">{fmt(totReal)}</td>
                  <td className={`px-4 py-3 ${(totReal - totPrev) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {(totReal - totPrev) !== 0 ? `${(totReal - totPrev) > 0 ? '+' : ''}${fmt(totReal - totPrev)}` : '—'}
                  </td>
                  <td colSpan={5} className="px-4 py-3 text-[11px] text-gray-500 font-normal">
                    {mesesMedidos} de {detalhe.length} meses medidos · {pctRealizado.toFixed(1)}% do contrato realizado
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {detalhe.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-10 text-center mt-4">
            <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Nenhum registro de forecast para esta obra.</p>
          </div>
        )}
      </div>
    )
  }

  // LISTAGEM PRINCIPAL
  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/dashboard" />
        <span className="font-medium text-gray-700">Forecast</span>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold font-display text-brand mb-1">Forecast de Receita</h1>
          <p className="text-sm text-gray-500">Previsão e acompanhamento de receita por contrato. Clique em uma linha para ver o mês a mês.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/financeiro" className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">Financeiro</Link>
          <Link href="/relatorios/margem" className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">Margem</Link>
        </div>
      </div>

      {/* Instrução/Ajuda */}
      <div className="mb-5 p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
        <strong>Como usar:</strong> cada linha é um contrato/obra. A receita <em>prevista</em> vem do contrato mensal; a <em>realizada</em> vem dos BMs aprovados. A diferença mostra se a obra está acima ou abaixo do previsto. Clique para marcar BMs emitidos/aprovados e pagamentos recebidos.
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-blue-500 p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-blue-500" />
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Receita Prevista</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 font-display">{fmtK(receitaPrevista)}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-green-500 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-500" />
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Realizada</span>
          </div>
          <div className="text-2xl font-bold text-green-700 font-display">{fmtK(receitaRealizada)}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-amber-500 p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-amber-500" />
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">A Receber</span>
          </div>
          <div className="text-2xl font-bold text-amber-700 font-display">{fmtK(aReceber)}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-violet-500 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-violet-500" />
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Meses Restantes</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 font-display">{mesesRestantes}</div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <SearchInput value={busca} onChange={setBusca} placeholder="Buscar contrato..." />
      </div>

      {/* Tabela por contrato */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {['Contrato', 'Cliente', 'Meses Reg.', 'Receita Prevista', 'Receita Realizada', 'Diferença', 'A Receber', 'Receita Futura', 'Meses Rest.'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {forecast.length > 0 ? forecast.filter((f: any) => !busca || f.obra?.toLowerCase().includes(busca.toLowerCase()) || f.cliente?.toLowerCase().includes(busca.toLowerCase())).map((f: any) => {
              const diff = Number(f.receita_total_realizada || 0) - Number(f.receita_total_prevista || 0)
              return (
                <tr key={f.obra_id} className="border-b border-gray-50 hover:bg-gray-50/80 cursor-pointer group" onClick={() => abrirDetalhe(f)}>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-900 group-hover:text-brand transition-colors">{f.obra}</div>
                    <div className="text-xs text-gray-400">{f.status_obra}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{f.cliente}</td>
                  <td className="px-4 py-3 text-center font-mono">{f.meses_registrados}</td>
                  <td className="px-4 py-3">{fmt(f.receita_total_prevista)}</td>
                  <td className="px-4 py-3 font-semibold">{fmt(f.receita_total_realizada)}</td>
                  <td className={`px-4 py-3 font-semibold ${diff >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {diff !== 0 ? `${diff > 0 ? '+' : ''}${fmt(diff)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-amber-700 font-medium">{fmt(f.a_receber)}</td>
                  <td className="px-4 py-3 text-gray-500">{fmt(f.receita_futura_estimada)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      Number(f.meses_restantes) <= 2 ? 'bg-red-100 text-red-700' :
                      Number(f.meses_restantes) <= 4 ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{f.meses_restantes}m</span>
                  </td>
                </tr>
              )
            }) : (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">
                <TrendingUp className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p>Nenhum dado de forecast disponível.</p>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Totais */}
      {forecast.length > 0 && (
        <div className="mt-4 bg-brand/5 rounded-xl border border-brand/10 p-4 flex items-center justify-between text-sm">
          <span className="font-semibold text-brand">Total consolidado</span>
          <div className="flex gap-6">
            <span>Prevista: <strong>{fmtK(receitaPrevista)}</strong></span>
            <span>Realizada: <strong className="text-green-700">{fmtK(receitaRealizada)}</strong></span>
            <span>A receber: <strong className="text-amber-700">{fmtK(aReceber)}</strong></span>
          </div>
        </div>
      )}
    </div>
  )
}
