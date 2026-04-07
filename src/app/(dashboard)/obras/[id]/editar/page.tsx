'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import BackButton from '@/components/BackButton'
import DeleteEntityButton from '@/components/DeleteEntityButton'

export default function EditarObraPage({ params }: { params: { id: string } }) {
  const [form, setForm] = useState({ nome: '', cliente: '', local: '', data_inicio: '', data_prev_fim: '', status: 'ativo' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.from('obras').select('*').eq('id', params.id).single().then(({ data }) => {
      if (data) setForm({
        nome: data.nome ?? '',
        cliente: data.cliente ?? '',
        local: data.local ?? '',
        data_inicio: data.data_inicio ?? '',
        data_prev_fim: data.data_prev_fim ?? '',
        status: data.status ?? 'ativo',
      })
      setLoading(false)
    })
  }, [params.id])

  function set(field: string, value: string) { setForm(f => ({ ...f, [field]: value })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const { error } = await supabase.from('obras').update({
      nome: form.nome,
      cliente: form.cliente || null,
      local: form.local || null,
      data_inicio: form.data_inicio || null,
      data_prev_fim: form.data_prev_fim || null,
      status: form.status,
    }).eq('id', params.id)
    if (error) { setError(error.message); setSaving(false); return }
    setSuccess(true)
    setTimeout(() => router.push(`/obras/${params.id}`), 1200)
  }

  if (loading) return <div className="p-6 text-sm text-gray-400">Carregando...</div>

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/obras" />
        <Link href="/obras" className="text-gray-400 hover:text-gray-600">Obras</Link>
        <span className="text-gray-300">/</span>
        <Link href={`/obras/${params.id}`} className="text-gray-400 hover:text-gray-600">{form.nome}</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700">Editar</span>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h1 className="text-lg font-semibold font-display text-brand mb-6">Editar obra</h1>

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl flex items-center gap-2">
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7"/><path d="M5 8l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none"/></svg>
            Obra atualizada! Redirecionando...
          </div>
        )}
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nome da obra *</label>
            <input type="text" required value={form.nome} onChange={e => set('nome', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Cliente</label>
              <input type="text" value={form.cliente} onChange={e => set('cliente', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Local</label>
              <input type="text" value={form.local} onChange={e => set('local', e.target.value)}
                placeholder="Cidade/UF"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Data de início</label>
              <input type="date" value={form.data_inicio} onChange={e => set('data_inicio', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Previsão de término</label>
              <input type="date" value={form.data_prev_fim} onChange={e => set('data_prev_fim', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
              <option value="ativo">Ativo</option>
              <option value="pausado">Pausado</option>
              <option value="concluido">Concluído</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>

          <div className="flex gap-3 pt-2 items-center">
            <button type="submit" disabled={saving || success}
              className="px-6 py-2.5 bg-brand text-white rounded-xl text-sm font-semibold hover:bg-brand-dark disabled:opacity-50 transition-colors">
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
            <Link href={`/obras/${params.id}`} className="px-6 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">
              Cancelar
            </Link>
            <div className="ml-auto">
              <DeleteEntityButton table="obras" id={params.id} entityName={form.nome ?? 'obra'} redirectTo="/obras" />
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
