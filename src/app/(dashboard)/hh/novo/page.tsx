'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import BackButton from '@/components/BackButton'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

export default function NovoHHPage() {
  const [funcionarios, setFuncionarios] = useState<any[]>([])
  const [obras, setObras] = useState<any[]>([])
  const hoje = new Date()
  const [form, setForm] = useState({
    funcionario_id: '', obra_id: '',
    mes: hoje.getMonth() + 1, ano: hoje.getFullYear(),
    horas_normais: '', horas_extras: '', horas_noturnas: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [custoPreview, setCustoPreview] = useState(0)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.from('funcionarios').select('id,nome,cargo,custo_hora').is('deleted_at', null).order('nome').then(({ data }) => setFuncionarios(data ?? []))
    supabase.from('obras').select('id,nome').eq('status','ativo').is('deleted_at', null).order('nome').then(({ data }) => setObras(data ?? []))
  }, [])

  function set(field: string, value: any) {
    setForm(f => {
      const next = { ...f, [field]: value }
      // Calcular preview de custo
      const func = funcionarios.find(fn => fn.id === next.funcionario_id)
      const ch = Number(func?.custo_hora ?? 0)
      const custo = Number(next.horas_normais || 0) * ch
        + Number(next.horas_extras || 0) * ch * 1.7
        + Number(next.horas_noturnas || 0) * ch * 1.4
      setCustoPreview(custo)
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.from('hh_lancamentos').upsert({
      funcionario_id: form.funcionario_id,
      obra_id: form.obra_id,
      mes: form.mes, ano: form.ano,
      horas_normais: Number(form.horas_normais) || 0,
      horas_extras: Number(form.horas_extras) || 0,
      horas_noturnas: Number(form.horas_noturnas) || 0,
    }, { onConflict: 'funcionario_id,obra_id,mes,ano' })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/hh')
  }

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const totalHoras = Number(form.horas_normais || 0) + Number(form.horas_extras || 0) + Number(form.horas_noturnas || 0)

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/hh" />
        <Link href="/hh" className="text-gray-400 hover:text-gray-600">HH</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium">Novo lançamento</span>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h1 className="text-lg font-bold font-display text-brand mb-6">Lançamento de HH</h1>
        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Funcionário *</label>
            <select required value={form.funcionario_id} onChange={e => set('funcionario_id', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
              <option value="">Selecione...</option>
              {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome} — {f.cargo}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Obra *</label>
            <select required value={form.obra_id} onChange={e => set('obra_id', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
              <option value="">Selecione...</option>
              {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Mês *</label>
              <select required value={form.mes} onChange={e => set('mes', parseInt(e.target.value))}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
                {MESES.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Ano *</label>
              <select required value={form.ano} onChange={e => set('ano', parseInt(e.target.value))}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
                {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { field: 'horas_normais', label: 'H. Normais', color: 'text-brand' },
              { field: 'horas_extras', label: 'H. Extras (×1,7)', color: 'text-amber-600' },
              { field: 'horas_noturnas', label: 'H. Noturnas (×1,4)', color: 'text-blue-600' },
            ].map(({ field, label, color }) => (
              <div key={field}>
                <label className={`block text-sm font-semibold mb-1.5 ${color}`}>{label}</label>
                <input type="number" min="0" step="0.5" value={(form as any)[field]} onChange={e => set(field, e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand text-center font-mono"/>
              </div>
            ))}
          </div>
          {(totalHoras > 0 || custoPreview > 0) && (
            <div className="p-4 bg-brand/5 rounded-xl border border-brand/10 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <div className="text-xs text-gray-500">Total de horas</div>
                <div className="text-xl font-bold font-display text-brand">{totalHoras.toFixed(1)}h</div>
              </div>
              {custoPreview > 0 ? (
                <div>
                  <div className="text-xs text-gray-500">Custo estimado</div>
                  <div className="text-xl font-bold font-display text-green-700">{fmt(custoPreview)}</div>
                </div>
              ) : form.funcionario_id && (
                <div>
                  <div className="text-xs text-amber-600 font-medium">Custo/hora não cadastrado para este funcionário</div>
                </div>
              )}
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading}
              className="px-6 py-2.5 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50">
              {loading ? 'Salvando...' : 'Salvar lançamento'}
            </button>
            <Link href="/hh" className="px-6 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</Link>
          </div>
        </form>
      </div>
    </div>
  )
}
