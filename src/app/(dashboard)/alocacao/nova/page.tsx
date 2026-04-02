'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import BackButton from '@/components/BackButton'

export default function NovaAlocacaoPage() {
  const [funcionarios, setFuncionarios] = useState<any[]>([])
  const [obras, setObras] = useState<any[]>([])
  const [conflito, setConflito] = useState<string | null>(null)
  const [form, setForm] = useState({ funcionario_id: '', obra_id: '', cargo_na_obra: '', data_inicio: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.from('funcionarios').select('id,nome,cargo,status').order('nome').then(({ data }) => setFuncionarios(data ?? []))
    supabase.from('obras').select('id,nome,cliente').eq('status','ativo').order('nome').then(({ data }) => setObras(data ?? []))
  }, [])

  async function checkConflito(funcId: string) {
    if (!funcId) return
    const { data } = await supabase.from('alocacoes')
      .select('obras(nome)').eq('funcionario_id', funcId).eq('ativo', true)
    if (data && data.length > 0) {
      setConflito(`Este funcionário já está alocado em: ${(data as any[]).map(a => a.obras?.nome).join(', ')}`)
    } else {
      setConflito(null)
    }
  }

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
    if (field === 'funcionario_id') checkConflito(value)
    if (field === 'funcionario_id' && value) {
      const func = funcionarios.find(f => f.id === value)
      if (func) setForm(f => ({ ...f, funcionario_id: value, cargo_na_obra: func.cargo }))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.from('alocacoes').insert({
      ...form, ativo: true,
      data_inicio: form.data_inicio || (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })()
    })
    if (error) { setError(error.message); setLoading(false); return }
    await supabase.from('funcionarios').update({ status: 'alocado' }).eq('id', form.funcionario_id)
    router.push('/alocacao')
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/alocacao" />
        <Link href="/alocacao" className="text-gray-400 hover:text-gray-600">Alocação</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium">Nova alocação</span>
      </div>
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h1 className="text-lg font-bold font-display text-brand mb-6">Nova alocação</h1>
        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200">{error}</div>}
        {conflito && <div className="mb-4 p-3 bg-amber-50 text-amber-800 text-sm rounded-xl border border-amber-200">⚠️ {conflito}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Funcionário *</label>
            <select required value={form.funcionario_id} onChange={e => set('funcionario_id', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
              <option value="">Selecione o funcionário...</option>
              {funcionarios.map(f => (
                <option key={f.id} value={f.id}>{f.nome} — {f.cargo} {f.status === 'alocado' ? '(já alocado)' : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Obra *</label>
            <select required value={form.obra_id} onChange={e => set('obra_id', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
              <option value="">Selecione a obra...</option>
              {obras.map(o => <option key={o.id} value={o.id}>{o.nome} — {o.cliente}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Cargo na obra</label>
              <input type="text" value={form.cargo_na_obra} onChange={e => set('cargo_na_obra', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand"/>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Data de início</label>
              <input type="date" value={form.data_inicio} onChange={e => set('data_inicio', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand"/>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading}
              className="px-6 py-2.5 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50">
              {loading ? 'Salvando...' : 'Salvar alocação'}
            </button>
            <Link href="/alocacao" className="px-6 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</Link>
          </div>
        </form>
      </div>
    </div>
  )
}
