'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import SearchInput from '@/components/SearchInput'

const TIPOS: Record<string, { label: string; color: string }> = {
  trabalhista: { label: 'Trabalhista', color: 'bg-red-100 text-red-700' },
  civel: { label: 'Cível', color: 'bg-blue-100 text-blue-700' },
  tributario: { label: 'Tributário', color: 'bg-amber-100 text-amber-700' },
  ambiental: { label: 'Ambiental', color: 'bg-green-100 text-green-700' },
  administrativo: { label: 'Administrativo', color: 'bg-purple-100 text-purple-700' },
  criminal: { label: 'Criminal', color: 'bg-gray-100 text-gray-700' },
}

const STATUS: Record<string, { label: string; color: string }> = {
  inicial: { label: 'Inicial', color: 'bg-gray-100 text-gray-600' },
  em_andamento: { label: 'Em andamento', color: 'bg-blue-100 text-blue-700' },
  aguardando_audiencia: { label: 'Aguardando audiência', color: 'bg-amber-100 text-amber-700' },
  aguardando_sentenca: { label: 'Aguardando sentença', color: 'bg-orange-100 text-orange-700' },
  recurso: { label: 'Recurso', color: 'bg-purple-100 text-purple-700' },
  acordo: { label: 'Acordo', color: 'bg-green-100 text-green-700' },
  encerrado: { label: 'Encerrado', color: 'bg-gray-200 text-gray-500' },
  arquivado: { label: 'Arquivado', color: 'bg-gray-100 text-gray-400' },
}

const PROGNOSTICOS: Record<string, { label: string; color: string }> = {
  provavel: { label: 'Provável', color: 'bg-red-100 text-red-700' },
  possivel: { label: 'Possível', color: 'bg-amber-100 text-amber-700' },
  remoto: { label: 'Remoto', color: 'bg-green-100 text-green-700' },
}

export default function ProcessosPage() {
  const [processos, setProcessos] = useState<any[]>([])
  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const PAGE_SIZE = 100
  const supabase = createClient()

  useEffect(() => { load() }, [page])

  async function load() {
    setLoading(true)
    const from = (page - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    const { data, count } = await supabase
      .from('processos_juridicos')
      .select('*, advogados(nome), funcionarios(nome), obras(nome)', { count: 'exact' })
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(from, to)

    setProcessos(data ?? [])
    setTotalCount(count ?? 0)
    setLoading(false)
  }

  const filtered = processos.filter(p => {
    const matchBusca = !busca ||
      p.numero_cnj?.toLowerCase().includes(busca.toLowerCase()) ||
      p.parte_contraria?.toLowerCase().includes(busca.toLowerCase()) ||
      p.objeto?.toLowerCase().includes(busca.toLowerCase())
    const matchTipo = filtroTipo === 'todos' || p.tipo === filtroTipo
    const matchStatus = filtroStatus === 'todos' || p.status === filtroStatus
    return matchBusca && matchTipo && matchStatus
  })

  const fmt = (v: number | null) => v ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'

  // KPIs
  const ativos = processos.filter(p => p.status !== 'encerrado' && p.status !== 'arquivado')
  const totalProvisionado = processos.reduce((s, p) => s + (p.valor_provisionado || 0), 0)
  const provisoesProvaveis = processos.filter(p => p.prognostico === 'provavel').reduce((s, p) => s + (p.valor_provisionado || 0), 0)
  const semPrognostico30 = processos.filter(p => {
    if (p.prognostico) return false
    if (!p.created_at) return true
    const diff = (Date.now() - new Date(p.created_at).getTime()) / 86400000
    return diff >= 30
  }).length

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold font-display text-brand">Processos Jurídicos</h1>
          <p className="text-sm text-gray-500 mt-0.5">{totalCount} processo(s) cadastrado(s)</p>
        </div>
        <Link href="/juridico/processos/novo" className="px-4 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark">
          + Novo processo
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase">Ativos</p>
          <p className="text-2xl font-bold text-brand">{ativos.length}</p>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase">Provisionado total</p>
          <p className="text-2xl font-bold text-gray-800">{fmt(totalProvisionado)}</p>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase">Provisões prováveis</p>
          <p className="text-2xl font-bold text-red-600">{fmt(provisoesProvaveis)}</p>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase">Sem prognóstico 30+ dias</p>
          <p className="text-2xl font-bold text-amber-600">{semPrognostico30}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <SearchInput value={busca} onChange={setBusca} placeholder="Buscar CNJ, parte contrária..." />
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          <option value="todos">Todos os tipos</option>
          {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          <option value="todos">Todos os status</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400 py-10 text-center">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-gray-400 py-10 text-center">Nenhum processo encontrado.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-3">N CNJ</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Parte contrária</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Prognóstico</th>
                <th className="px-4 py-3 text-right">Valor causa</th>
                <th className="px-4 py-3">Advogado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">
                    <Link href={`/juridico/processos/${p.id}`} className="text-brand hover:underline">
                      {p.numero_cnj || '—'}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TIPOS[p.tipo]?.color ?? 'bg-gray-100 text-gray-600'}`}>
                      {TIPOS[p.tipo]?.label ?? p.tipo ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">{p.parte_contraria || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS[p.status]?.color ?? 'bg-gray-100 text-gray-600'}`}>
                      {STATUS[p.status]?.label ?? p.status ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {p.prognostico ? (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PROGNOSTICOS[p.prognostico]?.color ?? 'bg-gray-100 text-gray-600'}`}>
                        {PROGNOSTICOS[p.prognostico]?.label ?? p.prognostico}
                      </span>
                    ) : <span className="text-gray-400 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">{fmt(p.valor_causa)}</td>
                  <td className="px-4 py-3 text-gray-600">{p.advogados?.nome ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-gray-500">Página {page} de {totalPages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 border rounded-lg disabled:opacity-40">Anterior</button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 border rounded-lg disabled:opacity-40">Próxima</button>
          </div>
        </div>
      )}
    </div>
  )
}
