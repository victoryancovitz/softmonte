'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

async function safeDelete(supabase: any, table: string) {
  try {
    await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
  } catch {} // table might not exist or be empty
}

async function safeUpdate(supabase: any, table: string, updates: Record<string, any>, filterCol: string) {
  try {
    await supabase.from(table).update(updates).neq(filterCol, '00000000-0000-0000-0000-000000000000')
  } catch {}
}

export async function resetTotal(confirmation: string): Promise<{ success?: boolean; error?: string }> {
  // 1. Validate confirmation string
  if (confirmation !== 'ZERAR SOFTMONTE') {
    return { error: 'Texto de confirmação inválido.' }
  }

  // 2. Check user role
  const supabase = createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return { error: 'Usuário não autenticado.' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, nome')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return { error: 'Apenas administradores podem executar o reset total.' }
  }

  // 3. Log the reset event
  try {
    await supabase.from('audit_log').insert({
      acao: 'RESET_TOTAL',
      descricao: `Reset total executado por ${profile.nome || user.email} em ${new Date().toISOString()}`,
      usuario_id: user.id,
    })
  } catch {} // audit_log might not exist

  // 4. Delete all tables in FK order (deepest children first)

  // Wave 1 — holerite / folha children
  await safeDelete(supabase, 'holerite_questionamentos')
  await safeDelete(supabase, 'holerite_assinaturas')
  await safeDelete(supabase, 'holerite_envios')
  await safeDelete(supabase, 'folha_itens')

  // Wave 2 — BM children
  await safeDelete(supabase, 'bm_documentos')
  await safeDelete(supabase, 'bm_itens')

  // Wave 3 — estoque children
  await safeDelete(supabase, 'estoque_requisicao_itens')
  await safeDelete(supabase, 'estoque_movimentacoes')

  // Wave 4 — financeiro children
  await safeDelete(supabase, 'ofx_transacoes')
  await safeDelete(supabase, 'divida_parcelas')
  await safeDelete(supabase, 'divida_renegociacoes')

  // Wave 5 — RH extras
  await safeDelete(supabase, 'pagamentos_extras')
  await safeDelete(supabase, 'rescisoes')

  // Wave 6 — ponto
  await safeDelete(supabase, 'ponto_marcacoes')
  await safeDelete(supabase, 'ponto_registros')
  await safeDelete(supabase, 'ponto_dia_status')
  await safeDelete(supabase, 'ponto_fechamentos')
  await safeDelete(supabase, 'ponto_sync_log')

  // Wave 7 — efetivo / banco horas / faltas
  await safeDelete(supabase, 'efetivo_diario')
  await safeDelete(supabase, 'banco_horas')
  await safeDelete(supabase, 'hh_lancamentos')
  await safeDelete(supabase, 'faltas')

  // Wave 8 — workflows
  await safeDelete(supabase, 'admissao_overrides')
  await safeDelete(supabase, 'admissoes_workflow')
  await safeDelete(supabase, 'desligamentos_workflow')

  // Wave 9 — documentos / treinamentos / ferias
  await safeDelete(supabase, 'treinamentos_funcionarios')
  await safeDelete(supabase, 'ferias')
  await safeDelete(supabase, 'documentos')
  await safeDelete(supabase, 'documentos_gerados')

  // Wave 10 — EPI / histórico salarial / provisões
  await safeDelete(supabase, 'fichas_epi')
  await safeDelete(supabase, 'funcionario_historico_salarial')
  await safeDelete(supabase, 'provisoes_funcionario')

  // Wave 11 — vínculos / transferências / correções
  await safeDelete(supabase, 'vinculos_funcionario')
  await safeDelete(supabase, 'transferencias')
  await safeDelete(supabase, 'correcoes_salariais')

  // Wave 12 — estoque parents
  await safeDelete(supabase, 'estoque_requisicoes')
  await safeDelete(supabase, 'estoque_lotes')
  await safeDelete(supabase, 'estoque_itens')

  // Wave 13 — folha / boletins
  await safeDelete(supabase, 'folha_fechamentos')
  await safeDelete(supabase, 'boletins_medicao')

  // Wave 14 — obra children
  await safeDelete(supabase, 'alocacoes')
  await safeDelete(supabase, 'diario_obra')
  await safeDelete(supabase, 'rnc')
  await safeDelete(supabase, 'cronograma_etapas')
  await safeDelete(supabase, 'forecast_contrato')

  // Wave 15 — contratos
  await safeDelete(supabase, 'contrato_composicao')
  await safeDelete(supabase, 'aditivos')

  // Wave 16 — financeiro parents
  await safeDelete(supabase, 'financeiro_lancamentos')
  await safeDelete(supabase, 'passivos_nao_circulantes')
  await safeDelete(supabase, 'ativos_fixos')

  // Wave 17 — OFX imports
  await safeDelete(supabase, 'ofx_imports')

  // Wave 18 — Nullify FK in profiles before deleting funcionarios
  await safeUpdate(supabase, 'profiles', { funcionario_id: null }, 'id')

  // Wave 19 — funcionarios
  await safeDelete(supabase, 'funcionarios')

  // Wave 20 — obras
  await safeDelete(supabase, 'obras')

  // Wave 21 — sócios (nullify FK in contas_correntes first)
  await safeUpdate(supabase, 'contas_correntes', { socio_id: null }, 'id')
  await safeDelete(supabase, 'socios')

  // Wave 22 — contas correntes
  await safeDelete(supabase, 'contas_correntes')

  // Wave 23 — clientes / fornecedores
  await safeDelete(supabase, 'clientes')
  await safeDelete(supabase, 'fornecedores')

  // Wave 24 — EPI kits / NR
  await safeDelete(supabase, 'epi_kits_funcao')
  await safeDelete(supabase, 'nr_obrigatorias_funcao')

  // Wave 25 — tipos contrato
  await safeDelete(supabase, 'tipos_contrato_composicao')
  await safeDelete(supabase, 'tipos_contrato')

  // Wave 26 — treinamentos / funções
  await safeDelete(supabase, 'treinamentos_tipos')
  await safeDelete(supabase, 'funcoes')

  // Wave 27 — notificações / audit
  await safeDelete(supabase, 'notificacoes')
  await safeDelete(supabase, 'audit_log')

  // 5. Revalidate everything
  revalidatePath('/', 'layout')

  return { success: true }
}
