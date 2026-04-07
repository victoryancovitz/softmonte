'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import BackButton from '@/components/BackButton'
import { FileText } from 'lucide-react'

export default function BmComparativoPage() {
  const [dados, setDados] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('vw_bm_orcado_real').select('*').order('data_inicio', { ascending: false }).then(({ data }) => {
      setDados(data || []); setLoading(false)
    })
  }, [])

  const fmt = (v: any) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const totReceita = dados.reduce((s, d) => s + Number(d.receita_bm || 0), 0)
  const totCusto = dados.reduce((s, d) => s + Number(d.custo_mo_periodo || 0), 0)
  const totMargem = totReceita - totCusto
  const totPct = totReceita > 0 ? (totMargem / totReceita) * 100 : 0

  if (loading) return <div className="p-6 text-gray-400 text-sm">Carregando...</div>

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/relatorios" />
        <span className="text-gray-400">Relatórios</span>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700">BM: Orçado × Real</span>
      </div>

      <h1 className="text-xl font-bold font-display text-brand mb-1">Boletins de Medição — Orçado × Real</h1>
      <p className="text-sm text-gray-500 mb-6">Receita medida × custo real de MO no período do BM (rateio por dias-pessoa).</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-gray-100 border-l-4 border-l-green-500 p-4">
          <div className="text-[11px] font-semibold text-gray-400 uppercase">Receita BMs</div>
          <div className="text-lg font-bold text-green-700 font-display">{fmt(totReceita)}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 border-l-4 border-l-red-500 p-4">
          <div className="text-[11px] font-semibold text-gray-400 uppercase">Custo MO Real</div>
          <div className="text-lg font-bold text-red-700 font-display">{fmt(totCusto)}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 border-l-4 border-l-blue-500 p-4">
          <div className="text-[11px] font-semibold text-gray-400 uppercase">Margem</div>
          <div className={`text-lg font-bold font-display ${totMargem >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(totMargem)}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 border-l-4 border-l-violet-500 p-4">
          <div className="text-[11px] font-semibold text-gray-400 uppercase">Margem %</div>
          <div className={`text-lg font-bold font-display ${totPct >= 30 ? 'text-green-700' : totPct >= 15 ? 'text-amber-700' : 'text-red-700'}`}>{totPct.toFixed(1)}%</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {['BM', 'Obra', 'Período', 'Status', 'Receita', 'Custo MO', 'Dias-pessoa', 'Funcs', 'Margem', 'Margem %'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dados.length > 0 ? dados.map(d => (
              <tr key={d.bm_id} className="border-b border-gray-50 hover:bg-gray-50/80">
                <td className="px-4 py-3"><Link href={`/boletins/${d.bm_id}`} className="font-bold text-brand hover:underline">BM {d.numero}</Link></td>
                <td className="px-4 py-3 text-gray-600">{d.obra}</td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {new Date(d.data_inicio + 'T12:00').toLocaleDateString('pt-BR')} → {new Date(d.data_fim + 'T12:00').toLocaleDateString('pt-BR')}
                </td>
                <td className="px-4 py-3"><span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-semibold uppercase">{d.status}</span></td>
                <td className="px-4 py-3 text-green-700 font-semibold">{fmt(d.receita_bm)}</td>
                <td className="px-4 py-3 text-red-700">{fmt(d.custo_mo_periodo)}</td>
                <td className="px-4 py-3 text-gray-600">{d.dias_trabalhados}</td>
                <td className="px-4 py-3 text-gray-600">{d.funcionarios_periodo}</td>
                <td className={`px-4 py-3 font-bold ${Number(d.margem_bruta) >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(d.margem_bruta)}</td>
                <td className={`px-4 py-3 font-bold ${Number(d.margem_pct) >= 30 ? 'text-green-700' : Number(d.margem_pct) >= 15 ? 'text-amber-700' : 'text-red-700'}`}>
                  {Number(d.margem_pct || 0).toFixed(1)}%
                </td>
              </tr>
            )) : (
              <tr><td colSpan={10} className="px-4 py-10 text-center text-gray-400">
                <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p>Nenhum BM cadastrado ainda.</p>
              </td></tr>
            )}
          </tbody>
          {dados.length > 0 && (
            <tfoot>
              <tr className="bg-brand/5 border-t-2 border-brand/20 font-bold">
                <td className="px-4 py-3 text-brand" colSpan={4}>TOTAL</td>
                <td className="px-4 py-3 text-green-700">{fmt(totReceita)}</td>
                <td className="px-4 py-3 text-red-700">{fmt(totCusto)}</td>
                <td colSpan={2}></td>
                <td className={`px-4 py-3 ${totMargem >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(totMargem)}</td>
                <td className={`px-4 py-3 ${totPct >= 30 ? 'text-green-700' : totPct >= 15 ? 'text-amber-700' : 'text-red-700'}`}>{totPct.toFixed(1)}%</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
