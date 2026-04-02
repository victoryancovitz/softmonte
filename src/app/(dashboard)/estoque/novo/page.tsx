'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import BackButton from '@/components/BackButton'

export default function NovoItemPage() {
  const [form, setForm] = useState({ codigo: '', nome: '', categoria: 'Material', deposito: '', quantidade: '0', quantidade_minima: '0', unidade: 'un' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  function set(field: string, value: string) { setForm(f => ({ ...f, [field]: value })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.from('estoque_itens').insert({
      ...form, quantidade: parseFloat(form.quantidade), quantidade_minima: parseFloat(form.quantidade_minima)
    })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/estoque')
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <BackButton fallback="/estoque" />
        <Link href="/estoque" className="text-gray-400 hover:text-gray-600 text-sm">Estoque</Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-medium">Novo item</span>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h1 className="text-lg font-semibold font-display mb-6">Novo item de estoque</h1>
        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Codigo *</label>
              <input type="text" required value={form.codigo} onChange={e => set('codigo', e.target.value)} placeholder="EPI-001" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
              <select value={form.categoria} onChange={e => set('categoria', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-white">
                <option>EPI</option><option>Material</option><option>Ferramenta</option><option>Consumivel</option>
              </select></div>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Nome do item *</label>
            <input type="text" required value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Ex: Capacete de seguranca" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" /></div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Qtd. atual</label>
              <input type="number" step="0.01" value={form.quantidade} onChange={e => set('quantidade', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Qtd. minima</label>
              <input type="number" step="0.01" value={form.quantidade_minima} onChange={e => set('quantidade_minima', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Unidade</label>
              <select value={form.unidade} onChange={e => set('unidade', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-white">
                {['un','m','kg','l','pares','cx','rolo'].map(u => <option key={u}>{u}</option>)}
              </select></div>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Deposito</label>
            <input type="text" value={form.deposito} onChange={e => set('deposito', e.target.value)} placeholder="Ex: Almoxarifado A" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" /></div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="px-6 py-2.5 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark disabled:opacity-50">{loading ? 'Salvando...' : 'Salvar item'}</button>
            <Link href="/estoque" className="px-6 py-2.5 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">Cancelar</Link>
          </div>
        </form>
      </div>
    </div>
  )
}
