import { createClient } from '@/lib/supabase-server'

export async function getEfetivoDashboard() {
  const supabase = createClient()
  const hoje = new Date().toISOString().split('T')[0]
  const trintaDiasAtras = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]

  // Get active obra IDs first
  const { data: obrasAtivas } = await supabase
    .from('obras')
    .select('id, nome')
    .eq('status', 'ativo')
    .is('deleted_at', null)
  const obraIds = (obrasAtivas ?? []).map(o => o.id)

  const [alocados, efetivoHoje, historico30d] = await Promise.all([
    // Expected: active allocations in active obras
    obraIds.length > 0
      ? supabase
          .from('alocacoes')
          .select('funcionario_id, obra_id, funcionarios(nome, funcao_id, funcoes(nome))')
          .eq('ativo', true)
          .in('obra_id', obraIds)
      : Promise.resolve({ data: [] }),
    // Today's efetivo
    supabase
      .from('efetivo_diario')
      .select('funcionario_id, obra_id, data, tipo_dia, horas_trabalhadas, entrada, saida, funcionarios(nome, funcao_id, funcoes(nome))')
      .eq('data', hoje),
    // Last 30 days
    supabase
      .from('efetivo_diario')
      .select('data, tipo_dia, horas_trabalhadas')
      .gte('data', trintaDiasAtras)
      .lte('data', hoje),
  ])

  return {
    hoje,
    obraIds,
    obrasAtivas: obrasAtivas ?? [],
    alocados: alocados.data ?? [],
    efetivoHoje: efetivoHoje.data ?? [],
    historico30d: historico30d.data ?? [],
  }
}
