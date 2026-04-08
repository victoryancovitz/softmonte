import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Sistema de impacto: dado (tabela, id), retorna lista de quais outros
 * lugares da plataforma serão afetados por uma edição/exclusão.
 *
 * Cada entrada tem: { label, count, tabela, pagina, severidade }.
 * Severidade: 'info' (apenas referência), 'warn' (bloqueia se forte), 'critico' (dado histórico).
 */

export interface ImpactEntry {
  label: string
  count: number
  tabela: string
  pagina?: string
  severidade: 'info' | 'warn' | 'critico'
  detalhes?: string
}

type ImpactFn = (supabase: SupabaseClient, id: string) => Promise<ImpactEntry[]>

// Registra as regras de impacto por entidade
const RULES: Record<string, ImpactFn> = {
  funcao: async (supabase, id) => {
    const [funcs, comp, alocs, bmItens] = await Promise.all([
      supabase.from('funcionarios').select('id', { count: 'exact', head: true }).eq('funcao_id', id).is('deleted_at', null),
      supabase.from('contrato_composicao').select('id', { count: 'exact', head: true }).eq('funcao_id', id),
      supabase.from('alocacoes').select('id', { count: 'exact', head: true }).eq('ativo', true),  // todos (nao temos link direto)
      supabase.from('correcoes_salariais').select('id', { count: 'exact', head: true }).eq('funcao_id', id),
    ])
    const out: ImpactEntry[] = []
    if ((funcs.count || 0) > 0) out.push({ label: 'Funcionários usando esta função', count: funcs.count || 0, tabela: 'funcionarios', pagina: '/funcionarios', severidade: 'warn', detalhes: 'Referência mantida; custos e adicionais padrão mudam apenas para NOVAS admissões.' })
    if ((comp.count || 0) > 0) out.push({ label: 'Composições de contrato referenciando', count: comp.count || 0, tabela: 'contrato_composicao', pagina: '/obras', severidade: 'warn', detalhes: 'Recálculo de margem pode ser afetado.' })
    if ((correcoes_count(comp.count)) > 0) {}  // noop (type hint)
    return out
  },

  funcionario: async (supabase, id) => {
    const [alocs, efetivo, faltas, docs, folha, resc, hist, bmItens] = await Promise.all([
      supabase.from('alocacoes').select('id', { count: 'exact', head: true }).eq('funcionario_id', id),
      supabase.from('efetivo_diario').select('id', { count: 'exact', head: true }).eq('funcionario_id', id),
      supabase.from('faltas').select('id', { count: 'exact', head: true }).eq('funcionario_id', id),
      supabase.from('documentos').select('id', { count: 'exact', head: true }).eq('funcionario_id', id).is('deleted_at', null),
      supabase.from('folha_itens').select('id', { count: 'exact', head: true }).eq('funcionario_id', id),
      supabase.from('rescisoes').select('id', { count: 'exact', head: true }).eq('funcionario_id', id).is('deleted_at', null),
      supabase.from('funcionario_historico_salarial').select('id', { count: 'exact', head: true }).eq('funcionario_id', id),
      supabase.from('bm_itens').select('id', { count: 'exact', head: true }).eq('funcionario_id', id),
    ])
    const out: ImpactEntry[] = []
    if ((alocs.count || 0) > 0)   out.push({ label: 'Alocações em obra', count: alocs.count || 0, tabela: 'alocacoes', pagina: '/alocacao', severidade: 'warn' })
    if ((efetivo.count || 0) > 0) out.push({ label: 'Registros de ponto', count: efetivo.count || 0, tabela: 'efetivo_diario', pagina: '/ponto', severidade: 'critico', detalhes: 'Base de cálculo do custo real e BMs.' })
    if ((faltas.count || 0) > 0)  out.push({ label: 'Faltas registradas', count: faltas.count || 0, tabela: 'faltas', pagina: '/faltas', severidade: 'warn' })
    if ((docs.count || 0) > 0)    out.push({ label: 'Documentos', count: docs.count || 0, tabela: 'documentos', pagina: '/documentos', severidade: 'warn' })
    if ((folha.count || 0) > 0)   out.push({ label: 'Itens em folhas fechadas', count: folha.count || 0, tabela: 'folha_itens', pagina: '/rh/folha', severidade: 'critico', detalhes: 'Registros contábeis imutáveis.' })
    if ((resc.count || 0) > 0)    out.push({ label: 'Rescisões', count: resc.count || 0, tabela: 'rescisoes', pagina: '/rh/rescisoes', severidade: 'critico' })
    if ((hist.count || 0) > 0)    out.push({ label: 'Registros no histórico salarial', count: hist.count || 0, tabela: 'funcionario_historico_salarial', severidade: 'info' })
    if ((bmItens.count || 0) > 0) out.push({ label: 'Linhas em boletins de medição', count: bmItens.count || 0, tabela: 'bm_itens', pagina: '/boletins', severidade: 'critico', detalhes: 'Referenciado em BMs já enviados.' })
    return out
  },

  obra: async (supabase, id) => {
    const [alocs, efetivo, bms, lanc, folha, forecast] = await Promise.all([
      supabase.from('alocacoes').select('id', { count: 'exact', head: true }).eq('obra_id', id).eq('ativo', true),
      supabase.from('efetivo_diario').select('id', { count: 'exact', head: true }).eq('obra_id', id),
      supabase.from('boletins_medicao').select('id', { count: 'exact', head: true }).eq('obra_id', id).is('deleted_at', null),
      supabase.from('financeiro_lancamentos').select('id', { count: 'exact', head: true }).eq('obra_id', id).is('deleted_at', null),
      supabase.from('folha_fechamentos').select('id', { count: 'exact', head: true }).eq('obra_id', id).is('deleted_at', null),
      supabase.from('forecast_contrato').select('id', { count: 'exact', head: true }).eq('obra_id', id),
    ])
    const out: ImpactEntry[] = []
    if ((alocs.count || 0) > 0)    out.push({ label: 'Alocações ativas', count: alocs.count || 0, tabela: 'alocacoes', pagina: '/alocacao', severidade: 'warn' })
    if ((efetivo.count || 0) > 0)  out.push({ label: 'Registros de ponto', count: efetivo.count || 0, tabela: 'efetivo_diario', pagina: '/ponto', severidade: 'critico' })
    if ((bms.count || 0) > 0)      out.push({ label: 'Boletins de medição', count: bms.count || 0, tabela: 'boletins_medicao', pagina: '/boletins', severidade: 'critico' })
    if ((lanc.count || 0) > 0)     out.push({ label: 'Lançamentos financeiros', count: lanc.count || 0, tabela: 'financeiro_lancamentos', pagina: '/financeiro', severidade: 'critico' })
    if ((folha.count || 0) > 0)    out.push({ label: 'Fechamentos de folha', count: folha.count || 0, tabela: 'folha_fechamentos', pagina: '/rh/folha', severidade: 'critico' })
    if ((forecast.count || 0) > 0) out.push({ label: 'Registros de forecast', count: forecast.count || 0, tabela: 'forecast_contrato', pagina: '/forecast', severidade: 'warn' })
    return out
  },

  cliente: async (supabase, id) => {
    const [obras, contatos] = await Promise.all([
      supabase.from('obras').select('id', { count: 'exact', head: true }).eq('cliente_id', id).is('deleted_at', null),
      supabase.from('obra_contatos').select('id', { count: 'exact', head: true }).eq('cliente_id', id),
    ])
    const out: ImpactEntry[] = []
    if ((obras.count || 0) > 0)    out.push({ label: 'Obras do cliente', count: obras.count || 0, tabela: 'obras', pagina: '/obras', severidade: 'warn' })
    if ((contatos.count || 0) > 0) out.push({ label: 'Contatos cadastrados', count: contatos.count || 0, tabela: 'obra_contatos', severidade: 'info' })
    return out
  },

  tipo_contrato: async (supabase, id) => {
    const [obras] = await Promise.all([
      supabase.from('obras').select('id', { count: 'exact', head: true }).eq('tipo_contrato_id', id).is('deleted_at', null),
    ])
    const out: ImpactEntry[] = []
    if ((obras.count || 0) > 0) out.push({ label: 'Obras usando este tipo', count: obras.count || 0, tabela: 'obras', pagina: '/obras', severidade: 'warn' })
    return out
  },

  categoria_financeira: async (supabase, id) => {
    const [lanc] = await Promise.all([
      supabase.from('financeiro_lancamentos').select('id', { count: 'exact', head: true }).eq('categoria_id', id).is('deleted_at', null),
    ])
    const out: ImpactEntry[] = []
    if ((lanc.count || 0) > 0) out.push({ label: 'Lançamentos financeiros', count: lanc.count || 0, tabela: 'financeiro_lancamentos', pagina: '/financeiro', severidade: 'warn' })
    return out
  },

  bm: async (supabase, id) => {
    const [itens, docs, bm] = await Promise.all([
      supabase.from('bm_itens').select('id', { count: 'exact', head: true }).eq('boletim_id', id),
      supabase.from('bm_documentos').select('id', { count: 'exact', head: true }).eq('bm_id', id),
      supabase.from('boletins_medicao').select('status, obra_id, valor_aprovado').eq('id', id).maybeSingle(),
    ])
    const out: ImpactEntry[] = []
    if ((itens.count || 0) > 0) out.push({ label: 'Linhas de medição', count: itens.count || 0, tabela: 'bm_itens', severidade: 'warn' })
    if ((docs.count || 0) > 0)  out.push({ label: 'Documentos anexados', count: docs.count || 0, tabela: 'bm_documentos', severidade: 'info' })
    if (bm.data?.status === 'aprovado' || bm.data?.status === 'enviado') {
      out.push({ label: `BM ${bm.data.status}`, count: 1, tabela: 'boletins_medicao', severidade: 'critico', detalhes: `Afeta DRE mês a mês, forecast e comparativo orçado × real. Valor: R$ ${Number(bm.data.valor_aprovado || 0).toLocaleString('pt-BR')}` })
    }
    return out
  },

  folha: async (supabase, id) => {
    const [itens, lanc] = await Promise.all([
      supabase.from('folha_itens').select('id', { count: 'exact', head: true }).eq('folha_id', id),
      supabase.from('financeiro_lancamentos').select('id', { count: 'exact', head: true }).ilike('observacao', `%${id}%`).eq('origem', 'folha_fechamento').is('deleted_at', null),
    ])
    const out: ImpactEntry[] = []
    if ((itens.count || 0) > 0) out.push({ label: 'Itens de folha (funcionários)', count: itens.count || 0, tabela: 'folha_itens', severidade: 'critico', detalhes: 'Serão descartados ao reverter o fechamento.' })
    if ((lanc.count || 0) > 0)  out.push({ label: 'Lançamentos no financeiro gerados', count: lanc.count || 0, tabela: 'financeiro_lancamentos', pagina: '/financeiro', severidade: 'critico', detalhes: 'Serão soft-deletados junto com o fechamento.' })
    return out
  },
}

function correcoes_count(n: any): number { return Number(n || 0) }

/**
 * Calcula o impacto de editar/deletar um registro.
 * @param supabase Cliente Supabase
 * @param entity Nome lógico ('funcao', 'funcionario', 'obra', 'cliente'...)
 * @param id UUID do registro
 */
export async function calcularImpacto(
  supabase: SupabaseClient,
  entity: string,
  id: string,
): Promise<ImpactEntry[]> {
  const fn = RULES[entity]
  if (!fn) return []
  try {
    return await fn(supabase, id)
  } catch (e) {
    console.error('Impact calculation failed:', e)
    return []
  }
}
