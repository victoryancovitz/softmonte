'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import BackButton from '@/components/BackButton'
import QuickCreateSelect from '@/components/QuickCreateSelect'

export default function NovaObraPage() {
  const [form, setForm] = useState<any>({ nome: '', cliente_id: '', cliente: '', local: '', data_inicio: '', data_prev_fim: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  function set(field: string, value: string) { setForm((f: any) => ({ ...f, [field]: value })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    // Normalizar campos opcionais: strings vazias viram null (Postgres rejeita "" em UUID/date)
    const payload: any = { ...form, status: 'ativo' }
    if (!payload.cliente_id) payload.cliente_id = null
    if (!payload.data_inicio) payload.data_inicio = null
    if (!payload.data_prev_fim) payload.data_prev_fim = null
    if (!payload.cliente) payload.cliente = null
    if (!payload.local) payload.local = null
    const { error } = await supabase.from('obras').insert(payload)
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/obras')
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <BackButton fallback="/obras" />
        <Link href="/obras" className="text-gray-400 hover:text-gray-600 text-sm">Obras</Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-medium">Nova obra</span>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h1 className="text-lg font-semibold font-display mb-6">Nova obra</h1>
        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Nome da obra *</label>
            <input type="text" required value={form.nome} onChange={e => set('nome', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" /></div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
            <QuickCreateSelect
              table="clientes"
              value={form.cliente_id}
              onChange={(id, record) => {
                set('cliente_id', id)
                if (record?.nome) set('cliente', record.nome)
              }}
              placeholder="Selecione o cliente..."
              buttonLabel="Novo cliente"
              createTitle="Criar novo cliente"
              createFields={[
                { name: 'nome', label: 'Nome / Razão social', required: true, placeholder: 'Cesari Engenharia' },
                { name: 'cnpj', label: 'CNPJ', placeholder: '00.000.000/0000-00' },
                { name: 'email', label: 'E-mail' },
                { name: 'telefone', label: 'Telefone' },
                { name: 'cidade', label: 'Cidade' },
                { name: 'estado', label: 'UF' },
              ]}
            />
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Local da obra</label>
            <input type="text" value={form.local} onChange={e => set('local', e.target.value)} placeholder="Cidade/UF" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
