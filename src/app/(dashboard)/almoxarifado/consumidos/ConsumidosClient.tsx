'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { processarSaidaFIFO } from '@/lib/estoque'
import EmptyState from '@/components/ui/EmptyState'
import { ClipboardList, Plus, Trash2 } from 'lucide-react'
import { fmt } from '@/lib/cores'

interface LinhaItem {
  item_id: string
  quantidade: string
}

export default function ConsumidosClient({ requisicoes, itens, obras, funcionarios }: { requisicoes: any[]; itens: any[]; obras: any[]; funcionarios: any[] }) {
  const supabase = createClient()
  const toast = useToast()
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [obraId, setObraId] = useState('')
  const [funcionarioId, setFuncionarioId] = useState('')
  const [observacao, setObservacao] = useState('')
  const [linhas, setLinhas] = useState<LinhaItem[]>([{ item_id: '', quantidade: '' }])

  function addLinha() {
    setLinhas(l => [...l, { item_id: '', quantidade: '' }])
  }

  function removeLinha(idx: number) {
    setLinhas(l => l.length <= 1 ? l : l.filter((_, i) => i !== idx))
  }

  function updateLinha(idx: number, field: keyof LinhaItem, value: string) {
    setLinhas(l => l.map((row, i) => i === idx ? { ...row, [field]: value } : row))
  }

  function resetForm() {
    setObraId(''); setFuncionarioId(''); setObservacao('')
    setLinhas([{ item_id: '', quantidade: '' }])
  }

  async function salvarRequisicao() {
    if (!obraId || !funcionarioId) { toast.error('Selecione obra e solicitante'); return }
    const linhasValidas = linhas.filter(l => l.item_id && Number(l.quantidade) > 0)
    if (linhasValidas.length === 0) { toast.error('Adicione pelo menos um item com quantidade'); return }

    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      // Process FIFO for each item
      let custoTotalGeral = 0
      const resultados: Array<{ item_id: string; quantidade: number; custo_unitario: number; custo_total: number }> = []

      for (const linha of linhasValidas) {
        const qtd = Number(linha.quantidade)
        const resultado = await processarSaidaFIFO(supabase, linha.item_id, qtd)
        if (!resultado.sucesso) {
          const itemNome = itens.find(i => i.id === linha.item_id)?.nome || 'Item'
          toast.error(`Erro no item "${itemNome}": ${resultado.erro}`)
          setSaving(false)
          return
        }
        custoTotalGeral += resultado.custo_total
        resultados.push({
          item_id: linha.item_id,
          quantidade: qtd,
          custo_unitario: resultado.custo_medio,
          custo_total: resultado.custo_total,
        })
      }

      // Generate numero REQ-XXXXX
      const { count } = await supabase.from('estoque_requisicoes').select('*', { count: 'exact', head: true })
      const numero = `REQ-${String((count || 0) + 1).padStart(5, '0')}`

      // Create requisição
      const { data: req } = await supabase.from('estoque_requisicoes').insert({
        obra_id: obraId,
        funcionario_id: funcionarioId,
        data_requisicao: new Date().toISOString().slice(0, 10),
        status: 'entregue',
        custo_total: Math.round(custoTotalGeral * 100) / 100,
        observacao: observacao || null,
        numero,
        created_by: user?.id,
      }).select().single()

      // Create requisição items
      if (req) {
        for (const r of resultados) {
          await supabase.from('estoque_requisicao_itens').insert({
            requisicao_id: req.id,
            item_id: r.item_id,
            quantidade: r.quantidade,
            custo_unitario: r.custo_unitario,
            custo_total: r.custo_total,
          })
        }
      }

      // Update estoque_itens quantity
      for (const r of resultados) {
        const item = itens.find(i => i.id === r.item_id)
        const novaQtd = Math.max(0, Number(item?.quantidade || 0) - r.quantidade)
        await supabase.from('estoque_itens').update({ quantidade: novaQtd }).eq('id', r.item_id)
      }

      // Create financeiro_lancamento
      const obraNome = obras.find(o => o.id === obraId)?.nome || 'Obra'
      await supabase.from('financeiro_lancamentos').insert({
        tipo: 'despesa',
        nome: `Consumo estoque — ${obraNome}`,
        categoria: 'Custo dos Serviços Prestados',
        valor: Math.round(custoTotalGeral * 100) / 100,
        status: 'pago',
        data_competencia: new Date().toISOString().slice(0, 10),
        data_pagamento: new Date().toISOString().slice(0, 10),
        origem: 'manual',
        is_provisao: false,
        created_by: user?.id,
      })

      toast.success(`Requisição ${numero} registrada! Custo total: ${fmt(custoTotalGeral)}`)
      setShowModal(false)
      resetForm()
    } catch (err: any) {
      toast.error('Erro ao salvar requisição: ' + (err?.message || 'Tente novamente'))
    } finally {
      setSaving(false)
    }
  }

  // Preview total
  const previewTotal = linhas.reduce((s, l) => {
    if (!l.item_id || !l.quantidade) return s
    const item = itens.find(i => i.id === l.item_id)
    return s + Number(l.quantidade) * Number(item?.custo_medio_atual || 0)
  }, 0)

  return (
    <>
      <div className="flex justify-end mb-4">
        <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark">+ Requisição de Material</button>
      </div>

      {/* Modal Requisição */}
      {showModal && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
          <h3 className="text-sm font-bold text-brand mb-4">Nova Requisição de Material (Saída FIFO)</h3>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Obra *</label>
              <select value={obraId} onChange={e => setObraId(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                <option value="">Selecionar obra...</option>
                {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Solicitante *</label>
              <select value={funcionarioId} onChange={e => setFuncionarioId(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                <option value="">Selecionar funcionário...</option>
                {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </div>
          </div>

          {/* Item rows */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-500">Itens da Requisição *</label>
              <button onClick={addLinha} className="flex items-center gap-1 text-xs text-brand font-medium hover:text-brand-dark">
                <Plus className="w-3.5 h-3.5" /> Adicionar item
              </button>
            </div>
            <div className="space-y-2">
              {linhas.map((linha, idx) => (
                <div key={idx} className="flex gap-2 items-end">
                  <div className="flex-1">
                    {idx === 0 && <label className="block text-[10px] text-gray-400 mb-0.5">Item</label>}
                    <select value={linha.item_id} onChange={e => updateLinha(idx, 'item_id', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                      <option value="">Selecionar item...</option>
                      {itens.map(i => (
                        <option key={i.id} value={i.id}>{i.nome} — disp: {Number(i.quantidade || 0)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-28">
                    {idx === 0 && <label className="block text-[10px] text-gray-400 mb-0.5">Qtd</label>}
                    <input type="number" step="0.001" min="0" value={linha.quantidade} onChange={e => updateLinha(idx, 'quantidade', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="0" />
                  </div>
                  <button onClick={() => removeLinha(idx)} className="p-2 text-gray-400 hover:text-red-500" title="Remover">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Observação</label>
            <textarea value={observacao} onChange={e => setObservacao(e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Observação opcional..." />
          </div>

          {previewTotal > 0 && (
            <div className="bg-amber-50 rounded-lg p-2 mb-3 text-xs text-amber-700">
              Custo estimado (custo médio): {fmt(previewTotal)} — o custo real será calculado pelo FIFO dos lotes.
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => { setShowModal(false); resetForm() }} className="px-4 py-2 border border-gray-200 rounded-lg text-sm">Cancelar</button>
            <button onClick={salvarRequisicao} disabled={saving} className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium disabled:opacity-50">{saving ? 'Processando FIFO...' : 'Registrar Requisição'}</button>
          </div>
        </div>
      )}

      {/* Tabela de Requisições */}
      {requisicoes.length === 0 ? (
        <EmptyState titulo="Nenhuma requisição" descricao="Registre saídas de material do almoxarifado vinculadas às obras." icone={<ClipboardList className="w-10 h-10" />} />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 border-b border-gray-100">
              {['Nº', 'Data', 'Solicitante', 'Obra', 'Custo Total', 'Status'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {requisicoes.map((r: any) => (
                <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{r.numero}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{r.data_requisicao ? new Date(r.data_requisicao + 'T12:00').toLocaleDateString('pt-BR') : '—'}</td>
                  <td className="px-4 py-3">{r.funcionarios?.nome || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{r.obras?.nome || '—'}</td>
                  <td className="px-4 py-3 font-semibold">{fmt(r.custo_total)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${r.status === 'entregue' ? 'bg-green-100 text-green-700' : r.status === 'aprovada' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
