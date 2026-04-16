export function formatSupabaseError(error: any): string {
  const msg = error?.message ?? error?.toString() ?? ''

  // Duplicate key
  if (msg.includes('duplicate key')) {
    if (msg.includes('cpf')) return 'Este CPF já está cadastrado no sistema.'
    if (msg.includes('matricula')) return 'Esta matrícula já existe.'
    if (msg.includes('email')) return 'Este e-mail já está em uso.'
    if (msg.includes('numero_contrato')) return 'Este número de contrato já existe.'
    return 'Este registro já existe no sistema.'
  }

  // Not null
  if (msg.includes('not-null') || msg.includes('null value')) {
    const match = msg.match(/column "(\w+)"/)
    const campo = match?.[1]
    const labels: Record<string, string> = {
      nome: 'Nome', matricula: 'Matrícula', cargo: 'Cargo', salario_base: 'Salário base',
      admissao: 'Data de admissão', data_inicio: 'Data de início', obra_id: 'Obra',
      funcionario_id: 'Funcionário', razao_social: 'Razão social',
    }
    return `O campo "${labels[campo ?? ''] ?? campo}" é obrigatório.`
  }

  // Foreign key
  if (msg.includes('foreign key') || msg.includes('violates foreign key')) {
    return 'Selecione uma opção válida para os campos de seleção.'
  }

  // Check constraint
  if (msg.includes('check constraint')) {
    return 'Um dos valores informados não é válido. Verifique os campos de seleção.'
  }

  // RLS / permissão
  if (msg.includes('row-level security') || msg.includes('new row violates') || msg.includes('permission denied')) {
    return 'Você não tem permissão para realizar esta ação.'
  }

  // Registro não encontrado
  if (msg.includes('PGRST116') || msg.includes('0 rows') || msg.includes('JSON object requested')) {
    return 'Nenhum registro encontrado.'
  }

  // JWT / sessão
  if (msg.includes('JWT') || msg.includes('token') || msg.includes('expired')) {
    return 'Sessão expirada. Faça login novamente.'
  }

  // Rede
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('Failed to fetch') || msg.includes('ECONNREFUSED')) {
    return 'Erro de conexão. Verifique sua internet e tente novamente.'
  }

  // Generic — só retorna mensagem técnica se for curta e sem códigos hexadecimais
  if (msg.length > 0 && msg.length < 120 && !/[0-9a-f]{8}-[0-9a-f]{4}/i.test(msg)) return msg
  return 'Ocorreu um erro. Tente novamente ou contate o suporte.'
}
