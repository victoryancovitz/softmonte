'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import BackButton from '@/components/BackButton'
import { TrendingUp, Users, ChevronDown, ChevronUp } from 'lucide-react'

export default function MargemPage() {
  const [dre, setDre] = useState<any[]>([])
  const [custos, setCustos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandido, setExpandido] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const [{ data: d }, { data: c }] = await Promise.all([
        supabase.from('vw_dre_obra').select('*'),
        supabase.from('vw_custo_funcionario').select('*'),
      ])
      setDre(d || [])
      setCustos(c || [])
      setLoading(false)
    }
    load()
  }, [])

  const fmt = (v: number | null) => v != null ? Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'

  const statusColor: Record<string, string> = {
    verde: 'bg-green-100 text-green-700',
    amarelo: 'bg-amber-100 text-amber-700',
    vermelho: 'bg-red-100 text-red-700',
    ok: 'bg-green-100 text-green-700',
    atencao: 'bg-amber-100 text-amber-700',
    critico: 'bg-red-100 text-red-700',
  }

  if (loading) return <div className="p-4 sm:p-6 text-gray-400 text-sm">Carregando...</div>

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/relatorios" />
        <span className="text-gray-400">Relatórios</span>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700">Margem por Contrato</span>
      </div>

      <h1 className="text-xl font-bold font-display text-brand mb-1">DRE e Margem por Contrato</h1>
      <p className="text-sm text-gray-500 mb-6">Receita × custo real de MO × margem bruta por contrato e por funcionário</p>

      {dre.length > 0 ? (
        <div className="space-y-4">
          {dre.map((obra: any) => {
            const isOpen = expandido === obra.obra_id
            const funcsObra = custos.filter(c => c.obra === obra.obra)
            return (
              <div key={obra.obra_id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Header */}
                <button onClick={() => setExpandido(isOpen ? null : obra.obra_id)}
                  className="w-full px-5 py-4 flex items-center gap-4 hover:bg-gray-50/50 transition-colors text-left">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900">{obra.obra}</span>
                      <span className="text-xs text-gray-400">{obra.cliente}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${statusColor[obra.status_margem] ?? 'bg-gray-100 text-gray-600'}`}>
                        {obra.status_margem?.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-xs text-gray-500 mt-1">
                      <span>Receita mensal: <strong className="text-green-700">{fmt(obra.receita_mensal_contrato)}</strong></span>
                      <span>Custo MO real: <strong className="text-red-700">{fmt(obra.custo_mo_real_mensal)}</strong></span>
                      <span>Margem bruta: <strong className={Number(obra.margem_pct) >= Number(obra.margem_alvo_pct) ? 'text-green-700' : 'text-red-700'}>{fmt(obra.margem_bruta_mensal)} ({Number(obra.margem_pct).toFixed(1)}%)</strong></span>
                      <span>Alvo: <strong>{Number(obra.margem_alvo_pct).toFixed(0)}%</strong></span>
                      <span><Users className="w-3 h-3 inline" /> {obra.funcionarios_alocados} func.</span>
                    </div>
                  </div>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>

                {/* Detalhe por funcionário */}
                {isOpen && (
                  <div className="border-t border-gray-100 bg-gray-50/50">
                    <div className="px-5 py-3">
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Custo por Funcionário Alocado</h3>
                      {funcsObra.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-200">
                                {['Funcionário', 'Salário Base', 'Custo Total/Mês', 'Custo/Hora Real', 'Billing Rate', 'Margem/HH', 'Margem %', 'Status'].map(h => (
                                  <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {funcsObra.map((f: any) => (
                                <tr key={f.funcionario_id} className="border-b border-gray-100">
                                  <td className="px-3 py-2">
                                    <div className="font-medium text-gray-900">{f.nome}</div>
                                    <div className="text-xs text-gray-400">{f.funcao_no_contrato}</div>
                                  </td>
                                  <td className="px-3 py-2">{fmt(f.salario_base)}</td>
                                  <td className="px-3 py-2 font-semibold">{fmt(f.custo_total_mensal)}</td>
                                  <td className="px-3 py-2 text-red-600 font-semibold">{fmt(f.custo_hora_real)}/h</td>
                                  <td className="px-3 py-2 text-green-600 font-semibold">{fmt(f.billing_rate)}/h</td>
                                  <td className={`px-3 py-2 font-semibold ${Number(f.margem_hh) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                    {fmt(f.margem_hh)}/h
                                  </td>
                                  <td className={`px-3 py-2 font-bold ${Number(f.margem_pct) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                    {Number(f.margem_pct).toFixed(1)}%
                                  </td>
                                  <td className="px-3 py-2">
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${statusColor[f.status_margem] ?? 'bg-gray-100'}`}>
                                      {f.status_margem?.toUpperCase()}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400">Sem dados de custo de funcionários para esta obra.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-10 text-center">
          <TrendingUp className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Nenhum dado de DRE disponível.</p>
          <p className="text-xs text-gray-400 mt-1">Cadastre salários dos funcionários para ver a análise de margem.</p>
        </div>
      )}
    </div>
  )
}
