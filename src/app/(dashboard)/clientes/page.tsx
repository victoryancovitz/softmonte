'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Plus, X, Pencil, Trash2 } from 'lucide-react'
import { confirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/Toast'
import Link from 'next/link'

interface Cliente {
  id: string
  nome: string
  razao_social: string | null
  cnpj: string | null
  endereco: string | null
  telefone: string | null
  email_principal: string | null
  contato: string | null
  cidade: string | null
  ativo: boolean
  contatos: any[] | null
}

const emptyForm = {
  nome: '',
  razao_social: '',
  cnpj: '',
  endereco: '',
  telefone: '',
  email: '',
  contato: '',
}

export default function ClientesPage() {
  const supabase = createClient()
  const toast = useToast()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  async function loadClientes() {
    setLoading(true)
    const { data } = await supabase
      .from('clientes')
      .select('*')
      .is('deleted_at', null)
      .order('nome')
    setClientes(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadClientes() }, [])

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  function openEdit(c: Cliente) {
    setEditingId(c.id)
    setForm({
      nome: c.nome ?? '',
      razao_social: c.razao_social ?? '',
      cnpj: c.cnpj ?? '',
      endereco: c.endereco ?? '',
      telefone: c.telefone ?? '',
      email: c.email_principal ?? '',
      contato: c.contato ?? '',
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
      razao_social: form.razao_social.trim() || null,
      cnpj: form.cnpj.trim() || null,
      endereco: form.endereco.trim() || null,
      telefone: form.telefone.trim() || null,
      email_principal: form.email.trim() || null,
      contato: form.contato.trim() || null,
    }

    if (editingId) {
      const { error } = await supabase.from('clientes').update(payload).eq('id', editingId)
      if (error) { toast.error('Erro ao atualizar: ' + error.message); setSaving(false); return }
      toast.success('Cliente atualizado')
    } else {
      const { error } = await supabase.from('clientes').insert({ ...payload, ativo: true })
      if (error) { toast.error('Erro ao criar: ' + error.message); setSaving(false); return }
      toast.success('Cliente criado')
    }
    closeForm()
    setSaving(false)
    loadClientes()
  }

  async function handleDelete(c: Cliente) {
    if (!await confirmDialog({
      title: 'Excluir cliente?',
      message: `Excluir "${c.nome}"? Esta acao nao pode ser desfeita.`,
      variant: 'danger',
      confirmLabel: 'Excluir',
    })) return

    const { error } = await supabase.rpc('excluir_cliente', { p_id: c.id })
    if (error) {
      toast.error('Erro ao excluir: ' + error.message)
      return
    }
    toast.success('Cliente excluido')
    loadClientes()
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold font-display text-brand">Clientes</h1>
          <p className="text-sm text-gray-500 mt-0.5">{clientes.length} cadastrado(s)</p>
        </div>
        <button
          onClick={() => showForm ? closeForm() : openCreate()}
          className="inline-flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand/90 transition"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancelar' : 'Novo Cliente'}
        </button>
      </div>

      {/* Inline Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-5">
          <h2 className="text-sm font-bold text-gray-700 mb-4">
            {editingId ? 'Editar Cliente' : 'Cadastrar Cliente'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nome *</label>
              <input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Nome fantasia"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Razao Social</label>
              <input
                value={form.razao_social}
                onChange={(e) => setForm({ ...form, razao_social: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">CNPJ</label>
              <input
                value={form.cnpj}
                onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="00.000.000/0000-00"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Endereco</label>
              <input
                value={form.endereco}
                onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Telefone</label>
              <input
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">E-mail</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Contato</label>
              <input
                value={form.contato}
                onChange={(e) => setForm({ ...form, contato: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Nome do contato"
              />
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
      ) : clientes.length === 0 ? (
        <p className="text-sm text-gray-400">Nenhum cliente cadastrado.</p>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Nome', 'CNPJ', 'E-mail', 'Telefone', 'Contato', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/80 group">
                  <td className="px-4 py-3 font-semibold">{c.nome}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{c.cnpj ?? '--'}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{c.email_principal ?? '--'}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{c.telefone ?? '--'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{c.contato ?? '--'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center gap-3 justify-end opacity-0 group-hover:opacity-100 sm:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(c)} className="text-xs text-brand hover:underline inline-flex items-center gap-1">
                        <Pencil size={12} /> Editar
                      </button>
                      <button onClick={() => handleDelete(c)} className="text-xs text-red-500 hover:text-red-700 inline-flex items-center gap-1">
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
