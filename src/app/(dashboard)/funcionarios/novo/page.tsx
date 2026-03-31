'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function NovoFuncionarioPage() {
  const [form, setForm] = useState({ nome: '', matricula: '', cargo: '', turno: 'diurno', jornada_horas: '8', custo_hora: '', custo_hora_extra: '', custo_hora_noturno: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  function set(field: string, value: string) { setForm(f => ({ ...f, [field]: value })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.from('funcionarios').insert({
      nome: form.nome, matricula: form.matricula, cargo: form.cargo,
      turno: form.turno, jornada_horas: parseInt(form.jornada_horas),
      custo_hora: form.custo_hora ? parseFloat(form.custo_hora) : null,
      custo_hora_extra: form.custo_hora_extra ? parseFloat(form.custo_hora_extra) : null,
      custo_hora_noturno: form.custo_hora_noturno ? parseFloat(form.custo_hora_noturno) : null,
      status: 'disponivel'
    })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/funcionarios')
  }

  const cargos = ['Caldeireiro','Soldador','Mecanico','Tubulador','Eletricista','Montador','Servente','Pintor industrial','Inspetor de solda','Encarregado']

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/funcionarios" className="text-gray-400 hover:text-gray-600 text-sm">Funcionarios</Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-medium">Novo funcionario</span>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h1 className="text-lg font-semibold mb-6">Novo funcionario</h1>
        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Nome completo *</label>
              <input type="text" required value={form.nome} onChange={e => set('nome', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Matricula *</label>
              <input type="text" required value={form.matricula} onChange={e => set('matricula', e.target.value)} placeholder="SM-001" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Cargo *</label>
              <select required value={form.cargo} onChange={e => set('cargo', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-white">
                <option value="">Selecione...</option>
                {cargos.map(c => <option key={c} value={c}>{c}</option>)}
              </select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Turno</label>
              <select value={form.turno} onChange={e => set('turno', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-white">
                <option value="diurno">Diurno</option>
                <option value="noturno">Noturno</option>
                <option value="misto">Misto</option>
              </select></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Custo/hora (R$)</label>
              <input type="number" step="0.01" value={form.custo_hora} onChange={e => set('custo_hora', e.target.value)} placeholder="55.00" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Hora extra (R$)</label>
              <input type="number" step="0.01" value={form.custo_hora_extra} onChange={e => set('custo_hora_extra', e.target.value)} placeholder="82.50" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Hora noturna (R$)</label>
              <input type="number" step="0.01" value={form.custo_hora_noturno} onChange={e => set('custo_hora_noturno', e.target.value)} placeholder="77.00" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" /></div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="px-6 py-2.5 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark disabled:opacity-50">{loading ? 'Salvando...' : 'Salvar funcionario'}</button>
            <Link href="/funcionarios" className="px-6 py-2.5 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">Cancelar</Link>
          </div>
        </form>
      </div>
    </div>
  )
}
