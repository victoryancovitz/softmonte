import { SupabaseClient } from '@supabase/supabase-js'

export async function gerarParcelasAcordo(supabase: SupabaseClient, acordoId: string) {
  const { data: acordo } = await supabase
    .from('processo_acordos')
    .select('*, processos_juridicos:processo_id(id, centro_custo_id, parte_contraria, numero_cnj)')
    .eq('id', acordoId)
    .single()

  if (!acordo) throw new Error('Acordo não encontrado')

  const processo = (acordo as any).processos_juridicos
  const valorParcela = Math.floor((acordo.valor_total * 100) / acordo.numero_parcelas) / 100
  const resto = Number((acordo.valor_total - valorParcela * acordo.numero_parcelas).toFixed(2))
  const grupoId = acordo.parcela_grupo_id || crypto.randomUUID()

  const parcelas = []
  const base = new Date(acordo.primeira_parcela + 'T12:00:00')
  for (let i = 0; i < acordo.numero_parcelas; i++) {
    const data = new Date(base)
    data.setDate(base.getDate() + i * acordo.intervalo_dias)
    parcelas.push({
      nome: `Acordo — ${processo.parte_contraria} (${i + 1}/${acordo.numero_parcelas})`,
      tipo: 'despesa',
      valor: i === 0 ? valorParcela + resto : valorParcela,
      data_competencia: data.toISOString().split('T')[0],
      data_vencimento: data.toISOString().split('T')[0],
      status: 'em_aberto',
      categoria: 'Acordos Judiciais',
      centro_custo_id: processo.centro_custo_id,
      processo_juridico_id: processo.id,
      parcela_grupo_id: grupoId,
      parcela_numero: i + 1,
      parcela_total: acordo.numero_parcelas,
      is_parcelado: true,
      origem: 'juridico_acordo',
      observacao: processo.numero_cnj ? `Processo ${processo.numero_cnj}` : null,
    })
  }

  const { error } = await supabase.from('financeiro_lancamentos').insert(parcelas)
  if (error) throw error

  // Update acordo with parcela_grupo_id if not set
  if (!acordo.parcela_grupo_id) {
    await supabase.from('processo_acordos').update({ parcela_grupo_id: grupoId }).eq('id', acordoId)
  }

  return parcelas.length
}
