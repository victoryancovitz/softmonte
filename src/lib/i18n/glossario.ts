/**
 * Glossário oficial do Softmonte.
 * Usar estas constantes para garantir consistência terminológica.
 */

export const GLOSSARIO = {
  funcionario: 'Funcionário', funcionarios: 'Funcionários',
  funcao: 'Função', cargo: 'Cargo', obra: 'Obra',
  cliente: 'Cliente', fornecedor: 'Fornecedor',
  socio: 'Sócio', socios: 'Sócios',
  boletim_medicao: 'Boletim de Medição', bm: 'BM',
  hh: 'HH (Homem-Hora)', ponto: 'Ponto', folha: 'Folha',
  alocacao: 'Alocação', desligamento: 'Desligamento',
  admissao: 'Admissão', ferias: 'Férias',
  lancamento: 'Lançamento', categoria: 'Categoria',
  conta_corrente: 'Conta Corrente', centro_custo: 'Centro de Custo',
  cc: 'CC', competencia: 'Competência', vencimento: 'Vencimento',
  recorrencia: 'Recorrência', frequencia: 'Frequência',
  parcela: 'Parcela', observacao: 'Observação', observacoes: 'Observações',
  processo: 'Processo', processos: 'Processos',
  audiencia: 'Audiência', audiencias: 'Audiências',
  acordo: 'Acordo', advogado: 'Advogado',
  provisao: 'Provisão', provisoes: 'Provisões',
  prognostico: 'Prognóstico',
  nome: 'Nome', codigo: 'Código', numero: 'Número',
  responsavel: 'Responsável', descricao: 'Descrição',
  historico: 'Histórico', periodo: 'Período',
  proximo: 'Próximo', anterior: 'Anterior',
} as const

export function termo(chave: keyof typeof GLOSSARIO) {
  return GLOSSARIO[chave]
}

export const VOZ = {
  criado: (e: string) => `${e} cadastrado com sucesso`,
  criada: (e: string) => `${e} cadastrada com sucesso`,
  salvo: () => 'Alterações salvas',
  excluido: (e: string) => `${e} excluído`,
  arquivado: (e: string) => `${e} arquivado`,
  erro: () => 'Erro ao salvar. Tente novamente.',
  erro_permissao: () => 'Você não tem permissão para esta ação.',
  confirmar_exclusao: (e: string) => `Tem certeza que deseja excluir este ${e}? Esta ação não pode ser desfeita.`,
  confirmar_arquivamento: (e: string) => `Arquivar este ${e}? Ficará oculto mas pode ser restaurado.`,
}
