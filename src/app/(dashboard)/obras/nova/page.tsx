'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import BackButton from '@/components/BackButton'

export default function NovaObraPage() {
  const [form, setForm] = useState({ nome: '', cliente: '', local: '', data_inicio: '', data_prev_fim: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  function set(field: string, value: string) { setForm(f => ({ ...f, [field]: value })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.from('obras').insert({ ...form, status: 'ativo' })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/obras')
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <BackButton fallback="/obras" />
        <Link href="/obras" className="text-gray-400 hover:text-gray-600 text-sm">Obras</Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-medium">Nova obra</span>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h1 className="text-lg font-semibold font-display mb-6">Nova obra</h1>
        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Nome da obra *</label>
            <input type="text" required value={form.nome} onChange={e => set('nome', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
              <input type="text" value={form.cliente} onChange={e => set('cliente', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Local</label>
              <input type="text" value={form.local} onChange={e => set('local', e.target.value)} placeholder="Cidade/UF" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Data de inicio</label>
              <input type="date" value={form.data_inicio} onChange={e => set('data_inicio', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Previsao de termino</label>
              <input type="date" value={form.data_prev_fim} onChange={e => set('data_prev_fim', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" /></div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="px-6 py-2.5 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark disabled:opacity-50">{loading ? 'Salvando...' : 'Salvar obra'}</button>
            <Link href="/obras" className="px-6 py-2.5 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">Cancelar</Link>
          </div>
        </form>
      </div>
    </div>
  )
}
