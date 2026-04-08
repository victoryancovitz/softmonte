'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import BackButton from '@/components/BackButton'
import { AlertTriangle, Users } from 'lucide-react'

export default function NovaAlocacaoPage() {
  const [funcionarios, setFuncionarios] = useState<any[]>([])
  const [obras, setObras] = useState<any[]>([])
  const [outrasAlocacoes, setOutrasAlocacoes] = useState<any[]>([])
  const [incluirArquivados, setIncluirArquivados] = useState(false)
  const [form, setForm] = useState({
    funcionario_id: '', obra_id: '', cargo_na_obra: '',
    data_inicio: '', data_fim: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function loadFuncionarios() {
    let q = supabase.from('funcionarios').select('id,nome,cargo,status,deleted_at').order('nome')
    if (!incluirArquivados) q = q.is('deleted_at', null)
    const { data } = await q
    setFuncionarios(data ?? [])
  }

  useEffect(() => { loadFuncionarios() }, [incluirArquivados])
  useEffect(() => {
    supabase.from('obras').select('id,nome,cliente').eq('status', 'ativo').is('deleted_at', null).order('nome')
      .then(({ data }) => setObras(data ?? []))
  }, [])

  async function checkOutras(funcId: string) {
    if (!funcId) { setOutrasAlocacoes([]); return }
    const { data } = await supabase.from('alocacoes')
      .select('id, obra_id, cargo_na_obra, data_inicio, obras(nome)')
      .eq('funcionario_id', funcId)
      .eq('ativo', true)
    setOutrasAlocacoes(data ?? [])
  }

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
    if (field === 'funcionario_id') {
      checkOutras(value)
      if (value) {
        const func = funcionarios.find((x: any) => x.id === value)
        if (func) setForm(f => ({ ...f, funcionario_id: value, cargo_na_obra: func.cargo || '' }))
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (form.data_fim && form.data_inicio && form.data_fim < form.data_inicio) {
      setError('A data de fim não pode ser anterior à data de início.')
      return
    }

    // Se há outras alocações ativas, confirma antes de prosseguir
    if (outrasAlocacoes.length > 0) {
      const nomes = outrasAlocacoes.map((a: any) => a.obras?.nome || '(obra)').join(', ')
      const ok = window.confirm(
        `Este funcionário já tem ${outrasAlocacoes.length} alocação(ões) ativa(s) em: ${nomes}.\n\n` +
        `A presença dele é controlada pelo ponto — ele não pode estar em dois lugares ao mesmo tempo, ` +
        `então registre o ponto em apenas uma das obras por dia.\n\n` +
        `Deseja criar esta alocação mesmo assim?`
      )
      if (!ok) return
    }

    // Se o funcionário está arquivado, avisa (pode ser readmissão ou ajuste retroativo)
    const func = funcionarios.find((f: any) => f.id === form.funcionario_id)
    if (func?.deleted_at) {
      const ok = window.confirm(
        `ATENÇÃO: ${func.nome} está arquivado (desligado em ${new Date(func.deleted_at).toLocaleDateString('pt-BR')}).\n\n` +
        `Use esta opção somente para:\n` +
        `• Readmissão (reativar o funcionário no sistema)\n` +
        `• Fechamento retroativo de ponto/folha\n\n` +
        `Deseja prosseguir?`
      )
      if (!ok) return
    }

    setLoading(true)

    const { data: freshObra } = await supabase.from('obras')
      .select('status, deleted_at').eq('id', form.obra_id).maybeSingle()
    if (!freshObra || (freshObra as any).deleted_at || (freshObra as any).status !== 'ativo') {
      setError('Obra não está mais ativa.')
      setLoading(false)
      return
    }

    const { error: insErr } = await supabase.from('alocacoes').insert({
      funcionario_id: form.funcionario_id,
      obra_id: form.obra_id,
      cargo_na_obra: form.cargo_na_obra || null,
      data_inicio: form.data_inicio || new Date().toISOString().slice(0, 10),
      data_fim: form.data_fim || null,
      ativo: true,
    })
    if (insErr) { setError(insErr.message); setLoading(false); return }

    // Atualiza status para alocado APENAS se o funcionário não está arquivado
    if (!func?.deleted_at) {
      await supabase.from('funcionarios').update({ status: 'alocado' }).eq('id', form.funcionario_id)
    }

    router.push('/alocacao')
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/alocacao" />
        <Link href="/alocacao" className="text-gray-400 hover:text-gray-600">Alocação</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium">Nova alocação</span>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h1 className="text-lg font-bold font-display text-brand mb-1">Nova alocação</h1>
        <p className="text-xs text-gray-500 mb-5">
          Um funcionário pode estar alocado em mais de uma obra — a presença é controlada pelo ponto diário.
        </p>

        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200">{error}</div>}

        {outrasAlocacoes.length > 0 && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <strong className="text-sm text-amber-800">
                  Já tem {outrasAlocacoes.length} alocação{outrasAlocacoes.length > 1 ? 'ões' : ''} ativa{outrasAlocacoes.length > 1 ? 's' : ''}:
                </strong>
                <ul className="text-xs text-amber-700 mt-1 space-y-0.5">
                  {outrasAlocacoes.map((a: any) => (
                    <li key={a.id}>
                      • {a.obras?.nome} {a.cargo_na_obra && `— ${a.cargo_na_obra}`}
                      {a.data_inicio && ` (desde ${new Date(a.data_inicio + 'T12:00').toLocaleDateString('pt-BR')})`}
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-amber-600 mt-2 italic">
                  A multi-alocação é permitida mas a presença será rateada via ponto.
                </p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-semibold text-gray-700">Funcionário *</label>
              <label className="flex items-center gap-1.5 text-[11px] text-gray-500 cursor-pointer">
                <input type="checkbox" checked={incluirArquivados} onChange={e => setIncluirArquivados(e.target.checked)}
                  className="rounded border-gray-300 text-brand w-3.5 h-3.5" />
                Incluir arquivados
              </label>
            </div>
            <select required value={form.funcionario_id} onChange={e => set('funcionario_id', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
              <option value="">Selecione o funcionário...</option>
              {funcionarios.map((f: any) => (
                <option key={f.id} value={f.id}>
                  {f.nome} — {f.cargo || 's/ cargo'}
                  {f.deleted_at ? ' [ARQUIVADO]' : f.status === 'alocado' ? ' (alocado)' : ''}
                </option>
              ))}
            </select>
            {incluirArquivados && (
              <p className="text-[11px] text-amber-600 mt-1">⚠ Arquivados só para readmissão ou fechamento retroativo.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Obra *</label>
            <select required value={form.obra_id} onChange={e => set('obra_id', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
              <option value="">Selecione a obra...</option>
              {obras.map((o: any) => <option key={o.id} value={o.id}>{o.nome} — {o.cliente}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Cargo na obra</label>
              <input type="text" value={form.cargo_na_obra} onChange={e => set('cargo_na_obra', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Data de início</label>
              <input type="date" value={form.data_inicio} onChange={e => set('data_inicio', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Data prevista de fim <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <input type="date" value={form.data_fim} onChange={e => set('data_fim', e.target.value)}
              min={form.data_inicio}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
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
