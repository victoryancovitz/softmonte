'use client'
import { useState, Fragment } from 'react'
import { ChevronDown, ChevronUp, TrendingUp, Clock, DollarSign, Users } from 'lucide-react'

const fmt = (v: any) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const BE_BADGE: Record<string, { label: string; icon: string; cls: string }> = {
  no_lucro: { label: 'No lucro', icon: '✅', cls: 'bg-green-100 text-green-700' },
  em_amortizacao: { label: 'Amortizando', icon: '⏳', cls: 'bg-amber-100 text-amber-700' },
  nunca_rentavel: { label: 'Margem negativa', icon: '❌', cls: 'bg-red-100 text-red-700' },
  sem_dados: { label: 'Sem histórico', icon: '○', cls: 'bg-gray-100 text-gray-500' },
}

const MARGEM_CLS = (pct: number) =>
  pct >= 30 ? 'text-green-700' : pct >= 15 ? 'text-amber-700' : 'text-red-700'

export default function RentabilidadeClient({ data, ciclo }: { data: any[]; ciclo: any }) {
  const [expandido, setExpandido] = useState<string | null>(null)

  const totalFuncs = data.length
  const noLucro = data.filter(d => d.status_breakeven === 'no_lucro').length
  const emAmort = data.filter(d => d.status_breakeven === 'em_amortizacao').length
  const semDados = data.filter(d => d.status_breakeven === 'sem_dados').length
  const margemMedia = totalFuncs > 0 ? data.reduce((s, d) => s + Number(d.margem_pct || 0), 0) / totalFuncs : 0

  return (
    <>
      {/* Cards resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-brand" /><span className="text-[10px] font-bold text-gray-400 uppercase">Margem Média (teórica)</span></div>
          <div className={`text-2xl font-bold font-display ${MARGEM_CLS(margemMedia)}`}>{margemMedia.toFixed(1)}%</div>
          <div className="text-[10px] text-gray-400 mt-0.5">{margemMedia >= 30 ? 'Excelente' : margemMedia >= 20 ? 'Bom' : margemMedia >= 10 ? 'Atenção' : 'Crítico'}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1"><DollarSign className="w-4 h-4 text-green-500" /><span className="text-[10px] font-bold text-gray-400 uppercase">No Lucro</span></div>
          <div className="text-2xl font-bold text-green-700 font-display">{noLucro}</div>
          <div className="text-[10px] text-gray-400 mt-0.5">resultado acumulado positivo</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1"><Clock className="w-4 h-4 text-amber-500" /><span className="text-[10px] font-bold text-gray-400 uppercase">Em Amortização</span></div>
          <div className="text-2xl font-bold text-amber-700 font-display">{emAmort}</div>
          <div className="text-[10px] text-gray-400 mt-0.5">custo acumulado {'>'} receita</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1"><Users className="w-4 h-4 text-gray-400" /><span className="text-[10px] font-bold text-gray-400 uppercase">Sem Histórico</span></div>
          <div className="text-2xl font-bold text-gray-400 font-display">{semDados}</div>
          <div className="text-[10px] text-gray-400 mt-0.5">sem BMs ou folha registrados</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1"><DollarSign className="w-4 h-4 text-violet-500" /><span className="text-[10px] font-bold text-gray-400 uppercase">Capital em Giro</span></div>
          <div className="text-lg font-bold text-gray-900 font-display">{ciclo ? fmt(ciclo.capital_giro_necessario) : '—'}</div>
          <div className="text-[10px] text-gray-400 mt-0.5">{ciclo ? `Ciclo: ${ciclo.ciclo_financeiro_dias}d` : 'Sem obra ativa'}</div>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="w-8 px-2 py-3"></th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Funcionário</th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Custo/mês</th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Billing/HH</th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Custo/HH</th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Margem/HH</th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500 uppercase" title="Margem calculada sobre preço contratado por HH. Não reflete faturamento real.">Margem % (teórica)</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Break-even</th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500 uppercase" title="Receita real de BMs aprovados menos custo real acumulado">Resultado real</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">Sem dados de rentabilidade.</td></tr>
            ) : data.sort((a, b) => Number(b.margem_pct || 0) - Number(a.margem_pct || 0)).map(f => {
              const isOpen = expandido === f.funcionario_id
              const be = BE_BADGE[f.status_breakeven] || BE_BADGE.nunca_rentavel
              return (
                <Fragment key={f.funcionario_id}>
                <tr onClick={() => setExpandido(isOpen ? null : f.funcionario_id)}
                  className={`border-b border-gray-50 cursor-pointer transition-colors ${isOpen ? 'bg-brand/5' : 'hover:bg-gray-50'}`}>
                  <td className="px-2 py-3 text-center text-gray-400">
                    {isOpen ? <ChevronUp className="w-3.5 h-3.5 inline" /> : <ChevronDown className="w-3.5 h-3.5 inline" />}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-900">{f.nome?.split(' ').slice(0, 2).join(' ')}</div>
                    <div className="text-[10px] text-gray-400">{f.funcao_no_contrato} · {f.meses_na_empresa}m</div>
                  </td>
                  <td className="px-3 py-3 text-right text-gray-700">{fmt(f.custo_total_mensal)}</td>
                  <td className="px-3 py-3 text-right text-green-700 font-semibold">{fmt(f.billing_rate)}/h</td>
                  <td className="px-3 py-3 text-right text-red-600">{fmt(f.custo_hora_real)}/h</td>
                  <td className={`px-3 py-3 text-right font-semibold ${Number(f.margem_hh) >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(f.margem_hh)}/h</td>
                  <td className={`px-3 py-3 text-right font-bold ${MARGEM_CLS(Number(f.margem_pct))}`}>{Number(f.margem_pct).toFixed(1)}%</td>
                  <td className="px-3 py-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${be.cls}`}>
                      {be.icon} {be.label}{f.status_breakeven === 'em_amortizacao' && f.meses_para_breakeven ? ` (${f.meses_para_breakeven}m)` : ''}
                    </span>
                  </td>
                  <td className={`px-3 py-3 text-right font-bold ${f.status_breakeven === 'sem_dados' ? 'text-gray-300' : Number(f.resultado_acumulado) >= 0 ? 'text-green-700' : 'text-red-600'}`}
                    title={f.status_breakeven === 'sem_dados' ? 'Sem dados de faturamento real. Crie BMs e feche folhas.' : ''}>
                    {f.status_breakeven === 'sem_dados' ? '—' : fmt(f.resultado_acumulado)}
                  </td>
                </tr>
                {isOpen && (
                  <tr><td colSpan={9} className="bg-gray-50/80 border-b border-gray-200 px-4 py-5">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Composição do custo */}
                      <div>
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Composição do Custo Mensal</h4>
                        <div className="space-y-1.5 text-sm">
                          <div className="flex justify-between"><span className="text-gray-500">Salário base</span><span className="font-medium">{fmt(f.salario_base)}</span></div>
                          {Number(f.insalubridade_pct) > 0 && (
                            <div className="flex justify-between text-xs"><span className="text-gray-400 pl-3">+ Insalubridade ({f.insalubridade_pct}%)</span><span className="text-gray-600">{fmt(Number(f.salario_base) * Number(f.insalubridade_pct) / 100)}</span></div>
                          )}
                          <div className="flex justify-between pt-1 border-t border-gray-100"><span className="text-gray-500">Encargos (INSS+FGTS+RAT+S.S.)</span><span className="text-red-600 font-medium">+ {fmt(f.encargos_valor)}</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Provisões (13°+Férias+FGTS)</span><span className="text-violet-600 font-medium">+ {fmt(f.provisoes_valor)}</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Benefícios (VT+VR+VA+Plano)</span><span className="text-blue-600 font-medium">+ {fmt(f.beneficios_valor)}</span></div>
                          <div className="flex justify-between pt-2 border-t-2 border-gray-200 font-bold"><span>Custo total/mês</span><span className="text-red-700">{fmt(f.custo_total_mensal)}</span></div>
                          <div className="flex justify-between text-xs text-gray-400 mt-1"><span>Custo por hora</span><span>{fmt(f.custo_hora_real)}/h</span></div>
                          <div className="flex justify-between text-xs text-gray-400"><span>Billing rate</span><span className="text-green-600">{fmt(f.billing_rate)}/h</span></div>
                          <div className="flex justify-between text-xs font-semibold"><span>Margem por hora</span><span className={Number(f.margem_hh) >= 0 ? 'text-green-700' : 'text-red-700'}>{fmt(f.margem_hh)}/h ({Number(f.margem_pct).toFixed(1)}%)</span></div>
                          {Number(f.custo_mobilizacao_total) > 0 && (
                            <div className="mt-2 p-2 bg-amber-50 rounded-lg text-xs">
                              <div className="font-semibold text-amber-700 mb-1">Custo de mobilização</div>
                              <div className="flex justify-between text-amber-600"><span>ASO + EPI + Uniforme</span><span>{fmt(f.custo_mobilizacao_total)}</span></div>
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Jornada financeira */}
                      <div>
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Jornada Financeira Acumulada</h4>
                        <div className="grid grid-cols-3 gap-2 text-center mb-3">
                          <div className="bg-red-50 rounded-lg p-2"><div className="text-[10px] text-red-400 font-bold mb-0.5">Custo acumulado</div><div className="text-sm font-bold text-red-700">{fmt(f.custo_total_acumulado)}</div></div>
                          <div className="bg-green-50 rounded-lg p-2"><div className="text-[10px] text-green-400 font-bold mb-0.5">Receita acumulada</div><div className="text-sm font-bold text-green-700">{fmt(f.receita_acumulada)}</div></div>
                          <div className={`rounded-lg p-2 ${Number(f.resultado_acumulado) >= 0 ? 'bg-green-50' : 'bg-red-50'}`}><div className="text-[10px] font-bold mb-0.5 text-gray-400">Resultado</div><div className={`text-sm font-bold ${Number(f.resultado_acumulado) >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(f.resultado_acumulado)}</div></div>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {f.meses_para_breakeven != null && (
                            <div className="text-[10px] bg-amber-50 text-amber-700 px-2 py-1 rounded-full">
                              Break-even: mês {f.meses_para_breakeven} {f.meses_na_empresa >= (f.meses_para_breakeven || 0) ? '✅ atingido' : `(faltam ${(f.meses_para_breakeven || 0) - f.meses_na_empresa}m)`}
                            </div>
                          )}
                          {f.meses_periodo_otimo != null && (
                            <div className="text-[10px] bg-blue-50 text-blue-700 px-2 py-1 rounded-full">Período ótimo: até mês {f.meses_periodo_otimo}</div>
                          )}
                        </div>
                        <div className="mt-3 text-[10px] text-gray-400">
                          {f.meses_na_empresa}m na empresa · {Number(f.hh_faturadas_total).toLocaleString('pt-BR')} HH faturadas · Admissão: {f.admissao ? new Date(f.admissao + 'T12:00').toLocaleDateString('pt-BR') : '—'}
                        </div>
                      </div>
                    </div>
                  </td></tr>
                )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Ciclo Financeiro */}
      {ciclo && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Ciclo Financeiro — {ciclo.obra}</h3>
          <div className="flex items-center gap-1 mb-4">
            <div className="flex-1 h-10 bg-red-100 rounded-l-lg flex items-center justify-center text-xs font-medium text-red-700">
              Trabalho (15d)
            </div>
            <div className="flex-1 h-10 bg-amber-100 flex items-center justify-center text-xs font-medium text-amber-700">
              BM + Aprovação (30d)
            </div>
            <div className="h-10 bg-blue-100 rounded-r-lg flex items-center justify-center text-xs font-medium text-blue-700 px-4">
              Pgto ({ciclo.prazo_pagamento_dias || 5}d)
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-[10px] text-gray-400 uppercase font-bold">Custo MO/mês</div>
              <div className="text-sm font-bold text-red-700">{fmt(ciclo.custo_mo_mensal)}</div>
            </div>
            <div>
              <div className="text-[10px] text-gray-400 uppercase font-bold">Ciclo total</div>
              <div className="text-sm font-bold text-gray-900">{ciclo.ciclo_financeiro_dias} dias</div>
            </div>
            <div>
              <div className="text-[10px] text-gray-400 uppercase font-bold">Capital de giro necessário</div>
              <div className="text-sm font-bold text-brand">{fmt(ciclo.capital_giro_necessario)}</div>
            </div>
          </div>
          <div className="mt-3 text-[10px] text-gray-400">
            A empresa financia {ciclo.ciclo_financeiro_dias} dias de custo de MO ({fmt(ciclo.custo_diario_mo)}/dia) antes de receber do cliente.
          </div>
        </div>
      )}
    </>
  )
}
