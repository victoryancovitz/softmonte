/**
 * Constantes de BM (boletim de medição) compartilhadas.
 * Extraídas de src/app/(dashboard)/boletins/[id]/page.tsx como parte da
 * refatoração parcial do arquivo de 991 linhas.
 */

export const TIPOS_DOC_BM: { value: string; label: string }[] = [
  { value: 'nf', label: 'Nota Fiscal' },
  { value: 'medicao_assinada', label: 'Medição Assinada' },
  { value: 'comprovante', label: 'Comprovante' },
  { value: 'outro', label: 'Outro' },
]

export const BM_STATUS_ORDER: string[] = ['aberto', 'fechado', 'enviado', 'aprovado']

export const BM_STATUS_BADGE: Record<string, string> = {
  aberto: 'bg-blue-100 text-blue-700',
  fechado: 'bg-gray-100 text-gray-600',
  enviado: 'bg-amber-100 text-amber-700',
  aprovado: 'bg-green-100 text-green-700',
}

export const BM_TIPO_HORA_LABEL: Record<string, string> = {
  normal: 'Hora Normal',
  extra_70: 'HE 70%',
  extra_100: 'HE 100%',
}

export const BM_TIPO_HORA_COLOR: Record<string, string> = {
  normal: 'text-blue-700 bg-blue-50',
  extra_70: 'text-amber-700 bg-amber-50',
  extra_100: 'text-red-700 bg-red-50',
}
