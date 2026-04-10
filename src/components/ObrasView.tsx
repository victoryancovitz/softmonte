'use client'
import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import SortableHeader, { applySort, type SortDir } from '@/components/SortableHeader'

const STATUS_COLOR: Record<string, string> = {
  ativo: 'bg-green-100 text-green-700',
  pausado: 'bg-yellow-100 text-yellow-700',
  concluido: 'bg-gray-100 text-gray-600',
  cancelado: 'bg-red-100 text-red-600',
}

const STORAGE_KEY = 'obras_filters'

export default function ObrasView({ obras }: { obras: any[] }) {
  const router = useRouter()
  const sp = useSearchParams()

  const [searchInput, setSearchInput] = useState(sp.get('q') ?? '')
  const [q, setQ] = useState(sp.get('q') ?? '')
  const [status, setStatus] = useState(sp.get('status') ?? '')
  const [cliente, setCliente] = useState(sp.get('cliente') ?? '')
  const [sortField, setSortField] = useState<string | null>(sp.get('sort') ?? 'created_at')
  const [sortDir, setSortDir] = useState<SortDir>((sp.get('dir') as SortDir) ?? 'desc')

  // Restore from localStorage
  useEffect(() => {
    if (sp.toString()) return
    if (typeof window === 'undefined') return
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const o = JSON.parse(saved)
        if (o.q) { setQ(o.q); setSearchInput(o.q) }
        if (o.status) setStatus(o.status)
        if (o.cliente) setCliente(o.cliente)
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

  // Sync URL + localStorage
  useEffect(() => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (status) params.set('status', status)
    if (cliente) params.set('cliente', cliente)
    if (sortField && sortField !== 'created_at') params.set('sort', sortField)
    if (sortDir && sortDir !== 'desc') params.set('dir', sortDir)
    const qs = params.toString()
    router.replace(qs ? `/obras?${qs}` : '/obras', { scroll: false })
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ q, status, cliente, sortField, sortDir }))
    }
  }, [q, status, cliente, sortField, sortDir])

  function toggleSort(field: string) {
    if (sortField === field) {
      if (sortDir === 'asc') setSortDir('desc')
      else if (sortDir === 'desc') { setSortField(null); setSortDir(null) }
      else setSortDir('asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const filtered = useMemo(() => {
    let result = obras
    if (q) {
      const ql = q.toLowerCase()
      result = result.filter(o =>
        (o.nome ?? '').toLowerCase().includes(ql) ||
        (o.cliente ?? '').toLowerCase().includes(ql) ||
        (o.local ?? '').toLowerCase().includes(ql)
      )
    }
    if (status) result = result.filter(o => o.status === status)
    if (cliente) result = result.filter(o => o.cliente === cliente)
    return applySort(result, sortField, sortDir)
  }, [obras, q, status, cliente, sortField, sortDir])

  const clientesUnicos = Array.from(new Set(obras.map(o => o.cliente).filter(Boolean))).sort()
  const hasFilter = q || status || cliente

  function clearFilters() {
    setQ(''); setSearchInput(''); setStatus(''); setCliente('')
  }

  return (
    <>
      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
              placeholder="Buscar por nome, cliente ou local..."
              className="w-full px-3 py-2 pr-7 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            {searchInput && (
              <button onClick={() => setSearchInput('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">✕</button>
            )}
          </div>
          <select value={status} onChange={e => setStatus(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
            <option value="">Todos os status</option>
            <option value="ativo">Ativo</option>
            <option value="pausado">Pausado</option>
            <option value="concluido">Concluído</option>
            <option value="cancelado">Cancelado</option>
          </select>
          <select value={cliente} onChange={e => setCliente(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
            <option value="">Todos os clientes</option>
            {clientesUnicos.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {hasFilter && (
            <button onClick={clearFilters} className="text-xs text-red-600 hover:underline font-medium">
              ✕ Limpar
            </button>
          )}
          <span className="text-xs text-gray-400 ml-auto">{filtered.length} resultado(s)</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <SortableHeader label="Nome" field="nome" currentField={sortField} currentDir={sortDir} onSort={toggleSort} />
              <SortableHeader label="Cliente" field="cliente" currentField={sortField} currentDir={sortDir} onSort={toggleSort} />
              <SortableHeader label="Local" field="local" currentField={sortField} currentDir={sortDir} onSort={toggleSort} />
              <SortableHeader label="Início" field="data_inicio" currentField={sortField} currentDir={sortDir} onSort={toggleSort} />
              <SortableHeader label="Prev. Fim" field="data_prev_fim" currentField={sortField} currentDir={sortDir} onSort={toggleSort} />
              <SortableHeader label="Status" field="status" currentField={sortField} currentDir={sortDir} onSort={toggleSort} />
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Encerramento</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? filtered.map((o: any) => (
              <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50 group cursor-pointer">
                <td className="px-4 py-3 font-semibold">
                  <Link href={`/obras/${o.id}`} className="hover:text-brand block">{o.nome}</Link>
                </td>
                <td className="px-4 py-3 text-gray-600"><Link href={`/obras/${o.id}`} className="block">{o.cliente ?? '—'}</Link></td>
                <td className="px-4 py-3 text-gray-500"><Link href={`/obras/${o.id}`} className="block">{o.local ?? '—'}</Link></td>
                <td className="px-4 py-3 text-gray-500 text-xs"><Link href={`/obras/${o.id}`} className="block">{o.data_inicio ? new Date(o.data_inicio+'T12:00').toLocaleDateString('pt-BR') : '—'}</Link></td>
                <td className="px-4 py-3 text-gray-500 text-xs"><Link href={`/obras/${o.id}`} className="block">{o.data_prev_fim ? new Date(o.data_prev_fim+'T12:00').toLocaleDateString('pt-BR') : '—'}</Link></td>
                <td className="px-4 py-3"><Link href={`/obras/${o.id}`} className="block">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLOR[o.status] ?? 'bg-gray-100 text-gray-600'}`}>{o.status ?? 'ativo'}</span>
                </Link></td>
                <td className="px-4 py-3 text-xs">
                  {(() => {
                    if (!o.data_prev_fim) return <span className="text-gray-300">—</span>
                    const dias = Math.ceil((new Date(o.data_prev_fim).getTime() - Date.now()) / 86400000)
                    if (dias < 0) return <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold">Vencido</span>
                    if (dias <= 30) return <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold">{dias}d</span>
                    if (dias <= 60) return <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold">{dias}d</span>
                    return <span className="text-gray-500">{dias}d</span>
                  })()}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center gap-3 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link href={`/obras/${o.id}`} className="text-xs text-brand hover:underline">Ver</Link>
                    <Link href={`/obras/${o.id}/editar`} className="text-xs text-gray-500 hover:text-gray-800">Editar</Link>
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">{hasFilter ? 'Nenhuma obra encontrada com os filtros aplicados.' : 'Nenhuma obra cadastrada.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
