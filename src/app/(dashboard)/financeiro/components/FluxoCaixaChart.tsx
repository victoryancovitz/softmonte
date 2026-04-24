'use client'
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts'
import { CHART_THEME, formatCurrencyK, formatCurrency } from '@/lib/charts/theme'

interface FluxoCaixaChartProps {
  fluxo: any[]
  chartH: number
  maxVal: number
  barW: number
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

export default function FluxoCaixaChart({ fluxo, chartH, maxVal, barW }: FluxoCaixaChartProps) {
  const chartData = fluxo.map(m => ({
    mes: m.mes.slice(5, 7) + '/' + m.mes.slice(2, 4),
    receita_pago: m.receita_pago,
    despesa_pago: m.despesa_pago,
    resultado: m.resultado,
  }))

  return (
    <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold">Fluxo de Caixa Mensal</h2>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500 inline-block" />&nbsp;Receita Paga</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500 inline-block" />&nbsp;Despesa Paga</span>
          <span className="flex items-center gap-1"><span className="w-3 h-1 border-t-2 border-amber-500 inline-block" />&nbsp;Resultado</span>
        </div>
      </div>
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={Math.max(chartH + 60, 260)}>
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
              dataKey="receita_pago"
              name="Receita Paga"
              fill={CHART_THEME.success}
              radius={[3, 3, 0, 0]}
              barSize={barW || 18}
              animationDuration={CHART_THEME.animationDuration}
            />
            <Bar
              yAxisId="bars"
              dataKey="despesa_pago"
              name="Despesa Paga"
              fill={CHART_THEME.danger}
              radius={[3, 3, 0, 0]}
              barSize={barW || 18}
              animationDuration={CHART_THEME.animationDuration}
            />
            <Line
              yAxisId="line"
              type="monotone"
              dataKey="resultado"
              name="Resultado"
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
  )
}
