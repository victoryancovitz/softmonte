'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import BackButton from '@/components/BackButton'
import { Search, Check, Users } from 'lucide-react'

type Func = { id: string; nome: string; cargo: string | null; status: string | null; deleted_at: string | null }
type AtivaMap = Record<string, { id: string; obra_nome: string; cargo_na_obra: string | null; data_inicio: string | null }[]>

export default function NovaAlocacaoPage() {
  const [funcionarios, setFuncionarios] = useState<Func[]>([])
  const [obras, setObras] = useState<any[]>([])
  const [ativasMap, setAtivasMap] = useState<AtivaMap>({})
  const [incluirArquivados, setIncluirArquivados] = useState(false)
  const [busca, setBusca] = useState('')
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [form, setForm] = useState({
    obra_id: '', data_inicio: '', data_fim: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resultados, setResultados] = useState<{ nome: string; ok: boolean; msg?: string }[] | null>(null)
  const router = useRouter()
  const supabase = createClient()

  async function loadFuncionarios() {
    let q = supabase.from('funcionarios').select('id,nome,cargo,status,deleted_at').order('nome')
    if (!incluirArquivados) q = q.is('deleted_at', null)
    const { data } = await q
    setFuncionarios((data as Func[]) ?? [])
  }

  useEffect(() => { loadFuncionarios() }, [incluirArquivados])
  useEffect(() => {
    supabase.from('obras').select('id,nome,cliente').eq('status', 'ativo').is('deleted_at', null).order('nome')
      .then(({ data }) => setObras(data ?? []))
  }, [])

  // Carrega mapa de alocações ativas de todos funcionários visíveis (para badge "já alocado")
  useEffect(() => {
    if (funcionarios.length === 0) return
    const ids = funcionarios.map(f => f.id)
    supabase.from('alocacoes')
      .select('id, funcionario_id, obra_id, cargo_na_obra, data_inicio, obras(nome)')
      .in('funcionario_id', ids)
      .eq('ativo', true)
      .then(({ data }) => {
        const map: AtivaMap = {}
        ;(data ?? []).forEach((a: any) => {
          const fid = a.funcionario_id
          if (!map[fid]) map[fid] = []
          map[fid].push({
            id: a.id,
            obra_nome: a.obras?.nome || '(obra)',
            cargo_na_obra: a.cargo_na_obra,
            data_inicio: a.data_inicio,
          })
        })
        setAtivasMap(map)
      })
  }, [funcionarios])

  const funcionariosFiltrados = useMemo(() => {
    const s = busca.trim().toLowerCase()
    if (!s) return funcionarios
    return funcionarios.filter(f =>
      f.nome.toLowerCase().includes(s) || (f.cargo || '').toLowerCase().includes(s)
    )
  }, [funcionarios, busca])

  function toggle(id: string) {
    setSelecionados(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selecionarTodosFiltrados() {
    setSelecionados(prev => {
      const next = new Set(prev)
      funcionariosFiltrados.forEach(f => next.add(f.id))
      return next
    })
  }

  function limparSelecao() {
    setSelecionados(new Set())
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setResultados(null)

    if (selecionados.size === 0) {
      setError('Selecione ao menos um funcionário.')
      return
    }
    if (!form.obra_id) {
      setError('Selecione uma obra.')
      return
    }
    if (form.data_fim && form.data_inicio && form.data_fim < form.data_inicio) {
      setError('A data de fim não pode ser anterior à data de início.')
      return
    }

    const selList = funcionarios.filter(f => selecionados.has(f.id))

    // Conflitos: arquivados
    const arquivados = selList.filter(f => f.deleted_at)
    if (arquivados.length > 0) {
      const detalhe = arquivados.map(f =>
        `• ${f.nome} (desligado em ${new Date(f.deleted_at!).toLocaleDateString('pt-BR')})`
      ).join('\n')
      const ok = window.confirm(
        `ATENÇÃO: ${arquivados.length} funcionário(s) arquivado(s):\n\n${detalhe}\n\n` +
        `Use somente para:\n` +
        `• Readmissão (reativar no sistema)\n` +
        `• Fechamento retroativo de ponto/folha\n\n` +
        `Deseja prosseguir?`
      )
      if (!ok) return
    }

    setLoading(true)

    // Valida obra ainda ativa
    const { data: freshObra } = await supabase.from('obras')
      .select('status, deleted_at').eq('id', form.obra_id).maybeSingle()
    if (!freshObra || (freshObra as any).deleted_at || (freshObra as any).status !== 'ativo') {
      setError('Obra não está mais ativa.')
      setLoading(false)
      return
    }

    // Cria uma alocação por funcionário selecionado
    const res: { nome: string; ok: boolean; msg?: string }[] = []
    for (const f of selList) {
      const { error: insErr } = await supabase.from('alocacoes').insert({
        funcionario_id: f.id,
        obra_id: form.obra_id,
        cargo_na_obra: f.cargo || null,
        data_inicio: form.data_inicio || new Date().toISOString().slice(0, 10),
        data_fim: form.data_fim || null,
        ativo: true,
      })
      if (insErr) {
        res.push({ nome: f.nome, ok: false, msg: insErr.message })
        continue
      }
      // Atualiza status apenas se não arquivado
      if (!f.deleted_at) {
        await supabase.from('funcionarios').update({ status: 'alocado' }).eq('id', f.id)
      }
      res.push({ nome: f.nome, ok: true })
    }

    setLoading(false)
    setResultados(res)

    const todosOk = res.every(r => r.ok)
    if (todosOk) {
      setTimeout(() => router.push('/alocacao'), 800)
    }
  }

  const totalSel = selecionados.size

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/alocacao" />
        <Link href="/alocacao" className="text-gray-400 hover:text-gray-600">Alocação</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium">Nova alocação</span>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h1 className="text-lg font-bold font-display text-brand mb-1">Nova alocação</h1>
        <p className="text-xs text-gray-500 mb-5">
          Selecione um ou mais funcionários para alocar na mesma obra. A presença efetiva do dia é definida pelo ponto do colaborador.
        </p>

        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200">{error}</div>}

        {resultados && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="text-sm font-semibold text-blue-800 mb-1">
              Resultado: {resultados.filter(r => r.ok).length}/{resultados.length} criada(s)
            </div>
            <ul className="text-xs text-blue-700 space-y-0.5">
              {resultados.map((r, i) => (
                <li key={i} className={r.ok ? '' : 'text-red-700'}>
                  {r.ok ? '✓' : '✗'} {r.nome}{r.msg ? ` — ${r.msg}` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Obra */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Obra *</label>
            <select required value={form.obra_id} onChange={e => setForm(f => ({ ...f, obra_id: e.target.value }))}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
              <option value="">Selecione a obra...</option>
              {obras.map((o: any) => <option key={o.id} value={o.id}>{o.nome} — {o.cliente}</option>)}
            </select>
          </div>

          {/* Funcionários — multi-select */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                Funcionários * {totalSel > 0 && <span className="text-brand">({totalSel} selecionado{totalSel > 1 ? 's' : ''})</span>}
              </label>
              <label className="flex items-center gap-1.5 text-[11px] text-gray-500 cursor-pointer">
                <input type="checkbox" checked={incluirArquivados} onChange={e => setIncluirArquivados(e.target.checked)}
                  className="rounded border-gray-300 text-brand w-3.5 h-3.5" />
                Incluir arquivados
              </label>
            </div>

            <div className="relative mb-2">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
                placeholder="Buscar por nome ou cargo..."
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>

            <div className="flex items-center justify-between mb-2 text-[11px]">
              <div className="text-gray-500">
                {funcionariosFiltrados.length} funcionário(s) {busca && 'encontrado(s)'}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={selecionarTodosFiltrados}
                  className="text-brand font-semibold hover:underline">Selecionar todos</button>
                {totalSel > 0 && (
                  <button type="button" onClick={limparSelecao}
                    className="text-gray-500 hover:underline">Limpar ({totalSel})</button>
                )}
              </div>
            </div>

            <div className="border border-gray-200 rounded-xl max-h-80 overflow-y-auto divide-y divide-gray-100">
              {funcionariosFiltrados.length === 0 && (
                <div className="p-4 text-center text-sm text-gray-400">Nenhum funcionário encontrado</div>
              )}
              {funcionariosFiltrados.map(f => {
                const sel = selecionados.has(f.id)
                const ativas = ativasMap[f.id] || []
                return (
                  <label key={f.id}
                    className={`flex items-start gap-3 p-3 cursor-pointer hover:bg-gray-50 ${sel ? 'bg-brand/5' : ''}`}>
                    <div className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${
                      sel ? 'bg-brand border-brand' : 'border-gray-300 bg-white'
                    }`}>
                      {sel && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <input type="checkbox" checked={sel} onChange={() => toggle(f.id)} className="sr-only" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900">{f.nome}</span>
                        <span className="text-xs text-gray-500">{f.cargo || 's/ cargo'}</span>
                        {f.deleted_at && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-semibold">ARQUIVADO</span>
                        )}
                        {ativas.length > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded font-semibold">
                            {ativas.length} alocação{ativas.length > 1 ? 'ões' : ''}
                          </span>
                        )}
                      </div>
                      {ativas.length > 0 && (
                        <div className="text-[11px] text-gray-500 mt-0.5 truncate">
                          em: {ativas.map(a => a.obra_nome).join(', ')}
                        </div>
                      )}
                    </div>
                  </label>
                )
              })}
            </div>
            {incluirArquivados && (
              <p className="text-[11px] text-amber-600 mt-1">⚠ Arquivados só para readmissão ou fechamento retroativo.</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Data de início</label>
              <input type="date" value={form.data_inicio} onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Data prevista de fim <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <input type="date" value={form.data_fim} onChange={e => setForm(f => ({ ...f, data_fim: e.target.value }))}
                min={form.data_inicio}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading || totalSel === 0}
              className="px-6 py-2.5 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50">
              {loading ? 'Salvando...' : totalSel > 1 ? `Criar ${totalSel} alocações` : 'Salvar alocação'}
            </button>
            <Link href="/alocacao" className="px-6 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</Link>
          </div>
        </form>
      </div>
    </div>
  )
}
