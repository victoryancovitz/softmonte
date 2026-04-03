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

  // RLS
  if (msg.includes('row-level security') || msg.includes('new row violates')) {
    return 'Você não tem permissão para realizar esta ação.'
  }

  // Generic
  if (msg.length > 0 && msg.length < 200) return msg
  return 'Algo deu errado. Tente novamente ou entre em contato com o suporte.'
}
