'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

type Registro = {
  id: string
  obra_id: string
  data: string
  clima: string | null
  efetivo_presente: number | null
  servicos_executados: string | null
  ocorrencias: string | null
  equipamentos_utilizados: string | null
  observacoes: string | null
  registrado_por: string | null
  registrado_por_nome: string | null
}

type FormData = {
  data: string
  clima: string
  efetivo_presente: string
  servicos_executados: string
  ocorrencias: string
  equipamentos_utilizados: string
  observacoes: string
}

const hoje = new Date().toISOString().split('T')[0]

const emptyForm: FormData = {
  data: hoje,
  clima: '',
  efetivo_presente: '',
  servicos_executados: '',
  ocorrencias: '',
  equipamentos_utilizados: '',
  observacoes: '',
}

const CLIMA_OPTIONS = [
  { value: '', label: 'Selecione' },
  { value: 'sol', label: 'Sol' },
  { value: 'nublado', label: 'Nublado' },
  { value: 'chuva', label: 'Chuva' },
]

const CLIMA_ICON: Record<string, string> = {
  sol: '\u2600\uFE0F',
  nublado: '\u2601\uFE0F',
  chuva: '\uD83C\uDF27\uFE0F',
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function DiarioTab({ obraId }: { obraId: string }) {
  const supabase = createClient()
  const toast = useToast()

  const [registros, setRegistros] = useState<Registro[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [saving, setSaving] = useState(false)

  const fetchRegistros = useCallback(async () => {
    const { data, error } = await supabase
      .from('diario_obra')
      .select('*')
      .eq('obra_id', obraId)
      .order('data', { ascending: false })
    if (error) toast.error('Erro ao carregar diário')
    else setRegistros(data ?? [])
    setLoading(false)
  }, [obraId])

  useEffect(() => { fetchRegistros() }, [fetchRegistros])

  function openNew() {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  function openEdit(r: Registro) {
    setEditingId(r.id)
    setForm({
      data: r.data ?? hoje,
      clima: r.clima ?? '',
      efetivo_presente: r.efetivo_presente != null ? String(r.efetivo_presente) : '',
      servicos_executados: r.servicos_executados ?? '',
      ocorrencias: r.ocorrencias ?? '',
      equipamentos_utilizados: r.equipamentos_utilizados ?? '',
      observacoes: r.observacoes ?? '',
    })
    setShowForm(true)
  }

  function cancel() {
    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm)
  }

  async function save() {
    if (!form.data || !form.servicos_executados.trim()) {
      toast.warning('Preencha data e serviços executados')
      return
    }
    setSaving(true)

    // Get current user for registrado_por
    const { data: { user } } = await supabase.auth.getUser()

    const payload: Record<string, any> = {
      data: form.data,
      clima: form.clima || null,
      efetivo_presente: form.efetivo_presente ? Number(form.efetivo_presente) : null,
      servicos_executados: form.servicos_executados.trim(),
      ocorrencias: form.ocorrencias.trim() || null,
      equipamentos_utilizados: form.equipamentos_utilizados.trim() || null,
      observacoes: form.observacoes.trim() || null,
    }

    if (editingId) {
      const { error } = await supabase.from('diario_obra').update(payload).eq('id', editingId)
      if (error) toast.error('Erro ao atualizar registro')
      else toast.success('Registro atualizado')
    } else {
      payload.obra_id = obraId
      payload.registrado_por = user?.id ?? null
      payload.registrado_por_nome = user?.user_metadata?.nome ?? user?.email ?? null
      const { error } = await supabase.from('diario_obra').insert(payload)
      if (error) toast.error('Erro ao criar registro')
      else toast.success('Registro adicionado')
    }
    setSaving(false)
    cancel()
    fetchRegistros()
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este registro?')) return
    const { error } = await supabase.from('diario_obra').delete().eq('id', id)
    if (error) toast.error('Erro ao excluir registro')
    else { toast.success('Registro excluído'); fetchRegistros() }
  }

  if (loading) return <div className="text-sm text-gray-400 py-8 text-center">Carregando...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-700">Diário da Obra</h2>
        {!showForm && (
          <button onClick={openNew} className="text-xs font-semibold text-brand hover:underline">+ Novo registro</button>
        )}
      </div>

      {/* Inline form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">{editingId ? 'Editar registro' : 'Novo registro'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Data *</label>
              <input type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand/30 focus:border-brand outline-none" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Clima</label>
              <select value={form.clima} onChange={e => setForm({ ...form, clima: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand/30 focus:border-brand outline-none">
                {CLIMA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Efetivo presente</label>
              <input type="number" min="0" value={form.efetivo_presente} onChange={e => setForm({ ...form, efetivo_presente: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand/30 focus:border-brand outline-none" />
            </div>
            <div className="sm:col-span-3">
              <label className="text-xs text-gray-500 mb-1 block">Serviços executados *</label>
              <textarea value={form.servicos_executados} onChange={e => setForm({ ...form, servicos_executados: e.target.value })} rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand/30 focus:border-brand outline-none resize-none" />
            </div>
            <div className="sm:col-span-3">
              <label className="text-xs text-gray-500 mb-1 block">Ocorrências</label>
              <textarea value={form.ocorrencias} onChange={e => setForm({ ...form, ocorrencias: e.target.value })} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand/30 focus:border-brand outline-none resize-none" />
            </div>
            <div className="sm:col-span-3">
              <label className="text-xs text-gray-500 mb-1 block">Equipamentos utilizados</label>
              <textarea value={form.equipamentos_utilizados} onChange={e => setForm({ ...form, equipamentos_utilizados: e.target.value })} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand/30 focus:border-brand outline-none resize-none" />
            </div>
            <div className="sm:col-span-3">
              <label className="text-xs text-gray-500 mb-1 block">Observações</label>
              <textarea value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand/30 focus:border-brand outline-none resize-none" />
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
      {registros.length > 0 ? (
        <div className="space-y-3">
          {registros.map(d => (
            <div key={d.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{fmtDate(d.data)}</span>
                  {d.clima && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{CLIMA_ICON[d.clima] ?? ''} {d.clima}</span>}
                </div>
                <div className="flex items-center gap-3">
                  {d.efetivo_presente != null && <span className="text-xs text-gray-400">{d.efetivo_presente} presentes</span>}
                  <button onClick={() => openEdit(d)} className="text-xs text-gray-400 hover:text-brand">Editar</button>
                  <button onClick={() => handleDelete(d.id)} className="text-xs text-gray-400 hover:text-red-600">Excluir</button>
                </div>
              </div>
              {d.servicos_executados && (
                <p className="text-xs text-gray-600 mb-1 line-clamp-2">{d.servicos_executados}</p>
              )}
              {d.ocorrencias && <p className="text-xs text-red-600 mb-1">{d.ocorrencias}</p>}
              {d.equipamentos_utilizados && <p className="text-xs text-gray-500 mb-1">Equip.: {d.equipamentos_utilizados}</p>}
              {d.registrado_por_nome && <p className="text-[10px] text-gray-400 mt-1">Registrado por: {d.registrado_por_nome}</p>}
            </div>
          ))}
        </div>
      ) : (
        !showForm && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
            <p className="text-gray-500 font-medium mb-1">Nenhum registro no diário de obra</p>
            <p className="text-xs text-gray-400 mb-3">Registre atividades diárias, clima e ocorrências.</p>
            <button onClick={openNew} className="text-xs font-semibold text-brand hover:underline">+ Novo registro</button>
          </div>
        )
      )}
    </div>
  )
}
