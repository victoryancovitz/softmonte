/**
 * Formatadores centralizados — nunca exibir snake_case na UI.
 * Importar de @/lib/formatters em vez de criar funções inline.
 */

// ═══ MAPAS DE LABELS ═══

export const TIPO_DESLIGAMENTO: Record<string, string> = {
  demissao_sem_justa_causa: 'Sem Justa Causa',
  sem_justa_causa: 'Sem Justa Causa',
  demissao_por_justa_causa: 'Por Justa Causa',
  justa_causa: 'Por Justa Causa',
  pedido_demissao: 'Pedido de Demissão',
  termino_contrato: 'Término de Contrato',
  aposentadoria: 'Aposentadoria',
  falecimento: 'Falecimento',
  acordo_mutual: 'Acordo Mútuo',
  acordo: 'Acordo Mútuo',
}

export const TIPO_VINCULO: Record<string, string> = {
  indeterminado: 'CLT Indeterminado',
  experiencia_45_45: 'Experiência 45+45',
  experiencia_30_60: 'Experiência 30+60',
  experiencia_90: 'Experiência 90 dias',
  determinado_6m: 'Prazo Determinado 6m',
  determinado_12m: 'Prazo Determinado 12m',
}

export const STATUS_LANCAMENTO: Record<string, string> = {
  em_aberto: 'Em Aberto',
  pago: 'Pago',
  cancelado: 'Cancelado',
  provisionado: 'Provisão',
  pendente: 'Pendente',
}

export const TIPO_PAGAMENTO_EXTRA: Record<string, string> = {
  bonus: 'Bônus',
  bonus_por_fora: 'Bônus (Por Fora)',
  comissao: 'Comissão',
  premio_producao: 'Prêmio Produção',
  gratificacao: 'Gratificação',
  ajuda_custo: 'Ajuda de Custo',
  adiantamento: 'Adiantamento',
  vale_extra: 'Vale Extra',
  outro: 'Outro',
}

export const MOTIVO_CORRECAO: Record<string, string> = {
  acordo_coletivo: 'Acordo Coletivo (ACT)',
  dissidio: 'Dissídio',
  merito: 'Mérito / Desempenho',
  promocao: 'Promoção',
  correcao: 'Correção de Erro',
  piso: 'Piso da Categoria',
  outro: 'Outro',
}

export const TIPO_FALTA: Record<string, string> = {
  falta_injustificada: 'Injustificada',
  falta_justificada: 'Justificada',
  atestado_medico: 'Atestado Médico',
  atestado_acidente: 'Acidente de Trabalho',
  suspensao: 'Suspensão',
  licenca_maternidade: 'Licença Maternidade',
  licenca_paternidade: 'Licença Paternidade',
  folga_compensatoria: 'Folga Compensatória',
  feriado: 'Feriado',
  outro: 'Outro',
}

export const STATUS_GERAL: Record<string, string> = {
  ativo: 'Ativo', em_aberto: 'Em Aberto', pago: 'Pago',
  cancelado: 'Cancelado', concluido: 'Concluído', concluida: 'Concluída',
  em_andamento: 'Em Andamento', pausado: 'Pausado',
  provisionado: 'Provisão', atrasado: 'Atrasado',
  pendente: 'Pendente', aberto: 'Aberto', fechado: 'Fechado',
  enviado: 'Enviado', aprovado: 'Aprovado',
  previsto: 'Previsto', programada: 'Programada',
  realizada: 'Realizada', valido: 'Válido', vencido: 'Vencido',
  a_vencer: 'A Vencer', vencendo: 'Vencendo',
  disponivel: 'Disponível', alocado: 'Alocado',
  inativo: 'Inativo', afastado: 'Afastado',
}

// ═══ FUNÇÕES ═══

/** Formata qualquer valor snake_case usando um mapa, com fallback Title Case */
export function fmt(map: Record<string, string>, value: string | null | undefined): string {
  if (!value) return '—'
  return map[value] ?? value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function formatTipoDesligamento(tipo: string): string {
  return fmt(TIPO_DESLIGAMENTO, tipo)
}

export function formatStatus(status: string): string {
  return fmt(STATUS_GERAL, status)
}

export function formatTipoVinculo(tipo: string): string {
  return fmt(TIPO_VINCULO, tipo)
}

export function formatTipoFalta(tipo: string): string {
  return fmt(TIPO_FALTA, tipo)
}

export function formatTipoPagamento(tipo: string): string {
  return fmt(TIPO_PAGAMENTO_EXTRA, tipo)
}

export function formatMotivoCorrecao(motivo: string): string {
  return fmt(MOTIVO_CORRECAO, motivo)
}
