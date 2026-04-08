'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import BackButton from '@/components/BackButton'
import DeleteEntityButton from '@/components/DeleteEntityButton'
import { useToast } from '@/components/Toast'

interface Contato {
  nome: string
  email: string
  funcao: string
  whatsapp: string
}

export default function EditarClientePage({ params }: { params: { id: string } }) {
  const [form, setForm] = useState<any>({
    nome: '', razao_social: '', cnpj: '',
    endereco: '', cidade: '', estado: '',
    email_principal: '', email_medicao: '', email_fiscal: '', email_rh: '',
  })
  const [contatos, setContatos] = useState<Contato[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()

  useEffect(() => {
    supabase.from('clientes').select('*').eq('id', params.id).single().then(({ data, error: err }) => {
      if (err) { setError(err.message); setLoading(false); return }
      if (data) {
        setForm({
          nome: data.nome ?? '',
          razao_social: data.razao_social ?? '',
          cnpj: data.cnpj ?? '',
          endereco: data.endereco ?? '',
          cidade: data.cidade ?? '',
          estado: data.estado ?? '',
          email_principal: data.email_principal ?? '',
          email_medicao: data.email_medicao ?? '',
          email_fiscal: data.email_fiscal ?? '',
          email_rh: data.email_rh ?? '',
        })
        setContatos(Array.isArray(data.contatos) ? data.contatos : [])
      }
      setLoading(false)
    })
  }, [params.id])

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
    setSaving(true)
    setError('')

    const { error: err } = await supabase.from('clientes').update({
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
    }).eq('id', params.id)

    if (err) { setError(err.message); setSaving(false); return }
    setSuccess(true)
    toast.success('Cliente atualizado!')
    setTimeout(() => {
      router.push(`/clientes/${params.id}`)
      router.refresh()
    }, 1000)
  }

  if (loading) return <div className="p-6 text-sm text-gray-400">Carregando...</div>

  const inp = "w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand"
  const lbl = "block text-xs font-semibold text-gray-600 mb-1"

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/clientes" />
        <Link href="/clientes" className="text-gray-400 hover:text-gray-600">Clientes</Link>
        <span className="text-gray-300">/</span>
        <Link href={`/clientes/${params.id}`} className="text-gray-400 hover:text-gray-600">{form.nome}</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium">Editar</span>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h1 className="text-lg font-bold font-display text-brand mb-6">Editar cliente</h1>

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl">
            Cliente atualizado! Redirecionando...
          </div>
        )}
        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Identificação */}
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">Identificação</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="col-span-1 sm:col-span-2"><label className={lbl}>Nome *</label>
                <input required type="text" value={form.nome} onChange={e => set('nome', e.target.value)} className={inp} /></div>
              <div className="col-span-1 sm:col-span-2"><label className={lbl}>Razão social</label>
                <input type="text" value={form.razao_social} onChange={e => set('razao_social', e.target.value)} className={inp} /></div>
              <div><label className={lbl}>CNPJ</label>
                <input type="text" value={form.cnpj} onChange={e => set('cnpj', e.target.value)} className={inp} placeholder="00.000.000/0000-00" /></div>
            </div>
          </section>

          {/* Endereço */}
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">Endereço</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="col-span-1 sm:col-span-2"><label className={lbl}>Endereço</label>
                <input type="text" value={form.endereco} onChange={e => set('endereco', e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Cidade</label>
                <input type="text" value={form.cidade} onChange={e => set('cidade', e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Estado</label>
                <input type="text" value={form.estado} onChange={e => set('estado', e.target.value)} className={inp} placeholder="SP" /></div>
            </div>
          </section>

          {/* Emails */}
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">Emails</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="col-span-1 sm:col-span-2"><label className={lbl}>Email principal</label>
                <input type="email" value={form.email_principal} onChange={e => set('email_principal', e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Email medição</label>
                <input type="email" value={form.email_medicao} onChange={e => set('email_medicao', e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Email fiscal</label>
                <input type="email" value={form.email_fiscal} onChange={e => set('email_fiscal', e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Email RH</label>
                <input type="email" value={form.email_rh} onChange={e => set('email_rh', e.target.value)} className={inp} /></div>
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
                      <input type="text" value={contato.nome} onChange={e => updateContato(i, 'nome', e.target.value)} className={inp} /></div>
                    <div><label className={lbl}>Função</label>
                      <input type="text" value={contato.funcao} onChange={e => updateContato(i, 'funcao', e.target.value)} className={inp} placeholder="Ex: Engenheiro, Gerente" /></div>
                    <div><label className={lbl}>Email</label>
                      <input type="email" value={contato.email} onChange={e => updateContato(i, 'email', e.target.value)} className={inp} /></div>
                    <div><label className={lbl}>WhatsApp</label>
                      <input type="text" value={contato.whatsapp} onChange={e => updateContato(i, 'whatsapp', e.target.value)} className={inp} placeholder="(11) 99999-9999" /></div>
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={addContato}
              className="mt-3 px-4 py-2 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-brand hover:text-brand transition-colors w-full">
              + Adicionar contato
            </button>
          </section>

          <div className="flex gap-3 pt-2 border-t border-gray-100 items-center">
            <button type="submit" disabled={saving || success}
              className="px-6 py-2.5 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
            <Link href={`/clientes/${params.id}`} className="px-6 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</Link>
            <div className="ml-auto">
              <DeleteEntityButton
                table="clientes" id={params.id} entityName={form.nome ?? 'cliente'} redirectTo="/clientes"
                impactEntity="cliente"
                impactTitle="Excluir cliente"
                impactAction="As obras do cliente não são deletadas, mas o vínculo com ele é perdido. Se houver obras ativas, prefira marcar como inativo."
              />
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
