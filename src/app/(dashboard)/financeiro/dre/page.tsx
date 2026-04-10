'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import BackButton from '@/components/BackButton'
import { TrendingUp, Users, ChevronDown, ChevronUp } from 'lucide-react'

export default function DrePage() {
  const [dre, setDre] = useState<any[]>([])
  const [dreMes, setDreMes] = useState<any[]>([])
  const [custos, setCustos] = useState<any[]>([])
  const [lancamentos, setLancamentos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandido, setExpandido] = useState<string | null>(null)
  const [tab, setTab] = useState<'margem' | 'dre'>('margem')
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const [{ data: d }, { data: dm }, { data: c }, { data: l }] = await Promise.all([
        supabase.from('vw_dre_obra').select('*').limit(500),
        supabase.from('vw_dre_obra_mes').select('*').limit(500),
        supabase.from('vw_custo_funcionario').select('*'),
        supabase.from('financeiro_lancamentos').select('*').is('deleted_at', null).order('data_competencia').limit(5000),
      ])
      setDre(d || [])
      setDreMes(dm || [])
      setCustos(c || [])
      setLancamentos(l || [])
      setLoading(false)
    }
    load()
  }, [])

  const MESES = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  const fmt = (v: number | null) => v != null ? Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'

  const statusColor: Record<string, string> = {
    verde: 'bg-green-100 text-green-700',
    amarelo: 'bg-amber-100 text-amber-700',
    vermelho: 'bg-red-100 text-red-700',
    ok: 'bg-green-100 text-green-700',
    atencao: 'bg-amber-100 text-amber-700',
    critico: 'bg-red-100 text-red-700',
  }

  // DRE consolidado por mes
  const dreByMes: Record<string, { mes: string; receita: number; custoMO: number; outrasDesp: number; provisoes: number }> = {}
  lancamentos.forEach(l => {
    const mes = l.data_competencia?.slice(0, 7) ?? 'sem-data'
    if (!dreByMes[mes]) dreByMes[mes] = { mes, receita: 0, custoMO: 0, outrasDesp: 0, provisoes: 0 }
    const v = Number(l.valor || 0)
    if (l.tipo === 'receita') {
      dreByMes[mes].receita += v
    } else {
      if (l.is_provisao) dreByMes[mes].provisoes += v
      else if (l.categoria === 'Folha de Pagamento' || l.origem === 'folha_fechamento') dreByMes[mes].custoMO += v
      else dreByMes[mes].outrasDesp += v
    }
  })
  const dreMeses = Object.values(dreByMes).sort((a, b) => a.mes.localeCompare(b.mes))

  if (loading) return <div className="p-4 sm:p-6 text-gray-400 text-sm">Carregando...</div>

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/financeiro/sumario" />
        <Link href="/financeiro/sumario" className="text-gray-400 hover:text-gray-600">Financeiro</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700">DRE & Resultado</span>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold font-display text-brand mb-1">DRE & Resultado</h1>
          <p className="text-sm text-gray-500">Demonstrativo de resultado, margem por contrato e custo de MO por funcionario.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/forecast" className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">Forecast</Link>
          <Link href="/relatorios/bm-comparativo" className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">BM Comparativo</Link>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-lg w-fit">
        {([
          { key: 'margem', label: 'Margem por Contrato' },
          { key: 'dre', label: 'DRE Consolidado' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'margem' ? (
        /* === MARGEM POR CONTRATO === */
        dre.length > 0 ? (
          <div className="space-y-4">
            {dre.map((obra: any) => {
              const isOpen = expandido === obra.obra_id
              const funcsObra = custos.filter(c => c.obra === obra.obra)
              return (
                <div key={obra.obra_id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <button onClick={() => setExpandido(isOpen ? null : obra.obra_id)}
                    className="w-full px-5 py-4 flex items-center gap-4 hover:bg-gray-50/50 transition-colors text-left">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900">{obra.obra}</span>
                        <span className="text-xs text-gray-400">{obra.cliente}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${statusColor[obra.status_margem] ?? 'bg-gray-100 text-gray-600'}`}>
                          {obra.status_margem ? obra.status_margem.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) : '—'}
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

                  {isOpen && (
                    <div className="border-t border-gray-100 bg-gray-50/50">
                      {/* DRE real mes a mes */}
                      {(() => {
                        const mesesObra = dreMes.filter((m: any) => m.obra_id === obra.obra_id)
                        if (mesesObra.length === 0) return null
                        const totCusto = mesesObra.reduce((s: number, m: any) => s + Number(m.custo_mo_real || 0), 0)
                        const totReceita = mesesObra.reduce((s: number, m: any) => s + Number(m.receita_realizada || m.receita_prevista || 0), 0)
                        const totMargem = totReceita - totCusto
                        const totMargemPct = totReceita > 0 ? (totMargem / totReceita) * 100 : 0
                        return (
                          <div className="px-5 py-3 border-b border-gray-100">
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">DRE Real Mes a Mes (CLT + faltas)</h3>
                              <div className="text-[10px] text-gray-400">custo considera encargos, provisoes, beneficios e desconto de faltas</div>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-gray-200">
                                    {['Mes', 'Funcs', 'Dias Trab.', 'Desc.', 'Receita', 'Custo MO Real', 'Margem Bruta', 'Margem %'].map(h => (
                                      <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {mesesObra.map((m: any) => {
                                    const receita = Number(m.receita_realizada || m.receita_prevista || 0)
                                    const custo = Number(m.custo_mo_real || 0)
                                    const margem = receita - custo
                                    const margemPct = receita > 0 ? (margem / receita) * 100 : 0
                                    return (
                                      <tr key={`${m.ano}-${m.mes}`} className="border-b border-gray-100">
                                        <td className="px-3 py-2 font-medium">{MESES[m.mes]}/{m.ano}</td>
                                        <td className="px-3 py-2 text-gray-600">{m.funcionarios}</td>
                                        <td className="px-3 py-2 text-gray-600">{m.dias_trabalhados}</td>
                                        <td className="px-3 py-2 text-gray-500">
                                          {Number(m.dias_descontados) > 0 ? (
                                            <span className="text-red-600 font-medium">{Number(m.dias_descontados).toFixed(1)}d</span>
                                          ) : '—'}
                                        </td>
                                        <td className="px-3 py-2 text-green-700 font-semibold">{fmt(receita)}</td>
                                        <td className="px-3 py-2 text-red-700 font-semibold">{fmt(custo)}</td>
                                        <td className={`px-3 py-2 font-bold ${margem >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                          {fmt(margem)}
                                        </td>
                                        <td className={`px-3 py-2 font-bold ${margemPct >= 30 ? 'text-green-700' : margemPct >= 15 ? 'text-amber-700' : 'text-red-700'}`}>
                                          {margemPct.toFixed(1)}%
                                        </td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                                <tfoot>
                                  <tr className="bg-brand/5 border-t-2 border-brand/20 font-bold">
                                    <td className="px-3 py-2 text-brand" colSpan={4}>TOTAL acumulado</td>
                                    <td className="px-3 py-2 text-green-700">{fmt(totReceita)}</td>
                                    <td className="px-3 py-2 text-red-700">{fmt(totCusto)}</td>
                                    <td className={`px-3 py-2 ${totMargem >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(totMargem)}</td>
                                    <td className={`px-3 py-2 ${totMargemPct >= 30 ? 'text-green-700' : totMargemPct >= 15 ? 'text-amber-700' : 'text-red-700'}`}>
                                      {totMargemPct.toFixed(1)}%
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </div>
                        )
                      })()}
                      <div className="px-5 py-3">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Custo por Funcionario Alocado (referencia mensal sem faltas)</h3>
                        {funcsObra.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-gray-200">
                                  {['Funcionario', 'Salario Base', 'Custo Total/Mes', 'Custo/Hora Real', 'Billing Rate', 'Margem/HH', 'Margem %', 'Status'].map(h => (
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
                                        {f.status_margem ? f.status_margem.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) : '—'}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400">Sem dados de custo de funcionarios para esta obra.</p>
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
            <p className="text-gray-500 text-sm">Nenhum dado de DRE disponivel.</p>
            <p className="text-xs text-gray-400 mt-1">Cadastre salarios dos funcionarios para ver a analise de margem.</p>
          </div>
        )
      ) : (
        /* === DRE CONSOLIDADO === */
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Mes', 'Receita', 'Custo MO', 'Outras Despesas', 'Provisoes', 'Resultado', 'Margem %'].map(h => (
                  <th key={h} className="text-right first:text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dreMeses.length > 0 ? dreMeses.map(m => {
                const resultado = m.receita - m.custoMO - m.outrasDesp - m.provisoes
                const margemPct = m.receita > 0 ? (resultado / m.receita * 100) : 0
                const mesLabel = m.mes === 'sem-data' ? 'Sem data' :
                  new Date(m.mes + '-01').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '').replace(' ', "'")
                return (
                  <tr key={m.mes} className="border-b border-gray-50 hover:bg-gray-50/80">
                    <td className="px-4 py-2.5 font-medium text-sm">{mesLabel}</td>
                    <td className="px-4 py-2.5 text-right text-green-600">{m.receita > 0 ? fmt(m.receita) : '—'}</td>
                    <td className="px-4 py-2.5 text-right text-red-600">{m.custoMO > 0 ? fmt(m.custoMO) : '—'}</td>
                    <td className="px-4 py-2.5 text-right text-orange-600">{m.outrasDesp > 0 ? fmt(m.outrasDesp) : '—'}</td>
                    <td className="px-4 py-2.5 text-right text-purple-600">{m.provisoes > 0 ? fmt(m.provisoes) : '—'}</td>
                    <td className={`px-4 py-2.5 text-right font-bold ${resultado >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {fmt(resultado)}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-bold ${margemPct >= 30 ? 'text-green-700' : margemPct >= 15 ? 'text-amber-700' : 'text-red-700'}`}>
                      {margemPct.toFixed(1)}%
                    </td>
                  </tr>
                )
              }) : (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                    <TrendingUp className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p>Sem lancamentos financeiros para gerar DRE.</p>
                  </td>
                </tr>
              )}
            </tbody>
            {dreMeses.length > 0 && (
              <tfoot>
                <tr className="bg-brand/5 border-t-2 border-brand/20 font-bold">
                  <td className="px-4 py-3 text-brand">TOTAL</td>
                  <td className="px-4 py-3 text-right text-green-700">{fmt(dreMeses.reduce((s, m) => s + m.receita, 0))}</td>
                  <td className="px-4 py-3 text-right text-red-700">{fmt(dreMeses.reduce((s, m) => s + m.custoMO, 0))}</td>
                  <td className="px-4 py-3 text-right text-orange-600">{fmt(dreMeses.reduce((s, m) => s + m.outrasDesp, 0))}</td>
                  <td className="px-4 py-3 text-right text-purple-600">{fmt(dreMeses.reduce((s, m) => s + m.provisoes, 0))}</td>
                  {(() => {
                    const totRec = dreMeses.reduce((s, m) => s + m.receita, 0)
                    const totDesp = dreMeses.reduce((s, m) => s + m.custoMO + m.outrasDesp + m.provisoes, 0)
                    const res = totRec - totDesp
                    const pct = totRec > 0 ? (res / totRec * 100) : 0
                    return (
                      <>
                        <td className={`px-4 py-3 text-right ${res >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(res)}</td>
                        <td className={`px-4 py-3 text-right ${pct >= 30 ? 'text-green-700' : pct >= 15 ? 'text-amber-700' : 'text-red-700'}`}>{pct.toFixed(1)}%</td>
                      </>
                    )
                  })()}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  )
}
