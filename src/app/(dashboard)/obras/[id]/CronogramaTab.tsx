'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

type Etapa = {
  id: string
  obra_id: string
  nome: string
  descricao: string | null
  ordem: number
  nivel: number
  parent_id: string | null
  data_inicio_plan: string | null
  data_fim_plan: string | null
  data_inicio_real: string | null
  data_fim_real: string | null
  percentual_fisico: number
  responsavel: string | null
  milestone: boolean
  status: string
}

type FormData = {
  nome: string
  descricao: string
  data_inicio_plan: string
  data_fim_plan: string
  responsavel: string
  milestone: boolean
}

const emptyForm: FormData = { nome: '', descricao: '', data_inicio_plan: '', data_fim_plan: '', responsavel: '', milestone: false }

const STATUS_BADGE: Record<string, string> = {
  pendente: 'bg-gray-100 text-gray-500',
  em_andamento: 'bg-blue-100 text-blue-700',
  concluido: 'bg-green-100 text-green-700',
  atrasado: 'bg-red-100 text-red-700',
}

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em Andamento',
  concluido: 'Concluído',
  atrasado: 'Atrasado',
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T12:00').toLocaleDateString('pt-BR')
}

export default function CronogramaTab({ obraId }: { obraId: string }) {
  const supabase = createClient()
  const toast = useToast()

  const [etapas, setEtapas] = useState<Etapa[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [saving, setSaving] = useState(false)

  const fetchEtapas = useCallback(async () => {
    const { data, error } = await supabase
      .from('cronograma_etapas')
      .select('*')
      .eq('obra_id', obraId)
      .order('ordem')
    if (error) {
      toast.error('Erro ao carregar cronograma')
    } else {
      setEtapas(data ?? [])
    }
    setLoading(false)
  }, [obraId])

  useEffect(() => { fetchEtapas() }, [fetchEtapas])

  function openNew() {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  function openEdit(e: Etapa) {
    setEditingId(e.id)
    setForm({
      nome: e.nome,
      descricao: e.descricao ?? '',
      data_inicio_plan: e.data_inicio_plan ?? '',
      data_fim_plan: e.data_fim_plan ?? '',
      responsavel: e.responsavel ?? '',
      milestone: e.milestone,
    })
    setShowForm(true)
  }

  function cancel() {
    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm)
  }

  async function save() {
    if (!form.nome.trim() || !form.data_inicio_plan || !form.data_fim_plan) {
      toast.warning('Preencha nome, data início e data fim')
      return
    }
    setSaving(true)
    if (editingId) {
      const { error } = await supabase.from('cronograma_etapas').update({
        nome: form.nome.trim(),
        descricao: form.descricao.trim() || null,
        data_inicio_plan: form.data_inicio_plan,
        data_fim_plan: form.data_fim_plan,
        responsavel: form.responsavel.trim() || null,
        milestone: form.milestone,
      }).eq('id', editingId)
      if (error) toast.error('Erro ao atualizar etapa')
      else toast.success('Etapa atualizada')
    } else {
      const maxOrdem = etapas.length > 0 ? Math.max(...etapas.map(e => e.ordem ?? 0)) + 1 : 1
      const { error } = await supabase.from('cronograma_etapas').insert({
        obra_id: obraId,
        nome: form.nome.trim(),
        descricao: form.descricao.trim() || null,
        ordem: maxOrdem,
        nivel: 0,
        data_inicio_plan: form.data_inicio_plan,
        data_fim_plan: form.data_fim_plan,
        responsavel: form.responsavel.trim() || null,
        milestone: form.milestone,
        status: 'pendente',
        percentual_fisico: 0,
      })
      if (error) toast.error('Erro ao criar etapa')
      else toast.success('Etapa adicionada')
    }
    setSaving(false)
    cancel()
    fetchEtapas()
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta etapa?')) return
    const { error } = await supabase.from('cronograma_etapas').delete().eq('id', id)
    if (error) toast.error('Erro ao excluir etapa')
    else { toast.success('Etapa excluída'); fetchEtapas() }
  }

  async function handleStatusChange(id: string, status: string) {
    const updates: Record<string, any> = { status }
    if (status === 'concluido') updates.percentual_fisico = 100
    const { error } = await supabase.from('cronograma_etapas').update(updates).eq('id', id)
    if (error) toast.error('Erro ao atualizar status')
    else fetchEtapas()
  }

  if (loading) return <div className="text-sm text-gray-400 py-8 text-center">Carregando...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-700">{etapas.length} etapas</h2>
        {!showForm && (
          <button onClick={openNew} className="text-xs font-semibold text-brand hover:underline">+ Adicionar etapa</button>
        )}
      </div>

      {/* Inline form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">{editingId ? 'Editar etapa' : 'Nova etapa'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Nome *</label>
              <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand/30 focus:border-brand outline-none" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Descrição</label>
              <textarea value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand/30 focus:border-brand outline-none resize-none" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Data início planejada *</label>
              <input type="date" value={form.data_inicio_plan} onChange={e => setForm({ ...form, data_inicio_plan: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand/30 focus:border-brand outline-none" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Data fim planejada *</label>
              <input type="date" value={form.data_fim_plan} onChange={e => setForm({ ...form, data_fim_plan: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand/30 focus:border-brand outline-none" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Responsável</label>
              <input value={form.responsavel} onChange={e => setForm({ ...form, responsavel: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand/30 focus:border-brand outline-none" />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input type="checkbox" id="milestone" checked={form.milestone} onChange={e => setForm({ ...form, milestone: e.target.checked })} className="rounded border-gray-300 text-brand focus:ring-brand" />
              <label htmlFor="milestone" className="text-sm text-gray-700">Marco (milestone)</label>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={save} disabled={saving} className="px-4 py-2 bg-brand text-white text-xs font-semibold rounded-lg hover:bg-brand/90 disabled:opacity-50">
              {saving ? 'Salvando...' : editingId ? 'Atualizar' : 'Adicionar'}
            </button>
            <button onClick={cancel} className="px-4 py-2 text-xs font-semibold text-gray-500 hover:text-gray-700">Cancelar</button>
          </div>
        </div>
      )}

      {/* List */}
      {etapas.length > 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-50">
          {etapas.map(e => (
            <div key={e.id} className={`px-4 py-3 ${e.nivel > 0 ? 'pl-10' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${e.nivel === 0 ? 'font-bold' : 'font-medium'} text-gray-900`}>{e.nome}</span>
                  {e.milestone && <span className="text-xs bg-brand/10 text-brand px-2 py-0.5 rounded">Marco</span>}
                  {e.responsavel && <span className="text-xs text-gray-400">({e.responsavel})</span>}
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={e.status}
                    onChange={ev => handleStatusChange(e.id, ev.target.value)}
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold border-0 cursor-pointer ${STATUS_BADGE[e.status] ?? 'bg-gray-100'}`}
                  >
                    {Object.entries(STATUS_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  <span className="text-xs text-gray-400 min-w-[36px] text-right">{e.percentual_fisico}%</span>
                  <button onClick={() => openEdit(e)} className="text-xs text-gray-400 hover:text-brand">Editar</button>
                  <button onClick={() => handleDelete(e.id)} className="text-xs text-gray-400 hover:text-red-600">Excluir</button>
                </div>
              </div>
              {(e.data_inicio_plan || e.data_fim_plan) && (
                <div className="text-xs text-gray-400 mt-1">
                  Plan: {fmtDate(e.data_inicio_plan)} → {fmtDate(e.data_fim_plan)}
                </div>
              )}
              <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${e.percentual_fisico}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        !showForm && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
            <p className="text-gray-500 font-medium mb-1">Nenhuma etapa de cronograma cadastrada</p>
            <p className="text-xs text-gray-400 mb-3">Adicione etapas para acompanhar o progresso da obra.</p>
            <button onClick={openNew} className="text-xs font-semibold text-brand hover:underline">+ Adicionar etapa</button>
          </div>
        )
      )}
    </div>
  )
}
