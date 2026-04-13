export function corMargem(pct: number | null): string {
  if (pct === null || pct === undefined) return 'text-gray-400'
  if (pct < 0) return 'text-red-700'
  if (pct < 15) return 'text-orange-600'
  if (pct < 25) return 'text-amber-600'
  return 'text-green-700'
}

export function bgMargem(pct: number | null): string {
  if (pct === null || pct === undefined) return 'bg-gray-200'
  if (pct < 0) return 'bg-red-500'
  if (pct < 15) return 'bg-orange-400'
  if (pct < 25) return 'bg-amber-400'
  return 'bg-green-500'
}

export function bgCardMargem(pct: number | null): string {
  if (pct === null || pct === undefined) return 'bg-white border-gray-100'
  if (pct < 0) return 'bg-gradient-to-br from-red-50 to-white border-red-200'
  if (pct < 25) return 'bg-gradient-to-br from-amber-50 to-white border-amber-200'
  return 'bg-gradient-to-br from-green-50 to-white border-green-200'
}

export function pillMargem(pct: number | null): string {
  if (pct === null || pct === undefined) return 'bg-gray-100 text-gray-500'
  if (pct < 0) return 'bg-red-100 text-red-700'
  if (pct < 25) return 'bg-amber-100 text-amber-700'
  return 'bg-green-100 text-green-700'
}

export const fmt = (v: any) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
export const fmtK = fmt
