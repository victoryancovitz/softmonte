'use client'

interface FilterChip {
  label: string
  value: string
  color?: string
}

interface FilterChipsProps {
  filters: FilterChip[]
  onRemove: (value: string) => void
  onClearAll?: () => void
  total?: number
  showing?: number
}

export default function FilterChips({ filters, onRemove, onClearAll, total, showing }: FilterChipsProps) {
  if (filters.length === 0) return null

  return (
    <div className="flex items-center gap-2 flex-wrap text-xs">
      {(total !== undefined && showing !== undefined) && (
        <span className="text-gray-500">Mostrando {showing} de {total}</span>
      )}
      {filters.length > 0 && <span className="text-gray-400">|</span>}
      {filters.map(f => (
        <span key={f.value} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${f.color || 'bg-gray-100 text-gray-700'}`}>
          {f.label}
          <button onClick={() => onRemove(f.value)} className="ml-0.5 hover:text-red-600 transition-colors" title="Remover filtro">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </span>
      ))}
      {onClearAll && filters.length > 1 && (
        <button onClick={onClearAll} className="text-brand hover:underline font-medium ml-1">
          Limpar tudo
        </button>
      )}
    </div>
  )
}
