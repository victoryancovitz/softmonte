'use client'

import { useState, useMemo } from 'react'
import SearchInput from '@/components/SearchInput'
import SortableHeader, { SortDir, applySort } from '@/components/SortableHeader'
import { ExcluirHHBtn } from '@/components/DeleteActions'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function HHTable({ lancamentos, role }: { lancamentos: any[]; role: string }) {
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

  const enriched = useMemo(() => lancamentos.map(l => {
    const ch = Number(l.funcionarios?.custo_hora ?? 0)
    const custo = Number(l.horas_normais ?? 0) * ch + Number(l.horas_extras ?? 0) * ch * 1.7 + Number(l.horas_noturnas ?? 0) * ch * 1.4
    const total = Number(l.horas_normais ?? 0) + Number(l.horas_extras ?? 0) + Number(l.horas_noturnas ?? 0)
    return { ...l, custo, total, funcionario_nome: l.funcionarios?.nome ?? '', obra_nome: l.obras?.nome ?? '' }
  }), [lancamentos])

  const filtered = useMemo(() => {
    let result = enriched
    if (busca.trim()) {
      const q = busca.toLowerCase()
      result = result.filter(l =>
        l.funcionario_nome.toLowerCase().includes(q) ||
        l.obra_nome.toLowerCase().includes(q) ||
        l.funcionarios?.cargo?.toLowerCase().includes(q)
      )
    }
    return applySort(result, sortField, sortDir, ['horas_normais', 'horas_extras', 'horas_noturnas', 'total', 'custo'])
  }, [enriched, busca, sortField, sortDir])

  return (
    <>
      <div className="mb-4">
        <SearchInput value={busca} onChange={setBusca} placeholder="Buscar lancamento HH..." />
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <SortableHeader label="Funcionario" field="funcionario_nome" currentField={sortField} currentDir={sortDir} onSort={onSort} />
              <SortableHeader label="Obra" field="obra_nome" currentField={sortField} currentDir={sortDir} onSort={onSort} />
              <SortableHeader label="H.Normais" field="horas_normais" currentField={sortField} currentDir={sortDir} onSort={onSort} />
              <SortableHeader label="H.Extras" field="horas_extras" currentField={sortField} currentDir={sortDir} onSort={onSort} />
              <SortableHeader label="H.Noturnas" field="horas_noturnas" currentField={sortField} currentDir={sortDir} onSort={onSort} />
              <SortableHeader label="Total" field="total" currentField={sortField} currentDir={sortDir} onSort={onSort} />
              <SortableHeader label="Custo estimado" field="custo" currentField={sortField} currentDir={sortDir} onSort={onSort} />
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? filtered.map((l: any) => (
              <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50/80">
                <td className="px-4 py-3">
                  <div className="font-semibold text-gray-900">{l.funcionarios?.nome}</div>
                  <div className="text-xs text-gray-400">{l.funcionarios?.cargo}</div>
                </td>
                <td className="px-4 py-3 text-gray-600 text-xs">{l.obras?.nome}</td>
                <td className="px-4 py-3 text-center font-mono text-sm">{Number(l.horas_normais ?? 0).toFixed(0)}</td>
                <td className="px-4 py-3 text-center font-mono text-sm text-amber-600">{Number(l.horas_extras ?? 0).toFixed(0)}</td>
                <td className="px-4 py-3 text-center font-mono text-sm text-blue-600">{Number(l.horas_noturnas ?? 0).toFixed(0)}</td>
                <td className="px-4 py-3 text-center font-bold text-brand">{l.total.toFixed(0)}h</td>
                <td className="px-4 py-3 text-green-700 font-semibold text-xs">{fmt(l.custo)}</td>
                <td className="px-4 py-3 text-right">
                  <span className="inline-flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${l.auditoria_status === 'aprovado' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {l.auditoria_status ?? 'pendente'}
                    </span>
                    <ExcluirHHBtn hhId={l.id} nome={l.funcionarios?.nome} role={role} />
                  </span>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">Nenhum lancamento encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
