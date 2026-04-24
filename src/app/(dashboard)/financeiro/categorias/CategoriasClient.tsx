'use client'
import { useState, useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { CHART_THEME } from '@/lib/charts/theme'
import { fmt } from '@/lib/cores'

type Lancamento = {
  id: string
  descricao: string
  valor: number
  tipo: string
  categoria: string
  data_competencia: string | null
  fornecedor: string | null
}

type CategoriaRow = {
  categoria: string
  qtd: number
  total: number
}

export default function CategoriasClient({ lancamentos }: { lancamentos: Lancamento[] }) {
  const [selected, setSelected] = useState<string | null>(null)

  const agrupados = useMemo(() => {
    const map = new Map<string, CategoriaRow>()
    lancamentos.forEach((l) => {
      const key = l.categoria
      const cur = map.get(key)
      const valor = Math.abs(Number(l.valor || 0))
      if (cur) {
        cur.qtd += 1
        cur.total += valor
      } else {
        map.set(key, { categoria: key, qtd: 1, total: valor })
      }
    })
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [lancamentos])

  const totalGeral = useMemo(() => agrupados.reduce((s, r) => s + r.total, 0), [agrupados])

  const chartData = useMemo(() => {
    const top = agrupados.slice(0, 7)
    const outros = agrupados.slice(7)
    const result = top.map((r) => ({ name: r.categoria, value: r.total }))
    if (outros.length > 0) {
      result.push({ name: 'Outros', value: outros.reduce((s, r) => s + r.total, 0) })
    }
    return result
  }, [agrupados])

  const drillDown = useMemo(() => {
    if (!selected) return []
    return lancamentos
      .filter((l) => l.categoria === selected)
      .sort((a, b) => Math.abs(Number(b.valor)) - Math.abs(Number(a.valor)))
  }, [lancamentos, selected])

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
        {/* Donut Chart */}
        <div className="lg:col-span-3 bg-white border border-gray-100 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Distribuicao por Categoria</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={110}
                  dataKey="value"
                  onClick={(_, i) => {
                    const name = chartData[i]?.name
                    if (name) setSelected(name === selected ? null : name)
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {chartData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={CHART_THEME.categorical[i % CHART_THEME.categorical.length]}
                      opacity={selected && chartData[i]?.name !== selected ? 0.4 : 1}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) => fmt(Number(v ?? 0))}
                  contentStyle={{
                    backgroundColor: CHART_THEME.tooltipBg,
                    border: 'none',
                    borderRadius: 8,
                    color: '#fff',
                    fontSize: 11,
                  }}
                  itemStyle={{ color: '#fff' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Table */}
        <div className="lg:col-span-2 bg-white border border-gray-100 rounded-xl p-4 overflow-auto">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Categorias</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 text-xs border-b">
                <th className="pb-2">Categoria</th>
                <th className="pb-2 text-right">Qtd</th>
                <th className="pb-2 text-right">Valor</th>
                <th className="pb-2 text-right">%</th>
              </tr>
            </thead>
            <tbody>
              {agrupados.map((row, i) => (
                <tr
                  key={row.categoria}
                  className={`border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors ${
                    selected === row.categoria ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => setSelected(row.categoria === selected ? null : row.categoria)}
                >
                  <td className="py-2 flex items-center gap-2">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor:
                          i < 7
                            ? CHART_THEME.categorical[i % CHART_THEME.categorical.length]
                            : CHART_THEME.neutral,
                      }}
                    />
                    <span className="truncate max-w-[140px]">{row.categoria}</span>
                  </td>
                  <td className="py-2 text-right text-gray-500">{row.qtd}</td>
                  <td className="py-2 text-right font-medium">{fmt(row.total)}</td>
                  <td className="py-2 text-right text-gray-500">
                    {totalGeral > 0 ? ((row.total / totalGeral) * 100).toFixed(1) + '%' : '--'}
                  </td>
                </tr>
              ))}
              {agrupados.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-400">
                    Nenhum lancamento categorizado encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drill-down */}
      {selected && drillDown.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">
              Lancamentos: <span className="text-brand">{selected}</span>
            </h2>
            <button
              className="text-xs text-gray-400 hover:text-gray-600"
              onClick={() => setSelected(null)}
            >
              Fechar
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 text-xs border-b">
                  <th className="pb-2">Data</th>
                  <th className="pb-2">Descricao</th>
                  <th className="pb-2">Fornecedor</th>
                  <th className="pb-2">Tipo</th>
                  <th className="pb-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {drillDown.slice(0, 50).map((l) => (
                  <tr key={l.id} className="border-b border-gray-50">
                    <td className="py-2 text-gray-500 whitespace-nowrap">
                      {l.data_competencia
                        ? new Date(l.data_competencia + 'T00:00:00').toLocaleDateString('pt-BR')
                        : '--'}
                    </td>
                    <td className="py-2 truncate max-w-[250px]">{l.descricao || '--'}</td>
                    <td className="py-2 text-gray-500 truncate max-w-[150px]">
                      {l.fornecedor || '--'}
                    </td>
                    <td className="py-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          l.tipo === 'receita'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {l.tipo === 'receita' ? 'Receita' : 'Despesa'}
                      </span>
                    </td>
                    <td className="py-2 text-right font-medium">{fmt(l.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {drillDown.length > 50 && (
              <p className="text-xs text-gray-400 mt-2 text-center">
                Mostrando 50 de {drillDown.length} lancamentos.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  )
}
