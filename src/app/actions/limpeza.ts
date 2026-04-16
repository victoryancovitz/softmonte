'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

export type LimpezaResult = {
  success: boolean
  error?: string
  deletados?: number
}

async function checkRole(): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Não autenticado.' }
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('user_id', user.id).maybeSingle()
  if (!profile || !['admin', 'diretoria'].includes((profile as any).role)) {
    return { ok: false, error: 'Apenas admin ou diretoria podem limpar dados.' }
  }
  return { ok: true }
}

async function countRows(table: string): Promise<number> {
  const supabase = createClient()
  try {
    const { count } = await supabase.from(table).select('*', { count: 'exact', head: true })
    return count ?? 0
  } catch { return 0 }
}

async function deleteAllFrom(tables: string[]): Promise<number> {
  const supabase = createClient()
  let total = 0
  for (const t of tables) {
    try {
      const before = await countRows(t)
      if (before === 0) continue
      const { error } = await supabase.from(t).delete().neq('id', '00000000-0000-0000-0000-000000000000')
      if (!error) total += before
    } catch { /* ignora tabela inexistente */ }
  }
  return total
}

export async function contagens(): Promise<Record<string, number>> {
  const tabelas = [
    'notificacoes', 'ponto_registros', 'ponto_marcacoes', 'ponto_dia_status',
    'audit_log', 'email_logs', 'financeiro_lancamentos', 'boletins_medicao',
    'forecast_contrato', 'folha_fechamentos', 'folha_itens', 'banco_horas',
    'ferias', 'faltas', 'admissoes_workflow', 'desligamentos_workflow',
    'rescisoes', 'diario_obra', 'funcionarios', 'alocacoes',
    'obras', 'clientes', 'estoque_itens', 'estoque_lotes', 'fornecedores',
  ]
  const result: Record<string, number> = {}
  for (const t of tabelas) result[t] = await countRows(t)
  return result
}

export async function limparNotificacoes(): Promise<LimpezaResult> {
  const r = await checkRole(); if (!r.ok) return { success: false, error: r.error }
  const n = await deleteAllFrom(['notificacoes'])
  revalidatePath('/', 'layout')
  return { success: true, deletados: n }
}

export async function limparPonto(): Promise<LimpezaResult> {
  const r = await checkRole(); if (!r.ok) return { success: false, error: r.error }
  const n = await deleteAllFrom([
    'ponto_dia_status', 'ponto_marcacoes', 'ponto_registros',
    'ponto_fechamentos', 'ponto_sync_log',
  ])
  revalidatePath('/', 'layout')
  return { success: true, deletados: n }
}

export async function limparAuditoria(): Promise<LimpezaResult> {
  const r = await checkRole(); if (!r.ok) return { success: false, error: r.error }
  const n = await deleteAllFrom(['audit_log', 'email_logs'])
  revalidatePath('/', 'layout')
  return { success: true, deletados: n }
}

export async function limparFinanceiro(): Promise<LimpezaResult> {
  const r = await checkRole(); if (!r.ok) return { success: false, error: r.error }
  const n = await deleteAllFrom([
    'folha_itens', 'folha_fechamentos',
    'bm_documentos', 'bm_itens', 'boletins_medicao',
    'forecast_contrato', 'financeiro_lancamentos',
    'hh_lancamentos', 'efetivo_diario',
  ])
  revalidatePath('/', 'layout')
  return { success: true, deletados: n }
}

export async function limparBancoHorasFerias(): Promise<LimpezaResult> {
  const r = await checkRole(); if (!r.ok) return { success: false, error: r.error }
  const n = await deleteAllFrom(['banco_horas', 'ferias', 'faltas'])
  revalidatePath('/', 'layout')
  return { success: true, deletados: n }
}

export async function limparWorkflows(): Promise<LimpezaResult> {
  const r = await checkRole(); if (!r.ok) return { success: false, error: r.error }
  const n = await deleteAllFrom(['rescisoes', 'desligamentos_workflow', 'admissoes_workflow', 'admissao_overrides'])
  revalidatePath('/', 'layout')
  return { success: true, deletados: n }
}

export async function limparDiario(): Promise<LimpezaResult> {
  const r = await checkRole(); if (!r.ok) return { success: false, error: r.error }
  const n = await deleteAllFrom([
    'diario_ocorrencias', 'diario_historico',
    'diario_fotos', 'diario_equipamentos', 'diario_atividades',
    'diario_clima', 'diario_efetivo', 'diario_obra',
  ])
  revalidatePath('/', 'layout')
  return { success: true, deletados: n }
}

export async function limparFuncionarios(): Promise<LimpezaResult> {
  const r = await checkRole(); if (!r.ok) return { success: false, error: r.error }
  // Bloquear se ainda houver dependências críticas
  const pontoCount = await countRows('ponto_registros')
  const admCount = await countRows('admissoes_workflow')
  if (pontoCount > 0) return { success: false, error: `Limpe ponto antes (${pontoCount} registros restantes)` }
  if (admCount > 0) return { success: false, error: `Limpe admissões antes (${admCount} restantes)` }
  const supabase = createClient()
  try { await supabase.from('profiles').update({ funcionario_id: null }).not('funcionario_id', 'is', null) } catch {}
  const n = await deleteAllFrom([
    'fichas_epi', 'documentos_gerados', 'documentos',
    'treinamentos_funcionarios', 'correcoes_salariais',
    'funcionario_historico_salarial', 'pagamentos_extras',
    'vinculos_funcionario', 'provisoes_funcionario',
    'transferencias', 'alocacoes', 'funcionarios',
  ])
  revalidatePath('/', 'layout')
  return { success: true, deletados: n }
}

export async function limparObras(): Promise<LimpezaResult> {
  const r = await checkRole(); if (!r.ok) return { success: false, error: r.error }
  const funcCount = await countRows('funcionarios')
  const finCount = await countRows('financeiro_lancamentos')
  if (funcCount > 0) return { success: false, error: `Limpe funcionários antes (${funcCount} restantes)` }
  if (finCount > 0) return { success: false, error: `Limpe financeiro antes (${finCount} restantes)` }
  const n = await deleteAllFrom([
    'aditivos', 'contrato_composicao',
    'cronograma_etapas', 'obra_documentos', 'obra_contatos',
    'rnc', 'obras', 'clientes',
  ])
  revalidatePath('/', 'layout')
  return { success: true, deletados: n }
}

export async function limparEstoque(): Promise<LimpezaResult> {
  const r = await checkRole(); if (!r.ok) return { success: false, error: r.error }
  const n = await deleteAllFrom([
    'estoque_movimentacoes', 'estoque_requisicao_itens',
    'estoque_requisicoes', 'estoque_lotes', 'estoque_itens',
    'fornecedores', 'cotacoes', 'requisicoes',
  ])
  revalidatePath('/', 'layout')
  return { success: true, deletados: n }
}
