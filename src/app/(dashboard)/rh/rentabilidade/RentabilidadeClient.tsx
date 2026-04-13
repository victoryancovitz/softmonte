'use client'
import { useState, useMemo, Fragment } from 'react'
import { ChevronDown, ChevronUp, TrendingUp, Clock, DollarSign, Users } from 'lucide-react'
import { fmt, corMargem } from '@/lib/cores'

const BE_BADGE: Record<string, { label: string; icon: string; cls: string }> = {
  no_lucro: { label: 'No lucro', icon: '✅', cls: 'bg-green-100 text-green-700' },
  em_amortizacao: { label: 'Amortizando', icon: '⏳', cls: 'bg-amber-100 text-amber-700' },
  nunca_rentavel: { label: 'Margem negativa', icon: '❌', cls: 'bg-red-100 text-red-700' },
  sem_dados: { label: 'Sem histórico', icon: '○', cls: 'bg-gray-100 text-gray-500' },
}

const MARGEM_CLS = (pct: number) =>
  pct >= 25 ? 'text-green-700' : pct >= 0 ? 'text-amber-600' : 'text-red-700'

export default function RentabilidadeClient({ data, ciclo, receitaReal, margemReal, margemRealProv }: {
  data: any[]; ciclo: any; receitaReal: number; margemReal: number | null; margemRealProv: number | null
}) {
  const [expandido, setExpandido] = useState<string | null>(null)

  const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

  const roiMap = useMemo<Record<string, { roi_pct: number | null; resultado_prov: number | null; margem_prov_pct: number | null }>>(() => {
    const map: Record<string, any> = {}
    for (const row of data) {
      const resultado = Number(row.resultado_acumulado || 0)
      const custo = Number(row.custo_total_acumulado || 0)
      const receita = Number(row.receita_acumulada || 0)
      const provisaoMes = Number(row.provisoes_valor || 0)
      const meses = Number(row.meses_na_empresa || 0)
      const roi_pct = custo > 0 ? Math.round(resultado / custo * 1000) / 10 : null
      const resultado_prov = resultado - (provisaoMes * meses)
      const margem_prov_pct = receita > 0 ? Math.round(resultado_prov / receita * 1000) / 10 : null
      map[row.funcionario_id] = { roi_pct, resultado_prov, margem_prov_pct }
    }
    return map
  }, [data])

  const totalFuncs = data.length
  const noLucro = data.filter(d => d.status_breakeven === 'no_lucro').length
  const emAmort = data.filter(d => d.status_breakeven === 'em_amortizacao').length
  const semDados = data.filter(d => d.status_breakeven === 'sem_dados').length
  const margemMedia = totalFuncs > 0 ? data.reduce((s, d) => s + Number(d.margem_pct || 0), 0) / totalFuncs : 0

  return (
    <>
      {/* Cards resumo */}
      {/* 3 Margens */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4" title="Calculada sobre preço contratado por HH vs custo projetado. Não reflete faturamento real.">
          <div className="text-[10px] font-bold text-gray-400 uppercase">Margem Teórica</div>
          <div className={`text-2xl font-bold font-display ${MARGEM_CLS(margemMedia)}`}>{margemMedia.toFixed(1)}%</div>
          <div className="text-[10px] text-gray-400">Billing rate vs custo/hora projetado</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4" title="Receita BMs aprovados menos folha (salário + encargos + benefícios). Exclui provisões de 13°, férias e FGTS.">
          <div className="text-[10px] font-bold text-gray-400 uppercase">Margem Real</div>
          <div className={`text-2xl font-bold font-display ${margemReal != null ? MARGEM_CLS(margemReal) : 'text-gray-300'}`}>{margemReal != null ? `${margemReal.toFixed(1)}%` : '—'}</div>
          <div className="text-[10px] text-gray-400">{receitaReal > 0 ? 'Receita BMs − folha (sem provisões)' : 'Sem BMs aprovados'}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4" title="Inclui provisões de 13°, férias e FGTS. Margem mais conservadora e mais próxima do resultado definitivo.">
          <div className="text-[10px] font-bold text-gray-400 uppercase">Margem Real c/ Provisões</div>
          <div className={`text-2xl font-bold font-display ${margemRealProv != null ? MARGEM_CLS(margemRealProv) : 'text-gray-300'}`}>{margemRealProv != null ? `${margemRealProv.toFixed(1)}%` : '—'}</div>
          <div className="text-[10px] text-gray-400">{receitaReal > 0 ? 'Receita BMs − folha completa' : 'Sem BMs aprovados'}</div>
        </div>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1"><DollarSign className="w-4 h-4 text-green-500" /><span className="text-[10px] font-bold text-gray-400 uppercase">No Lucro</span></div>
          <div className="text-2xl font-bold text-green-700 font-display">{noLucro}</div>
          <div className="text-[10px] text-gray-400 mt-0.5">de {totalFuncs}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1"><Clock className="w-4 h-4 text-amber-500" /><span className="text-[10px] font-bold text-gray-400 uppercase">Em Amortização</span></div>
          <div className="text-2xl font-bold text-amber-700 font-display">{emAmort}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1"><Users className="w-4 h-4 text-gray-400" /><span className="text-[10px] font-bold text-gray-400 uppercase">Sem Histórico</span></div>
          <div className="text-2xl font-bold text-gray-400 font-display">{semDados}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1"><DollarSign className="w-4 h-4 text-violet-500" /><span className="text-[10px] font-bold text-gray-400 uppercase">Capital em Giro</span></div>
          <div className="text-lg font-bold text-gray-900 font-display">{ciclo ? fmt(ciclo.capital_giro_necessario) : '—'}</div>
          <div className="text-[10px] text-gray-400 mt-0.5">{ciclo ? `Ciclo: ${ciclo.ciclo_financeiro_dias}d` : 'Sem obra ativa'}</div>
        </div>
      </div>

      {/* Legenda */}
      <div className="text-[11px] text-gray-400 flex gap-4 mb-4 px-1">
        <span><strong className="text-gray-500">ROI Período</strong> = Margem acumulada ÷ Custo total empregado</span>
        <span>·</span>
        <span><strong className="text-gray-500">Margem c/Prov</strong> = Descontando 13°, férias e FGTS já acumulados</span>
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
              <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500 uppercase" title="Margem real: receita BMs aprovados menos custo efetivo">Margem Real %</th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500 uppercase" title="Retorno sobre o custo total empregado neste funcionário">ROI Período</th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500 uppercase" title="Margem real descontando 13°, férias e FGTS provisionados">Margem c/Prov</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Break-even</th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500 uppercase" title="Receita real de BMs aprovados menos custo real acumulado">Resultado real</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr><td colSpan={12} className="px-4 py-10 text-center text-gray-400">Sem dados de rentabilidade.</td></tr>
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
                  <td className={`px-3 py-3 text-right font-bold ${corMargem(f.margem_real_pct != null ? Number(f.margem_real_pct) : null)}`}>{f.margem_real_pct != null ? `${Number(f.margem_real_pct).toFixed(1)}%` : '—'}</td>
                  <td className="px-3 py-3 text-right text-sm">{roiMap[f.funcionario_id]?.roi_pct != null ? <span className={roiMap[f.funcionario_id].roi_pct! >= 50 ? 'font-bold text-green-700' : roiMap[f.funcionario_id].roi_pct! >= 25 ? 'font-semibold text-green-600' : roiMap[f.funcionario_id].roi_pct! >= 0 ? 'text-amber-600' : 'text-red-600'}>{roiMap[f.funcionario_id].roi_pct!.toFixed(1)}%</span> : <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-3 text-right text-sm">{roiMap[f.funcionario_id]?.margem_prov_pct != null ? <div><span className={roiMap[f.funcionario_id].margem_prov_pct! >= 25 ? 'font-bold text-green-700' : roiMap[f.funcionario_id].margem_prov_pct! >= 10 ? 'font-semibold text-amber-600' : roiMap[f.funcionario_id].margem_prov_pct! >= 0 ? 'text-orange-600' : 'text-red-600'}>{roiMap[f.funcionario_id].margem_prov_pct!.toFixed(1)}%</span><div className={`text-[10px] mt-0.5 ${(roiMap[f.funcionario_id].resultado_prov ?? 0) >= 0 ? 'text-gray-400' : 'text-red-400'}`}>{fmt(roiMap[f.funcionario_id].resultado_prov ?? 0)}</div></div> : <span className="text-gray-300">—</span>}</td>
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
                  <tr><td colSpan={12} className="bg-gray-50/80 border-b border-gray-200 px-4 py-5">
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
                    {/* ROI + Provisões cards */}
                    {(() => {
                      const roi = roiMap[f.funcionario_id]
                      return roi ? (
                        <div className="grid grid-cols-3 gap-3 mb-4 mt-4">
                          <div className="bg-white rounded-lg border p-3 text-center">
                            <div className="text-[10px] text-gray-400 uppercase mb-1">ROI do Período</div>
                            <div className={`text-xl font-bold ${(roi.roi_pct ?? 0) >= 25 ? 'text-green-700' : 'text-amber-600'}`}>{roi.roi_pct?.toFixed(1) ?? '—'}%</div>
                            <div className="text-[10px] text-gray-400 mt-0.5">margem ÷ custo total</div>
                          </div>
                          <div className="bg-white rounded-lg border p-3 text-center">
                            <div className="text-[10px] text-gray-400 uppercase mb-1">Resultado c/ Provisões</div>
                            <div className={`text-xl font-bold ${(roi.resultado_prov ?? 0) >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(roi.resultado_prov ?? 0)}</div>
                            <div className="text-[10px] text-gray-400 mt-0.5">inclui 13°, férias e FGTS</div>
                          </div>
                          <div className="bg-white rounded-lg border p-3 text-center">
                            <div className="text-[10px] text-gray-400 uppercase mb-1">Margem c/ Provisões</div>
                            <div className={`text-xl font-bold ${(roi.margem_prov_pct ?? 0) >= 25 ? 'text-green-700' : (roi.margem_prov_pct ?? 0) >= 0 ? 'text-amber-600' : 'text-red-600'}`}>{roi.margem_prov_pct?.toFixed(1) ?? '—'}%</div>
                            <div className="text-[10px] text-gray-400 mt-0.5">da receita faturada</div>
                          </div>
                        </div>
                      ) : null
                    })()}
                    {/* Fluxo de Caixa Acumulado */}
                    {(() => {
                      try {
                        const fluxos: { ano: number; mes: number; receita: number; custo: number; margem: number }[] =
                          typeof f.fluxo_caixa_mensal === 'string' ? JSON.parse(f.fluxo_caixa_mensal || '[]') : (f.fluxo_caixa_mensal || [])
                        if (fluxos.length === 0) return null
                        const mobil = Number(f.custo_mobilizacao_total) > 0 ? Number(f.custo_mobilizacao_total) : Number(f.custo_total_mensal)
                        const acumulado: number[] = []
                        let acc = -mobil
                        for (const fl of fluxos) { acc += fl.margem; acumulado.push(acc) }
                        const labels = fluxos.map(fl => `${MESES[fl.mes - 1]}/${String(fl.ano).slice(2)}`)
                        const n = acumulado.length
                        if (n < 2) return null
                        const minY = Math.min(0, ...acumulado)
                        const maxY = Math.max(0, ...acumulado)
                        const rangeY = maxY - minY || 1
                        const padL = 50; const padR = 10; const padT = 15; const padB = 30
                        const W = 700; const H = 150
                        const cW = W - padL - padR; const cH = H - padT - padB
                        const px = (i: number) => padL + (i / (n - 1)) * cW
                        const py = (v: number) => padT + cH - ((v - minY) / rangeY) * cH
                        const y0 = py(0)
                        const linePts = acumulado.map((v, i) => `${px(i)},${py(v)}`).join(' ')
                        // Positive fill (green)
                        const posPts: string[] = []; const negPts: string[] = []
                        for (let i = 0; i < n; i++) {
                          if (acumulado[i] >= 0) posPts.push(`${px(i)},${py(acumulado[i])}`)
                          else posPts.push(`${px(i)},${y0}`)
                          if (acumulado[i] <= 0) negPts.push(`${px(i)},${py(acumulado[i])}`)
                          else negPts.push(`${px(i)},${y0}`)
                        }
                        const posPath = `${posPts.join(' ')} ${px(n-1)},${y0} ${px(0)},${y0}`
                        const negPath = `${negPts.join(' ')} ${px(n-1)},${y0} ${px(0)},${y0}`
                        // Break-even crossing
                        let beCross: number | null = null
                        for (let i = 1; i < n; i++) {
                          if ((acumulado[i-1] < 0 && acumulado[i] >= 0) || (acumulado[i-1] >= 0 && acumulado[i] < 0)) {
                            const ratio = Math.abs(acumulado[i-1]) / (Math.abs(acumulado[i-1]) + Math.abs(acumulado[i]))
                            beCross = px(i - 1 + ratio)
                            break
                          }
                        }
                        return (
                          <div className="mt-5">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Fluxo de Caixa Acumulado</h4>
                            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 150 }}>
                              {/* Grid lines */}
                              <line x1={padL} y1={y0} x2={W - padR} y2={y0} stroke="#9ca3af" strokeWidth={1} strokeDasharray="4 3" />
                              <text x={padL - 4} y={y0 + 3} textAnchor="end" className="fill-gray-400" fontSize={8}>R$ 0</text>
                              {/* Green fill (positive) */}
                              <polygon points={posPath} fill="#bbf7d0" opacity={0.5} />
                              {/* Red fill (negative) */}
                              <polygon points={negPath} fill="#fecaca" opacity={0.5} />
                              {/* Line */}
                              <polyline points={linePts} fill="none" stroke="#3b82f6" strokeWidth={2} />
                              {/* Dots */}
                              {acumulado.map((v, i) => (
                                <circle key={i} cx={px(i)} cy={py(v)} r={2.5} fill={v >= 0 ? '#16a34a' : '#dc2626'} />
                              ))}
                              {/* X labels */}
                              {labels.map((l, i) => {
                                const step = Math.max(1, Math.floor(n / 8))
                                if (i % step !== 0 && i !== n - 1) return null
                                return <text key={i} x={px(i)} y={H - 5} textAnchor="middle" className="fill-gray-400" fontSize={7}>{l}</text>
                              })}
                              {/* Y min/max */}
                              <text x={padL - 4} y={padT + 4} textAnchor="end" className="fill-gray-400" fontSize={7}>{(maxY / 1000).toFixed(0)}k</text>
                              <text x={padL - 4} y={padT + cH + 4} textAnchor="end" className="fill-gray-400" fontSize={7}>{(minY / 1000).toFixed(0)}k</text>
                              {/* Break-even label */}
                              {beCross !== null && (
                                <>
                                  <line x1={beCross} y1={padT} x2={beCross} y2={padT + cH} stroke="#16a34a" strokeWidth={1} strokeDasharray="3 2" />
                                  <text x={beCross} y={padT - 3} textAnchor="middle" fill="#16a34a" fontSize={8} fontWeight="bold">Break-even</text>
                                </>
                              )}
                            </svg>
                          </div>
                        )
                      } catch { return null }
                    })()}
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
