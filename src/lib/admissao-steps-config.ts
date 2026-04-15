export const ADMISSAO_STEPS_FIELDS: Record<string, {
  label: string
  tab: string
  campos: { field: string; label: string; obrigatorio: boolean }[]
}> = {
  docs_pessoais: {
    label: 'Documentos Pessoais',
    tab: 'visao',
    campos: [
      { field: 're', label: 'RG', obrigatorio: true },
      { field: 'cpf', label: 'CPF', obrigatorio: true },
      { field: 'pis', label: 'PIS / NIS', obrigatorio: true },
      { field: 'data_nascimento', label: 'Data de Nascimento', obrigatorio: true },
      { field: 'naturalidade', label: 'Naturalidade', obrigatorio: true },
      { field: 'estado_civil', label: 'Estado Civil', obrigatorio: true },
      { field: 'nome_mae', label: 'Nome da Mae', obrigatorio: true },
      { field: 'nome_pai', label: 'Nome do Pai', obrigatorio: false },
      { field: 'telefone', label: 'Telefone', obrigatorio: true },
      { field: 'email', label: 'E-mail', obrigatorio: false },
      { field: 'endereco', label: 'Endereco', obrigatorio: true },
      { field: 'cidade_endereco', label: 'Cidade', obrigatorio: true },
      { field: 'cep', label: 'CEP', obrigatorio: true },
      { field: 'titulo_eleitor', label: 'Titulo de Eleitor', obrigatorio: false },
      { field: 'raca_cor', label: 'Raca / Cor', obrigatorio: true },
      { field: 'matricula', label: 'Matricula', obrigatorio: true },
      { field: 'id_ponto', label: 'ID no Ponto (Secullum)', obrigatorio: true },
      { field: 'tamanho_uniforme', label: 'Tamanho Uniforme', obrigatorio: true },
      { field: 'tamanho_bota', label: 'Tamanho de Bota', obrigatorio: true },
    ]
  },
  treinamentos: {
    label: 'Treinamentos NR',
    tab: 'treinamentos',
    campos: []
  }
}
