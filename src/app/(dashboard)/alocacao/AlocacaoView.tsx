'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import SearchInput from '@/components/SearchInput'
import { EncerrarAlocacaoBtn } from '@/components/DeleteActions'

interface AlocacaoViewProps {
  ativas: any[]
  role: string
}

export default function AlocacaoView({ ativas, role }: AlocacaoViewProps) {
  const [busca, setBusca] = useState('')
  const [filtroObra, setFiltroObra] = useState('')

  const obrasUnicas = useMemo(() => {
    const map = new Map<string, string>()
    ativas.forEach((a: any) => {
      if (a.obras?.id && a.obras?.nome) map.set(a.obras.id, a.obras.nome)
    })
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [ativas])

  const filteredAtivas = useMemo(() => {
    let result = ativas
    if (busca) {
      const term = busca.toLowerCase()
      result = result.filter((a: any) =>
        a.funcionarios?.nome?.toLowerCase().includes(term) ||
        a.obras?.nome?.toLowerCase().includes(term)
      )
    }
    if (filtroObra) {
      result = result.filter((a: any) => a.obra_id === filtroObra)
    }
    return result
  }, [ativas, busca, filtroObra])

  const hasFilter = busca || filtroObra

  return (
    <>
      <div className="flex flex-wrap gap-2 items-center mb-4">
        <div className="flex-1 min-w-[200px]">
          <SearchInput value={busca} onChange={setBusca} placeholder="Buscar por funcionário ou obra..." />
        </div>
        <select value={filtroObra} onChange={e => setFiltroObra(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
          <option value="">Todas as obras</option>
          {obrasUnicas.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
        </select>
        {hasFilter && (
          <button onClick={() => { setBusca(''); setFiltroObra('') }}
            className="text-xs text-red-600 hover:underline font-medium">Limpar filtros</button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Alocações ativas ({filteredAtivas.length})</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              {['Funcionário','Cargo','Obra','Cliente','Desde',''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredAtivas.length > 0 ? filteredAtivas.map((a: any) => (
              <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50/80 group">
                <td className="px-4 py-3 font-semibold text-gray-900">
                  <Link href={`/funcionarios/${a.funcionario_id}`} className="hover:text-brand">{a.funcionarios?.nome}</Link>
                </td>
                <td className="px-4 py-3 text-gray-600">{a.cargo_na_obra}</td>
                <td className="px-4 py-3 font-medium">
                  <Link href={`/obras/${a.obra_id}`} className="hover:text-brand">{a.obras?.nome}</Link>
                </td>
                <td className="px-4 py-3 text-gray-500">{a.obras?.cliente}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{a.data_inicio ? new Date(a.data_inicio+'T12:00').toLocaleDateString('pt-BR') : '—'}</td>
                <td className="px-4 py-3 text-right">
                  <span className="inline-flex items-center gap-2">
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Ativa</span>
                    <EncerrarAlocacaoBtn alocacaoId={a.id} funcId={a.funcionario_id} role={role} />
                  </span>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Nenhuma alocacao encontrada.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
