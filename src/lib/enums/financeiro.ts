/**
 * Enums autoritativos do módulo financeiro.
 * Valores DEVEM bater com os CHECK constraints do banco.
 * Qualquer valor diferente causa erro no INSERT/UPDATE.
 */

export const PASSIVO_TIPO = {
  emprestimo: 'Empréstimo',
  financiamento: 'Financiamento',
  provisao_trabalhista: 'Provisão Trabalhista',
  outros: 'Outros',
} as const

export const DIVIDA_TIPO = {
  refinanciamento: 'Refinanciamento (com banco)',
  emprestimo: 'Empréstimo comum',
  acordo_judicial: 'Acordo Judicial',
  parcelamento_inss: 'Parcelamento INSS',
  parcelamento_fgts: 'Parcelamento FGTS',
  parcelamento_tributario: 'Parcelamento Tributário',
  outros: 'Outros',
} as const

export const DIVIDA_STATUS = {
  ativa: 'Ativa',
  quitada: 'Quitada',
  renegociada: 'Renegociada',
  cancelada: 'Cancelada',
} as const

export const PARCELA_STATUS = {
  aberta: 'Em aberto',
  paga: 'Paga',
  atrasada: 'Atrasada',
  antecipada: 'Antecipada',
} as const

export const CREDOR_TIPO = {
  banco: 'Banco',
  fornecedor: 'Fornecedor',
  advogado: 'Advogado',
  governo: 'Governo / Fisco',
  outro: 'Outro',
} as const

export const SISTEMA_AMORTIZACAO = {
  price: 'PRICE (parcela fixa)',
  sac: 'SAC (amortização constante)',
  americano: 'Americano (só juros)',
} as const

export const LANCAMENTO_TIPO = { receita: 'Receita', despesa: 'Despesa' } as const
export const LANCAMENTO_STATUS = { pago: 'Pago', em_aberto: 'Em aberto', cancelado: 'Cancelado' } as const

export const FORMA_PAGAMENTO = {
  pix: 'Pix', ted: 'TED', boleto: 'Boleto',
  cartao_credito: 'Cartão de crédito', cartao_debito: 'Cartão de débito',
  dinheiro: 'Dinheiro', cheque: 'Cheque', debito_automatico: 'Débito automático',
} as const

export const LANCAMENTO_ORIGEM = {
  manual: 'Manual', importado: 'Importado', provisionado: 'Provisionado',
  bm_aprovado: 'BM Aprovado', folha_fechamento: 'Folha', rescisao: 'Rescisão',
  conciliacao_ofx: 'Conciliação OFX', pagamento_extra: 'Pagamento Extra',
  divida_parcela: 'Parcela de Dívida', divida_entrada: 'Entrada de Empréstimo',
  divida_juros: 'Juros de Dívida', transferencia: 'Transferência',
  recorrencia: 'Recorrência', mutuo_socio: 'Mútuo Sócio',
  aporte_socio: 'Aporte Sócio', dividendos: 'Dividendos',
  juridico_acordo: 'Acordo Judicial', juridico_honorarios: 'Honorários',
  juridico_custas: 'Custas Judiciais', juridico_deposito: 'Depósito Judicial',
  juridico_pericia: 'Perícia', juridico_multa: 'Multa/Indenização',
} as const

export const PROCESSO_TIPO = {
  trabalhista: 'Trabalhista', civel: 'Cível', tributario: 'Tributário',
  administrativo: 'Administrativo', criminal: 'Criminal',
} as const

export const PROCESSO_STATUS = {
  inicial: 'Inicial', instrucao: 'Instrução', sentenca: 'Sentença',
  recurso: 'Recurso', execucao: 'Execução', acordo: 'Acordo',
  arquivado: 'Arquivado', extinto: 'Extinto',
} as const

export const PROCESSO_POLO = { ativo: 'Ativo (Tecnomonte demanda)', passivo: 'Passivo (Tecnomonte demandada)' } as const
export const PROCESSO_PROGNOSTICO = { provavel: 'Provável', possivel: 'Possível', remoto: 'Remoto', nao_avaliado: 'Não avaliado' } as const

export const ACORDO_STATUS = {
  negociado: 'Negociado', homologado: 'Homologado', em_pagamento: 'Em pagamento',
  quitado: 'Quitado', inadimplente: 'Inadimplente', rescindido: 'Rescindido',
} as const
