'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Plus, X, ChevronDown, ChevronUp, Check, AlertTriangle, Trash2, ShoppingCart } from 'lucide-react'
import SearchInput from '@/components/SearchInput'
import { useToast } from '@/components/Toast'
import { confirmDialog } from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'

interface Obra {
  id: string
  nome: string
}

interface CotacaoItem {
  descricao: string
  quantidade: number
}

interface Cotacao {
  id: string
  numero: string
  obra_id: string | null
  descricao: string
  urgente: boolean
  status: string
  prazo_resposta: string | null
  fornecedores_convidados: any[] | null
  valor_aprovado: number | null
  fornecedor_escolhido: string | null
  motivo_escolha: string | null
  itens: CotacaoItem[] | null
  created_at: string
  obras?: { nome: string } | null
}

const STATUS_COLORS: Record<string, string> = {
  aberta: 'bg-blue-100 text-blue-700',
  em_analise: 'bg-yellow-100 text-yellow-700',
  aprovada: 'bg-green-100 text-green-700',
  cancelada: 'bg-gray-100 text-gray-500',
}

const STATUS_LABELS: Record<string, string> = {
  aberta: 'Aberta',
  em_analise: 'Em Cotação',
  aprovada: 'Aprovada',
  cancelada: 'Cancelada',
}

