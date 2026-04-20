'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { confirmDialog } from '@/components/ui/ConfirmDialog'

type Rnc = {
  id: string
  obra_id: string
  numero: string | null
  tipo: string
  descricao: string
  causa_raiz: string | null
  impacto: string | null
  acao_corretiva: string | null
  acao_preventiva: string | null
  responsavel_nome: string | null
  prazo_correcao: string | null
  status: string
}

type FormData = {
  tipo: string
  descricao: string
  causa_raiz: string
  impacto: string
  acao_corretiva: string
  acao_preventiva: string
  responsavel_nome: string
  prazo_correcao: string
}

const emptyForm: FormData = {
  tipo: 'qualidade',
  descricao: '',
  causa_raiz: '',
  impacto: '',
  acao_corretiva: '',
  acao_preventiva: '',
  responsavel_nome: '',
  prazo_correcao: '',
}

const TIPO_OPTIONS = [
  { value: 'qualidade', label: 'Qualidade' },
  { value: 'seguranca', label: 'Segurança' },
  { value: 'meio_ambiente', label: 'Meio Ambiente' },
  { value: 'outro', label: 'Outro' },
]

const TIPO_BADGE: Record<string, string> = {
  qualidade: 'bg-purple-100 text-purple-700',
  seguranca: 'bg-orange-100 text-orange-700',
  meio_ambiente: 'bg-emerald-100 text-emerald-700',
  outro: 'bg-gray-100 text-gray-600',
}

const TIPO_LABEL: Record<string, string> = {
  qualidade: 'Qualidade',
  seguranca: 'Segurança',
  meio_ambiente: 'Meio Ambiente',
  outro: 'Outro',
}

const STATUS_OPTIONS = [
  { value: 'aberta', label: 'Aberta' },
  { value: 'em_analise', label: 'Em Análise' },
  { value: 'corrigida', label: 'Corrigida' },
  { value: 'verificada', label: 'Verificada' },
  { value: 'fechada', label: 'Fechada' },
]

const STATUS_BADGE: Record<string, string> = {
  aberta: 'bg-blue-100 text-blue-700',
  em_analise: 'bg-amber-100 text-amber-700',
  corrigida: 'bg-cyan-100 text-cyan-700',
  verificada: 'bg-green-100 text-green-700',
  fechada: 'bg-gray-100 text-gray-500',
}

const STATUS_LABEL: Record<string, string> = {
  aberta: 'Aberta',
  em_analise: 'Em Análise',
  corrigida: 'Corrigida',
  verificada: 'Verificada',
  fechada: 'Fechada',
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T12:00').toLocaleDateString('pt-BR')
}

