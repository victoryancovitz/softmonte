export type UserRole = 'admin' | 'encarregado' | 'engenheiro' | 'almoxarife' | 'funcionario' | 'rh' | 'financeiro' | 'visualizador'

export interface Profile {
  id: string
  user_id: string
  nome: string
  email?: string
  role: UserRole
  created_at: string
}

export interface Obra {
  id: string
  nome: string
  cliente: string
  local: string
  data_inicio: string
  data_prev_fim: string
  status: string
  created_at: string
}

export interface Funcionario {
  id: string
  nome: string
  matricula: string
  cargo: string
  turno: 'diurno' | 'noturno' | 'misto'
  jornada_horas: number
  custo_hora: number
  custo_hora_extra: number
  custo_hora_noturno: number
  status: 'alocado' | 'disponivel' | 'afastado'
  user_id?: string
  created_at: string
}

export interface Alocacao {
  id: string
  funcionario_id: string
  obra_id: string
  cargo_na_obra: string
  data_inicio: string
  data_fim?: string
  ativo: boolean
  funcionarios?: Funcionario
  obras?: Obra
}

export interface Documento {
  id: string
  funcionario_id: string
  tipo: 'ASO' | 'NR-10' | 'NR-35' | 'NR-33' | 'NR-12' | 'CIPA' | 'outro'
  vencimento: string
  arquivo_url?: string
  observacao?: string
  funcionarios?: Funcionario
}

export interface EstoqueItem {
  id: string
  codigo: string
  nome: string
  categoria: 'EPI' | 'Material' | 'Ferramenta' | 'Consumivel'
  deposito: string
  quantidade: number
  quantidade_minima: number
  unidade: string
}

export interface Movimentacao {
  id: string
  item_id: string
  tipo: 'entrada' | 'saida' | 'transferencia'
  quantidade: number
  obra_id?: string
  responsavel_id?: string
  observacao?: string
  created_at: string
  estoque_itens?: EstoqueItem
  obras?: Obra
}

export interface Requisicao {
  id: string
  numero: number
  solicitante_id: string
  obra_id: string
  itens: { nome: string; quantidade: number; unidade: string }[]
  status: 'pendente' | 'aprovada' | 'rejeitada' | 'entregue'
  observacao?: string
  created_at: string
  funcionarios?: Funcionario
  obras?: Obra
}

export interface HHLancamento {
  id: string
  funcionario_id: string
  obra_id: string
  mes: number
  ano: number
  horas_normais: number
  horas_extras: number
  horas_noturnas: number
  importado_ponto: boolean
  auditoria_status: string
  funcionarios?: Funcionario
  obras?: Obra
}
