'use client'
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { CHART_THEME, formatCurrencyK, formatCurrency } from '@/lib/charts/theme'
import { fmt } from '@/lib/cores'

interface FluxoRow {
  mes: string
  receita_paga: number
  receita_em_aberto: number
  despesa_paga: number
  despesa_em_aberto: number
  provisao: number
  resultado_caixa: number
  resultado_previsto: number
  qtd: number
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#0f1e2e] text-white rounded-xl shadow-2xl border border-white/10 p-3 text-xs min-w-[200px]">
      <p className="font-bold text-brand mb-2 text-sm">{label}</p>
      <div className="space-y-1.5">
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex justify-between gap-4">
            <span style={{ color: p.color }}>{p.name}</span>
            <span className="font-semibold">{formatCurrency(p.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatMesLabel(mes: string) {
  // mes comes as "2026-04" or similar
  const parts = mes.split('-')
  if (parts.length >= 2) return parts[1] + '/' + parts[0].slice(2)
  return mes
}

export default function FluxoCaixaClient({ rows }: { rows: FluxoRow[] }) {
  const chartData = rows.map(r => ({
    mes: formatMesLabel(r.mes),
    receita_paga: Number(r.receita_paga || 0),
    despesa_paga: Number(r.despesa_paga || 0),
    resultado_caixa: Number(r.resultado_caixa || 0),
  }))

  // Running sum (acumulado)
  let acumulado = 0
  const tableRows = rows.map(r => {
    const rc = Number(r.resultado_caixa || 0)
    acumulado += rc
    return { ...r, acumulado }
  })

  return (
    <>
      {/* Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">Fluxo de Caixa Mensal</h2>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500 inline-block" />&nbsp;Receita Paga</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500 inline-block" />&nbsp;Despesa Paga</span>
            <span className="flex items-center gap-1"><span className="w-3 h-1 border-t-2 border-amber-500 inline-block" />&nbsp;Resultado Caixa</span>
          </div>
        </div>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.gridColor} vertical={false} />
              <XAxis
                dataKey="mes"
                tick={{ fontSize: 11, fill: CHART_THEME.axisColor }}
                tickLine={false}
                axisLine={{ stroke: CHART_THEME.gridColor }}
              />
              <YAxis
                yAxisId="bars"
                tick={{ fontSize: 10, fill: CHART_THEME.axisColor }}
                tickFormatter={formatCurrencyK}
                tickLine={false}
                axisLine={false}
                width={60}
              />
              <YAxis
                yAxisId="line"
                orientation="right"
                tick={{ fontSize: 10, fill: CHART_THEME.warning }}
                tickFormatter={formatCurrencyK}
                tickLine={false}
                axisLine={false}
                width={60}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                yAxisId="bars"
                dataKey="receita_paga"
                name="Receita Paga"
                fill={CHART_THEME.success}
                radius={[3, 3, 0, 0]}
                barSize={18}
                animationDuration={CHART_THEME.animationDuration}
              />
              <Bar
                yAxisId="bars"
                dataKey="despesa_paga"
                name="Despesa Paga"
                fill={CHART_THEME.danger}
                radius={[3, 3, 0, 0]}
                barSize={18}
                animationDuration={CHART_THEME.animationDuration}
              />
              <Line
                yAxisId="line"
                type="monotone"
                dataKey="resultado_caixa"
                name="Resultado Caixa"
                stroke={CHART_THEME.warning}
                strokeWidth={2.5}
                dot={{ r: 4, fill: CHART_THEME.warning, stroke: '#fff', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: CHART_THEME.warning, stroke: '#fff', strokeWidth: 2 }}
                animationDuration={CHART_THEME.animationDuration}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-40 flex items-center justify-center text-gray-400 text-sm">Sem dados</div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {['Mes', 'Receita Paga', 'Despesa Paga', 'Em Aberto', 'Provisao', 'Resultado Caixa', 'Resultado Previsto', 'Acumulado'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableRows.map((r, i) => {
              const recPaga = Number(r.receita_paga || 0)
              const desPaga = Number(r.despesa_paga || 0)
              const emAberto = Number(r.receita_em_aberto || 0) - Number(r.despesa_em_aberto || 0)
              const provisao = Number(r.provisao || 0)
              const resCaixa = Number(r.resultado_caixa || 0)
              const resPrev = Number(r.resultado_previsto || 0)
              return (
                <tr key={r.mes} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-2 font-medium text-gray-700">{formatMesLabel(r.mes)}</td>
                  <td className="px-4 py-2 text-right text-green-700 font-semibold">{fmt(recPaga)}</td>
                  <td className="px-4 py-2 text-right text-red-700 font-semibold">{fmt(desPaga)}</td>
                  <td className={`px-4 py-2 text-right font-semibold ${emAberto >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>{fmt(emAberto)}</td>
                  <td className="px-4 py-2 text-right text-gray-500">{fmt(provisao)}</td>
                  <td className={`px-4 py-2 text-right font-bold ${resCaixa >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(resCaixa)}</td>
                  <td className={`px-4 py-2 text-right font-semibold ${resPrev >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(resPrev)}</td>
                  <td className={`px-4 py-2 text-right font-bold ${r.acumulado >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(r.acumulado)}</td>
                </tr>
              )
            })}
            {tableRows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">Nenhum dado encontrado</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
