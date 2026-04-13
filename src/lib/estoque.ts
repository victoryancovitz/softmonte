export async function processarSaidaFIFO(
  supabase: any, itemId: string, quantidade: number
): Promise<{ sucesso: boolean; custo_total: number; custo_medio: number; lotes: Array<{ lote_id: string; qtd: number; custo: number }>; erro?: string }> {
  const { data: lotes } = await supabase.from('estoque_lotes')
    .select('id, quantidade_disponivel, custo_unitario')
    .eq('item_id', itemId).eq('esgotado', false)
    .order('data_entrada', { ascending: true })

  if (!lotes || lotes.length === 0) return { sucesso: false, custo_total: 0, custo_medio: 0, lotes: [], erro: 'Sem estoque disponível' }

  let restante = quantidade, custoTotal = 0
  const usados: Array<{ lote_id: string; qtd: number; custo: number }> = []

  for (const l of lotes) {
    if (restante <= 0) break
    const usar = Math.min(restante, Number(l.quantidade_disponivel))
    custoTotal += usar * Number(l.custo_unitario)
    usados.push({ lote_id: l.id, qtd: usar, custo: Number(l.custo_unitario) })
    restante -= usar
    const novaQtd = Number(l.quantidade_disponivel) - usar
    await supabase.from('estoque_lotes').update({
      quantidade_disponivel: novaQtd, esgotado: novaQtd <= 0,
    }).eq('id', l.id)
  }

  if (restante > 0) return { sucesso: false, custo_total: 0, custo_medio: 0, lotes: [], erro: `Estoque insuficiente: faltam ${restante}` }

  const custoMedio = custoTotal / quantidade
  await supabase.from('estoque_itens').update({ custo_medio_atual: custoMedio, quantidade: supabase.rpc ? undefined : undefined }).eq('id', itemId)

  return { sucesso: true, custo_total: Math.round(custoTotal * 100) / 100, custo_medio: Math.round(custoMedio * 100) / 100, lotes: usados }
}
