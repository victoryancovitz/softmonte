'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { CHART_THEME, formatCurrencyK } from '@/lib/charts/theme'

const MESES = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

interface FluxoMensalItem {
  mes: string
  receita: number
  despesa: number
  resultado: number
}

export function FluxoMensalChart({ data }: { data: FluxoMensalItem[] }) {
  if (data.length === 0) return null

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-4">Fluxo Mensal — Receita vs Custo MO (6 meses)</div>
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 5 }}>
            <XAxis
              dataKey="mes"
              tick={{ fontSize: 10, fill: CHART_THEME.axisColor }}
              axisLine={{ stroke: CHART_THEME.gridColor }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={formatCurrencyK}
              tick={{ fontSize: 10, fill: CHART_THEME.axisColor }}
              axisLine={false}
              tickLine={false}
              width={55}
            />
            <Tooltip
              formatter={(v: any) => `R$ ${Number(v).toLocaleString('pt-BR')}`}
              contentStyle={{
                backgroundColor: CHART_THEME.tooltipBg,
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                fontSize: 11,
              }}
              itemStyle={{ color: '#fff' }}
              labelStyle={{ color: CHART_THEME.gold, fontWeight: 'bold' }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            />
            <Bar
              dataKey="receita"
              name="Receita"
              fill={CHART_THEME.success}
              radius={[4, 4, 0, 0]}
              animationDuration={CHART_THEME.animationDuration}
            />
            <Bar
              dataKey="despesa"
              name="Custo MO"
              fill={CHART_THEME.danger}
              radius={[4, 4, 0, 0]}
              animationDuration={CHART_THEME.animationDuration}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

interface CashflowMensalItem {
  mes: string
  entradas: number
  saidas: number
  saldo: number
}

export function CashflowMensalChart({ data }: { data: CashflowMensalItem[] }) {
  if (data.length === 0) return null

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-4">Fluxo de Caixa Mensal — Entradas vs Saídas</div>
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 5 }}>
            <XAxis
              dataKey="mes"
              tick={{ fontSize: 10, fill: CHART_THEME.axisColor }}
              axisLine={{ stroke: CHART_THEME.gridColor }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={formatCurrencyK}
              tick={{ fontSize: 10, fill: CHART_THEME.axisColor }}
              axisLine={false}
              tickLine={false}
              width={55}
            />
            <Tooltip
              formatter={(v: any) => `R$ ${Math.abs(Number(v)).toLocaleString('pt-BR')}`}
              contentStyle={{
                backgroundColor: CHART_THEME.tooltipBg,
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                fontSize: 11,
              }}
              itemStyle={{ color: '#fff' }}
              labelStyle={{ color: CHART_THEME.gold, fontWeight: 'bold' }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            />
            <Bar
              dataKey="entradas"
              name="Entradas"
              fill={CHART_THEME.success}
              radius={[4, 4, 0, 0]}
              animationDuration={CHART_THEME.animationDuration}
            />
            <Bar
              dataKey="saidas"
              name="Saídas"
              fill={CHART_THEME.danger}
              radius={[4, 4, 0, 0]}
              animationDuration={CHART_THEME.animationDuration}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
