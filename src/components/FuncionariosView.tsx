'use client'
import { useState } from 'react'
import Link from 'next/link'

const STATUS_COLOR: Record<string, string> = {
  disponivel: 'bg-green-100 text-green-700',
  alocado:    'bg-blue-100 text-blue-700',
  afastado:   'bg-yellow-100 text-yellow-700',
  inativo:    'bg-gray-100 text-gray-500',
}

export default function FuncionariosView({ funcs, hoje }: { funcs: any[]; hoje: string }) {
  const [view, setView] = useState<'cards' | 'table'>('cards')
  const hojeDate = new Date(hoje + 'T12:00:00')

  return (
    <>
      {/* Toggle */}
      <div className="flex border border-gray-200 rounded-lg overflow-hidden">
        <button onClick={() => setView('cards')}
          className={`px-3 py-1.5 text-xs font-medium transition-all ${view === 'cards' ? 'bg-brand text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
          Cards
        </button>
        <button onClick={() => setView('table')}
          className={`px-3 py-1.5 text-xs font-medium transition-all ${view === 'table' ? 'bg-brand text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
          Tabela
        </button>
      </div>

      {/* Spacer - rendered in parent */}
      <div className="hidden" data-view={view} />

      {/* Content injected via portal pattern - actually we render inline */}
      {funcs.length > 0 ? (
        view === 'cards' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4 mt-5">
            {funcs.map((f: any) => {
              const p1 = f.prazo1 ? new Date(f.prazo1 + 'T12:00') : null
              const dias = p1 ? Math.ceil((p1.getTime() - hojeDate.getTime()) / 86400000) : null
              const vencido = dias !== null && dias < 0
              const alerta = dias !== null && dias <= 30 && dias >= 0
              return (
                <Link key={f.id} href={`/funcionarios/${f.id}`}
                  className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-brand/30 transition-all duration-200 block group">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center text-brand font-bold text-sm font-display">
                      {f.nome?.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${STATUS_COLOR[f.status] ?? 'bg-gray-100'}`}>
                      {f.status === 'disponivel' ? 'Disponível' : f.status}
                    </span>
                  </div>
                  <div className="font-semibold text-sm text-gray-900 group-hover:text-brand transition-colors">{f.nome}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{f.cargo} · {f.matricula}</div>
                  {p1 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className={`text-xs font-medium flex items-center gap-1 ${vencido ? 'text-red-600' : alerta ? 'text-amber-600' : 'text-gray-400'}`}>
                        Prazo: {p1.toLocaleDateString('pt-BR')}
                        {vencido && <span className="ml-1 bg-red-100 text-red-700 px-1.5 rounded text-[10px] font-bold">VENCIDO</span>}
                        {alerta && <span className="ml-1 bg-amber-100 text-amber-700 px-1.5 rounded text-[10px]">{dias}d</span>}
                      </div>
                    </div>
                  )}
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto mt-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Mat.', 'Nome', 'Cargo', 'VT', 'Prazo 1', 'Status', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {funcs.map((f: any) => {
                  const p1 = f.prazo1 ? new Date(f.prazo1 + 'T12:00') : null
                  const dias = p1 ? Math.ceil((p1.getTime() - hojeDate.getTime()) / 86400000) : null
                  const vencido = dias !== null && dias < 0
                  const alerta = dias !== null && dias <= 30 && dias >= 0
                  return (
                    <tr key={f.id} className="border-b border-gray-50 hover:bg-gray-50 group">
                      <td className="px-4 py-3 text-gray-400 text-xs font-mono">{f.matricula}</td>
                      <td className="px-4 py-3 font-semibold">
                        <Link href={`/funcionarios/${f.id}`} className="hover:text-brand transition-colors">{f.nome}</Link>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{f.cargo}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{f.vt_estrutura ?? '—'}</td>
                      <td className={`px-4 py-3 text-xs font-medium ${vencido ? 'text-red-600' : alerta ? 'text-amber-600' : 'text-gray-500'}`}>
                        {p1 ? p1.toLocaleDateString('pt-BR') : '—'}
                        {vencido && <span className="ml-1 bg-red-100 text-red-700 px-1.5 rounded text-[10px] font-bold">VENCIDO</span>}
                        {alerta && <span className="ml-1 bg-amber-100 text-amber-700 px-1.5 rounded text-[10px]">{dias}d</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold capitalize ${STATUS_COLOR[f.status] ?? 'bg-gray-100'}`}>
                          {f.status === 'disponivel' ? 'Disponível' : f.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-3 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link href={`/funcionarios/${f.id}`} className="text-xs text-brand hover:underline">Ver</Link>
                          <Link href={`/funcionarios/${f.id}/editar`} className="text-xs text-gray-500 hover:text-gray-800">Editar</Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center mt-5">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="mx-auto mb-4 text-gray-300">
            <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="2"/>
            <circle cx="24" cy="20" r="8" stroke="currentColor" strokeWidth="2"/>
            <path d="M8 42c0-8.8 7.2-16 16-16s16 7.2 16 16" stroke="currentColor" strokeWidth="2"/>
          </svg>
          <p className="text-gray-500 text-sm font-medium">Nenhum funcionário encontrado.</p>
          <Link href="/funcionarios/novo" className="mt-3 inline-block px-4 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark">+ Novo funcionário</Link>
        </div>
      )}
    </>
  )
}
