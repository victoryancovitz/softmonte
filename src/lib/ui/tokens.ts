/**
 * Design tokens do Softmonte.
 * Usar estes tokens em vez de hardcodar cores e espaçamentos.
 */

export const CORES = {
  primary: 'bg-brand text-white hover:bg-brand-dark',
  secondary: 'border border-gray-200 text-gray-700 hover:bg-gray-50',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  danger_soft: 'bg-red-50 text-red-700 border-red-200',
  warning: 'bg-amber-500 text-white hover:bg-amber-600',
  warning_soft: 'bg-amber-50 text-amber-700 border-amber-200',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700',
  success_soft: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ghost: 'text-gray-600 hover:bg-gray-100',
}

export const ESPACAMENTOS = {
  pagina: 'p-4 sm:p-6',
  card: 'p-4 sm:p-6',
  form_gap: 'space-y-4',
  section_gap: 'space-y-6',
}

export const TIPOGRAFIA = {
  h1: 'text-2xl font-bold font-display text-gray-900',
  h2: 'text-xl font-semibold text-gray-900',
  h3: 'text-lg font-semibold text-gray-900',
  body: 'text-sm text-gray-700',
  subtle: 'text-sm text-gray-500',
  caption: 'text-xs text-gray-500',
  label: 'text-xs font-semibold text-gray-500',
}

export const COMPONENTES = {
  card: 'bg-white rounded-xl border border-gray-200 shadow-sm',
  input: 'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand',
  modal: 'bg-white rounded-2xl shadow-2xl',
  badge: 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
  table_head: 'bg-gray-50 text-xs uppercase text-gray-500 tracking-wide',
  table_row: 'hover:bg-gray-50 transition-colors',
}
