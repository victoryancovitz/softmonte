'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import SearchInput from '@/components/SearchInput'
import SortableHeader, { SortDir, applySort } from '@/components/SortableHeader'
import { formatTipoFalta } from '@/lib/formatters'
import AbsenteismoTab from './AbsenteismoTab'

const TIPO_BADGE: Record<string, { cls: string }> = {
  falta_injustificada:  { cls: 'bg-red-100 text-red-700' },
  falta_justificada:    { cls: 'bg-orange-100 text-orange-700' },
  atestado_medico:      { cls: 'bg-blue-100 text-blue-700' },
  atestado_acidente:    { cls: 'bg-blue-100 text-blue-700' },
  licenca_maternidade:  { cls: 'bg-green-100 text-green-700' },
  licenca_paternidade:  { cls: 'bg-green-100 text-green-700' },
  folga_compensatoria:  { cls: 'bg-gray-100 text-gray-600' },
  feriado:              { cls: 'bg-gray-100 text-gray-600' },
  suspensao:            { cls: 'bg-red-100 text-red-700' },
  outro:                { cls: 'bg-gray-100 text-gray-600' },
}

type Tab = 'registros' | 'absenteismo'

export default function FaltasTable({ rows }: { rows: any[] }) {
  const [activeTab, setActiveTab] = useState<Tab>('registros')
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
      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        <button
          onClick={() => setActiveTab('registros')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'registros' ? 'bg-white text-brand shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Registros
        </button>
        <button
          onClick={() => setActiveTab('absenteismo')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'absenteismo' ? 'bg-white text-brand shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Absenteismo
        </button>
      </div>

      {activeTab === 'absenteismo' ? (
        <AbsenteismoTab />
      ) : (
        <>
          <div className="mb-4">
            <SearchInput value={busca} onChange={setBusca} placeholder="Buscar falta..." />
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <SortableHeader label="Funcionário" field="funcionario_nome" currentField={sortField} currentDir={sortDir} onSort={onSort} />
                  <SortableHeader label="Obra" field="obra_nome" currentField={sortField} currentDir={sortDir} onSort={onSort} />
                  <SortableHeader label="Data" field="data" currentField={sortField} currentDir={sortDir} onSort={onSort} />
                  <SortableHeader label="Tipo" field="tipo" currentField={sortField} currentDir={sortDir} onSort={onSort} />
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Observacao</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Arquivo</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length > 0 ? filtered.map((f: any) => {
                  const badgeCls = TIPO_BADGE[f.tipo]?.cls ?? 'bg-gray-100 text-gray-600'
                  const label = formatTipoFalta(f.tipo)
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
                        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${badgeCls}`}>{label}</span>
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
      )}
    </>
  )
}
