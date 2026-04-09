'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import SearchInput from '@/components/SearchInput'
import { EncerrarAlocacaoBtn } from '@/components/DeleteActions'

interface AlocacaoViewProps {
  ativas: any[]
  encerradas: any[]
  role: string
}

export default function AlocacaoView({ ativas, encerradas, role }: AlocacaoViewProps) {
  const [busca, setBusca] = useState('')

  const filteredAtivas = useMemo(() => {
    if (!busca) return ativas
    const term = busca.toLowerCase()
    return ativas.filter((a: any) =>
      a.funcionarios?.nome?.toLowerCase().includes(term) ||
      a.obras?.nome?.toLowerCase().includes(term)
    )
  }, [ativas, busca])

  const filteredEncerradas = useMemo(() => {
    if (!busca) return encerradas
    const term = busca.toLowerCase()
    return encerradas.filter((a: any) =>
      a.funcionarios?.nome?.toLowerCase().includes(term) ||
      a.obras?.nome?.toLowerCase().includes(term)
    )
  }, [encerradas, busca])

  return (
    <>
      <div className="mb-4">
        <SearchInput value={busca} onChange={setBusca} placeholder="Buscar por funcionário ou obra..." />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto mb-5">
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
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Nenhuma alocação encontrada.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {filteredEncerradas.length > 0 && (
        <details className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <summary className="px-5 py-3 bg-gray-50 border-b border-gray-100 cursor-pointer text-sm font-semibold text-gray-500">
            Alocações encerradas ({filteredEncerradas.length})
          </summary>
          <table className="w-full text-sm">
            <tbody>
              {filteredEncerradas.map((a: any) => (
                <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50/80">
                  <td className="px-4 py-2.5 text-gray-400 font-medium">{a.funcionarios?.nome}</td>
                  <td className="px-4 py-2.5 text-gray-400">{a.obras?.nome}</td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">{a.data_fim ? new Date(a.data_fim+'T12:00').toLocaleDateString('pt-BR') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </>
  )
}
