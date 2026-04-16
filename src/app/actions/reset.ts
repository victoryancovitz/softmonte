'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

export type DeleteLog = {
  tabela: string
  deletados: number
  erro: string | null
}

export type ResetResult = {
  success: boolean
  error?: string
  log?: DeleteLog[]
  contagens_final?: Record<string, number>
}

// Tabelas agrupadas em ordem de apagado (filhos antes de pais)
// Comentários ao lado indicam o grupo.
const DELETE_ORDER: string[] = [
  // Grupo 1 — logs e notificações (sem dependências de dados)
  'ponto_dia_status',
  'ponto_sync_log',
  'ponto_marcacoes',
  'ponto_registros',
  'ponto_fechamentos',
  'ofx_transacoes',
  'ofx_imports',
  'email_logs',
  'notificacoes',
  'backup_snapshots',

  // Grupo 2 — diário de obra (todas as filhas antes de diario_obra)
  'diario_ocorrencias',
  'diario_historico',
  'diario_fotos',
  'diario_equipamentos',
  'diario_atividades',
  'diario_clima',
  'diario_efetivo',
  'diario_obra',

  // Grupo 3 — RH: holerites, folha, banco horas, férias, faltas
  'holerite_questionamentos',
  'holerite_assinaturas',
  'holerite_envios',
  'folha_itens',
  'folha_fechamentos',
  'banco_horas',
  'ferias',
  'faltas',
  'pagamentos_extras',
  'correcoes_salariais',
  'funcionario_historico_salarial',
  'provisoes_funcionario',
  'treinamentos_funcionarios',
  'fichas_epi',
  'documentos_gerados',
  'documentos',
  'vinculos_funcionario',
  'rescisoes',
  'desligamentos_workflow',
  'admissoes_workflow',
  'admissao_overrides',

  // Grupo 4 — BMs / financeiro / forecast / efetivo
  'bm_documentos',
  'bm_itens',
  'boletins_medicao',
  'hh_lancamentos',
  'efetivo_diario',
  'forecast_contrato',
  'transferencias',
  'financeiro_lancamentos',
  'divida_renegociacoes',
  'divida_parcelas',
  'passivos_nao_circulantes',
  'ativos_fixos',

  // Grupo 5 — obra: cronograma, documentos, aditivos, composição, alocações
  'cronograma_etapas',
  'obra_documentos',
  'obra_contatos',
  'aditivos',
  'contrato_composicao',
  'alocacoes',
  'rnc',

  // Grupo 6 — estoque / fornecedores / cotações
  'estoque_movimentacoes',
  'estoque_requisicao_itens',
  'estoque_requisicoes',
  'estoque_lotes',
  'estoque_itens',
  'requisicoes',
  'cotacoes',
  'fornecedores',

  // Grupo 7 — auditoria (por último porque pode ter logs dos deletes)
  'audit_log',

  // Grupo 8 — entidades principais (depois de tudo limpo)
  'funcionarios',
  'obras',
  'clientes',
  'contas_correntes',
]

async function countTable(supabase: any, table: string): Promise<number> {
  try {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
    if (error) return 0
    return count ?? 0
  } catch {
    return 0
  }
}

async function deleteAll(supabase: any, table: string): Promise<DeleteLog> {
  const before = await countTable(supabase, table)
  if (before === 0) return { tabela: table, deletados: 0, erro: null }

  try {
    // DELETE com filtro que bate em qualquer linha (neq com id impossível)
    const { error } = await supabase
      .from(table)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) return { tabela: table, deletados: 0, erro: error.message }
  } catch (e: any) {
    return { tabela: table, deletados: 0, erro: e?.message ?? 'erro desconhecido' }
  }

  const after = await countTable(supabase, table)
  return { tabela: table, deletados: Math.max(0, before - after), erro: null }
}

export async function resetTotal(confirmation: string): Promise<ResetResult> {
  // 1. Confirmation
  if (confirmation !== 'ZERAR SOFTMONTE') {
    return { success: false, error: 'Texto de confirmação inválido.' }
  }

  const supabase = createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return { success: false, error: 'Usuário não autenticado.' }
  }

  // 2. Role check via user_id (padrão Softmonte)
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, nome')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!profile || !['admin', 'diretoria'].includes((profile as any).role)) {
    return { success: false, error: 'Apenas admin ou diretoria podem executar o reset total.' }
  }

  // 3. Nullify FKs circulares ANTES de qualquer delete
  try {
    await supabase.from('profiles').update({ funcionario_id: null }).not('funcionario_id', 'is', null)
  } catch {}
  try {
    await supabase.from('contas_correntes').update({ socio_id: null }).not('socio_id', 'is', null)
  } catch {}

  // 4. Executar deletes em ordem
  const log: DeleteLog[] = []
  for (const table of DELETE_ORDER) {
    const result = await deleteAll(supabase, table)
    log.push(result)
  }

  // 5. Contagens finais das tabelas principais
  const contagens_final: Record<string, number> = {}
  for (const table of ['funcionarios', 'obras', 'clientes', 'admissoes_workflow', 'contrato_composicao', 'alocacoes', 'ponto_registros', 'diario_obra', 'boletins_medicao', 'financeiro_lancamentos']) {
    contagens_final[table] = await countTable(supabase, table)
  }

  // 6. Log final no audit (após apagar tudo, cria entrada nova)
  try {
    await supabase.from('audit_log').insert({
      acao: 'RESET_TOTAL',
      descricao: `Reset total executado por ${(profile as any).nome || user.email}`,
      usuario_id: user.id,
    })
  } catch {}

  revalidatePath('/', 'layout')

  return { success: true, log, contagens_final }
}
