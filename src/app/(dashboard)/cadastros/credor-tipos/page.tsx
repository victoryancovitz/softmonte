'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Plus, X } from 'lucide-react'
import { useToast } from '@/components/Toast'
import BackButton from '@/components/BackButton'
import Link from 'next/link'

interface CredorTipo {
  id: string
  valor: string
  label: string
  ativo: boolean
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

export default function CredorTiposPage() {
  const supabase = createClient()
  const toast = useToast()
  const [tipos, setTipos] = useState<CredorTipo[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [label, setLabel] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadTipos() {
    setLoading(true)
    const { data } = await supabase
      .from('credor_tipos')
      .select('*')
      .order('label')
    setTipos(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadTipos() }, [])

  function closeForm() {
    setShowForm(false)
    setLabel('')
  }

  async function handleSave() {
    if (!label.trim()) return
    setSaving(true)
    const valor = slugify(label)
    const { error } = await supabase.from('credor_tipos').insert({
      valor,
      label: label.trim(),
      ativo: true,
    })
    if (error) {
      toast.error('Erro ao criar: ' + error.message)
      setSaving(false)
      return
    }
    toast.success('Tipo de credor criado')
    closeForm()
    setSaving(false)
    loadTipos()
  }

  async function toggleAtivo(t: CredorTipo) {
    const { error } = await supabase
      .from('credor_tipos')
      .update({ ativo: !t.ativo })
      .eq('id', t.id)
    if (error) {
      toast.error('Erro ao atualizar: ' + error.message)
      return
    }
    loadTipos()
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/cadastros" />
        <Link href="/cadastros" className="text-gray-400 hover:text-gray-600">Cadastros</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700">Tipos de Credor</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold font-display text-brand">Tipos de Credor</h1>
          <p className="text-sm text-gray-500 mt-0.5">{tipos.length} tipo(s)</p>
        </div>
        <button
          onClick={() => showForm ? closeForm() : setShowForm(true)}
          className="inline-flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand/90 transition"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancelar' : 'Novo Tipo'}
        </button>
      </div>

      {/* Inline Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-5">
          <h2 className="text-sm font-bold text-gray-700 mb-4">Cadastrar Tipo de Credor</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Label *</label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Ex: Pessoa Juridica"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Valor (auto)</label>
              <input
                value={label ? slugify(label) : ''}
                disabled
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving || !label.trim()}
              className="bg-brand text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-brand/90 transition disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <p className="text-sm text-gray-400">Carregando...</p>
      ) : tipos.length === 0 ? (
        <p className="text-sm text-gray-400">Nenhum tipo cadastrado.</p>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Valor', 'Label', 'Ativo'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tipos.map((t) => (
                <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50/80">
                  <td className="px-4 py-3 text-xs font-mono text-gray-600">{t.valor}</td>
                  <td className="px-4 py-3 font-semibold">{t.label}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleAtivo(t)}
                      className={`text-xs px-2.5 py-1 rounded-full font-semibold transition ${
                        t.ativo
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {t.ativo ? 'Ativo' : 'Inativo'}
                    </button>
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
