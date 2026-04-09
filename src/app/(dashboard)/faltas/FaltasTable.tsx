'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import SearchInput from '@/components/SearchInput'
import SortableHeader, { SortDir, applySort } from '@/components/SortableHeader'

const TIPO_BADGE: Record<string, { label: string; cls: string }> = {
  falta_injustificada:  { label: 'FALTA', cls: 'bg-red-100 text-red-700' },
  falta_justificada:    { label: 'JUSTIFICADA', cls: 'bg-orange-100 text-orange-700' },
  atestado_medico:      { label: 'ATESTADO', cls: 'bg-blue-100 text-blue-700' },
  atestado_acidente:    { label: 'ACIDENTE', cls: 'bg-blue-100 text-blue-700' },
  licenca_maternidade:  { label: 'LIC. MATERNIDADE', cls: 'bg-green-100 text-green-700' },
  licenca_paternidade:  { label: 'LIC. PATERNIDADE', cls: 'bg-green-100 text-green-700' },
  folga_compensatoria:  { label: 'FOLGA', cls: 'bg-gray-100 text-gray-600' },
  feriado:              { label: 'FERIADO', cls: 'bg-gray-100 text-gray-600' },
  suspensao:            { label: 'SUSPENSAO', cls: 'bg-red-100 text-red-700' },
  outro:                { label: 'OUTRO', cls: 'bg-gray-100 text-gray-600' },
}

export default function FaltasTable({ rows }: { rows: any[] }) {
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
    let result = rows
    if (busca.trim()) {
      const q = busca.toLowerCase()
      result = result.filter(f =>
        f.funcionarios?.nome?.toLowerCase().includes(q) ||
        f.obras?.nome?.toLowerCase().includes(q) ||
        f.tipo?.toLowerCase().includes(q) ||
        f.funcionarios?.matricula?.toLowerCase().includes(q)
      )
    }
    return applySort(result, sortField, sortDir)
  }, [rows, busca, sortField, sortDir])

  return (
    <>
      <div className="mb-4">
        <SearchInput value={busca} onChange={setBusca} placeholder="Buscar falta..." />
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <SortableHeader label="Funcionario" field="funcionario_nome" currentField={sortField} currentDir={sortDir} onSort={onSort} />
              <SortableHeader label="Obra" field="obra_nome" currentField={sortField} currentDir={sortDir} onSort={onSort} />
              <SortableHeader label="Data" field="data" currentField={sortField} currentDir={sortDir} onSort={onSort} />
              <SortableHeader label="Tipo" field="tipo" currentField={sortField} currentDir={sortDir} onSort={onSort} />
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Observacao</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Arquivo</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? filtered.map((f: any) => {
              const badge = TIPO_BADGE[f.tipo] ?? { label: f.tipo, cls: 'bg-gray-100 text-gray-600' }
              const dataFormatada = f.data
                ? new Date(f.data + 'T12:00:00').toLocaleDateString('pt-BR')
                : '—'
              return (
                <tr key={f.id} className="border-b border-gray-50 hover:bg-gray-50/80">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{f.funcionarios?.nome ?? '—'}</div>
                    <div className="text-xs text-gray-400">{f.funcionarios?.cargo} · {f.funcionarios?.matricula}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{f.obras?.nome ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{dataFormatada}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${badge.cls}`}>{badge.label}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px] truncate">{f.observacao ?? '—'}</td>
                  <td className="px-4 py-3">
                    {f.arquivo_url ? (
                      <a href={f.arquivo_url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand hover:underline">
                        Ver arquivo
                      </a>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              )
            }) : (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                  Nenhuma falta encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
