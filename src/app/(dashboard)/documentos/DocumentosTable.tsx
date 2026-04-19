'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import SearchInput from '@/components/SearchInput'
import SortableHeader, { SortDir, applySort } from '@/components/SortableHeader'
import { ExcluirDocBtn } from '@/components/DeleteActions'

const TIPO_LABEL: Record<string, string> = {
  'ASO': 'ASO', 'NR-10': 'NR-10', 'NR-35': 'NR-35', 'NR-33': 'NR-33',
  'NR-12': 'NR-12', 'CIPA': 'CIPA', 'outro': 'Outro',
}
const STATUS_COLOR = (dias: number | null) => {
  if (dias === null) return 'bg-gray-100 text-gray-500'
  if (dias < 0) return 'bg-red-100 text-red-700'
  if (dias <= 30) return 'bg-amber-100 text-amber-700'
  return 'bg-green-100 text-green-700'
}

export default function DocumentosTable({ docs, role }: { docs: any[]; role: string }) {
  const [busca, setBusca] = useState('')
  const [filtroVencimento, setFiltroVencimento] = useState('')
  const [sortField, setSortField] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>(null)

  function onSort(field: string) {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : sortDir === 'desc' ? null : 'asc')
      if (sortDir === 'desc') setSortField(null)
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const filtered = useMemo(() => {
    let result = docs
    if (busca.trim()) {
      const q = busca.toLowerCase()
      result = result.filter(d =>
        d.funcionarios?.nome?.toLowerCase().includes(q) ||
        d.tipo?.toLowerCase().includes(q) ||
        d.funcionarios?.cargo?.toLowerCase().includes(q)
      )
    }
    if (filtroVencimento === 'vencido') {
      result = result.filter(d => d.dias !== null && d.dias < 0)
    } else if (filtroVencimento === '30d') {
      result = result.filter(d => d.dias !== null && d.dias >= 0 && d.dias <= 30)
    } else if (filtroVencimento === '60d') {
      result = result.filter(d => d.dias !== null && d.dias >= 0 && d.dias <= 60)
    } else if (filtroVencimento === 'sem') {
      result = result.filter(d => d.dias === null)
    }
    return applySort(result, sortField, sortDir, ['dias'])
  }, [docs, busca, filtroVencimento, sortField, sortDir])

  return (
    <>
      <div className="flex flex-wrap gap-2 items-center mb-4">
        <div className="flex-1 min-w-[200px]">
          <SearchInput value={busca} onChange={setBusca} placeholder="Buscar documento..." />
        </div>
        <select value={filtroVencimento} onChange={e => setFiltroVencimento(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
          <option value="">Todos os vencimentos</option>
          <option value="vencido">Vencidos</option>
          <option value="30d">Vence em 30 dias</option>
          <option value="60d">Vence em 60 dias</option>
          <option value="sem">Sem vencimento</option>
        </select>
        {(busca || filtroVencimento) && (
          <button onClick={() => { setBusca(''); setFiltroVencimento('') }}
            className="text-xs text-red-600 hover:underline font-medium">Limpar filtros</button>
        )}
        <span className="text-xs text-gray-400">{filtered.length} resultado(s)</span>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <SortableHeader label="Funcionário" field="funcionario_nome" currentField={sortField} currentDir={sortDir} onSort={onSort} />
              <SortableHeader label="Tipo" field="tipo" currentField={sortField} currentDir={sortDir} onSort={onSort} />
              <SortableHeader label="Emissão" field="emissao" currentField={sortField} currentDir={sortDir} onSort={onSort} />
              <SortableHeader label="Vencimento" field="vencimento" currentField={sortField} currentDir={sortDir} onSort={onSort} />
              <SortableHeader label="Status" field="dias" currentField={sortField} currentDir={sortDir} onSort={onSort} />
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Arquivo</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? filtered.map((d: any) => (
              <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50/80 group">
                <td className="px-4 py-3 font-semibold">
                  <Link href={`/funcionarios/${d.funcionario_id}`} className="hover:text-brand">{d.funcionarios?.nome}</Link>
                  <div className="text-xs text-gray-400">{d.funcionarios?.cargo}</div>
                </td>
                <td className="px-4 py-3"><span className="text-xs font-bold bg-brand/10 text-brand px-2 py-0.5 rounded">{TIPO_LABEL[d.tipo] ?? d.tipo}</span></td>
                <td className="px-4 py-3 text-gray-500 text-xs">{d.emissao ? new Date(d.emissao+'T12:00').toLocaleDateString('pt-BR') : '—'}</td>
                <td className="px-4 py-3 text-xs font-medium">{d.vencimento ? new Date(d.vencimento+'T12:00').toLocaleDateString('pt-BR') : '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${STATUS_COLOR(d.dias)}`}>
                    {d.dias === null ? 'Sem vencimento' : d.dias < 0 ? `Vencido ha ${Math.abs(d.dias)}d` : d.dias === 0 ? 'Vence hoje' : `${d.dias}d`}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {d.arquivo_url ? (
                    <a href={d.arquivo_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-brand hover:underline flex items-center gap-1">📎 {d.arquivo_nome ?? 'Ver'}</a>
                  ) : <span className="text-xs text-gray-300">Sem arquivo</span>}
                </td>
                <td className="px-4 py-3 text-right opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                  <span className="inline-flex items-center gap-2">
                    <Link href={`/documentos/novo?funcionario=${d.funcionario_id}&tipo=${d.tipo}`} className="text-xs text-brand hover:underline">Renovar</Link>
                    <ExcluirDocBtn docId={d.id} role={role} />
                  </span>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Nenhum documento encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
