'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { Plus, Trash2, Shirt } from 'lucide-react'

/* ─── Types ─── */

interface UniformeItem {
  id: string
  item_id: string | null
  nome: string
  tamanho: string
  qtd: number
}

interface Props {
  funcionario: any
  workflowId: string
  onComplete: () => void
}

const inputCls = 'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand'

let idCounter = 0
function genId() { return `u_${++idCounter}_${Date.now()}` }

export default function WizardStep7Uniforme({ funcionario, workflowId, onComplete }: Props) {
  const supabase = createClient()
  const toast = useToast()

  const [itens, setItens] = useState<UniformeItem[]>([])
  const [estoqueItens, setEstoqueItens] = useState<any[]>([])
  const [dataEntrega, setDataEntrega] = useState(new Date().toISOString().split('T')[0])
  const [responsavel, setResponsavel] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadEstoque() }, [])

  async function loadEstoque() {
    setLoading(true)
    const { data } = await supabase
      .from('estoque_itens')
      .select('*')
      .eq('categoria', 'uniforme')
      .order('nome')

    const items = data ?? []
    setEstoqueItens(items)

    // Pre-fill with available items
    if (items.length > 0) {
      setItens(items.map((it: any) => ({
        id: genId(),
        item_id: it.id,
        nome: it.nome || '',
        tamanho: funcionario.tamanho_uniforme || '',
        qtd: 1,
      })))
    }
    setLoading(false)
  }

  function addItem() {
    setItens(prev => [...prev, { id: genId(), item_id: null, nome: '', tamanho: '', qtd: 1 }])
  }

  function removeItem(id: string) {
    setItens(prev => prev.filter(i => i.id !== id))
  }

  function updateItem(id: string, field: keyof UniformeItem, value: string | number | null) {
    setItens(prev => prev.map(i => {
      if (i.id !== id) return i
      const updated = { ...i, [field]: value }
      // When selecting from estoque, fill name
      if (field === 'item_id' && value) {
        const est = estoqueItens.find(e => e.id === value)
        if (est) updated.nome = est.nome
      }
      return updated
    }))
  }

  async function handleSave() {
    if (itens.length === 0) {
      toast.warning('Adicione pelo menos um item de uniforme.')
      return
    }
    if (!dataEntrega) {
      toast.warning('Informe a data de entrega.')
      return
    }

    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const email = user?.email ?? 'sistema'

      // Insert requisicao
      const itensJson = itens.map(i => ({
        item_id: i.item_id,
        nome: i.nome,
        tamanho: i.tamanho,
        qtd: i.qtd,
      }))

      await supabase.from('estoque_requisicoes').insert({
        funcionario_id: funcionario.id,
        tipo: 'uniforme',
        data_entrega: dataEntrega,
        responsavel,
        itens: itensJson,
        workflow_id: workflowId,
        created_by: user?.id,
      })

      // Update custo_uniforme on funcionarios (sum of items * qty as placeholder)
      const custoTotal = itens.reduce((sum, i) => {
        const est = estoqueItens.find(e => e.id === i.item_id)
        return sum + (est?.custo_unitario ? Number(est.custo_unitario) * i.qtd : 0)
      }, 0)

      if (custoTotal > 0) {
        await supabase.from('funcionarios').update({
          custo_uniforme: custoTotal,
        }).eq('id', funcionario.id)
      }

      // Update workflow
      await supabase.from('admissoes_workflow').update({
        etapa_uniforme: {
          ok: true,
          data: new Date().toISOString().split('T')[0],
          por: email,
          total_itens: itens.length,
        },
        updated_at: new Date().toISOString(),
      }).eq('id', workflowId)

      toast.success('Uniforme registrado!')
      onComplete()
    } catch {
      toast.error('Erro ao salvar uniforme')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="py-12 text-center text-sm text-gray-400">Carregando itens de uniforme...</div>
  }

  return (
    <div className="space-y-4">
      {/* Reference sizes */}
      <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 flex items-center gap-3">
        <Shirt className="w-5 h-5 text-blue-600 flex-shrink-0" />
        <div className="text-sm text-blue-800">
          <span className="font-medium">Tamanhos do funcionario:</span>{' '}
          Uniforme <strong>{funcionario.tamanho_uniforme || '—'}</strong> &middot; Bota <strong>{funcionario.tamanho_bota || '—'}</strong>
        </div>
      </div>

      {/* Data + Responsavel */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Data de entrega</label>
          <input type="date" value={dataEntrega} onChange={e => setDataEntrega(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Responsavel</label>
          <input type="text" value={responsavel} onChange={e => setResponsavel(e.target.value)} className={inputCls} placeholder="Nome do responsavel" />
        </div>
      </div>

      {/* Items table */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Itens de Uniforme</p>

        <div className="grid grid-cols-[1fr_100px_60px_36px] gap-2 px-2">
          <span className="text-[10px] font-bold text-gray-400 uppercase">Item</span>
          <span className="text-[10px] font-bold text-gray-400 uppercase">Tamanho</span>
          <span className="text-[10px] font-bold text-gray-400 uppercase">QTD</span>
          <span />
        </div>

        <div className="space-y-1.5 max-h-60 overflow-y-auto">
          {itens.map(item => (
            <div key={item.id} className="grid grid-cols-[1fr_100px_60px_36px] gap-2 items-center">
              {estoqueItens.length > 0 ? (
                <select
                  value={item.item_id || ''}
                  onChange={e => updateItem(item.id, 'item_id', e.target.value || null)}
                  className="px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-white"
                >
                  <option value="">Selecionar item...</option>
                  {estoqueItens.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                </select>
              ) : (
                <input
                  type="text"
                  value={item.nome}
                  onChange={e => updateItem(item.id, 'nome', e.target.value)}
                  className="px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder="Nome do item"
                />
              )}
              <input
                type="text"
                value={item.tamanho}
                onChange={e => updateItem(item.id, 'tamanho', e.target.value)}
                className="px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                placeholder="M, G..."
              />
              <input
                type="number"
                min={1}
                value={item.qtd}
                onChange={e => updateItem(item.id, 'qtd', Number(e.target.value) || 1)}
                className="px-2 py-2 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand"
              />
              <button onClick={() => removeItem(item.id)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <button onClick={addItem} className="flex items-center gap-1.5 text-sm font-medium text-brand hover:text-brand-dark transition-colors">
          <Plus className="w-4 h-4" /> Adicionar item
        </button>
      </div>

      {/* Submit */}
      <button
        onClick={handleSave}
        disabled={itens.length === 0 || saving}
        className="w-full px-5 py-2.5 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50 transition-colors"
      >
        {saving ? 'Salvando...' : `Confirmar ${itens.length} itens de uniforme`}
      </button>
    </div>
  )
}
