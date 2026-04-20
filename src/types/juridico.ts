export type ProcessoTipo = 'trabalhista' | 'civel' | 'tributario' | 'administrativo' | 'criminal'
export type ProcessoStatus = 'inicial' | 'instrucao' | 'sentenca' | 'recurso' | 'execucao' | 'acordo' | 'arquivado' | 'extinto'
export type ProcessoPrognostico = 'provavel' | 'possivel' | 'remoto' | 'nao_avaliado'
export type ProcessoPolo = 'ativo' | 'passivo'
export type MovimentacaoTipo = 'peticao' | 'despacho' | 'decisao' | 'sentenca' | 'intimacao' | 'citacao' | 'audiencia' | 'recurso' | 'pericia' | 'outros'

export interface ProcessoJuridico {
  id: string
  numero_cnj: string | null
  tipo: ProcessoTipo
  status: ProcessoStatus
  vara: string | null
  comarca: string | null
  tribunal: string | null
  uf: string | null
  polo: ProcessoPolo
  parte_contraria: string
  parte_contraria_cpf_cnpj: string | null
  data_distribuicao: string | null
  data_citacao: string | null
  objeto: string
  valor_causa: number
  valor_provisionado: number
  prognostico: ProcessoPrognostico
  funcionario_id: string | null
  obra_id: string | null
  centro_custo_id: string
  advogado_id: string | null
  url_processo: string | null
  observacoes: string | null
  created_at: string
  deleted_at: string | null
}

export interface Advogado {
  id: string
  nome: string
  oab: string
  uf_oab: string
  tipo: 'interno' | 'externo' | 'escritorio'
  escritorio: string | null
  email: string | null
  telefone: string | null
  honorarios_mensais: number
  honorario_exito_pct: number
  ativo: boolean
  observacoes: string | null
}

export interface ProcessoMovimentacao {
  id: string
  processo_id: string
  data_movimento: string
  tipo: MovimentacaoTipo
  descricao: string
  responsavel: string | null
  anexo_id: string | null
}

export interface ProcessoAnexo {
  id: string
  processo_id: string
  tipo: string
  nome_original: string
  storage_path: string
  mime_type: string
  tamanho_bytes: number
  descricao: string | null
}
