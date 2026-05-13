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

/**
 * Retorna os campos que ficaram pendentes ao avançar uma etapa
 * (gravados pelo wizard quando RH escolhe "Avançar com pendências").
 */
export function etapaFaltando(valor: unknown): string[] {
  if (typeof valor !== 'object' || valor === null) return []
  const v = valor as { faltando?: unknown }
  if (!Array.isArray(v.faltando)) return []
  return v.faltando.filter((s): s is string => typeof s === 'string')
}

/**
 * Lista única de campos faltantes em todas as etapas da admissão.
 * Vazio = admissão completa (sem pendências conscientes).
 */
export function getPendenciasAdmissao(workflow: any): string[] {
  if (!workflow) return []
  const all: string[] = []
  for (const key of ETAPAS_KEYS) {
    all.push(...etapaFaltando(workflow[key]))
  }
  return Array.from(new Set(all))
}

export function admissaoIncompleta(workflow: any): boolean {
  return getPendenciasAdmissao(workflow).length > 0
}

/** Labels amigáveis para os campos da admissão (usados em badges/tooltips). */
export const FIELD_LABELS_ADMISSAO: Record<string, string> = {
  nome_mae: 'Nome da mãe',
  telefone: 'Telefone',
  endereco: 'Endereço',
  cidade_endereco: 'Cidade',
  cep: 'CEP',
  pis: 'PIS/NIS',
  re: 'RG',
  cargo: 'Cargo',
  matricula: 'Matrícula',
  id_ponto: 'ID Ponto',
  salario_base: 'Salário base',
  tipo_vinculo: 'Tipo de vínculo',
  tamanho_uniforme: 'Uniforme',
  tamanho_bota: 'Bota',
  ctps_numero: 'CTPS nº',
  ctps_serie: 'CTPS série',
  ctps_uf: 'CTPS UF',
  banco: 'Banco',
  aso_data_exame: 'Data ASO',
  aso_data_vencimento: 'Venc. ASO',
  contrato_arquivo: 'Contrato assinado',
}

export function labelCampoAdmissao(field: string): string {
  return FIELD_LABELS_ADMISSAO[field] || field
}
