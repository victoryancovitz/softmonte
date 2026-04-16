/**
 * Tipos mínimos das principais entidades do banco.
 * NÃO é auto-gerado — mantido à mão porque é mais enxuto e explícito.
 * Se o schema crescer muito, rodar: supabase gen types typescript.
 */

export interface Obra {
  id: string
  nome: string
  cliente: string | null
  cliente_id: string | null
  local: string | null
  status: 'ativo' | 'pausado' | 'concluido' | 'cancelado'
  data_inicio: string | null
  data_prev_fim: string | null
  deleted_at: string | null
  // Contrato
  tipo_contrato: string | null
  valor_contrato: number | null
  valor_mensal_estimado: number | null
  modelo_cobranca: 'hh_diaria' | 'hh_hora_efetiva' | 'hh_220' | null
  // Escala
  escala_entrada: string | null
  escala_saida_seg_qui: string | null
  escala_saida_sex: string | null
  escala_almoco_minutos: number | null
  escala_tolerancia_min: number | null
  tem_adicional_noturno: boolean
  adicional_noturno_pct: number | null
  he_pct_normal: number | null
  he_pct_domingo_feriado: number | null
}

export interface Funcionario {
  id: string
  nome: string
  nome_guerra: string | null
  matricula: string | null
  id_ponto: string | null
  cpf: string | null
  cargo: string | null
  funcao_id: string | null
  admissao: string | null
  prazo1: string | null
  prazo2: string | null
  status: 'pendente' | 'em_admissao' | 'disponivel' | 'alocado' | 'afastado' | 'inativo'
  tipo_vinculo: string | null
  salario_base: number | null
  horas_mes: number | null
  insalubridade_pct: number | null
  periculosidade_pct: number | null
  vt_mensal: number | null
  vr_diario: number | null
  va_mensal: number | null
  plano_saude_mensal: number | null
  outros_beneficios: number | null
  deleted_at: string | null
  nao_renovar: boolean | null
}

export interface Alocacao {
  id: string
  funcionario_id: string
  obra_id: string
  cargo_na_obra: string | null
  data_inicio: string | null
  data_fim: string | null
  ativo: boolean
}

export interface Bm {
  id: string
  numero: string
  obra_id: string
  data_inicio: string
  data_fim: string
  status: 'aberto' | 'fechado' | 'enviado' | 'aprovado'
  valor_aprovado: number | null
  observacao: string | null
  enviado_em: string | null
  aprovado_em: string | null
  deleted_at: string | null
}

export interface Folha {
  id: string
  obra_id: string
  ano: number
  mes: number
  status: 'fechada' | 'revertida' | 'paga'
  valor_total_bruto: number
  valor_total_encargos: number
  valor_total_provisoes: number
  valor_total_beneficios: number
  valor_total: number
  funcionarios_incluidos: number
  deleted_at: string | null
}

export interface Rescisao {
  id: string
  funcionario_id: string
  obra_id: string | null
  tipo: string
  data_aviso: string
  data_desligamento: string
  aviso_previo_tipo: string | null
  salario_base_rescisao: number
  salario_total_rescisao: number
  saldo_salario: number
  aviso_previo_valor: number
  ferias_vencidas: number
  ferias_proporcionais: number
  terco_ferias: number
  decimo_proporcional: number
  fgts_mes: number
  fgts_aviso: number
  fgts_13: number
  fgts_saldo_estimado: number
  multa_fgts_40: number
  desconto_inss: number
  desconto_irrf: number
  total_proventos: number
  total_descontos: number
  valor_liquido: number
  custo_total_empresa: number
  status: 'rascunho' | 'homologada' | 'paga' | 'cancelada'
  deleted_at: string | null
}

export interface PagamentoExtra {
  id: string
  funcionario_id: string
  obra_id: string | null
  tipo: 'bonus' | 'bonus_por_fora' | 'comissao' | 'premio_producao' | 'gratificacao' | 'ajuda_custo' | 'adiantamento' | 'vale_extra' | 'outro'
  descricao: string | null
  competencia: string
  data_pagamento: string | null
  valor: number
  entra_dre: boolean
  entra_base_legal: boolean
  tributado: boolean
  recorrente: boolean
  status: 'previsto' | 'pago' | 'cancelado'
  deleted_at: string | null
}

export interface EfetivoDiario {
  id: string
  funcionario_id: string
  obra_id: string
  data: string
  tipo_dia: 'util' | 'sabado' | 'domingo_feriado'
  horas_normais: number | null
  horas_extras_50: number | null
  horas_extras_100: number | null
  horas_noturnas: number | null
  horas_trabalhadas: number | null
  entrada: string | null
  saida_almoco: string | null
  volta_almoco: string | null
  saida: string | null
  atraso_minutos: number
  origem_registro: 'manual' | 'biometrico' | 'ajuste_rh' | 'importacao'
}

export interface Profile {
  user_id: string
  nome: string | null
  email: string | null
  role: 'admin' | 'rh' | 'financeiro' | 'encarregado' | 'engenheiro' | 'funcionario'
  ativo: boolean
}
