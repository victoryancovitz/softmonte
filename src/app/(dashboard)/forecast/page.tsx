'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import BackButton from '@/components/BackButton'
import { TrendingUp, DollarSign, Calendar, ArrowLeft, Check, X } from 'lucide-react'
import SearchInput from '@/components/SearchInput'

export default function ForecastPage() {
  const [forecast, setForecast] = useState<any[]>([])
  const [detalhe, setDetalhe] = useState<any[] | null>(null)
  const [obraAtiva, setObraAtiva] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const supabase = createClient()

  useEffect(() => { loadForecast() }, [])

  async function loadForecast() {
    const { data } = await supabase.from('vw_forecast_geral').select('*')
    setForecast(data || [])
    setLoading(false)
  }

  async function abrirDetalhe(obra: any) {
    setObraAtiva(obra)
    const { data } = await supabase.from('forecast_contrato')
      .select('*').eq('obra_id', obra.obra_id).order('ano').order('mes')
    setDetalhe(data || [])
  }

  function fecharDetalhe() {
    setObraAtiva(null)
    setDetalhe(null)
  }

  async function toggleCheck(id: string, field: string, current: boolean) {
    await supabase.from('forecast_contrato').update({ [field]: !current }).eq('id', id)
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
  const mesesRestantes = forecast.length > 0
    ? Math.round(forecast.reduce((s, f) => s + Number(f.meses_restantes || 0), 0) / forecast.length)
    : 0

  if (loading) return <div className="p-4 sm:p-6 text-gray-400 text-sm">Carregando...</div>

  // DETALHE MENSAL
  if (obraAtiva && detalhe) {
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

      <h1 className="text-xl font-bold font-display text-brand mb-1">Forecast de Receita</h1>
      <p className="text-sm text-gray-500 mb-6">Previsão e acompanhamento de receita por contrato</p>

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
