'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Plus, X, Pencil, Trash2 } from 'lucide-react'
import { confirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/Toast'
import BackButton from '@/components/BackButton'
import Link from 'next/link'

interface Socio {
  id: string
  nome: string
  cpf: string | null
  percentual_participacao: number | null
  data_entrada: string | null
  ativo: boolean
}

const emptyForm = {
  nome: '',
  cpf: '',
  percentual_participacao: '',
  data_entrada: '',
  ativo: true,
}

export default function SociosPage() {
  const supabase = createClient()
  const toast = useToast()
  const [socios, setSocios] = useState<Socio[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  async function loadSocios() {
    setLoading(true)
    const { data } = await supabase
      .from('socios')
      .select('*')
      .order('nome')
    setSocios(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadSocios() }, [])

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  function openEdit(s: Socio) {
    setEditingId(s.id)
    setForm({
      nome: s.nome ?? '',
      cpf: s.cpf ?? '',
      percentual_participacao: s.percentual_participacao != null ? String(s.percentual_participacao) : '',
      data_entrada: s.data_entrada ?? '',
      ativo: s.ativo,
    })
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm)
  }

  async function handleSave() {
    if (!form.nome.trim()) return
    setSaving(true)
    const payload = {
      nome: form.nome.trim(),
      cpf: form.cpf.trim() || null,
      percentual_participacao: form.percentual_participacao ? Number(form.percentual_participacao) : null,
      data_entrada: form.data_entrada || null,
      ativo: form.ativo,
    }

    if (editingId) {
      const { error } = await supabase.from('socios').update(payload).eq('id', editingId)
      if (error) { toast.error('Erro ao atualizar: ' + error.message); setSaving(false); return }
      toast.success('Socio atualizado')
    } else {
      const { error } = await supabase.from('socios').insert(payload)
      if (error) { toast.error('Erro ao criar: ' + error.message); setSaving(false); return }
      toast.success('Socio criado')
    }
    closeForm()
    setSaving(false)
    loadSocios()
  }

  async function handleDelete(s: Socio) {
    if (!await confirmDialog({
      title: 'Excluir socio?',
      message: `Excluir "${s.nome}"? Esta acao nao pode ser desfeita.`,
      variant: 'danger',
      confirmLabel: 'Excluir',
    })) return

    const { error } = await supabase.rpc('excluir_socio', { p_id: s.id })
    if (error) {
      toast.error('Erro ao excluir: ' + error.message)
      return
    }
    toast.success('Socio excluido')
    loadSocios()
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/cadastros" />
        <Link href="/cadastros" className="text-gray-400 hover:text-gray-600">Cadastros</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700">Socios</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold font-display text-brand">Socios</h1>
          <p className="text-sm text-gray-500 mt-0.5">{socios.length} cadastrado(s)</p>
        </div>
        <button
          onClick={() => showForm ? closeForm() : openCreate()}
          className="inline-flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand/90 transition"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancelar' : 'Novo Socio'}
        </button>
      </div>

      {/* Inline Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-5">
          <h2 className="text-sm font-bold text-gray-700 mb-4">
            {editingId ? 'Editar Socio' : 'Cadastrar Socio'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nome *</label>
              <input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Nome completo"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">CPF</label>
              <input
                value={form.cpf}
                onChange={(e) => setForm({ ...form, cpf: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="000.000.000-00"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">% Participacao</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={form.percentual_participacao}
                onChange={(e) => setForm({ ...form, percentual_participacao: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Ex: 50.00"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Data de Entrada</label>
              <input
                type="date"
                value={form.data_entrada}
                onChange={(e) => setForm({ ...form, data_entrada: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.ativo}
                  onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                  className="rounded border-gray-300"
                />
                Ativo
              </label>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving || !form.nome.trim()}
              className="bg-brand text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-brand/90 transition disabled:opacity-50"
            >
              {saving ? 'Salvando...' : editingId ? 'Atualizar' : 'Salvar'}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <p className="text-sm text-gray-400">Carregando...</p>
      ) : socios.length === 0 ? (
        <p className="text-sm text-gray-400">Nenhum socio cadastrado.</p>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Nome', 'CPF', '% Participacao', 'Status', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {socios.map((s) => (
                <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50/80 group">
                  <td className="px-4 py-3 font-semibold">{s.nome}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{s.cpf ?? '--'}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {s.percentual_participacao != null ? `${Number(s.percentual_participacao).toFixed(2)}%` : '--'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${s.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {s.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center gap-3 justify-end opacity-0 group-hover:opacity-100 sm:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(s)} className="text-xs text-brand hover:underline inline-flex items-center gap-1">
                        <Pencil size={12} /> Editar
                      </button>
                      <button onClick={() => handleDelete(s)} className="text-xs text-red-500 hover:text-red-700 inline-flex items-center gap-1">
                        <Trash2 size={12} /> Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
