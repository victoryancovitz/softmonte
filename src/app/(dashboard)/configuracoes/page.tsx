'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

export default function ConfiguracoesPage() {
  const [form, setForm] = useState<any>({
    id: 1,
    razao_social: '', nome_fantasia: '', cnpj: '', ie: '',
    endereco: '', cidade: '', estado: '', cep: '',
    email_principal: '', email_financeiro: '', email_rh: '',
    banco: '', agencia: '', conta: '', pix: '',
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  useEffect(() => {
    supabase.from('empresa_config').select('*').limit(1).single()
      .then(({ data }) => {
        if (data) setForm(data)
      })
  }, [])

  function set(field: string, value: any) {
    setForm((f: any) => ({ ...f, [field]: value }))
    setSuccess(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess(false)

    const { error: err } = await supabase.from('empresa_config').upsert({
      id: form.id || 1,
      razao_social: form.razao_social,
      nome_fantasia: form.nome_fantasia,
      cnpj: form.cnpj,
      ie: form.ie,
      endereco: form.endereco,
      cidade: form.cidade,
      estado: form.estado,
      cep: form.cep,
      email_principal: form.email_principal,
      email_financeiro: form.email_financeiro,
      email_rh: form.email_rh,
      banco: form.banco,
      agencia: form.agencia,
      conta: form.conta,
      pix: form.pix,
    }, { onConflict: 'id' })

    if (err) { setError(err.message); setLoading(false); return }
    setSuccess(true)
    setLoading(false)
  }

  const inp = "w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand"
  const lbl = "block text-xs font-semibold text-gray-600 mb-1"

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h1 className="text-lg font-bold font-display text-brand mb-6">Configurações da Empresa</h1>

        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200">{error}</div>}
        {success && <div className="mb-4 p-3 bg-green-50 text-green-700 text-sm rounded-xl border border-green-200">Configurações salvas com sucesso!</div>}

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Dados da empresa */}
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">Dados da empresa</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className={lbl}>Razão social</label>
                <input type="text" value={form.razao_social} onChange={e => set('razao_social', e.target.value)} className={inp} /></div>
              <div className="col-span-2"><label className={lbl}>Nome fantasia</label>
                <input type="text" value={form.nome_fantasia} onChange={e => set('nome_fantasia', e.target.value)} className={inp} /></div>
              <div><label className={lbl}>CNPJ</label>
                <input type="text" value={form.cnpj} onChange={e => set('cnpj', e.target.value)} className={inp} placeholder="00.000.000/0000-00" /></div>
              <div><label className={lbl}>Inscrição Estadual</label>
                <input type="text" value={form.ie} onChange={e => set('ie', e.target.value)} className={inp} /></div>
            </div>
          </section>

          {/* Endereço */}
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">Endereço</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className={lbl}>Endereço</label>
                <input type="text" value={form.endereco} onChange={e => set('endereco', e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Cidade</label>
                <input type="text" value={form.cidade} onChange={e => set('cidade', e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Estado</label>
                <input type="text" value={form.estado} onChange={e => set('estado', e.target.value)} className={inp} placeholder="SP" /></div>
              <div><label className={lbl}>CEP</label>
                <input type="text" value={form.cep} onChange={e => set('cep', e.target.value)} className={inp} placeholder="00000-000" /></div>
            </div>
          </section>

          {/* Emails */}
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">Emails</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className={lbl}>Email principal</label>
                <input type="email" value={form.email_principal} onChange={e => set('email_principal', e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Email financeiro</label>
                <input type="email" value={form.email_financeiro} onChange={e => set('email_financeiro', e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Email RH</label>
                <input type="email" value={form.email_rh} onChange={e => set('email_rh', e.target.value)} className={inp} /></div>
            </div>
          </section>

          {/* Dados bancários */}
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">Dados bancários</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Banco</label>
                <input type="text" value={form.banco} onChange={e => set('banco', e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Agência</label>
                <input type="text" value={form.agencia} onChange={e => set('agencia', e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Conta</label>
                <input type="text" value={form.conta} onChange={e => set('conta', e.target.value)} className={inp} /></div>
              <div><label className={lbl}>PIX</label>
                <input type="text" value={form.pix} onChange={e => set('pix', e.target.value)} className={inp} /></div>
            </div>
          </section>

          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button type="submit" disabled={loading}
              className="px-6 py-2.5 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50">
              {loading ? 'Salvando...' : 'Salvar configurações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
