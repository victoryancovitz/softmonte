'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import BackButton from '@/components/BackButton'

const CATEGORIAS = ['Montagem','Elétrica','Tubulação','Mecânica','Pintura','Qualidade','Gestão','Suporte','Equipamentos','Operacional']

export default function EditarFuncaoPage({ params }: { params: { id: string } }) {
  const [form, setForm] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.from('funcoes').select('*').eq('id', params.id).single()
      .then(({ data }) => { setForm(data); setLoading(false) })
  }, [params.id])

  function set(field: string, value: any) { setForm((f: any) => ({ ...f, [field]: value })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('funcoes').update({
      nome: form.nome?.toUpperCase().trim(),
      categoria: form.categoria,
      custo_hora: parseFloat(form.custo_hora) || null,
      multiplicador_extra: parseFloat(form.multiplicador_extra) || 1.70,
      multiplicador_noturno: parseFloat(form.multiplicador_noturno) || 1.40,
      ativo: form.ativo,
      updated_at: new Date().toISOString(),
    }).eq('id', params.id)
    if (error) { setError(error.message); setSaving(false); return }
    setSuccess(true)
    setTimeout(() => router.push('/cadastros/funcoes'), 1200)
  }

  async function toggleAtivo() {
    await supabase.from('funcoes').update({ ativo: !form.ativo }).eq('id', params.id)
    setForm((f: any) => ({ ...f, ativo: !f.ativo }))
  }

  if (loading || !form) return <div className="p-6 text-sm text-gray-400">Carregando...</div>

  const ch = parseFloat(form.custo_hora) || 0
  const extra = parseFloat(form.multiplicador_extra) || 1.70
  const not = parseFloat(form.multiplicador_noturno) || 1.40
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div className="p-4 sm:p-6 max-w-xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/cadastros/funcoes" />
        <Link href="/cadastros" className="text-gray-400 hover:text-gray-600">Cadastros</Link>
        <span className="text-gray-300">/</span>
        <Link href="/cadastros/funcoes" className="text-gray-400 hover:text-gray-600">Funções</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium">{form.nome}</span>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-bold font-display text-brand">Editar função</h1>
          <button onClick={toggleAtivo}
            className={`text-xs px-3 py-1.5 rounded-full font-semibold border transition-all ${form.ativo ? 'bg-green-50 text-green-700 border-green-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-green-50 hover:text-green-700 hover:border-green-200'}`}>
            {form.ativo ? '✓ Ativa' : '✗ Inativa'}
          </button>
        </div>
        {success && <div className="mb-4 p-3 bg-green-50 text-green-700 text-sm rounded-xl border border-green-200">✓ Salvo!</div>}
        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nome *</label>
            <input required type="text" value={form.nome ?? ''} onChange={e => set('nome', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm uppercase focus:outline-none focus:ring-2 focus:ring-brand"/>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Categoria</label>
            <select value={form.categoria ?? 'Operacional'} onChange={e => set('categoria', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
              {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Custo/hora normal (R$)</label>
            <input type="number" step="0.01" min="0" value={form.custo_hora ?? ''} onChange={e => set('custo_hora', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand"/>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-semibold text-amber-600 mb-1.5">Multiplicador extra</label>
              <input type="number" step="0.01" min="1" value={form.multiplicador_extra ?? 1.70} onChange={e => set('multiplicador_extra', e.target.value)}
                className="w-full px-4 py-2.5 border border-amber-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand"/>
            </div>
            <div>
              <label className="block text-sm font-semibold text-blue-600 mb-1.5">Multiplicador noturno</label>
              <input type="number" step="0.01" min="1" value={form.multiplicador_noturno ?? 1.40} onChange={e => set('multiplicador_noturno', e.target.value)}
                className="w-full px-4 py-2.5 border border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand"/>
            </div>
          </div>
          {ch > 0 && (
            <div className="p-4 bg-brand/5 rounded-xl border border-brand/10">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Preview</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                <div><p className="text-xs text-gray-400">Normal</p><p className="font-bold text-brand">{fmt(ch)}/h</p></div>
                <div><p className="text-xs text-amber-500">Extra</p><p className="font-bold text-amber-600">{fmt(ch * extra)}/h</p></div>
                <div><p className="text-xs text-blue-500">Noturno</p><p className="font-bold text-blue-600">{fmt(ch * not)}/h</p></div>
              </div>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving || success}
              className="px-6 py-2.5 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
            <Link href="/cadastros/funcoes" className="px-6 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</Link>
          </div>
        </form>
      </div>
    </div>
  )
}