export default function CotacoesPage() {
  const supabase = createClient()
  const toast = useToast()
  const [cotacoes, setCotacoes] = useState<Cotacao[]>([])
  const [obras, setObras] = useState<Obra[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [approving, setApproving] = useState<string | null>(null)

  // Form state
  const [formObraId, setFormObraId] = useState('')
  const [formDescricao, setFormDescricao] = useState('')
  const [formUrgente, setFormUrgente] = useState(false)
  const [formPrazo, setFormPrazo] = useState('')
  const [formItens, setFormItens] = useState<CotacaoItem[]>([{ descricao: '', quantidade: 1 }])

  // Approve form state
  const [approveForm, setApproveForm] = useState({ fornecedor: '', valor: '', motivo: '' })
  const [busca, setBusca] = useState('')
  const [gerandoPedido, setGerandoPedido] = useState<string | null>(null)

  async function loadData() {
    setLoading(true)
    const [cotRes, obrasRes] = await Promise.all([
      supabase
        .from('cotacoes')
        .select('*, obras(nome)')
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      supabase.from('obras').select('id, nome').is('deleted_at', null).order('nome'),
    ])
    setCotacoes(cotRes.data ?? [])
    setObras(obrasRes.data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  // KPIs
  const now = new Date()
  const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const abertas = cotacoes.filter((c) => c.status === 'aberta').length
  const emCotacao = cotacoes.filter((c) => c.status === 'em_analise').length
  const aprovadasMes = cotacoes.filter(
    (c) => c.status === 'aprovada' && c.created_at?.startsWith(mesAtual)
  ).length

  function resetForm() {
    setFormObraId('')
    setFormDescricao('')
    setFormUrgente(false)
    setFormPrazo('')
    setFormItens([{ descricao: '', quantidade: 1 }])
  }

  async function handleSave() {
    if (!formDescricao.trim()) return
    if (!formObraId) { toast.error('Selecione uma obra'); return }
    const itensComDescricao = formItens.filter((it) => it.descricao.trim())
    if (itensComDescricao.length === 0) { toast.error('Adicione pelo menos um item com descrição'); return }
    setSaving(true)
    const numero = `COT-${Date.now().toString(36).toUpperCase()}`
    const { error } = await supabase.from('cotacoes').insert({
      numero,
      obra_id: formObraId || null,
      descricao: formDescricao,
      urgente: formUrgente,
      prazo_resposta: formPrazo || null,
      itens: formItens.filter((it) => it.descricao.trim()),
      status: 'aberta',
      fornecedores_convidados: [],
    })
    setSaving(false)
    if (error) { toast.error('Erro ao criar cotação: ' + error.message); return }
    toast.success('Cotação criada')
    resetForm()
    setShowForm(false)
    loadData()
  }

  async function handleApprove(cotacao: Cotacao) {
    if (!approveForm.fornecedor.trim() || !approveForm.valor) return
    setSaving(true)
    const { error } = await supabase
      .from('cotacoes')
      .update({
        status: 'aprovada',
        fornecedor_escolhido: approveForm.fornecedor,
        valor_aprovado: Number(approveForm.valor),
        motivo_escolha: approveForm.motivo || null,
      })
      .eq('id', cotacao.id)
    setSaving(false)
    if (error) { toast.error('Erro ao aprovar cotação: ' + error.message); return }
    setApproving(null)
    setApproveForm({ fornecedor: '', valor: '', motivo: '' })
    toast.success('Cotação aprovada')
    loadData()
  }

  async function handleDelete(cotacao: Cotacao) {
    if (!await confirmDialog({ title: 'Excluir cotação?', message: `Excluir cotação ${cotacao.numero}? Esta ação não pode ser desfeita.`, variant: 'danger', confirmLabel: 'Excluir' })) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error('Sessão expirada — faça login novamente'); return }
    const { error } = await supabase.from('cotacoes')
      .update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
      .eq('id', cotacao.id)
    if (error) { toast.error('Erro: ' + error.message); return }
    toast.success('Cotação excluída')
    loadData()
  }

  async function gerarPedido(cotacao: Cotacao) {
    // Check if already generated
    const { data: existing } = await supabase.from('requisicoes')
      .select('id').eq('observacao', `Gerado automaticamente da cotacao #${cotacao.numero}`).limit(1)
    if (existing && existing.length > 0) {
      toast.warning('Pedido já foi gerado para esta cotação.')
      return
    }
    setGerandoPedido(cotacao.id)
    const { data: { user } } = await supabase.auth.getUser()
    const { error: insertErr } = await supabase.from('requisicoes').insert({
      obra_id: cotacao.obra_id,
      itens: cotacao.itens ?? [],
      status: 'aprovado',
      observacao: `Gerado automaticamente da cotacao #${cotacao.numero}`,
      solicitante_id: user?.id ?? null,
    })
    if (insertErr) {
      toast.error('Erro ao gerar pedido: ' + insertErr.message)
      setGerandoPedido(null)
      return
    }
    toast.success('Pedido de compra gerado!', `Cotação ${cotacao.numero}`)
    setGerandoPedido(null)
    loadData()
  }

  function addItem() {
    setFormItens([...formItens, { descricao: '', quantidade: 1 }])
  }

  function removeItem(idx: number) {
    if (formItens.length <= 1) return
    setFormItens(formItens.filter((_, i) => i !== idx))
  }

  function updateItem(idx: number, field: keyof CotacaoItem, value: string | number) {
    const next = [...formItens]
    next[idx] = { ...next[idx], [field]: value }
    setFormItens(next)
  }

  const fmt = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h1 className="text-xl font-bold font-display text-brand">Cotações</h1>
        <button
          onClick={() => { setShowForm(!showForm); if (showForm) resetForm() }}
          className="inline-flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand/90 transition"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancelar' : 'Nova Cotação'}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
          <div className="text-2xl font-bold font-display text-blue-600">{abertas}</div>
          <div className="text-xs text-gray-500">Abertas</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
          <div className="text-2xl font-bold font-display text-yellow-600">{emCotacao}</div>
          <div className="text-xs text-gray-500">Em Cotação</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
          <div className="text-2xl font-bold font-display text-green-600">{aprovadasMes}</div>
          <div className="text-xs text-gray-500">Aprovadas (mês)</div>
        </div>
      </div>

      {/* New Cotação Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-5">
          <h2 className="text-sm font-bold text-gray-700 mb-4">Nova Cotação</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Obra</label>
              <select
                value={formObraId}
                onChange={(e) => setFormObraId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="">Selecione...</option>
                {obras.map((o) => (
                  <option key={o.id} value={o.id}>{o.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Prazo de Resposta</label>
              <input
                type="date"
                value={formPrazo}
                onChange={(e) => setFormPrazo(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Descrição *</label>
              <textarea
                value={formDescricao}
                onChange={(e) => setFormDescricao(e.target.value)}
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Descreva a necessidade..."
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formUrgente}
                  onChange={(e) => setFormUrgente(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-500"></div>
              </label>
              <span className="text-sm text-gray-600">Urgente</span>
            </div>
          </div>

          {/* Itens */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 mb-2">Itens</label>
            <div className="space-y-2">
              {formItens.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    value={item.descricao}
                    onChange={(e) => updateItem(idx, 'descricao', e.target.value)}
                    placeholder="Descrição do item"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    min={1}
                    value={item.quantidade}
                    onChange={(e) => updateItem(idx, 'quantidade', Number(e.target.value))}
                    className="w-20 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    placeholder="Qtd"
                  />
                  <button
                    onClick={() => removeItem(idx)}
                    disabled={formItens.length <= 1}
                    className="text-gray-400 hover:text-red-500 disabled:opacity-30"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={addItem}
              className="mt-2 text-xs text-brand font-medium hover:underline"
            >
              + Adicionar item
            </button>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving || !formDescricao.trim()}
              className="bg-brand text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-brand/90 transition disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Criar Cotação'}
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <SearchInput value={busca} onChange={setBusca} placeholder="Buscar cotação..." />
      </div>

      {/* List */}
      {(() => {
        const filteredCotacoes = cotacoes.filter(c => !busca || c.descricao?.toLowerCase().includes(busca.toLowerCase()) || c.obras?.nome?.toLowerCase().includes(busca.toLowerCase()) || c.numero?.toLowerCase().includes(busca.toLowerCase()))
        return loading ? (
        <p className="text-sm text-gray-400">Carregando...</p>
      ) : filteredCotacoes.length === 0 ? (
        <EmptyState titulo="Nenhuma cotação aberta" descricao="Crie uma cotação para iniciar o processo de compras." acao={{ label: 'Nova Cotação', href: '#' }} />
      ) : (
        <div className="space-y-3">
          {filteredCotacoes.map((c) => {
            const isExpanded = expandedId === c.id
            const convidados = Array.isArray(c.fornecedores_convidados) ? c.fornecedores_convidados : []
            const itens = Array.isArray(c.itens) ? c.itens : []
            return (
              <div key={c.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Row */}
                <div
                  className="p-4 flex flex-wrap items-center gap-3 cursor-pointer hover:bg-gray-50 transition"
                  onClick={() => setExpandedId(isExpanded ? null : c.id)}
                >
                  <span className="text-xs font-mono font-bold text-gray-400 w-28">{c.numero}</span>
                  <span className="text-sm text-gray-800 flex-1 min-w-[120px] truncate">{c.descricao}</span>
                  {c.obras?.nome && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{c.obras.nome}</span>
                  )}
                  {c.urgente && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                      <AlertTriangle size={10} /> Urgente
                    </span>
                  )}
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[c.status] ?? 'bg-gray-100 text-gray-500'}`}>
                    {STATUS_LABELS[c.status] ?? c.status}
                  </span>
                  {c.prazo_resposta && (
                    <span className="text-xs text-gray-400">
                      Prazo: {new Date(c.prazo_resposta + 'T12:00').toLocaleDateString('pt-BR')}
                    </span>
                  )}
                  <span className="text-xs text-gray-400">{convidados.length} fornec.</span>
                  {c.valor_aprovado != null && (
                    <span className="text-xs font-bold text-green-700">{fmt(c.valor_aprovado)}</span>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(c) }}
                    title="Excluir cotação"
                    className="text-gray-300 hover:text-red-600 p-1 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                  {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-gray-100 p-4 bg-gray-50">
                    {/* Itens */}
                    {itens.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-xs font-bold text-gray-500 mb-2">Itens</h4>
                        <div className="space-y-1">
                          {itens.map((it: any, i: number) => (
                            <div key={i} className="flex justify-between text-sm bg-white rounded-lg px-3 py-2 border border-gray-100">
                              <span className="text-gray-700">{it.descricao}</span>
                              <span className="text-gray-500 font-medium">Qtd: {it.quantidade}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Fornecedores convidados */}
                    {convidados.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-xs font-bold text-gray-500 mb-2">Fornecedores Convidados</h4>
                        <div className="space-y-1">
                          {convidados.map((fc: any, i: number) => (
                            <div key={i} className="flex justify-between text-sm bg-white rounded-lg px-3 py-2 border border-gray-100">
                              <span className="text-gray-700">{fc.nome ?? fc.fornecedor_id ?? `Fornecedor ${i + 1}`}</span>
                              <span className="text-gray-500 font-medium">
                                {fc.valor_cotado != null ? fmt(fc.valor_cotado) : 'Aguardando'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Aprovação info */}
                    {c.status === 'aprovada' && c.fornecedor_escolhido && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-green-700">
                            <strong>Aprovada:</strong> {c.fornecedor_escolhido} - {c.valor_aprovado != null ? fmt(c.valor_aprovado) : ''}
                          </p>
                          {c.motivo_escolha && (
                            <p className="text-xs text-green-600 mt-1">Motivo: {c.motivo_escolha}</p>
                          )}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); gerarPedido(c) }}
                          disabled={gerandoPedido === c.id}
                          className="inline-flex items-center gap-1.5 bg-green-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-green-700 disabled:opacity-50 flex-shrink-0"
                        >
                          <ShoppingCart size={14} />
                          {gerandoPedido === c.id ? 'Gerando...' : 'Gerar Pedido de Compra'}
                        </button>
                      </div>
                    )}

                    {/* Approve button / form */}
                    {c.status !== 'aprovada' && c.status !== 'cancelada' && (
                      <>
                        {approving === c.id ? (
                          <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
                            <h4 className="text-xs font-bold text-gray-500">Aprovar Cotação</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Fornecedor Escolhido *</label>
                                {convidados.length > 0 ? (
                                  <select
                                    value={approveForm.fornecedor}
                                    onChange={(e) => setApproveForm({ ...approveForm, fornecedor: e.target.value })}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                                  >
                                    <option value="">Selecione...</option>
                                    {convidados.map((fc: any, i: number) => (
                                      <option key={i} value={fc.nome ?? fc.fornecedor_id ?? `Fornecedor ${i + 1}`}>
                                        {fc.nome ?? fc.fornecedor_id ?? `Fornecedor ${i + 1}`}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    value={approveForm.fornecedor}
                                    onChange={(e) => setApproveForm({ ...approveForm, fornecedor: e.target.value })}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                                    placeholder="Nome do fornecedor"
                                  />
                                )}
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Valor Aprovado *</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={approveForm.valor}
                                  onChange={(e) => setApproveForm({ ...approveForm, valor: e.target.value })}
                                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                                  placeholder="0.00"
                                />
                              </div>
                              <div className="sm:col-span-2">
                                <label className="block text-xs font-medium text-gray-500 mb-1">Motivo da Escolha</label>
                                <input
                                  value={approveForm.motivo}
                                  onChange={(e) => setApproveForm({ ...approveForm, motivo: e.target.value })}
                                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                                  placeholder="Justificativa..."
                                />
                              </div>
                            </div>
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => { setApproving(null); setApproveForm({ fornecedor: '', valor: '', motivo: '' }) }}
                                className="text-xs text-gray-500 px-3 py-1.5 hover:text-gray-700"
                              >
                                Cancelar
                              </button>
                              <button
                                onClick={() => handleApprove(c)}
                                disabled={saving || !approveForm.fornecedor || !approveForm.valor}
                                className="inline-flex items-center gap-1 bg-green-600 text-white px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50"
                              >
                                <Check size={14} /> Confirmar Aprovação
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); setApproving(c.id) }}
                            className="inline-flex items-center gap-1 bg-green-600 text-white px-4 py-2 rounded-lg text-xs font-medium hover:bg-green-700 transition"
                          >
                            <Check size={14} /> Aprovar
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )
      })()}
    </div>
  )
}
