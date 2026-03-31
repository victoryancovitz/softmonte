'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const MESES = ['Janeiro','Fevereiro','Marco','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

export default function NovoHHPage() {
  const [funcionarios, setFuncionarios] = useState<any[]>([])
  const [obras, setObras] = useState<any[]>([])
  const now = new Date()
  const [form, setForm] = useState({ funcionario_id: '', obra_id: '', mes: String(now.getMonth() + 1), ano: String(now.getFullYear()), horas_normais: '', horas_extras: '0', horas_noturnas: '0' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.from('funcionarios').select('id,nome,cargo').order('nome').then(({ data }) => setFuncionarios(data ?? []))
    supabase.from('obras').select('id,nome').eq('status','ativo').order('nome').then(({ data }) => setObras(data ?? []))
  }, [])

  function set(field: string, value: string) { setForm(f => ({ ...f, [field]: value })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.from('hh_lancamentos').upsert({
      funcionario_id: form.funcionario_id, obra_id: form.obra_id,
      mes: parseInt(form.mes), ano: parseInt(form.ano),
      horas_normais: parseFloat(form.horas_normais) || 0,
      horas_extras: parseFloat(form.horas_extras) || 0,
      horas_noturnas: parseFloat(form.horas_noturnas) || 0,
    }, { onConflict: 'funcionario_id,obra_id,mes,ano' })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/hh')
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/hh" className="text-gray-400 hover:text-gray-600 text-sm">Gestao de HH</Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-medium">Lancamento de HH</span>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h1 className="text-lg font-semibold mb-6">Lancamento de horas</h1>
        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Funcionario *</label>
            <select required value={form.funcionario_id} onChange={e => set('funcionario_id', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-white">
              <option value="">Selecione o funcionario...</option>
              {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome} — {f.cargo}</option>)}
            </select></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Obra *</label>
            <select required value={form.obra_id} onChange={e => set('obra_id', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-white">
              <option value="">Selecione a obra...</option>
              {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Mes *</label>
              <select required value={form.mes} onChange={e => set('mes', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-white">
                {MESES.map((m, i) => <option key={i+1} value={String(i+1)}>{m}</option>)}
              </select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Ano *</label>
              <input type="number" required value={form.ano} onChange={e => set('ano', e.target.value)} min="2020" max="2030" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" /></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Horas normais *</label>
              <input type="number" required step="0.5" value={form.horas_normais} onChange={e => set('horas_normais', e.target.value)} placeholder="160" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Horas extras</label>
              <input type="number" step="0.5" value={form.horas_extras} onChange={e => set('horas_extras', e.target.value)} placeholder="0" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Horas noturnas</label>
              <input type="number" step="0.5" value={form.horas_noturnas} onChange={e => set('horas_noturnas', e.target.value)} placeholder="0" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" /></div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="px-6 py-2.5 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark disabled:opacity-50">{loading ? 'Salvando...' : 'Salvar lancamento'}</button>
            <Link href="/hh" className="px-6 py-2.5 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">Cancelar</Link>
          </div>
        </form>
      </div>
    </div>
  )
}
