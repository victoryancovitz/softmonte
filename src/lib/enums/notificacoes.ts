export const NOTIFICACAO_TIPOS = [
  'doc_vencendo','doc_vencido','treinamento_vencendo','treinamento_vencido',
  'contrato_vencendo','ferias_pendente','banco_horas_critico',
  'transferencia_pendente','aditivo_pendente','rnc_aberta',
  'admissao_pendente','desligamento_pendente','bm_aprovado','geral',
  'passivo_criado','passivo_editado','divida_criada','parcela_paga',
  'parcela_vencendo','parcela_vencida','lancamento_criado','lancamento_pago',
  'lancamento_cancelado','divida_renegociada','divida_quitada',
  'processo_criado','acordo_criado','acordo_homologado','acordo_inadimplente',
  'centro_custo_criado','centro_custo_editado','fornecedor_criado',
  'folha_fechada','folha_revertida',
  'sistema','info','sucesso','aviso','erro',
] as const

export type NotificacaoTipo = typeof NOTIFICACAO_TIPOS[number]
