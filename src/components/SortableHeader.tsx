'use client'

export type SortDir = 'asc' | 'desc' | null

export default function SortableHeader({
  label,
  field,
  currentField,
  currentDir,
  onSort,
  align = 'left',
  className = '',
}: {
  label: string
  field: string
  currentField: string | null
  currentDir: SortDir
  onSort: (field: string) => void
  align?: 'left' | 'center' | 'right'
  className?: string
}) {
  const active = currentField === field
  const alignCls = align === 'right' ? 'text-right justify-end' : align === 'center' ? 'text-center justify-center' : 'text-left justify-start'

  return (
    <th className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide ${alignCls} ${className}`}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={`flex items-center gap-1 hover:text-gray-700 transition-colors ${alignCls} ${active ? 'text-brand' : ''}`}
      >
        {label}
        <svg width="10" height="14" viewBox="0 0 10 14" fill="none" className={active ? 'text-brand' : 'text-gray-300'}>
          <path d="M5 1L1 5h8L5 1z" fill={active && currentDir === 'asc' ? 'currentColor' : 'currentColor'} opacity={active && currentDir === 'asc' ? '1' : '0.3'}/>
          <path d="M5 13L1 9h8l-4 4z" fill={active && currentDir === 'desc' ? 'currentColor' : 'currentColor'} opacity={active && currentDir === 'desc' ? '1' : '0.3'}/>
        </svg>
      </button>
    </th>
  )
}

export function applySort<T>(items: T[], field: string | null, dir: SortDir, numericFields: string[] = []): T[] {
  if (!field || !dir) return items
  const sorted = [...items].sort((a: any, b: any) => {
    const av = a[field]
    const bv = b[field]
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    if (numericFields.includes(field)) {
      return Number(av) - Number(bv)
    }
    if (av instanceof Date || bv instanceof Date || (typeof av === 'string' && /^\d{4}-\d{2}-\d{2}/.test(av))) {
      return String(av).localeCompare(String(bv))
    }
    return String(av).localeCompare(String(bv), 'pt-BR', { numeric: true, sensitivity: 'base' })
  })
  return dir === 'desc' ? sorted.reverse() : sorted
}
