export const NOTIFICACAO_TIPOS = [
  // RH / contratos
  'experiencia_1_vencendo', 'experiencia_2_vencendo',
  'doc_vencendo', 'doc_vencido', 'documento_vencendo',
  'treinamento_vencendo', 'treinamento_vencido',
  'contrato_vencendo', 'ferias_pendente', 'banco_horas_critico',
  'transferencia_pendente', 'aditivo_pendente', 'rnc_aberta',
  'admissao_pendente', 'desligamento_pendente', 'bm_aprovado', 'geral',
  // Financeiro
  'passivo_criado', 'passivo_editado', 'divida_criada', 'parcela_paga',
  'parcela_vencendo', 'parcela_vencida', 'lancamento_criado', 'lancamento_pago',
  'lancamento_cancelado', 'divida_renegociada', 'divida_quitada',
  'alerta_vencimento', 'alerta_atraso',
  // Jurídico
  'processo_criado', 'acordo_criado', 'acordo_homologado', 'acordo_inadimplente',
  'audiencia_proxima', 'audiencia_urgente', 'acordo_parcela_proxima',
  'processo_sem_movimentacao', 'prognostico_desatualizado',
  // Cadastros
  'centro_custo_criado', 'centro_custo_editado', 'fornecedor_criado',
  'folha_fechada', 'folha_revertida',
  // Sistema
  'sistema', 'info', 'sucesso', 'aviso', 'erro',
] as const

export type NotificacaoTipo = typeof NOTIFICACAO_TIPOS[number]
