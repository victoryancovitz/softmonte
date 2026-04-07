'use client'
import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import SortableHeader, { applySort, type SortDir } from '@/components/SortableHeader'

const STATUS_COLOR: Record<string, string> = {
  disponivel: 'bg-green-100 text-green-700',
  alocado:    'bg-blue-100 text-blue-700',
  afastado:   'bg-yellow-100 text-yellow-700',
  inativo:    'bg-gray-100 text-gray-500',
}

const ALERTA_BADGE: Record<string, { label: string; cls: string }> = {
  experiencia_1_vencendo: { label: 'Exp. 1 vence', cls: 'bg-amber-100 text-amber-700' },
  experiencia_2_vencendo: { label: 'Exp. vence', cls: 'bg-red-100 text-red-700' },
  ferias_vencidas: { label: 'Férias vencidas', cls: 'bg-red-100 text-red-700' },
  ferias_urgente: { label: 'Férias urgente', cls: 'bg-orange-100 text-orange-700' },
  contrato_vencendo: { label: 'Contrato vence', cls: 'bg-amber-100 text-amber-700' },
}

export default function FuncionariosView({
  funcs,
  hoje,
  alertas = {},
  cargosUnicos = [],
}: {
  funcs: any[]
  hoje: string
  alertas?: Record<string, string>
  cargosUnicos?: string[]
}) {
  const router = useRouter()
  const sp = useSearchParams()
  const hojeDate = new Date(hoje + 'T12:00:00')

  // Initial state from URL
  const [view, setView] = useState<'cards' | 'table'>('cards')
  const [searchInput, setSearchInput] = useState(sp.get('q') ?? '')
  const [q, setQ] = useState(sp.get('q') ?? '')
  const [status, setStatus] = useState(sp.get('status') ?? '')
  const [cargo, setCargo] = useState(sp.get('cargo') ?? '')
  const [admDe, setAdmDe] = useState(sp.get('adm_de') ?? '')
  const [admAte, setAdmAte] = useState(sp.get('adm_ate') ?? '')
  const [sortField, setSortField] = useState<string | null>(sp.get('sort') ?? 'nome')
  const [sortDir, setSortDir] = useState<SortDir>((sp.get('dir') as SortDir) ?? 'asc')

  // Restore from localStorage
  useEffect(() => {
    if (sp.toString()) return
    if (typeof window === 'undefined') return
    const saved = localStorage.getItem('funcionarios_filters')
    if (saved) {
      try {
        const o = JSON.parse(saved)
        if (o.q) { setQ(o.q); setSearchInput(o.q) }
        if (o.status) setStatus(o.status)
        if (o.cargo) setCargo(o.cargo)
        if (o.admDe) setAdmDe(o.admDe)
        if (o.admAte) setAdmAte(o.admAte)
        if (o.sortField) setSortField(o.sortField)
        if (o.sortDir) setSortDir(o.sortDir)
      } catch {}
    }
  }, [])

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setQ(searchInput), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  // Sync to URL
  useEffect(() => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (status) params.set('status', status)
    if (cargo) params.set('cargo', cargo)
    if (admDe) params.set('adm_de', admDe)
    if (admAte) params.set('adm_ate', admAte)
    if (sortField && sortField !== 'nome') params.set('sort', sortField)
    if (sortDir && sortDir !== 'asc') params.set('dir', sortDir)
    const qs = params.toString()
    router.replace(qs ? `/funcionarios?${qs}` : '/funcionarios', { scroll: false })
    if (typeof window !== 'undefined') {
      localStorage.setItem('funcionarios_filters', JSON.stringify({ q, status, cargo, admDe, admAte, sortField, sortDir }))
    }
  }, [q, status, cargo, admDe, admAte, sortField, sortDir])

  function toggleSort(field: string) {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc')
      if (sortDir === 'desc') setSortField(null)
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  // Apply filters in real time
  const filtered = useMemo(() => {
    let result = funcs
    if (q) {
      const ql = q.toLowerCase()
      result = result.filter(f =>
        f.nome?.toLowerCase().includes(ql) ||
        f.nome_guerra?.toLowerCase().includes(ql) ||
        f.cpf?.replace(/\D/g, '').includes(ql.replace(/\D/g, '')) ||
        f.matricula?.toLowerCase().includes(ql) ||
        f.id_ponto?.toLowerCase().includes(ql) ||
        f.cargo?.toLowerCase().includes(ql)
      )
    }
    if (status) result = result.filter(f => f.status === status)
    if (cargo) result = result.filter(f => f.cargo === cargo)
    if (admDe) result = result.filter(f => f.admissao && f.admissao >= admDe)
    if (admAte) result = result.filter(f => f.admissao && f.admissao <= admAte)
    return applySort(result, sortField, sortDir, ['matricula'])
  }, [funcs, q, status, cargo, admDe, admAte, sortField, sortDir])

  const hasFilter = q || status || cargo || admDe || admAte

  function clearFilters() {
    setQ(''); setStatus(''); setCargo(''); setAdmDe(''); setAdmAte('')
  }

  return (
    <>
      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Buscar por nome, CPF, ID Ponto ou cargo..."
              className="w-full px-3 py-2 pr-7 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
            {searchInput && (
              <button onClick={() => setSearchInput('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">✕</button>
            )}
          </div>
          <select value={status} onChange={e => setStatus(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
            <option value="">Todos os status</option>
            <option value="disponivel">Disponível</option>
            <option value="alocado">Alocado</option>
            <option value="afastado">Afastado</option>
            <option value="inativo">Inativo</option>
          </select>
          <select value={cargo} onChange={e => setCargo(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
            <option value="">Todos os cargos</option>
            {cargosUnicos.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="flex border border-gray-200 rounded-lg overflow-hidden flex-shrink-0">
            <button onClick={() => setView('cards')}
              className={`px-3 py-2 text-xs font-medium transition-all ${view === 'cards' ? 'bg-brand text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
              Cards
            </button>
            <button onClick={() => setView('table')}
              className={`px-3 py-2 text-xs font-medium transition-all ${view === 'table' ? 'bg-brand text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
              Tabela
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <label className="text-xs text-gray-500">Admissão de:</label>
          <input type="date" value={admDe} onChange={e => setAdmDe(e.target.value)}
            className="px-2 py-1 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand" />
          <label className="text-xs text-gray-500">até:</label>
          <input type="date" value={admAte} onChange={e => setAdmAte(e.target.value)}
            className="px-2 py-1 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand" />
          {hasFilter && (
            <button type="button" onClick={clearFilters}
              className="ml-auto text-xs text-red-600 hover:underline font-medium">
              ✕ Limpar filtros
            </button>
          )}
          <span className={`text-xs text-gray-400 ${hasFilter ? '' : 'ml-auto'}`}>{filtered.length} resultado(s)</span>
        </div>
      </div>

      {/* Content */}
      {filtered.length > 0 ? (
        view === 'cards' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
            {filtered.map((f: any) => {
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
                  <div className="text-xs text-gray-500 mt-0.5">{f.cargo} · ID {f.matricula}</div>
                  {p1 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className={`text-xs font-medium flex items-center gap-1 ${vencido ? 'text-red-600' : alerta ? 'text-amber-600' : 'text-gray-400'}`}>
                        Exp. 1: {p1.toLocaleDateString('pt-BR')}
                        {vencido && <span className="ml-1 bg-red-100 text-red-700 px-1.5 rounded text-[10px] font-bold">VENCIDO</span>}
                        {alerta && <span className="ml-1 bg-amber-100 text-amber-700 px-1.5 rounded text-[10px]">{dias}d</span>}
                      </div>
                    </div>
                  )}
                  {alertas[f.id] && ALERTA_BADGE[alertas[f.id]] && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${ALERTA_BADGE[alertas[f.id]].cls}`}>
                        {ALERTA_BADGE[alertas[f.id]].label}
                      </span>
                    </div>
                  )}
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <SortableHeader label="ID Ponto" field="matricula" currentField={sortField} currentDir={sortDir} onSort={toggleSort} />
                  <SortableHeader label="Nome" field="nome" currentField={sortField} currentDir={sortDir} onSort={toggleSort} />
                  <SortableHeader label="Cargo" field="cargo" currentField={sortField} currentDir={sortDir} onSort={toggleSort} />
                  <SortableHeader label="Admissão" field="admissao" currentField={sortField} currentDir={sortDir} onSort={toggleSort} />
                  <SortableHeader label="1º Período" field="prazo1" currentField={sortField} currentDir={sortDir} onSort={toggleSort} />
                  <SortableHeader label="Status" field="status" currentField={sortField} currentDir={sortDir} onSort={toggleSort} />
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((f: any) => {
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
                      <td className="px-4 py-3 text-gray-500 text-xs">{f.admissao ? new Date(f.admissao+'T12:00').toLocaleDateString('pt-BR') : '—'}</td>
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
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="mx-auto mb-4 text-gray-300">
            <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="2"/>
            <circle cx="24" cy="20" r="8" stroke="currentColor" strokeWidth="2"/>
            <path d="M8 42c0-8.8 7.2-16 16-16s16 7.2 16 16" stroke="currentColor" strokeWidth="2"/>
          </svg>
          <p className="text-gray-500 text-sm font-medium">Nenhum funcionário encontrado.</p>
          {hasFilter ? (
            <button onClick={clearFilters} className="mt-3 inline-block px-4 py-2 border border-gray-200 rounded-xl text-sm hover:bg-gray-50">
              Limpar filtros
            </button>
          ) : (
            <Link href="/funcionarios/novo" className="mt-3 inline-block px-4 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark">+ Novo funcionário</Link>
          )}
        </div>
      )}
    </>
  )
}
