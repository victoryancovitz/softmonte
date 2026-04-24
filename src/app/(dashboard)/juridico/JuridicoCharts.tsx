'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'
import { CHART_THEME, formatCurrencyK } from '@/lib/charts/theme'

const PROGNOSTICO_COLORS: Record<string, string> = {
  provavel: '#EF4444',
  possivel: '#F59E0B',
  remoto: '#10B981',
}

const PROGNOSTICO_LABELS: Record<string, string> = {
  provavel: 'Provavel',
  possivel: 'Possivel',
  remoto: 'Remoto',
}

interface ExposicaoItem {
  name: string
  value: number
  provisao: number
  color: string
}

interface TipoItem {
  name: string
  count: number
}

interface JuridicoChartsProps {
  processos: Array<{ prognostico?: string | null; tipo?: string | null; valor_causa?: number | null; valor_provisao?: number | null }>
}

export default function JuridicoCharts({ processos }: JuridicoChartsProps) {
  // --- Exposicao por prognostico (donut) ---
  const prognosticoMap: Record<string, { count: number; provisao: number }> = {}
  for (const p of processos) {
    const prog = p.prognostico
    if (prog && PROGNOSTICO_COLORS[prog]) {
      if (!prognosticoMap[prog]) prognosticoMap[prog] = { count: 0, provisao: 0 }
      prognosticoMap[prog].count += 1
      prognosticoMap[prog].provisao += p.valor_provisao || p.valor_causa || 0
    }
  }

  const exposicaoData: ExposicaoItem[] = Object.entries(prognosticoMap).map(([key, val]) => ({
    name: PROGNOSTICO_LABELS[key] || key,
    value: val.count,
    provisao: val.provisao,
    color: PROGNOSTICO_COLORS[key],
  }))

  const hasExposicao = exposicaoData.some((d) => d.value > 0)

  // --- Processos por tipo (horizontal bar) ---
  const tipoMap: Record<string, number> = {}
  for (const p of processos) {
    const tipo = p.tipo || 'outros'
    tipoMap[tipo] = (tipoMap[tipo] || 0) + 1
  }

  const TIPO_LABELS: Record<string, string> = {
    trabalhista: 'Trabalhistas',
    civel: 'Civeis',
    tributario: 'Tributarios',
    outros: 'Outros',
  }

  const tipoData: TipoItem[] = Object.entries(tipoMap)
    .map(([key, count]) => ({ name: TIPO_LABELS[key] || key, count }))
    .sort((a, b) => b.count - a.count)

  const hasTipo = tipoData.length > 0 && tipoData.some((d) => d.count > 0)

  const tooltipStyle = {
    backgroundColor: CHART_THEME.tooltipBg,
    border: 'none',
    borderRadius: 8,
    color: '#fff',
    fontSize: 11,
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Donut: Exposicao por prognostico */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-4">
          Exposicao por prognostico
        </div>
        {!hasExposicao ? (
          <div className="flex items-center justify-center h-[180px]">
            <p className="text-sm text-gray-400">Nenhum processo com prognostico definido</p>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="h-[180px] w-[180px] flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={exposicaoData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={2}
                    animationDuration={CHART_THEME.animationDuration}
                  >
                    {exposicaoData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    itemStyle={{ color: '#fff' }}
                    formatter={(value: any, name: any, props: any) => {
                      const item = props.payload as ExposicaoItem
                      return [`${value} processo(s) — ${formatCurrencyK(item.provisao)}`, name]
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {exposicaoData.map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-gray-700">{item.name}</span>
                  <span className="font-semibold text-gray-900">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Horizontal Bar: Processos por tipo */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-4">
          Processos por tipo
        </div>
        {!hasTipo ? (
          <div className="flex items-center justify-center h-[180px]">
            <p className="text-sm text-gray-400">Nenhum processo cadastrado</p>
          </div>
        ) : (
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tipoData} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 5 }}>
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 10, fill: CHART_THEME.axisColor }}
                  axisLine={{ stroke: CHART_THEME.gridColor }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11, fill: CHART_THEME.axisColor }}
                  axisLine={false}
                  tickLine={false}
                  width={90}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  itemStyle={{ color: '#fff' }}
                  labelStyle={{ color: CHART_THEME.gold, fontWeight: 'bold' }}
                  formatter={(v: any) => [`${v} processo(s)`, 'Quantidade']}
                />
                <Bar
                  dataKey="count"
                  name="Processos"
                  fill={CHART_THEME.primary}
                  radius={[0, 4, 4, 0]}
                  animationDuration={CHART_THEME.animationDuration}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
