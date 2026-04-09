'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import SearchInput from '@/components/SearchInput'
import SortableHeader, { SortDir, applySort } from '@/components/SortableHeader'

const CAT_COLOR: Record<string, string> = {
  EPI: 'bg-blue-100 text-blue-700',
  Material: 'bg-green-100 text-green-700',
  Ferramenta: 'bg-amber-100 text-amber-700',
  Consumivel: 'bg-purple-100 text-purple-700',
}

export default function EstoqueTable({ itens }: { itens: any[] }) {
  const [busca, setBusca] = useState('')
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
    let result = itens
    if (busca.trim()) {
      const q = busca.toLowerCase()
      result = result.filter(i =>
        i.nome?.toLowerCase().includes(q) ||
        i.codigo?.toLowerCase().includes(q) ||
        i.categoria?.toLowerCase().includes(q) ||
        i.deposito?.toLowerCase().includes(q)
      )
    }
    return applySort(result, sortField, sortDir, ['quantidade', 'quantidade_minima'])
  }, [itens, busca, sortField, sortDir])

  return (
    <>
      <div className="mb-4">
        <SearchInput value={busca} onChange={setBusca} placeholder="Buscar item..." />
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <SortableHeader label="Codigo" field="codigo" currentField={sortField} currentDir={sortDir} onSort={onSort} />
              <SortableHeader label="Nome" field="nome" currentField={sortField} currentDir={sortDir} onSort={onSort} />
              <SortableHeader label="Categoria" field="categoria" currentField={sortField} currentDir={sortDir} onSort={onSort} />
              <SortableHeader label="Deposito" field="deposito" currentField={sortField} currentDir={sortDir} onSort={onSort} />
              <SortableHeader label="Qtd. Atual" field="quantidade" currentField={sortField} currentDir={sortDir} onSort={onSort} />
              <SortableHeader label="Qtd. Minima" field="quantidade_minima" currentField={sortField} currentDir={sortDir} onSort={onSort} />
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? filtered.map((i: any) => {
              const critico = Number(i.quantidade) <= Number(i.quantidade_minima ?? 0)
              return (
                <tr key={i.id} className={`border-b border-gray-50 hover:bg-gray-50/80 group ${critico ? 'bg-amber-50/30' : ''}`}>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">{i.codigo}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">{i.nome}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CAT_COLOR[i.categoria] ?? 'bg-gray-100 text-gray-600'}`}>{i.categoria}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{i.deposito ?? '—'}</td>
                  <td className={`px-4 py-3 font-bold text-lg font-display ${critico ? 'text-red-600' : 'text-brand'}`}>
                    {Number(i.quantidade).toFixed(0)} <span className="text-xs font-normal text-gray-400">{i.unidade}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-sm">{i.quantidade_minima ?? 0} {i.unidade}</td>
                  <td className="px-4 py-3">
                    {critico
                      ? <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">Critico</span>
                      : <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">OK</span>}
                  </td>
                  <td className="px-4 py-3 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link href={`/estoque/${i.id}`} className="text-xs text-brand hover:underline">Movimentar</Link>
                  </td>
                </tr>
              )
            }) : (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">Nenhum item encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
