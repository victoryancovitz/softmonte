/**
 * Verifica se uma etapa da admissão está concluída.
 * Aceita tanto boolean (legacy) quanto JSONB { ok: true }.
 */
export function etapaOk(valor: unknown): boolean {
  if (valor === true) return true
  if (typeof valor === 'object' && valor !== null) {
    return (valor as { ok?: boolean }).ok === true
  }
  return false
}

export const ETAPAS_KEYS = [
  'etapa_docs_pessoais',
  'etapa_exame_admissional',
  'etapa_ctps',
  'etapa_contrato_assinado',
  'etapa_dados_bancarios',
  'etapa_epi_entregue',
  'etapa_nr_obrigatorias',
  'etapa_integracao',
  'etapa_uniforme',
  'etapa_esocial',
] as const

export function contarConcluidas(workflow: any): number {
  return ETAPAS_KEYS.filter(k => etapaOk(workflow[k])).length
}
