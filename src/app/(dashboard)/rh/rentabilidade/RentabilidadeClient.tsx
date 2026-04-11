'use client'
import { useState } from 'react'
import { ChevronDown, ChevronUp, TrendingUp, Clock, DollarSign, Users } from 'lucide-react'

const fmt = (v: any) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const BE_BADGE: Record<string, { label: string; icon: string; cls: string }> = {
  no_lucro: { label: 'No lucro', icon: '✅', cls: 'bg-green-100 text-green-700' },
  em_amortizacao: { label: 'Amortizando', icon: '⏳', cls: 'bg-amber-100 text-amber-700' },
  nunca_rentavel: { label: 'Margem negativa', icon: '❌', cls: 'bg-red-100 text-red-700' },
}

const MARGEM_CLS = (pct: number) =>
  pct >= 30 ? 'text-green-700' : pct >= 15 ? 'text-amber-700' : 'text-red-700'

export default function RentabilidadeClient({ data, ciclo }: { data: any[]; ciclo: any }) {
  const [expandido, setExpandido] = useState<string | null>(null)

  const totalFuncs = data.length
  const noLucro = data.filter(d => d.status_breakeven === 'no_lucro').length
  const emAmort = data.filter(d => d.status_breakeven === 'em_amortizacao').length
  const margemMedia = totalFuncs > 0 ? data.reduce((s, d) => s + Number(d.margem_pct || 0), 0) / totalFuncs : 0

  return (
    <>
      {/* Cards resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-brand" /><span className="text-[10px] font-bold text-gray-400 uppercase">Margem Média</span></div>
          <div className={`text-2xl font-bold font-display ${MARGEM_CLS(margemMedia)}`}>{margemMedia.toFixed(1)}%</div>
          <div className="text-[10px] text-gray-400 mt-0.5">{margemMedia >= 30 ? 'Excelente' : margemMedia >= 20 ? 'Bom' : margemMedia >= 10 ? 'Atenção' : 'Crítico'}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1"><DollarSign className="w-4 h-4 text-green-500" /><span className="text-[10px] font-bold text-gray-400 uppercase">No Lucro</span></div>
          <div className="text-2xl font-bold text-green-700 font-display">{noLucro}</div>
          <div className="text-[10px] text-gray-400 mt-0.5">de {totalFuncs} funcionários</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1"><Clock className="w-4 h-4 text-amber-500" /><span className="text-[10px] font-bold text-gray-400 uppercase">Em Amortização</span></div>
          <div className="text-2xl font-bold text-amber-700 font-display">{emAmort}</div>
          <div className="text-[10px] text-gray-400 mt-0.5">recuperando custo de entrada</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1"><Users className="w-4 h-4 text-violet-500" /><span className="text-[10px] font-bold text-gray-400 uppercase">Capital em Giro</span></div>
          <div className="text-lg font-bold text-gray-900 font-display">{ciclo ? fmt(ciclo.capital_giro_necessario) : '—'}</div>
          <div className="text-[10px] text-gray-400 mt-0.5">{ciclo ? `Ciclo: ${ciclo.ciclo_financeiro_dias}d · Custo/dia: ${fmt(ciclo.custo_diario_mo)}` : 'Sem obra ativa'}</div>
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
              <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Margem %</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Break-even</th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Resultado</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">Sem dados de rentabilidade.</td></tr>
            ) : data.sort((a, b) => Number(b.margem_pct || 0) - Number(a.margem_pct || 0)).map(f => {
              const isOpen = expandido === f.funcionario_id
              const be = BE_BADGE[f.status_breakeven] || BE_BADGE.nunca_rentavel
              return (
                <tr key={f.funcionario_id}
                  onClick={() => setExpandido(isOpen ? null : f.funcionario_id)}
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
                  <td className={`px-3 py-3 text-right font-bold ${Number(f.resultado_acumulado) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {fmt(f.resultado_acumulado)}
                  </td>
                </tr>
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
