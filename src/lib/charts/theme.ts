export const CHART_THEME = {
  primary: '#00215B',
  primaryLight: '#2B4C80',
  gold: '#C4972A',
  success: '#10B981',
  danger: '#EF4444',
  warning: '#F59E0B',
  neutral: '#64748B',

  categorical: [
    '#00215B', '#C4972A', '#10B981', '#EF4444',
    '#8B5CF6', '#06B6D4', '#F97316', '#EC4899',
  ],

  gridColor: '#E2E8F0',
  axisColor: '#94A3B8',
  tooltipBg: 'rgba(0, 33, 91, 0.95)',

  animationDuration: 400,
}

export const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const formatCurrencyK = (v: number) =>
  v >= 1000000 ? `R$ ${(v / 1000000).toFixed(1)}M` :
  v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}k` :
  `R$ ${v.toFixed(0)}`

export const MESES_CURTO = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
