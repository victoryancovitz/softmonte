'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import SearchInput from '@/components/SearchInput'
import SortableHeader, { SortDir, applySort } from '@/components/SortableHeader'
import { AlertTriangle, Users, TrendingDown, BarChart3 } from 'lucide-react'

interface AbsenteismoRow {
  funcionario_id: string
  nome: string
  cargo: string
  obra_id: string
  obra: string
  ano: number
  mes: number
  dias_trabalhados: number
  total_faltas: number
  faltas_injustificadas: number
  atestados: number
  acidentes: number
  faltas_justificadas: number
  suspensoes: number
  licencas: number
  taxa_falta_pct: number
  taxa_injustificada_pct: number
}

const MESES = [
  'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function taxaBadge(taxa: number): { label: string; cls: string } {
  if (taxa >= 10) return { label: `${taxa.toFixed(1)}%`, cls: 'bg-red-100 text-red-700' }
  if (taxa >= 5) return { label: `${taxa.toFixed(1)}%`, cls: 'bg-amber-100 text-amber-700' }
  if (taxa > 0) return { label: `${taxa.toFixed(1)}%`, cls: 'bg-yellow-100 text-yellow-700' }
  return { label: '0%', cls: 'bg-green-100 text-green-700' }
}

export default function AbsenteismoTab() {
  const supabase = createClient()
  const [rows, setRows] = useState<AbsenteismoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [obraFilter, setObraFilter] = useState('')
  const [mesFilter, setMesFilter] = useState<number>(0)
  const [anoFilter, setAnoFilter] = useState<number>(new Date().getFullYear())
  const [sortField, setSortField] = useState<string | null>('taxa_falta_pct')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const { data, error } = await supabase
      .from('vw_absenteismo')
      .select('*')
      .eq('funcionario_ativo', true)
      .order('taxa_falta_pct', { ascending: false })

    setRows(data ?? [])
    setLoading(false)
  }

  function onSort(field: string) {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : sortDir === 'desc' ? null : 'asc')
      if (sortDir === 'desc') setSortField(null)
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  // Unique obras and anos from data
  const obras = useMemo(() => {
    const map = new Map<string, string>()
    rows.forEach(r => { if (r.obra_id && r.obra) map.set(r.obra_id, r.obra) })
    return Array.from(map.entries()).map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome))
  }, [rows])

  const anos = useMemo(() => {
    const set = new Set<number>()
    rows.forEach(r => { if (r.ano) set.add(r.ano) })
    return Array.from(set).sort((a, b) => b - a)
  }, [rows])

  const filtered = useMemo(() => {
    let result = rows

    if (busca.trim()) {
      const q = busca.toLowerCase()
      result = result.filter(r => r.nome?.toLowerCase().includes(q) || r.obra?.toLowerCase().includes(q))
    }

    if (obraFilter) {
      result = result.filter(r => r.obra_id === obraFilter)
    }

    if (anoFilter) {
      result = result.filter(r => r.ano === anoFilter)
    }

    if (mesFilter) {
      result = result.filter(r => r.mes === mesFilter)
    }

    return applySort(result, sortField, sortDir, ['taxa_falta_pct', 'taxa_injustificada_pct', 'total_faltas', 'dias_trabalhados', 'faltas_injustificadas'])
  }, [rows, busca, obraFilter, anoFilter, mesFilter, sortField, sortDir])

  // KPIs
  const taxaMedia = filtered.length > 0
    ? filtered.reduce((s, r) => s + (r.taxa_falta_pct || 0), 0) / filtered.length
    : 0
  const maiorAbsenteismo = filtered.length > 0
    ? filtered.reduce((max, r) => (r.taxa_falta_pct || 0) > (max.taxa_falta_pct || 0) ? r : max, filtered[0])
    : null
  const totalInjustificadas = filtered.reduce((s, r) => s + (r.faltas_injustificadas || 0), 0)

  return (
    <div>
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-4 h-4 text-brand" />
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Taxa Media</p>
          </div>
          <p className="text-2xl font-bold text-gray-800">{taxaMedia.toFixed(1)}%</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Maior Absenteismo</p>
          </div>
          <p className="text-lg font-bold text-red-600">{maiorAbsenteismo?.nome ?? '—'}</p>
          <p className="text-xs text-gray-400">{maiorAbsenteismo ? `${(maiorAbsenteismo.taxa_falta_pct || 0).toFixed(1)}% — ${maiorAbsenteismo.obra ?? ''}` : ''}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-amber-500" />
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Total Injustificadas</p>
          </div>
          <p className="text-2xl font-bold text-amber-600">{totalInjustificadas}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="flex-1 min-w-[200px]">
          <SearchInput value={busca} onChange={setBusca} placeholder="Buscar funcionário ou obra..." />
        </div>
        <select
          value={obraFilter}
          onChange={e => setObraFilter(e.target.value)}
          className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 bg-white min-w-[160px]"
        >
          <option value="">Todas as obras</option>
          {obras.map(o => (
            <option key={o.id} value={o.id}>{o.nome}</option>
          ))}
        </select>
        <select
          value={mesFilter}
          onChange={e => setMesFilter(Number(e.target.value))}
          className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 bg-white min-w-[130px]"
        >
          <option value={0}>Todos os meses</option>
          {MESES.map((m, i) => (
            <option key={i} value={i + 1}>{m}</option>
          ))}
        </select>
        <select
          value={anoFilter}
          onChange={e => setAnoFilter(Number(e.target.value))}
          className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 bg-white min-w-[100px]"
        >
          <option value={0}>Todos os anos</option>
          {anos.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <SortableHeader label="Nome" field="nome" currentField={sortField} currentDir={sortDir} onSort={onSort} />
              <SortableHeader label="Obra" field="obra" currentField={sortField} currentDir={sortDir} onSort={onSort} />
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Período</th>
              <SortableHeader label="Dias Trab." field="dias_trabalhados" currentField={sortField} currentDir={sortDir} onSort={onSort} />
              <SortableHeader label="Faltas" field="total_faltas" currentField={sortField} currentDir={sortDir} onSort={onSort} />
              <SortableHeader label="Injustif." field="faltas_injustificadas" currentField={sortField} currentDir={sortDir} onSort={onSort} />
              <SortableHeader label="Taxa %" field="taxa_falta_pct" currentField={sortField} currentDir={sortDir} onSort={onSort} />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-400">Carregando...</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                  Nenhum dado de absenteismo encontrado.
                </td>
              </tr>
            ) : filtered.map((row, i) => {
              const badge = taxaBadge(row.taxa_falta_pct || 0)
              return (
                <tr key={row.funcionario_id + '-' + row.mes + '-' + row.ano + '-' + i} className="border-b border-gray-50 hover:bg-gray-50/80">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-900">{row.nome ?? '—'}</div>
                    <div className="text-xs text-gray-400">{row.cargo}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{row.obra ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                    {row.mes ? MESES[row.mes - 1] : '—'}/{row.ano}
                  </td>
                  <td className="px-4 py-3 text-gray-800">{row.dias_trabalhados ?? 0}</td>
                  <td className="px-4 py-3 text-gray-800 font-medium">{row.total_faltas ?? 0}</td>
                  <td className="px-4 py-3 text-red-600 font-medium">{row.faltas_injustificadas ?? 0}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
