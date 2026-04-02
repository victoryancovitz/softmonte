'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import BackButton from '@/components/BackButton'

const CARGOS = ['Caldeireiro','Soldador','Mecanico','Tubulador','Eletricista','Montador','Servente','Pintor industrial','Inspetor de solda','Encarregado','Ajudante']

export default function EditarFuncionarioPage({ params }: { params: { id: string } }) {
  const [form, setForm] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.from('funcionarios').select('*').eq('id', params.id).single().then(({ data }) => {
      if (data) setForm(data)
      setLoading(false)
    })
  }, [params.id])

  function set(field: string, value: any) { setForm((f: any) => ({ ...f, [field]: value })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const { error } = await supabase.from('funcionarios').update({
      nome: form.nome, matricula: form.matricula, cargo: form.cargo,
      turno: form.turno, jornada_horas: parseInt(form.jornada_horas) || 8,
      custo_hora: form.custo_hora ? parseFloat(form.custo_hora) : null,
      custo_hora_extra: form.custo_hora_extra ? parseFloat(form.custo_hora_extra) : null,
      custo_hora_noturno: form.custo_hora_noturno ? parseFloat(form.custo_hora_noturno) : null,
      status: form.status, re: form.re || null, cpf: form.cpf || null,
      pis: form.pis || null, banco: form.banco || null,
      agencia_conta: form.agencia_conta || null, pix: form.pix || null,
      vt_estrutura: form.vt_estrutura || null,
      tamanho_bota: form.tamanho_bota || null, tamanho_uniforme: form.tamanho_uniforme || null,
      admissao: form.admissao || null, prazo1: form.prazo1 || null, prazo2: form.prazo2 || null,
      periodo_contrato: form.periodo_contrato || '45 DIAS',
    }).eq('id', params.id)
    if (error) { setError(error.message); setSaving(false); return }
    setSuccess(true)
    setTimeout(() => router.push(`/funcionarios/${params.id}`), 1200)
  }

  if (loading) return <div className="p-6 text-sm text-gray-400">Carregando...</div>

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/funcionarios" />
        <Link href="/funcionarios" className="text-gray-400 hover:text-gray-600">Funcionários</Link>
        <span className="text-gray-300">/</span>
        <Link href={`/funcionarios/${params.id}`} className="text-gray-400 hover:text-gray-600">{form.nome}</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700">Editar</span>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h1 className="text-lg font-bold font-display text-brand mb-6">Editar funcionário</h1>
        {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl">Atualizado! Redirecionando...</div>}
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Identificação</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs font-semibold text-gray-700 mb-1">Nome completo *</label>
                <input required type="text" value={form.nome ?? ''} onChange={e => set('nome', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"/></div>
              <div><label className="block text-xs font-semibold text-gray-700 mb-1">Matrícula *</label>
                <input required type="text" value={form.matricula ?? ''} onChange={e => set('matricula', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"/></div>
              <div><label className="block text-xs font-semibold text-gray-700 mb-1">RE</label>
                <input type="text" value={form.re ?? ''} onChange={e => set('re', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"/></div>
              <div><label className="block text-xs font-semibold text-gray-700 mb-1">CPF</label>
                <input type="text" value={form.cpf ?? ''} onChange={e => set('cpf', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"/></div>
              <div><label className="block text-xs font-semibold text-gray-700 mb-1">PIS</label>
                <input type="text" value={form.pis ?? ''} onChange={e => set('pis', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"/></div>
              <div><label className="block text-xs font-semibold text-gray-700 mb-1">Status</label>
                <select value={form.status ?? 'disponivel'} onChange={e => set('status', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
                  <option value="disponivel">Disponível</option><option value="alocado">Alocado</option>
                  <option value="afastado">Afastado</option><option value="inativo">Inativo</option>
                </select></div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Função e custos</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs font-semibold text-gray-700 mb-1">Cargo *</label>
                <select required value={form.cargo ?? ''} onChange={e => set('cargo', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
                  <option value="">Selecione...</option>
                  {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
                </select></div>
              <div><label className="block text-xs font-semibold text-gray-700 mb-1">Turno</label>
                <select value={form.turno ?? 'diurno'} onChange={e => set('turno', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
                  <option value="diurno">Diurno</option><option value="noturno">Noturno</option><option value="misto">Misto</option>
                </select></div>
              <div><label className="block text-xs font-semibold text-gray-700 mb-1">Custo/hora normal (R$)</label>
                <input type="number" step="0.01" value={form.custo_hora ?? ''} onChange={e => set('custo_hora', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"/></div>
              <div><label className="block text-xs font-semibold text-gray-700 mb-1">Custo hora extra (R$)</label>
                <input type="number" step="0.01" value={form.custo_hora_extra ?? ''} onChange={e => set('custo_hora_extra', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"/></div>
              <div><label className="block text-xs font-semibold text-gray-700 mb-1">VT Estrutura</label>
                <input type="text" value={form.vt_estrutura ?? ''} onChange={e => set('vt_estrutura', e.target.value)} placeholder="ex: 10+7,25+7,25" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"/></div>
              <div><label className="block text-xs font-semibold text-gray-700 mb-1">Período contrato</label>
                <input type="text" value={form.periodo_contrato ?? '45 DIAS'} onChange={e => set('periodo_contrato', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"/></div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Datas contratuais</h3>
            <div className="grid grid-cols-3 gap-4">
              <div><label className="block text-xs font-semibold text-gray-700 mb-1">Admissão</label>
                <input type="date" value={form.admissao ?? ''} onChange={e => set('admissao', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"/></div>
              <div><label className="block text-xs font-semibold text-gray-700 mb-1">Prazo 1</label>
                <input type="date" value={form.prazo1 ?? ''} onChange={e => set('prazo1', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"/></div>
              <div><label className="block text-xs font-semibold text-gray-700 mb-1">Prazo 2</label>
                <input type="date" value={form.prazo2 ?? ''} onChange={e => set('prazo2', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"/></div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Banco e pagamento</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs font-semibold text-gray-700 mb-1">Banco</label>
                <input type="text" value={form.banco ?? ''} onChange={e => set('banco', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"/></div>
              <div><label className="block text-xs font-semibold text-gray-700 mb-1">Agência / Conta</label>
                <input type="text" value={form.agencia_conta ?? ''} onChange={e => set('agencia_conta', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"/></div>
              <div><label className="block text-xs font-semibold text-gray-700 mb-1">PIX</label>
                <input type="text" value={form.pix ?? ''} onChange={e => set('pix', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"/></div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">EPIs</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs font-semibold text-gray-700 mb-1">Tamanho Bota</label>
                <input type="text" value={form.tamanho_bota ?? ''} onChange={e => set('tamanho_bota', e.target.value)} placeholder="ex: 42" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"/></div>
              <div><label className="block text-xs font-semibold text-gray-700 mb-1">Tamanho Uniforme</label>
                <input type="text" value={form.tamanho_uniforme ?? ''} onChange={e => set('tamanho_uniforme', e.target.value)} placeholder="ex: G" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"/></div>
            </div>
          </div>

          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button type="submit" disabled={saving || success}
              className="px-6 py-2.5 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50 transition-colors">
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
            <Link href={`/funcionarios/${params.id}`} className="px-6 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</Link>
          </div>
        </form>
      </div>
    </div>
  )
}
