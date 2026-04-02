'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import BackButton from '@/components/BackButton'

const CATEGORIAS = ['Montagem','Elétrica','Tubulação','Mecânica','Pintura','Qualidade','Gestão','Suporte','Equipamentos','Operacional']

export default function NovaFuncaoPage() {
  const [form, setForm] = useState({
    nome: '', categoria: 'Montagem',
    custo_hora: '', multiplicador_extra: '1.70', multiplicador_noturno: '1.40', ativo: true,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  function set(field: string, value: any) { setForm(f => ({ ...f, [field]: value })) }

  const ch = parseFloat(form.custo_hora) || 0
  const extra = parseFloat(form.multiplicador_extra) || 1.70
  const not = parseFloat(form.multiplicador_noturno) || 1.40

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.from('funcoes').insert({
      nome: form.nome.toUpperCase().trim(),
      categoria: form.categoria,
      custo_hora: ch || null,
      multiplicador_extra: extra,
      multiplicador_noturno: not,
      ativo: form.ativo,
    })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/cadastros/funcoes')
  }

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div className="p-6 max-w-xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/cadastros/funcoes" />
        <Link href="/cadastros" className="text-gray-400 hover:text-gray-600">Cadastros</Link>
        <span className="text-gray-300">/</span>
        <Link href="/cadastros/funcoes" className="text-gray-400 hover:text-gray-600">Funções</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium">Nova</span>
      </div>
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h1 className="text-lg font-bold font-display text-brand mb-6">Nova função / cargo</h1>
        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nome da função *</label>
            <input required type="text" value={form.nome} onChange={e => set('nome', e.target.value)}
              placeholder="Ex: CALDEIREIRO" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm uppercase focus:outline-none focus:ring-2 focus:ring-brand"/>
            <p className="text-xs text-gray-400 mt-1">Será convertido para maiúsculas automaticamente</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Categoria</label>
            <select value={form.categoria} onChange={e => set('categoria', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
              {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Custo por hora (R$)</label>
            <input type="number" step="0.01" min="0" value={form.custo_hora} onChange={e => set('custo_hora', e.target.value)}
              placeholder="0,00" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand"/>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-amber-600 mb-1.5">Multiplicador hora extra</label>
              <input type="number" step="0.01" min="1" value={form.multiplicador_extra} onChange={e => set('multiplicador_extra', e.target.value)}
                className="w-full px-4 py-2.5 border border-amber-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand"/>
              <p className="text-xs text-gray-400 mt-1">Padrão: 1,70 (70% a mais)</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-blue-600 mb-1.5">Multiplicador hora noturna</label>
              <input type="number" step="0.01" min="1" value={form.multiplicador_noturno} onChange={e => set('multiplicador_noturno', e.target.value)}
                className="w-full px-4 py-2.5 border border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand"/>
              <p className="text-xs text-gray-400 mt-1">Padrão: 1,40 (40% a mais)</p>
            </div>
          </div>

          {ch > 0 && (
            <div className="p-4 bg-brand/5 rounded-xl border border-brand/10">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Preview de custos</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div><p className="text-xs text-gray-400">Normal</p><p className="font-bold text-brand">{fmt(ch)}/h</p></div>
                <div><p className="text-xs text-amber-500">Extra (×{extra.toFixed(2)})</p><p className="font-bold text-amber-600">{fmt(ch * extra)}/h</p></div>
                <div><p className="text-xs text-blue-500">Noturno (×{not.toFixed(2)})</p><p className="font-bold text-blue-600">{fmt(ch * not)}/h</p></div>
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={form.ativo} onChange={e => set('ativo', e.target.checked)} className="rounded border-gray-300 text-brand w-4 h-4"/>
            <span className="text-sm text-gray-700">Função ativa (aparece nos formulários)</span>
          </label>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading}
              className="px-6 py-2.5 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50">
              {loading ? 'Salvando...' : 'Criar função'}
            </button>
            <Link href="/cadastros/funcoes" className="px-6 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</Link>
          </div>
        </form>
      </div>
    </div>
  )
}