export default function RncTab({ obraId }: { obraId: string }) {
  const supabase = createClient()
  const toast = useToast()

  const [rncs, setRncs] = useState<Rnc[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [saving, setSaving] = useState(false)

  const fetchRncs = useCallback(async () => {
    const { data, error } = await supabase
      .from('rnc')
      .select('*')
      .eq('obra_id', obraId)
      .order('created_at', { ascending: false })
    if (error) toast.error('Erro ao carregar RNCs')
    else setRncs(data ?? [])
    setLoading(false)
  }, [obraId])

  useEffect(() => { fetchRncs() }, [fetchRncs])

  function openNew() {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  function openEdit(r: Rnc) {
    setEditingId(r.id)
    setForm({
      tipo: r.tipo,
      descricao: r.descricao,
      causa_raiz: r.causa_raiz ?? '',
      impacto: r.impacto ?? '',
      acao_corretiva: r.acao_corretiva ?? '',
      acao_preventiva: r.acao_preventiva ?? '',
      responsavel_nome: r.responsavel_nome ?? '',
      prazo_correcao: r.prazo_correcao ?? '',
    })
    setShowForm(true)
  }

  function cancel() {
    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm)
  }

  function generateNumero(): string {
    const maxNum = rncs.reduce((max, r) => {
      if (!r.numero) return max
      const match = r.numero.match(/(\d+)$/)
      if (match) {
        const n = parseInt(match[1], 10)
        return n > max ? n : max
      }
      return max
    }, 0)
    return `RNC-${String(maxNum + 1).padStart(3, '0')}`
  }

  async function save() {
    if (!form.tipo || !form.descricao.trim() || !form.acao_corretiva.trim() || !form.responsavel_nome.trim()) {
      toast.warning('Preencha tipo, descrição, ação corretiva e responsável')
      return
    }
    setSaving(true)

    const payload: Record<string, any> = {
      tipo: form.tipo,
      descricao: form.descricao.trim(),
      causa_raiz: form.causa_raiz.trim() || null,
      impacto: form.impacto.trim() || null,
      acao_corretiva: form.acao_corretiva.trim(),
      acao_preventiva: form.acao_preventiva.trim() || null,
      responsavel_nome: form.responsavel_nome.trim(),
      prazo_correcao: form.prazo_correcao || null,
    }

    if (editingId) {
      const { error } = await supabase.from('rnc').update(payload).eq('id', editingId)
      if (error) toast.error('Erro ao atualizar RNC')
      else toast.success('RNC atualizada')
    } else {
      payload.obra_id = obraId
      payload.numero = generateNumero()
      payload.status = 'aberta'
      const { error } = await supabase.from('rnc').insert(payload)
      if (error) toast.error('Erro ao criar RNC')
      else toast.success('RNC registrada')
    }
    setSaving(false)
    cancel()
    fetchRncs()
  }

  async function handleDelete(id: string) {
    if (!await confirmDialog({ title: 'Excluir RNC?', message: 'Esta ação não pode ser desfeita.', variant: 'danger', confirmLabel: 'Excluir' })) return
    const { error } = await supabase.from('rnc').delete().eq('id', id)
    if (error) toast.error('Erro ao excluir RNC')
    else { toast.success('RNC excluída'); fetchRncs() }
  }

  async function handleStatusChange(id: string, status: string) {
    const { error } = await supabase.from('rnc').update({ status }).eq('id', id)
    if (error) toast.error('Erro ao atualizar status')
    else fetchRncs()
  }

  if (loading) return <div className="text-sm text-gray-400 py-8 text-center">Carregando...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-700">Registros de Não Conformidade</h2>
        {!showForm && (
          <button onClick={openNew} className="text-xs font-semibold text-brand hover:underline">+ Nova RNC</button>
        )}
      </div>

      {/* Inline form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">{editingId ? 'Editar RNC' : 'Nova RNC'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Tipo *</label>
              <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand/30 focus:border-brand outline-none">
                {TIPO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Responsável *</label>
              <input value={form.responsavel_nome} onChange={e => setForm({ ...form, responsavel_nome: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand/30 focus:border-brand outline-none" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Descrição *</label>
              <textarea value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand/30 focus:border-brand outline-none resize-none" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Causa raiz</label>
              <input value={form.causa_raiz} onChange={e => setForm({ ...form, causa_raiz: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand/30 focus:border-brand outline-none" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Impacto</label>
              <input value={form.impacto} onChange={e => setForm({ ...form, impacto: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand/30 focus:border-brand outline-none" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Ação corretiva *</label>
              <textarea value={form.acao_corretiva} onChange={e => setForm({ ...form, acao_corretiva: e.target.value })} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand/30 focus:border-brand outline-none resize-none" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Ação preventiva</label>
              <textarea value={form.acao_preventiva} onChange={e => setForm({ ...form, acao_preventiva: e.target.value })} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand/30 focus:border-brand outline-none resize-none" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Prazo de correção</label>
              <input type="date" value={form.prazo_correcao} onChange={e => setForm({ ...form, prazo_correcao: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand/30 focus:border-brand outline-none" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={save} disabled={saving} className="px-4 py-2 bg-brand text-white text-xs font-semibold rounded-lg hover:bg-brand/90 disabled:opacity-50">
              {saving ? 'Salvando...' : editingId ? 'Atualizar' : 'Registrar'}
            </button>
            <button onClick={cancel} className="px-4 py-2 text-xs font-semibold text-gray-500 hover:text-gray-700">Cancelar</button>
          </div>
        </div>
      )}

      {/* List */}
      {rncs.length > 0 ? (
        <div className="space-y-3">
          {rncs.map(r => (
            <div key={r.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold">RNC #{r.numero}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${TIPO_BADGE[r.tipo] ?? 'bg-gray-100'}`}>
                    {TIPO_LABEL[r.tipo] ?? r.tipo}
                  </span>
                  <select
                    value={r.status}
                    onChange={e => handleStatusChange(r.id, e.target.value)}
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold border-0 cursor-pointer ${STATUS_BADGE[r.status] ?? 'bg-gray-100'}`}
                  >
                    {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{r.responsavel_nome}</span>
                  <button onClick={() => openEdit(r)} className="text-xs text-gray-400 hover:text-brand">Editar</button>
                  <button onClick={() => handleDelete(r.id)} className="text-xs text-gray-400 hover:text-red-600">Excluir</button>
                </div>
              </div>
              <p className="text-xs text-gray-700 mb-1">{r.descricao}</p>
              {r.causa_raiz && <p className="text-xs text-gray-500">Causa: {r.causa_raiz}</p>}
              {r.acao_corretiva && <p className="text-xs text-gray-500">Ação corretiva: {r.acao_corretiva}</p>}
              {r.acao_preventiva && <p className="text-xs text-gray-500">Ação preventiva: {r.acao_preventiva}</p>}
              {r.prazo_correcao && <p className="text-xs text-gray-400 mt-1">Prazo: {fmtDate(r.prazo_correcao)}</p>}
            </div>
          ))}
        </div>
      ) : (
        !showForm && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
            <p className="text-gray-500 font-medium mb-1">Nenhum registro de não conformidade</p>
            <p className="text-xs text-gray-400 mb-3">Registre e acompanhe não conformidades da obra.</p>
            <button onClick={openNew} className="text-xs font-semibold text-brand hover:underline">+ Nova RNC</button>
          </div>
        )
      )}
    </div>
  )
}
