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

/* Dropdown options */
const TAMANHOS_BOTA = Array.from({ length: 48 - 33 + 1 }, (_, i) => String(33 + i))
const TAMANHOS_UNIFORME = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG']
const CORES_CAPACETE = ['Branco', 'Amarelo', 'Laranja', 'Azul', 'Vermelho']

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

  /* Form fields — salvos em etapa_uniforme jsonb */
  const [tamanhoBota, setTamanhoBota] = useState<string>('')
  const [tamanhoUniforme, setTamanhoUniforme] = useState<string>('')
  const [qtdCamisas, setQtdCamisas] = useState<number>(2)
  const [qtdCalcas, setQtdCalcas] = useState<number>(2)
  const [qtdBones, setQtdBones] = useState<number>(1)
  const [capaceteCor, setCapaceteCor] = useState<string>('Branco')

  useEffect(() => { loadEstoque() }, [])

  /* Pré-preencher com tamanhos vindos da etapa 2 */
  useEffect(() => {
    if (funcionario?.tamanho_uniforme) setTamanhoUniforme(String(funcionario.tamanho_uniforme))
    if (funcionario?.tamanho_bota) setTamanhoBota(String(funcionario.tamanho_bota))
  }, [funcionario?.tamanho_uniforme, funcionario?.tamanho_bota])

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
        tamanho: funcionario?.tamanho_uniforme || '',
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
    if (!dataEntrega) {
      toast.warning('Informe a data de entrega.')
      return
    }
    if (!tamanhoUniforme) {
      toast.warning('Selecione o tamanho do uniforme.')
      return
    }
    if (!tamanhoBota) {
      toast.warning('Selecione o tamanho da bota.')
      return
    }

    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const email = user?.email ?? 'sistema'

      // Insert requisicao (quando houver itens no estoque)
      const itensJson = itens.map(i => ({
        item_id: i.item_id,
        nome: i.nome,
        tamanho: i.tamanho,
        qtd: i.qtd,
      }))

      if (itens.length > 0) {
        await supabase.from('estoque_requisicoes').insert({
          funcionario_id: funcionario.id,
          tipo: 'uniforme',
          data_entrega: dataEntrega,
          responsavel,
          itens: itensJson,
          workflow_id: workflowId,
          created_by: user?.id,
        })
      }

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

      // Update workflow — etapa_uniforme jsonb carrega os campos do formulário
      await supabase.from('admissoes_workflow').update({
        etapa_uniforme: {
          ok: true,
          data: new Date().toISOString().split('T')[0],
          por: email,
          total_itens: itens.length,
          tamanho_bota: tamanhoBota,
          tamanho_uniforme: tamanhoUniforme,
          qtd_camisas: qtdCamisas,
          qtd_calcas: qtdCalcas,
          qtd_bones: qtdBones,
          capacete_cor: capaceteCor,
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
          <span className="font-medium">Tamanhos do funcionário:</span>{' '}
          Uniforme <strong>{funcionario?.tamanho_uniforme || '—'}</strong> &middot; Bota <strong>{funcionario?.tamanho_bota || '—'}</strong>
        </div>
      </div>

      {/* Data + Responsável */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Data de entrega</label>
          <input type="date" value={dataEntrega} onChange={e => setDataEntrega(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Responsável</label>
          <input type="text" value={responsavel} onChange={e => setResponsavel(e.target.value)} className={inputCls} placeholder="Nome do responsável" />
        </div>
      </div>

      {/* Kit padrão — tamanhos e quantidades */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Kit do colaborador</p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Tamanho uniforme</label>
            <select
              value={tamanhoUniforme}
              onChange={e => setTamanhoUniforme(e.target.value)}
              className={inputCls}
            >
              <option value="">Selecione...</option>
              {TAMANHOS_UNIFORME.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Tamanho bota</label>
            <select
              value={tamanhoBota}
              onChange={e => setTamanhoBota(e.target.value)}
              className={inputCls}
            >
              <option value="">Selecione...</option>
              {TAMANHOS_BOTA.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Cor do capacete</label>
            <select
              value={capaceteCor}
              onChange={e => setCapaceteCor(e.target.value)}
              className={inputCls}
            >
              {CORES_CAPACETE.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Qtd. camisas</label>
            <input
              type="number"
              min={0}
              value={qtdCamisas}
              onChange={e => setQtdCamisas(Math.max(0, Number(e.target.value) || 0))}
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Qtd. calças</label>
            <input
              type="number"
              min={0}
              value={qtdCalcas}
              onChange={e => setQtdCalcas(Math.max(0, Number(e.target.value) || 0))}
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Qtd. bonés</label>
            <input
              type="number"
              min={0}
              value={qtdBones}
              onChange={e => setQtdBones(Math.max(0, Number(e.target.value) || 0))}
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {/* Items table (opcional — itens do estoque) */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Itens do estoque (opcional)</p>

        {itens.length > 0 && (
          <div className="grid grid-cols-[1fr_100px_60px_36px] gap-2 px-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase">Item</span>
            <span className="text-[10px] font-bold text-gray-400 uppercase">Tamanho</span>
            <span className="text-[10px] font-bold text-gray-400 uppercase">QTD</span>
            <span />
          </div>
        )}

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
        disabled={saving}
        className="w-full px-5 py-2.5 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50 transition-colors"
      >
        {saving ? 'Salvando...' : 'Confirmar uniforme'}
      </button>
    </div>
  )
}
