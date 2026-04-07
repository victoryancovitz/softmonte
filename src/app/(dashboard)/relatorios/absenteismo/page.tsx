'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import BackButton from '@/components/BackButton'
import { AlertTriangle, TrendingDown } from 'lucide-react'

const MESES = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export default function AbsenteismoPage() {
  const [dados, setDados] = useState<any[]>([])
  const [obras, setObras] = useState<any[]>([])
  const [obraId, setObraId] = useState<string>('all')
  const [periodo, setPeriodo] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    (async () => {
      const [{ data }, { data: o }] = await Promise.all([
        supabase.from('vw_absenteismo').select('*').order('taxa_falta_pct', { ascending: false, nullsFirst: false }),
        supabase.from('obras').select('id,nome').is('deleted_at', null).order('nome'),
      ])
      setDados(data || []); setObras(o || []); setLoading(false)
    })()
  }, [])

  const filtrados = dados.filter(d => {
    if (obraId !== 'all' && d.obra_id !== obraId) return false
    if (periodo !== 'all') {
      const [ano, mes] = periodo.split('-').map(Number)
      if (d.ano !== ano || d.mes !== mes) return false
    }
    return true
  })

  // Rollup por funcionário
  const rollup = new Map<string, any>()
  filtrados.forEach(d => {
    const key = d.funcionario_id
    if (!rollup.has(key)) {
      rollup.set(key, {
        funcionario_id: d.funcionario_id, nome: d.nome, cargo: d.cargo, obra: d.obra,
        dias: 0, faltas: 0, injust: 0, atestados: 0, acidentes: 0, just: 0, suspensoes: 0,
      })
    }
    const r = rollup.get(key)
    r.dias += Number(d.dias_trabalhados || 0)
    r.faltas += Number(d.total_faltas || 0)
    r.injust += Number(d.faltas_injustificadas || 0)
    r.atestados += Number(d.atestados || 0)
    r.acidentes += Number(d.acidentes || 0)
    r.just += Number(d.faltas_justificadas || 0)
    r.suspensoes += Number(d.suspensoes || 0)
  })
  const rows = Array.from(rollup.values()).map(r => ({
    ...r,
    taxa: r.dias + r.faltas > 0 ? (r.faltas / (r.dias + r.faltas) * 100) : 0,
    taxaInj: r.dias + r.faltas > 0 ? (r.injust / (r.dias + r.faltas) * 100) : 0,
  })).sort((a, b) => b.taxa - a.taxa)

  const totalDias = rows.reduce((s, r) => s + r.dias, 0)
  const totalFaltas = rows.reduce((s, r) => s + r.faltas, 0)
  const totalInj = rows.reduce((s, r) => s + r.injust, 0)
  const taxaGlobal = totalDias + totalFaltas > 0 ? (totalFaltas / (totalDias + totalFaltas) * 100) : 0

  // Períodos disponíveis
  const periodos = Array.from(new Set(dados.map(d => `${d.ano}-${String(d.mes).padStart(2,'0')}`))).sort().reverse()

  if (loading) return <div className="p-6 text-gray-400 text-sm">Carregando...</div>

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/relatorios" />
        <span className="text-gray-400">Relatórios</span>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700">Absenteísmo</span>
      </div>

      <h1 className="text-xl font-bold font-display text-brand mb-1">Índice de Absenteísmo</h1>
      <p className="text-sm text-gray-500 mb-6">Ranking por taxa de faltas — identifica padrões e funcionários críticos.</p>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-5">
        <select value={obraId} onChange={e => setObraId(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
          <option value="all">Todas as obras</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
        <select value={periodo} onChange={e => setPeriodo(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
          <option value="all">Todo período</option>
          {periodos.map(p => {
            const [a, m] = p.split('-')
            return <option key={p} value={p}>{MESES[Number(m)]}/{a}</option>
          })}
        </select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-[11px] font-semibold text-gray-400 uppercase">Taxa global</div>
          <div className={`text-xl font-bold font-display ${taxaGlobal >= 10 ? 'text-red-700' : taxaGlobal >= 5 ? 'text-amber-700' : 'text-green-700'}`}>
            {taxaGlobal.toFixed(1)}%
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-[11px] font-semibold text-gray-400 uppercase">Dias trabalhados</div>
          <div className="text-xl font-bold text-gray-900 font-display">{totalDias}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-[11px] font-semibold text-gray-400 uppercase">Total faltas</div>
          <div className="text-xl font-bold text-amber-700 font-display">{totalFaltas}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-[11px] font-semibold text-gray-400 uppercase">Injustificadas</div>
          <div className="text-xl font-bold text-red-700 font-display">{totalInj}</div>
        </div>
      </div>

      {/* Ranking */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {['#', 'Funcionário', 'Dias Trab.', 'Faltas', 'Injust.', 'Atestados', 'Acidente', 'Justif.', 'Susp.', 'Taxa %', 'Taxa Injust %'].map(h => (
                <th key={h} className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? rows.map((r, i) => (
              <tr key={r.funcionario_id} className="border-b border-gray-50 hover:bg-gray-50/80">
                <td className="px-3 py-3 text-gray-400 font-mono text-xs">{i + 1}</td>
                <td className="px-3 py-3">
                  <Link href={`/funcionarios/${r.funcionario_id}`} className="font-semibold text-gray-900 hover:text-brand">{r.nome}</Link>
                  <div className="text-xs text-gray-400">{r.cargo} · {r.obra}</div>
                </td>
                <td className="px-3 py-3 text-gray-600">{r.dias}</td>
                <td className="px-3 py-3 font-bold text-gray-900">{r.faltas}</td>
                <td className="px-3 py-3 text-red-700 font-semibold">{r.injust}</td>
                <td className="px-3 py-3 text-blue-700">{r.atestados}</td>
                <td className="px-3 py-3 text-red-600">{r.acidentes}</td>
                <td className="px-3 py-3 text-amber-700">{r.just}</td>
                <td className="px-3 py-3 text-gray-600">{r.suspensoes}</td>
                <td className="px-3 py-3">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    r.taxa >= 15 ? 'bg-red-100 text-red-700' :
                    r.taxa >= 8 ? 'bg-amber-100 text-amber-700' :
                    'bg-green-100 text-green-700'
                  }`}>{r.taxa.toFixed(1)}%</span>
                </td>
                <td className="px-3 py-3">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    r.taxaInj >= 5 ? 'bg-red-100 text-red-700' :
                    r.taxaInj >= 2 ? 'bg-amber-100 text-amber-700' :
                    'bg-gray-100 text-gray-500'
                  }`}>{r.taxaInj.toFixed(1)}%</span>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={11} className="px-4 py-10 text-center text-gray-400">
                <TrendingDown className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p>Sem registros no período selecionado.</p>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {rows.filter(r => r.taxa >= 15).length > 0 && (
        <div className="mt-5 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
          <div className="text-sm">
            <div className="font-bold text-red-700 mb-1">Atenção: {rows.filter(r => r.taxa >= 15).length} funcionário(s) com absenteísmo crítico (≥15%)</div>
            <div className="text-red-600 text-xs">Considere conversa de ajuste ou suspensão disciplinar conforme política interna.</div>
          </div>
        </div>
      )}
    </div>
  )
}
