'use client'
import { useState, useEffect, Fragment, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import SearchInput from '@/components/SearchInput'
import BackButton from '@/components/BackButton'
import { useToast } from '@/components/Toast'
import { ShieldCheck, ChevronDown, ChevronUp, RotateCcw, Activity, Trash2, Clock } from 'lucide-react'

const PAGE_SIZE = 20

const ACAO_BADGE: Record<string, { label: string; cls: string }> = {
  INSERT: { label: 'INSERT', cls: 'bg-green-100 text-green-700' },
  UPDATE: { label: 'UPDATE', cls: 'bg-amber-100 text-amber-700' },
  DELETE: { label: 'DELETE', cls: 'bg-red-100 text-red-700' },
}

const TABELA_LABEL: Record<string, string> = {
  funcionarios: 'Funcionarios',
  boletins_medicao: 'Boletim de Medicao',
  bm_itens: 'Itens do BM',
  financeiro_lancamentos: 'Lancamentos',
  obras: 'Obras',
  correcoes_salariais: 'Correcoes Salariais',
  desligamentos_workflow: 'Desligamentos',
  alocacoes: 'Alocacoes',
  admissoes_workflow: 'Admissoes',
  efetivo_diario: 'Efetivo Diario',
  hh_lancamentos: 'HH Lancamentos',
  folha_fechamentos: 'Folha',
  rescisoes: 'Rescisoes',
}

function fmtVal(val: unknown): string | JSX.Element {
  if (val === null || val === undefined)
    return <span className="text-gray-300 italic text-[10px]">vazio</span> as any
  if (typeof val === 'boolean')
    return (
      <span
        className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${val ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
      >
        {val ? 'Sim' : 'Nao'}
      </span>
    ) as any
  if (typeof val === 'string') {
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(val)) return val.slice(0, 8) + '...'
    if (/^\d{4}-\d{2}-\d{2}(T|\s)/.test(val)) {
      try {
        return (
          new Date(val).toLocaleDateString('pt-BR') +
          ' ' +
          new Date(val).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        )
      } catch {
        return val
      }
    }
    return val
  }
  if (typeof val === 'number') return val.toLocaleString('pt-BR')
  if (typeof val === 'object') return JSON.stringify(val).slice(0, 120)
  return String(val)
}

function formatDate(iso: string) {
  if (!iso) return '--'
  const d = new Date(iso)
  return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
}

export default function AdminAuditoriaPage() {
  const supabase = createClient()
  const toast = useToast()

  const [logs, setLogs] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Filters
  const [busca, setBusca] = useState('')
  const [tabela, setTabela] = useState('')
  const [acao, setAcao] = useState('')
  const [dataDe, setDataDe] = useState('')
  const [dataAte, setDataAte] = useState('')

  // Stats
  const [statsTotal, setStatsTotal] = useState(0)
  const [stats24h, setStats24h] = useState(0)
  const [statsRecuperaveis, setStatsRecuperaveis] = useState(0)

  // Distinct table names for filter
  const [tabelasDisponiveis, setTabelasDisponiveis] = useState<string[]>([])

  // Restoring state
  const [restoring, setRestoring] = useState<string | null>(null)

  useEffect(() => {
    loadStats()
    loadDistinctTabelas()
  }, [])

  useEffect(() => {
    loadData()
  }, [page, tabela, acao, dataDe, dataAte, busca])

  async function loadStats() {
    const agora = new Date()
    const ontem = new Date(agora.getTime() - 24 * 60 * 60 * 1000).toISOString()

    const [totalRes, last24hRes] = await Promise.all([
      supabase.from('audit_log').select('id', { count: 'exact', head: true }),
      supabase.from('audit_log').select('id', { count: 'exact', head: true }).gte('created_at', ontem),
    ])

    setStatsTotal(totalRes.count ?? 0)
    setStats24h(last24hRes.count ?? 0)

    // Count recoverable soft-deletes: logs where dados_depois has deleted_at set
    const { data: delLogs } = await supabase
      .from('audit_log')
      .select('id, acao, dados_depois')
      .or('acao.eq.DELETE,acao.eq.UPDATE')
      .not('dados_depois', 'is', null)
      .limit(2000)

    const recoveraveis = (delLogs ?? []).filter((l: any) => {
      const depois = l.dados_depois
      return depois && depois.deleted_at
    })
    setStatsRecuperaveis(recoveraveis.length)
  }

  async function loadDistinctTabelas() {
    const { data } = await supabase
      .from('audit_log')
      .select('tabela')
      .limit(5000)

    if (data) {
      const unique = Array.from(new Set(data.map((r: any) => r.tabela).filter(Boolean))).sort() as string[]
      setTabelasDisponiveis(unique)
    }
  }

  async function loadData() {
    setLoading(true)
    let q = supabase
      .from('audit_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (tabela) q = q.eq('tabela', tabela)
    if (acao) q = q.eq('acao', acao)
    if (dataDe) q = q.gte('created_at', dataDe)
    if (dataAte) q = q.lte('created_at', dataAte + 'T23:59:59')
    if (busca.trim()) q = q.ilike('usuario_nome', `%${busca.trim()}%`)

    const { data, count } = await q
    setLogs(data ?? [])
    setTotal(count ?? 0)
    setLoading(false)
  }

  function clearFilters() {
    setBusca('')
    setTabela('')
    setAcao('')
    setDataDe('')
    setDataAte('')
    setPage(0)
  }

  function isSoftDeleteRecoverable(log: any): boolean {
    if (!log.dados_depois) return false
    if (!log.dados_depois.deleted_at) return false
    if (!log.tabela || !log.registro_id) return false
    return true
  }

  async function handleRestore(log: any) {
    if (!log.tabela || !log.registro_id) return
    setRestoring(log.id)
    try {
      const { error } = await supabase
        .from(log.tabela)
        .update({ deleted_at: null, deleted_by: null })
        .eq('id', log.registro_id)

      if (error) {
        toast.error('Erro ao restaurar: ' + error.message)
      } else {
        toast.success('Registro restaurado')
        loadData()
        loadStats()
      }
    } catch (e: any) {
      toast.error('Erro ao restaurar: ' + e.message)
    } finally {
      setRestoring(null)
    }
  }

  const hasFilter = !!(busca || tabela || acao || dataDe || dataAte)
  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <BackButton fallback="/admin/usuarios" />
        <ShieldCheck className="w-6 h-6 text-brand" />
        <h1 className="text-xl font-bold font-display text-brand">Auditoria & Recuperacao</h1>
      </div>
      <p className="text-sm text-gray-500 mb-5 ml-10">
        Log completo de acoes e recuperacao de registros excluidos.
      </p>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-4 h-4 text-gray-400" />
            <span className="text-[10px] font-bold text-gray-400 uppercase">Total no log</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 font-display">
            {statsTotal.toLocaleString('pt-BR')}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="text-[10px] font-bold text-gray-400 uppercase">Ultimas 24h</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 font-display">
            {stats24h.toLocaleString('pt-BR')}
            <span className="text-sm font-normal text-gray-400 ml-1">acoes</span>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Trash2 className="w-4 h-4 text-gray-400" />
            <span className="text-[10px] font-bold text-gray-400 uppercase">Deletados recuperaveis</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 font-display">
            {statsRecuperaveis.toLocaleString('pt-BR')}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-3">
        <SearchInput
          value={busca}
          onChange={(v: string) => {
            setBusca(v)
            setPage(0)
          }}
          placeholder="Buscar por nome do usuario..."
        />
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={tabela}
          onChange={(e) => {
            setTabela(e.target.value)
            setPage(0)
          }}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
        >
          <option value="">Todas as tabelas</option>
          {tabelasDisponiveis.map((t) => (
            <option key={t} value={t}>
              {TABELA_LABEL[t] || t}
            </option>
          ))}
        </select>
        <select
          value={acao}
          onChange={(e) => {
            setAcao(e.target.value)
            setPage(0)
          }}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
        >
          <option value="">Todas as acoes</option>
          <option value="INSERT">INSERT</option>
          <option value="UPDATE">UPDATE</option>
          <option value="DELETE">DELETE</option>
        </select>
        <div className="flex items-center gap-1">
          <input
            type="date"
            value={dataDe}
            onChange={(e) => {
              setDataDe(e.target.value)
              setPage(0)
            }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
          <span className="text-gray-400 text-xs">a</span>
          <input
            type="date"
            value={dataAte}
            onChange={(e) => {
              setDataAte(e.target.value)
              setPage(0)
            }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
        </div>
        {hasFilter && (
          <button
            onClick={clearFilters}
            className="px-3 py-2 text-xs text-brand font-semibold hover:underline"
          >
            Limpar filtros
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400 self-center">
          {total.toLocaleString('pt-BR')} registro(s)
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="w-8 px-2 py-3"></th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                Data/Hora
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                Usuario
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                Acao
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                Tabela
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                Registro
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                Detalhes
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                  Carregando...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                  Nenhum registro encontrado.
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const badge = ACAO_BADGE[log.acao] || {
                  label: log.acao,
                  cls: 'bg-gray-100 text-gray-600',
                }
                const isOpen = expandedId === log.id
                const recoverable = isSoftDeleteRecoverable(log)

                return (
                  <Fragment key={log.id}>
                    <tr
                      onClick={() => setExpandedId(isOpen ? null : log.id)}
                      className={`border-b border-gray-50 cursor-pointer transition-colors ${isOpen ? 'bg-brand/5' : 'hover:bg-gray-50'}`}
                    >
                      <td className="px-2 py-3 text-center text-gray-400">
                        {isOpen ? (
                          <ChevronUp className="w-3.5 h-3.5 inline" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 inline" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-gray-700">
                        {log.usuario_nome || log.user_id?.slice(0, 8) || 'Sistema'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${badge.cls}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {TABELA_LABEL[log.tabela] || log.tabela}
                      </td>
                      <td
                        className="px-4 py-3 text-[10px] font-mono text-gray-400"
                        title={log.registro_id}
                      >
                        {log.registro_id ? log.registro_id.slice(0, 8) + '...' : '--'}
                      </td>
                      <td className="px-4 py-3">
                        {log.acao === 'UPDATE' && log.campos_alterados?.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {log.campos_alterados.slice(0, 3).map((c: string) => (
                              <span
                                key={c}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-mono"
                              >
                                {c}
                              </span>
                            ))}
                            {log.campos_alterados.length > 3 && (
                              <span className="text-[10px] text-gray-400">
                                + {log.campos_alterados.length - 3} mais
                              </span>
                            )}
                          </div>
                        ) : recoverable ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 font-semibold">
                            Recuperavel
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-300">Expandir</span>
                        )}
                      </td>
                    </tr>

                    {/* Expanded diff row */}
                    {isOpen && (
                      <tr>
                        <td colSpan={7} className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-xs font-bold text-gray-600 uppercase">
                              {log.acao === 'INSERT'
                                ? 'Registro criado'
                                : log.acao === 'DELETE'
                                  ? 'Registro excluido'
                                  : 'Campos alterados'}
                              {' -- '}
                              {TABELA_LABEL[log.tabela] || log.tabela}
                            </h4>
                            {recoverable && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleRestore(log)
                                }}
                                disabled={restoring === log.id}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white text-xs font-semibold rounded-lg hover:bg-brand/90 disabled:opacity-50 transition-colors"
                              >
                                <RotateCcw
                                  className={`w-3.5 h-3.5 ${restoring === log.id ? 'animate-spin' : ''}`}
                                />
                                {restoring === log.id ? 'Restaurando...' : 'Restaurar'}
                              </button>
                            )}
                          </div>

                          {log.acao === 'UPDATE' ? (
                            <div className="space-y-1.5">
                              {(log.campos_alterados?.length > 0
                                ? log.campos_alterados
                                : Object.keys(log.dados_depois || {})
                              ).map((key: string) => {
                                const antes = log.dados_antes?.[key]
                                const depois = log.dados_depois?.[key]
                                return (
                                  <div
                                    key={key}
                                    className="flex items-start gap-3 bg-amber-50/50 rounded-lg px-3 py-2"
                                  >
                                    <span className="text-[10px] font-mono font-bold text-gray-600 min-w-[140px] pt-0.5">
                                      {key}
                                    </span>
                                    <span className="text-xs text-red-600 line-through min-w-[120px]">
                                      {fmtVal(antes)}
                                    </span>
                                    <span className="text-gray-400 text-xs">&rarr;</span>
                                    <span className="text-xs text-green-700 font-semibold">
                                      {fmtVal(depois)}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                              {Object.entries(
                                log.acao === 'DELETE'
                                  ? log.dados_antes || {}
                                  : log.dados_depois || {}
                              )
                                .filter(([k]) => k !== 'id')
                                .map(([key, val]) => (
                                  <div
                                    key={key}
                                    className={`rounded-lg px-3 py-1.5 ${log.acao === 'DELETE' ? 'bg-red-50/50' : 'bg-green-50/50'}`}
                                  >
                                    <span className="text-[10px] font-mono text-gray-500 block">
                                      {key}
                                    </span>
                                    <span
                                      className={`text-xs ${log.acao === 'DELETE' ? 'text-red-700' : 'text-green-700'}`}
                                    >
                                      {fmtVal(val)}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-xs text-gray-500">
            Pagina {page + 1} de {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
          >
            Proxima
          </button>
        </div>
      )}
    </div>
  )
}
