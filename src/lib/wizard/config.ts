export interface WizardStepConfig {
  id: number
  key: string
  titulo: string
  descricao: string
  depends: number[] // step IDs this depends on
  rota?: string    // link to the relevant page
}

export const WIZARD_STEPS: WizardStepConfig[] = [
  { id: 1,  key: 'empresa',          titulo: 'Empresa',               descricao: 'Razao social, CNPJ, logo',            depends: [],      rota: '/configuracoes' },
  { id: 2,  key: 'cadastros',        titulo: 'Cadastros Base',        descricao: 'Funcoes, tipos, plano de contas',      depends: [1],     rota: '/cadastros' },
  { id: 3,  key: 'clientes',         titulo: 'Clientes',              descricao: 'Clientes da empresa',                  depends: [1],     rota: '/clientes' },
  { id: 4,  key: 'obras',            titulo: 'Obra Ativa',            descricao: 'Ao menos 1 obra com status ativo',     depends: [2, 3],  rota: '/obras' },
  { id: 5,  key: 'composicao',       titulo: 'Composicao do Contrato', descricao: 'Funcoes x billing rate',              depends: [4],     rota: '/obras' },
  { id: 6,  key: 'funcionarios',     titulo: 'Funcionarios',          descricao: 'Equipe cadastrada',                    depends: [2],     rota: '/funcionarios' },
  { id: 7,  key: 'admissoes',        titulo: 'Admissões',             descricao: 'Workflow concluido ou bypass',         depends: [6],     rota: '/rh/admissoes' },
  { id: 8,  key: 'alocacoes',        titulo: 'Alocacoes',             descricao: 'Funcionarios alocados em obras',       depends: [4, 6],  rota: '/funcionarios' },
  { id: 9,  key: 'efetivo',          titulo: 'Efetivo Diario',        descricao: 'Presenca registrada',                  depends: [8],     rota: '/ponto' },
  { id: 10, key: 'ponto',            titulo: 'Ponto',                 descricao: 'Registros de ponto processados',       depends: [9],     rota: '/ponto' },
  { id: 11, key: 'fechamento_ponto', titulo: 'Fechamento de Ponto',   descricao: 'Ponto fechado por mes',                depends: [10],    rota: '/ponto' },
  { id: 12, key: 'folha',            titulo: 'Folha de Pagamento',    descricao: 'Folha fechada com CLT',                depends: [11],    rota: '/rh/folha' },
  { id: 13, key: 'bms',              titulo: 'Boletim de Medicao',    descricao: 'BM emitido e aprovado',                depends: [5, 12], rota: '/boletins' },
  { id: 14, key: 'financeiro',       titulo: 'Financeiro',            descricao: 'Contas, lancamentos, forecast',        depends: [13],    rota: '/financeiro' },
  { id: 15, key: 'almoxarifado',     titulo: 'Almoxarifado e EPIs',   descricao: 'Estoque, kits, NRs',                   depends: [6],     rota: '/almoxarifado' },
]
