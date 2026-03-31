'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function NovoBMPage() {
  const [obras, setObras] = useState<any[]>([])
  const [form, setForm] = useState({ obra_id: '', data_inicio: '', data_fim: '' })
  const [proximoBM, setProximoBM] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.from('obras').select('id,nome,cliente').eq('status','ativo').order('nome')
      .then(({ data }) => setObras(data ?? []))
  }, [])

  async function onObraChange(obraId: string) {
    set('obra_id', obraId)
    if (!obraId) return
    const { data } = await supabase.from('boletins_medicao')
      .select('numero').eq('obra_id', obraId).order('numero', { ascending: false }).limit(1)
    setProximoBM(data?.[0] ? data[0].numero + 1 : 1)
  }

  function set(field: string, value: string) { setForm(f => ({ ...f, [field]: value })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { data, error } = await supabase.from('boletins_medicao').insert({
      obra_id: form.obra_id, numero: proximoBM,
      data_inicio: form.data_inicio, data_fim: form.data_fim, status: 'aberto'
    }).select().single()
    if (error) { setError(error.message); setLoading(false); return }
    router.push(`/boletins/${data.id}`)
  }

  const dias = form.data_inicio && form.data_fim
    ? Math.ceil((new Date(form.data_fim).getTime() - new Date(form.data_inicio).getTime()) / 86400000) + 1
    : null

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/boletins" className="text-gray-400 hover:text-gray-600 text-sm">Boletins</Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-medium">Novo BM</span>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h1 className="text-lg font-semibold mb-6">Novo Boletim de Medição</h1>
        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Obra *</label>
            <select required value={form.obra_id} onChange={e => onObraChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
              <option value="">Selecione a obra...</option>
              {obras.map(o => <option key={o.id} value={o.id}>{o.nome} — {o.cliente}</option>)}
            </select>
          </div>

          {form.obra_id && (
            <div className="flex items-center gap-2 p-3 bg-brand/5 rounded-lg border border-brand/20">
              <span className="text-brand font-bold text-sm">BM {String(proximoBM).padStart(2,'0')}</span>
              <span className="text-gray-500 text-sm">— Este será o próximo boletim desta obra</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data de início *</label>
              <input type="date" required value={form.data_inicio} onChange={e => set('data_inicio', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data de término *</label>
              <input type="date" required value={form.data_fim} onChange={e => set('data_fim', e.target.value)}
                min={form.data_inicio}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
          </div>

          {dias && (
            <div className="text-sm text-gray-600 p-3 bg-gray-50 rounded-lg">
              Período de <strong>{dias} dias</strong>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading}
              className="px-6 py-2.5 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark disabled:opacity-50">
              {loading ? 'Criando...' : 'Criar boletim'}
            </button>
            <Link href="/boletins" className="px-6 py-2.5 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
