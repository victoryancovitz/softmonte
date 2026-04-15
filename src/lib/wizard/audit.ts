'use server'

import { createClient } from '@/lib/supabase-server'

export interface StepResult {
  ok: boolean
  count?: number
  detalhes?: string
  subItems?: { label: string; ok: boolean; count?: number }[]
}

export type AuditResult = Record<string, StepResult>

export async function runWizardAudit(): Promise<AuditResult> {
  const supabase = createClient()

  const [
    empresa,
    funcoes,
    tiposContrato,
    categorias,
    clientes,
    obrasAtivas,
    composicao,
    funcionarios,
    admissoesCompletas,
    admissoesBypass,
    alocacoes,
    efetivo,
    pontoMarcacoes,
    pontoFechamentos,
    folhaFechamentos,
    bmEmitidos,
    bmAprovados,
    contasCorrentes,
    lancamentos,
    forecastContrato,
    estoqueItens,
    epiKits,
  ] = await Promise.all([
    // 1 - Empresa
    supabase.from('empresa_config').select('razao_social, cnpj, logo_url').limit(1).maybeSingle(),
    // 2 - Cadastros: funcoes
    supabase.from('funcoes').select('id', { count: 'exact', head: true }).eq('ativo', true),
    // 2 - Cadastros: tipos contrato
    supabase.from('tipos_contrato').select('id', { count: 'exact', head: true }).eq('ativo', true).is('deleted_at', null),
    // 2 - Cadastros: categorias financeiras
    supabase.from('categorias_financeiras').select('id', { count: 'exact', head: true }).eq('ativo', true),
    // 3 - Clientes
    supabase.from('clientes').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    // 4 - Obras ativas
    supabase.from('obras').select('id, nome', { count: 'exact' }).eq('status', 'ativo').is('deleted_at', null),
    // 5 - Composicao contrato
    supabase.from('contrato_composicao').select('id', { count: 'exact', head: true }).eq('ativo', true),
    // 6 - Funcionarios
    supabase.from('funcionarios').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    // 7 - Admissoes concluidas
    supabase.from('admissoes_workflow').select('id', { count: 'exact', head: true }).eq('status', 'concluido'),
    // 7 - Admissoes bypass
    supabase.from('admissoes_workflow').select('id', { count: 'exact', head: true }).eq('status', 'bypass'),
    // 8 - Alocacoes
    supabase.from('alocacoes').select('id', { count: 'exact', head: true }).eq('ativo', true),
    // 9 - Efetivo diario
    supabase.from('efetivo_diario').select('id', { count: 'exact', head: true }),
    // 10 - Ponto marcacoes
    supabase.from('ponto_marcacoes').select('id', { count: 'exact', head: true }),
    // 11 - Ponto fechamentos
    supabase.from('ponto_fechamentos').select('id', { count: 'exact', head: true }),
    // 12 - Folha fechamentos
    supabase.from('folha_fechamentos').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    // 13 - BMs emitidos
    supabase.from('boletins_medicao').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    // 13 - BMs aprovados
    supabase.from('boletins_medicao').select('id', { count: 'exact', head: true }).eq('status', 'aprovado').is('deleted_at', null),
    // 14 - Contas correntes
    supabase.from('contas_correntes').select('id', { count: 'exact', head: true }).eq('ativo', true).is('deleted_at', null),
    // 14 - Lancamentos financeiros
    supabase.from('financeiro_lancamentos').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    // 14 - Forecast
    supabase.from('forecast_contrato').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    // 15 - Estoque itens
    supabase.from('estoque_itens').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    // 15 - EPI kits
    supabase.from('epi_kits_funcao').select('id', { count: 'exact', head: true }),
  ])

  const funcoesCount = funcoes.count ?? 0
  const tiposCount = tiposContrato.count ?? 0
  const categoriasCount = categorias.count ?? 0
  const clientesCount = clientes.count ?? 0
  const obrasCount = obrasAtivas.count ?? 0
  const composicaoCount = composicao.count ?? 0
  const funcionariosCount = funcionarios.count ?? 0
  const admConcluidasCount = admissoesCompletas.count ?? 0
  const admBypassCount = admissoesBypass.count ?? 0
  const alocacoesCount = alocacoes.count ?? 0
  const efetivoCount = efetivo.count ?? 0
  const pontoCount = pontoMarcacoes.count ?? 0
  const fechamentoPontoCount = pontoFechamentos.count ?? 0
  const folhaCount = folhaFechamentos.count ?? 0
  const bmEmitidosCount = bmEmitidos.count ?? 0
  const bmAprovadosCount = bmAprovados.count ?? 0
  const contasCount = contasCorrentes.count ?? 0
  const lancamentosCount = lancamentos.count ?? 0
  const forecastCount = forecastContrato.count ?? 0
  const estoqueCount = estoqueItens.count ?? 0
  const epiCount = epiKits.count ?? 0

  const hasRazao = !!empresa.data?.razao_social
  const hasCnpj = !!empresa.data?.cnpj
  const hasLogo = !!empresa.data?.logo_url

  return {
    empresa: {
      ok: hasRazao && hasCnpj,
      detalhes: empresa.data?.razao_social || 'Nao configurado',
      subItems: [
        { label: 'Razao social', ok: hasRazao },
        { label: 'CNPJ', ok: hasCnpj },
        { label: 'Logo', ok: hasLogo },
      ],
    },
    cadastros: {
      ok: funcoesCount > 0 && tiposCount > 0 && categoriasCount > 0,
      subItems: [
        { label: 'Funcoes', ok: funcoesCount > 0, count: funcoesCount },
        { label: 'Tipos de contrato', ok: tiposCount > 0, count: tiposCount },
        { label: 'Categorias financeiras', ok: categoriasCount > 0, count: categoriasCount },
      ],
    },
    clientes: {
      ok: clientesCount > 0,
      count: clientesCount,
      detalhes: clientesCount > 0 ? `${clientesCount} cliente(s)` : 'Nenhum cliente',
    },
    obras: {
      ok: obrasCount > 0,
      count: obrasCount,
      detalhes: obrasCount > 0 ? `${obrasCount} obra(s) ativa(s)` : 'Nenhuma obra ativa',
    },
    composicao: {
      ok: composicaoCount > 0,
      count: composicaoCount,
      detalhes: composicaoCount > 0 ? `${composicaoCount} linha(s) de composicao` : 'Sem composicao',
    },
    funcionarios: {
      ok: funcionariosCount > 0,
      count: funcionariosCount,
      detalhes: funcionariosCount > 0 ? `${funcionariosCount} funcionario(s)` : 'Nenhum funcionario',
    },
    admissoes: {
      ok: (admConcluidasCount + admBypassCount) > 0,
      count: admConcluidasCount + admBypassCount,
      subItems: [
        { label: 'Concluidas', ok: admConcluidasCount > 0, count: admConcluidasCount },
        { label: 'Bypass', ok: admBypassCount > 0, count: admBypassCount },
      ],
    },
    alocacoes: {
      ok: alocacoesCount > 0,
      count: alocacoesCount,
      detalhes: alocacoesCount > 0 ? `${alocacoesCount} alocacao(oes)` : 'Nenhuma alocacao',
    },
    efetivo: {
      ok: efetivoCount > 0,
      count: efetivoCount,
      detalhes: efetivoCount > 0 ? `${efetivoCount} registro(s)` : 'Sem registros',
    },
    ponto: {
      ok: pontoCount > 0,
      count: pontoCount,
      detalhes: pontoCount > 0 ? `${pontoCount} marcacao(oes)` : 'Sem marcacoes',
    },
    fechamento_ponto: {
      ok: fechamentoPontoCount > 0,
      count: fechamentoPontoCount,
      detalhes: fechamentoPontoCount > 0 ? `${fechamentoPontoCount} fechamento(s)` : 'Nenhum fechamento',
    },
    folha: {
      ok: folhaCount > 0,
      count: folhaCount,
      detalhes: folhaCount > 0 ? `${folhaCount} folha(s)` : 'Nenhuma folha',
    },
    bms: {
      ok: bmAprovadosCount > 0,
      count: bmEmitidosCount,
      subItems: [
        { label: 'Emitidos', ok: bmEmitidosCount > 0, count: bmEmitidosCount },
        { label: 'Aprovados', ok: bmAprovadosCount > 0, count: bmAprovadosCount },
      ],
    },
    financeiro: {
      ok: contasCount > 0 && lancamentosCount > 0,
      subItems: [
        { label: 'Contas correntes', ok: contasCount > 0, count: contasCount },
        { label: 'Lancamentos', ok: lancamentosCount > 0, count: lancamentosCount },
        { label: 'Forecast', ok: forecastCount > 0, count: forecastCount },
      ],
    },
    almoxarifado: {
      ok: estoqueCount > 0,
      subItems: [
        { label: 'Itens de estoque', ok: estoqueCount > 0, count: estoqueCount },
        { label: 'Kits EPI', ok: epiCount > 0, count: epiCount },
      ],
    },
  }
}
