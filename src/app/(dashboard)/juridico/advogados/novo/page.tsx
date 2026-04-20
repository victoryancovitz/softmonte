'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Breadcrumb from '@/components/ui/Breadcrumb'
import { useToast } from '@/components/Toast'

const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']

export default function NovoAdvogadoPage() {
  const [form, setForm] = useState({
    nome: '', oab: '', uf_oab: '', tipo: '',
    escritorio: '', email: '', telefone: '',
    honorarios_mensais: '', honorario_exito: '',
    observacoes: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!form.nome || !form.oab || !form.uf_oab || !form.tipo) {
      setError('Preencha os campos obrigatórios: Nome, OAB, UF e Tipo.')
      return
    }

    setLoading(true)
    const payload: any = {
      nome: form.nome,
      oab: form.oab,
      uf_oab: form.uf_oab,
      tipo: form.tipo,
      escritorio: form.escritorio || null,
      email: form.email || null,
      telefone: form.telefone || null,
      honorarios_mensais: form.honorarios_mensais ? parseFloat(form.honorarios_mensais) : null,
      honorario_exito: form.honorario_exito ? parseFloat(form.honorario_exito) : null,
      observacoes: form.observacoes || null,
    }

    const { error: err } = await supabase.from('advogados').insert(payload)
    setLoading(false)

    if (err) {
      setError(err.message)
      return
    }

    toast.success('Advogado cadastrado com sucesso')
    router.push('/juridico/advogados')
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <Breadcrumb items={[
        { label: 'Jurídico', href: '/juridico/processos' },
        { label: 'Advogados', href: '/juridico/advogados' },
        { label: 'Novo' },
      ]} />

      <h1 className="text-xl font-bold font-display text-brand mt-4 mb-6">Novo Advogado</h1>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
            <input type="text" value={form.nome} onChange={e => set('nome', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">OAB *</label>
            <input type="text" value={form.oab} onChange={e => set('oab', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="123456" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">UF OAB *</label>
            <select value={form.uf_oab} onChange={e => set('uf_oab', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">Selecione...</option>
              {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
            <select value={form.tipo} onChange={e => set('tipo', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">Selecione...</option>
              <option value="interno">Interno</option>
              <option value="externo">Externo</option>
              <option value="escritorio">Escritório</option>
            </select>
          </div>
        </div>

        {form.tipo !== 'interno' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Escritório</label>
            <input type="text" value={form.escritorio} onChange={e => set('escritorio', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
            <input type="text" value={form.telefone} onChange={e => set('telefone', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Honorários mensais (R$)</label>
            <input type="number" step="0.01" value={form.honorarios_mensais} onChange={e => set('honorarios_mensais', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Honorário de êxito (%)</label>
            <input type="number" step="0.1" value={form.honorario_exito} onChange={e => set('honorario_exito', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
          <textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)} rows={3} className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="px-5 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50">
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
          <button type="button" onClick={() => router.back()} className="px-5 py-2 border rounded-xl text-sm text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
