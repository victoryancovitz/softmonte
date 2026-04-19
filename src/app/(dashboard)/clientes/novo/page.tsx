'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import BackButton from '@/components/BackButton'

interface Contato {
  nome: string
  email: string
  funcao: string
  whatsapp: string
}

export default function NovoClientePage() {
  const [form, setForm] = useState<any>({
    nome: '', razao_social: '', cnpj: '',
    endereco: '', cidade: '', estado: '',
    email_principal: '', email_medicao: '', email_fiscal: '', email_rh: '',
  })
  const [contatos, setContatos] = useState<Contato[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  function set(field: string, value: any) {
    setForm((f: any) => ({ ...f, [field]: value }))
  }

  function addContato() {
    setContatos(prev => [...prev, { nome: '', email: '', funcao: '', whatsapp: '' }])
  }

  function updateContato(index: number, field: keyof Contato, value: string) {
    setContatos(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c))
  }

  function removeContato(index: number) {
    setContatos(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error: err } = await supabase.from('clientes').insert({
      nome: form.nome.trim(),
      razao_social: form.razao_social.trim() || null,
      cnpj: form.cnpj.trim() || null,
      endereco: form.endereco.trim() || null,
      cidade: form.cidade.trim() || null,
      estado: form.estado.trim() || null,
      email_principal: form.email_principal.trim() || null,
      email_medicao: form.email_medicao.trim() || null,
      email_fiscal: form.email_fiscal.trim() || null,
      email_rh: form.email_rh.trim() || null,
      contatos: contatos.filter(c => c.nome.trim()),
    })

    if (err) { setError(err.message); setLoading(false); return }
    router.push('/clientes')
  }

  const inp = "w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand"
  const lbl = "block text-xs font-semibold text-gray-600 mb-1"

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/clientes" />
        <Link href="/clientes" className="text-gray-400 hover:text-gray-600">Clientes</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium">Novo</span>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h1 className="text-lg font-bold font-display text-brand mb-6">Novo cliente</h1>

        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Identificação */}
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">Identificação</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="col-span-1 sm:col-span-2"><label className={lbl}>Nome *</label>
                <input required type="text" name="nome" value={form.nome} onChange={e => set('nome', e.target.value)} className={inp} /></div>
              <div className="col-span-1 sm:col-span-2"><label className={lbl}>Razão social</label>
                <input type="text" name="razao_social" value={form.razao_social} onChange={e => set('razao_social', e.target.value)} className={inp} /></div>
              <div><label className={lbl}>CNPJ</label>
                <input type="text" name="cnpj" value={form.cnpj} onChange={e => set('cnpj', e.target.value)} className={inp} placeholder="00.000.000/0000-00" /></div>
            </div>
          </section>

          {/* Endereço */}
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">Endereço</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="col-span-1 sm:col-span-2"><label className={lbl}>Endereço</label>
                <input type="text" name="endereco" value={form.endereco} onChange={e => set('endereco', e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Cidade</label>
                <input type="text" name="cidade" value={form.cidade} onChange={e => set('cidade', e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Estado</label>
                <input type="text" name="estado" value={form.estado} onChange={e => set('estado', e.target.value)} className={inp} placeholder="SP" /></div>
            </div>
          </section>

          {/* Emails */}
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">Emails</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="col-span-1 sm:col-span-2"><label className={lbl}>Email principal</label>
                <input type="email" name="email_principal" value={form.email_principal} onChange={e => set('email_principal', e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Email medição</label>
                <input type="email" name="email_medicao" value={form.email_medicao} onChange={e => set('email_medicao', e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Email fiscal</label>
                <input type="email" name="email_fiscal" value={form.email_fiscal} onChange={e => set('email_fiscal', e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Email RH</label>
                <input type="email" name="email_rh" value={form.email_rh} onChange={e => set('email_rh', e.target.value)} className={inp} /></div>
            </div>
          </section>

          {/* Contatos */}
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">Contatos</h3>
            {contatos.length === 0 && (
              <p className="text-sm text-gray-400 mb-3">Nenhum contato adicionado.</p>
            )}
            <div className="space-y-3">
              {contatos.map((contato, i) => (
                <div key={i} className="p-3 border border-gray-100 rounded-xl bg-gray-50 relative">
                  <button type="button" onClick={() => removeContato(i)}
                    className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg text-sm font-bold">
                    X
                  </button>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><label className={lbl}>Nome</label>
                      <input type="text" name={`contato_nome_${i}`} value={contato.nome} onChange={e => updateContato(i, 'nome', e.target.value)} className={inp} /></div>
                    <div><label className={lbl}>Função</label>
                      <input type="text" name={`contato_funcao_${i}`} value={contato.funcao} onChange={e => updateContato(i, 'funcao', e.target.value)} className={inp} placeholder="Ex: Engenheiro, Gerente" /></div>
                    <div><label className={lbl}>Email</label>
                      <input type="email" name={`contato_email_${i}`} value={contato.email} onChange={e => updateContato(i, 'email', e.target.value)} className={inp} /></div>
                    <div><label className={lbl}>WhatsApp</label>
                      <input type="text" name={`contato_whatsapp_${i}`} value={contato.whatsapp} onChange={e => updateContato(i, 'whatsapp', e.target.value)} className={inp} placeholder="(11) 99999-9999" /></div>
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={addContato}
              className="mt-3 px-4 py-2 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-brand hover:text-brand transition-colors w-full">
              + Adicionar contato
            </button>
          </section>

          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button type="submit" disabled={loading}
              className="px-6 py-2.5 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50">
              {loading ? 'Salvando...' : 'Criar cliente'}
            </button>
            <Link href="/clientes" className="px-6 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</Link>
          </div>
        </form>
      </div>
    </div>
  )
}
