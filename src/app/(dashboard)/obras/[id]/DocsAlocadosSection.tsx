'use client'
import { useState, useMemo } from 'react'
import SearchInput from '@/components/SearchInput'

type Doc = {
  id: string
  tipo: string
  vencimento: string | null
  funcionarios?: { nome: string } | null
  funcionario_id: string
  dias: number | null
}

function statusColor(dias: number | null) {
  if (dias === null) return 'bg-gray-100 text-gray-500'
  if (dias < 0) return 'bg-red-100 text-red-700'
  if (dias <= 30) return 'bg-amber-100 text-amber-700'
  return 'bg-green-100 text-green-700'
}

function statusLabel(dias: number | null) {
  if (dias === null) return 'Sem vencimento'
  if (dias < 0) return `Vencido há ${Math.abs(dias)}d`
  if (dias <= 30) return `Vence em ${dias}d`
  return 'Regular'
}

export default function DocsAlocadosSection({ docs }: { docs: Doc[] }) {
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'vencido' | 'vencendo' | 'regular'>('todos')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [expandido, setExpandido] = useState<Set<string>>(new Set())

  // Tipos únicos pra dropdown
  const tipos = useMemo(() => {
    const set = new Set(docs.map(d => d.tipo))
    return Array.from(set).sort()
  }, [docs])

  // Filtra
  const filtered = useMemo(() => {
    let result = docs
    if (busca.trim()) {
      const q = busca.toLowerCase()
      result = result.filter(d =>
        d.tipo.toLowerCase().includes(q) ||
        (d.funcionarios?.nome || '').toLowerCase().includes(q)
      )
    }
    if (filtroTipo) {
      result = result.filter(d => d.tipo === filtroTipo)
    }
    if (filtroStatus === 'vencido') result = result.filter(d => d.dias !== null && d.dias < 0)
    else if (filtroStatus === 'vencendo') result = result.filter(d => d.dias !== null && d.dias >= 0 && d.dias <= 30)
    else if (filtroStatus === 'regular') result = result.filter(d => d.dias === null || d.dias > 30)
    return result
  }, [docs, busca, filtroTipo, filtroStatus])

  // Agrupa por tipo
  const grouped = useMemo(() => {
    const map = new Map<string, Doc[]>()
    for (const d of filtered) {
      if (!map.has(d.tipo)) map.set(d.tipo, [])
      map.get(d.tipo)!.push(d)
    }
    // Ordena por tipo
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [filtered])

  function toggleGrupo(tipo: string) {
    setExpandido(prev => {
      const next = new Set(prev)
      if (next.has(tipo)) next.delete(tipo)
      else next.add(tipo)
      return next
    })
  }

  // Contagem por status
  const totalVencidos = docs.filter(d => d.dias !== null && d.dias < 0).length
  const totalVencendo = docs.filter(d => d.dias !== null && d.dias >= 0 && d.dias <= 30).length

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-brand font-display">
          Documentos dos funcionários alocados ({docs.length})
        </h2>
        <div className="flex items-center gap-2 text-[11px]">
          {totalVencidos > 0 && <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-semibold">{totalVencidos} vencido(s)</span>}
          {totalVencendo > 0 && <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-semibold">{totalVencendo} vencendo</span>}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-2 mb-3">
        <div className="flex-1 min-w-[180px] max-w-[280px]">
          <SearchInput value={busca} onChange={setBusca} placeholder="Buscar nome ou tipo..." />
        </div>
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
          className="px-2.5 py-2 border border-gray-200 rounded-lg text-xs bg-white">
          <option value="">Todos os tipos</option>
          {tipos.map(t => <option key={t} value={t}>{t} ({docs.filter(d => d.tipo === t).length})</option>)}
        </select>
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value as any)}
          className="px-2.5 py-2 border border-gray-200 rounded-lg text-xs bg-white">
          <option value="todos">Todos status</option>
          <option value="vencido">Vencidos ({totalVencidos})</option>
          <option value="vencendo">Vencendo 30d ({totalVencendo})</option>
          <option value="regular">Regulares</option>
        </select>
        <span className="text-[11px] text-gray-400">{filtered.length} resultado(s)</span>
      </div>

      {/* Agrupado por tipo */}
      {grouped.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">Nenhum documento encontrado.</p>
      ) : (
        <div className="space-y-1">
          {grouped.map(([tipo, items]) => {
            const isOpen = expandido.has(tipo)
            const vencidosGrupo = items.filter(d => d.dias !== null && d.dias < 0).length
            return (
              <div key={tipo} className="border border-gray-100 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleGrupo(tipo)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-700">{isOpen ? '▼' : '▶'} {tipo}</span>
                    <span className="text-[11px] text-gray-500">({items.length})</span>
                    {vencidosGrupo > 0 && <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-semibold">{vencidosGrupo} vencido(s)</span>}
                  </div>
                </button>
                {isOpen && (
                  <div className="divide-y divide-gray-50">
                    {items.map(d => (
                      <div key={d.id} className="px-3 py-1.5 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-medium text-gray-800">{d.funcionarios?.nome ?? '—'}</span>
                          {d.vencimento && (
                            <span className="text-gray-400 ml-2">
                              Venc. {new Date(d.vencimento + 'T12:00').toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </div>
                        <span className={`px-2 py-0.5 rounded-full font-medium ${statusColor(d.dias)}`}>
                          {statusLabel(d.dias)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
