'use client'
import { useState, useEffect, Fragment } from 'react'
import { createClient } from '@/lib/supabase'
import SearchInput from '@/components/SearchInput'
import { ShieldCheck, ChevronDown, ChevronUp, Database, RefreshCw } from 'lucide-react'
import { useToast } from '@/components/Toast'

const ACAO_BADGE: Record<string, { label: string; cls: string }> = {
  INSERT: { label: 'Criação', cls: 'bg-green-100 text-green-700' },
  UPDATE: { label: 'Edição', cls: 'bg-amber-100 text-amber-700' },
  DELETE: { label: 'Exclusão', cls: 'bg-red-100 text-red-700' },
}

const TABELA_LABEL: Record<string, string> = {
  funcionarios: 'Funcionários',
  boletins_medicao: 'Boletim de Medição',
  bm_itens: 'Itens do BM',
  financeiro_lancamentos: 'Lançamentos',
  obras: 'Obras',
  correcoes_salariais: 'Correções Salariais',
  desligamentos_workflow: 'Desligamentos',
  alocacoes: 'Alocações',
  admissoes_workflow: 'Admissões',
  efetivo_diario: 'Efetivo Diário',
  hh_lancamentos: 'HH Lançamentos',
  folha_fechamentos: 'Folha',
  rescisoes: 'Rescisões',
}

const TABELAS_FILTER = [
  'funcionarios', 'boletins_medicao', 'bm_itens', 'financeiro_lancamentos',
  'obras', 'correcoes_salariais', 'desligamentos_workflow', 'alocacoes',
  'admissoes_workflow', 'efetivo_diario',
]

const PAGE_SIZE = 50

// === Formatação de valores do diff ===
function fmtVal(val: any): string | JSX.Element {
  if (val === null || val === undefined) return <span className="text-gray-300 italic text-[10px]">vazio</span> as any
  if (typeof val === 'boolean') return <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${val ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{val ? 'Sim' : 'Não'}</span> as any
  if (typeof val === 'string') {
    // UUID
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(val)) return val.slice(0, 8) + '...'
    // ISO date
    if (/^\d{4}-\d{2}-\d{2}(T|\s)/.test(val)) {
      try { return new Date(val).toLocaleDateString('pt-BR') + ' ' + new Date(val).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) } catch { return val }
    }
    return val
  }
  if (typeof val === 'number') return val.toLocaleString('pt-BR')
  if (typeof val === 'object') return JSON.stringify(val).slice(0, 120)
  return String(val)
}

export default function AuditoriaPage() {
  const supabase = createClient()
  const toast = useToast()
  const [tab, setTab] = useState<'log' | 'backups'>('log')

  // === LOG STATE ===
  const [logs, setLogs] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [tabela, setTabela] = useState('')
  const [acao, setAcao] = useState('')
  const [dataDe, setDataDe] = useState('')
  const [dataAte, setDataAte] = useState('')
  const [statsHoje, setStatsHoje] = useState(0)
  const [statsSemana, setStatsSemana] = useState(0)
  const [topUser, setTopUser] = useState('')

  // === BACKUP STATE ===
  const [backups, setBackups] = useState<any[]>([])
  const [backupLoading, setBackupLoading] = useState(false)
  const [backupRunning, setBackupRunning] = useState(false)

  useEffect(() => { loadStats() }, [])
  useEffect(() => { if (tab === 'log') loadData() }, [page, tabela, acao, dataDe, dataAte, busca, tab])
  useEffect(() => { if (tab === 'backups') loadBackups() }, [tab])

  async function loadStats() {
    const hoje = new Date().toISOString().slice(0, 10)
    const semanaAtras = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
    const [{ count: ch }, { count: cs }, { data: top }] = await Promise.all([
      supabase.from('audit_log').select('id', { count: 'exact', head: true }).gte('created_at', hoje),
      supabase.from('audit_log').select('id', { count: 'exact', head: true }).gte('created_at', semanaAtras),
      supabase.from('audit_log').select('usuario_nome').gte('created_at', semanaAtras).not('usuario_nome', 'is', null).limit(1000),
    ])
    setStatsHoje(ch ?? 0)
    setStatsSemana(cs ?? 0)
    if (top && top.length > 0) {
      const freq: Record<string, number> = {}
      top.forEach((r: any) => { if (r.usuario_nome) freq[r.usuario_nome] = (freq[r.usuario_nome] || 0) + 1 })
      const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1])
      setTopUser(sorted[0] ? `${sorted[0][0]} (${sorted[0][1]})` : '—')
    }
  }

  async function loadData() {
    setLoading(true)
    let q = supabase.from('audit_log').select('*', { count: 'exact' })
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

  async function loadBackups() {
    setBackupLoading(true)
    const { data } = await supabase.from('backup_snapshots')
      .select('id, tabela, total_rows, criado_em')
      .order('criado_em', { ascending: false })
      .limit(200)
    setBackups(data ?? [])
    setBackupLoading(false)
  }

  async function runBackupNow() {
    setBackupRunning(true)
    try {
      const res = await fetch('/api/backup-manual', { method: 'POST' })
      const json = await res.json()
      if (json.sucesso) {
        toast.success(`Backup concluído: ${Object.keys(json.tabelas_salvas || {}).length} tabelas`)
        loadBackups()
      } else {
        toast.error('Erros: ' + (json.erros?.join(', ') || 'desconhecido'))
      }
    } catch (e: any) {
      toast.error('Erro ao executar backup: ' + e.message)
    } finally {
      setBackupRunning(false)
    }
  }

  function clearFilters() {
    setBusca(''); setTabela(''); setAcao(''); setDataDe(''); setDataAte(''); setPage(0)
  }

  const hasFilter = !!(busca || tabela || acao || dataDe || dataAte)
  const totalPages = Math.ceil(total / PAGE_SIZE)

  function formatDate(iso: string) {
    if (!iso) return '—'
    const d = new Date(iso)
    return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
  }

  // Group backups by date
  const backupsByDate = backups.reduce<Record<string, any[]>>((acc, b) => {
    const date = b.criado_em?.slice(0, 10) || 'sem-data'
    if (!acc[date]) acc[date] = []
    acc[date].push(b)
    return acc
  }, {})

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <ShieldCheck className="w-6 h-6 text-brand" />
        <h1 className="text-xl font-bold font-display text-brand">Auditoria do Sistema</h1>
      </div>
      <p className="text-sm text-gray-500 mb-5">Registro completo de todas as ações realizadas na plataforma.</p>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-[10px] font-bold text-gray-400 uppercase">Ações hoje</div>
          <div className="text-2xl font-bold text-gray-900 font-display">{statsHoje}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-[10px] font-bold text-gray-400 uppercase">Ações esta semana</div>
          <div className="text-2xl font-bold text-gray-900 font-display">{statsSemana}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-[10px] font-bold text-gray-400 uppercase">Usuário mais ativo (7d)</div>
          <div className="text-sm font-bold text-gray-900 truncate">{topUser || '—'}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-lg w-fit">
        <button onClick={() => setTab('log')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'log' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
          Log de Ações
        </button>
        <button onClick={() => setTab('backups')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'backups' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
          Backups
        </button>
      </div>

      {tab === 'log' ? (
        <>
          {/* Filters */}
          <div className="mb-3">
            <SearchInput value={busca} onChange={v => { setBusca(v); setPage(0) }} placeholder="Buscar por nome do usuário..." />
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            <select value={tabela} onChange={e => { setTabela(e.target.value); setPage(0) }}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
              <option value="">Todas as tabelas</option>
              {TABELAS_FILTER.map(t => <option key={t} value={t}>{TABELA_LABEL[t] || t}</option>)}
            </select>
            <select value={acao} onChange={e => { setAcao(e.target.value); setPage(0) }}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
              <option value="">Todas as ações</option>
              <option value="INSERT">Criação</option>
              <option value="UPDATE">Edição</option>
              <option value="DELETE">Exclusão</option>
            </select>
            <div className="flex items-center gap-1">
              <input type="date" value={dataDe} onChange={e => { setDataDe(e.target.value); setPage(0) }}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              <span className="text-gray-400 text-xs">a</span>
              <input type="date" value={dataAte} onChange={e => { setDataAte(e.target.value); setPage(0) }}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            {hasFilter && (
              <button onClick={clearFilters} className="px-3 py-2 text-xs text-brand font-semibold hover:underline">Limpar filtros</button>
            )}
            <span className="ml-auto text-xs text-gray-400 self-center">{total.toLocaleString('pt-BR')} registro(s)</span>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="w-8 px-2 py-3"></th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Data/hora</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Usuário</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Ação</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tabela</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Registro</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Campos alterados</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Carregando...</td></tr>
                ) : logs.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Nenhum registro encontrado.</td></tr>
                ) : logs.map(log => {
                  const badge = ACAO_BADGE[log.acao] || { label: log.acao, cls: 'bg-gray-100 text-gray-600' }
                  const isOpen = expandedId === log.id
                  const campos = log.campos_alterados as string[] | null
                  return (
                    <Fragment key={log.id}>
                      <tr
                        onClick={() => setExpandedId(isOpen ? null : log.id)}
                        className={`border-b border-gray-50 cursor-pointer transition-colors ${isOpen ? 'bg-brand/5' : 'hover:bg-gray-50'}`}>
                        <td className="px-2 py-3 text-center text-gray-400">
                          {isOpen ? <ChevronUp className="w-3.5 h-3.5 inline" /> : <ChevronDown className="w-3.5 h-3.5 inline" />}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDate(log.created_at)}</td>
                        <td className="px-4 py-3 text-xs font-medium text-gray-700">{log.usuario_nome || 'Sistema'}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${badge.cls}`}>{badge.label}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">{TABELA_LABEL[log.tabela] || log.tabela}</td>
                        <td className="px-4 py-3 text-[10px] font-mono text-gray-400" title={log.registro_id}>
                          {log.registro_id?.slice(0, 8)}...
                        </td>
                        <td className="px-4 py-3">
                          {campos && campos.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {campos.slice(0, 3).map(c => (
                                <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-mono">{c}</span>
                              ))}
                              {campos.length > 3 && <span className="text-[10px] text-gray-400">+ {campos.length - 3} mais</span>}
                            </div>
                          ) : log.acao === 'UPDATE' ? (
                            <span className="text-[10px] text-gray-300">—</span>
                          ) : null}
                        </td>
                      </tr>
                      {/* Diff row */}
                      {isOpen && (
                        <tr>
                          <td colSpan={7} className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-xs font-bold text-gray-600 uppercase">
                                {log.acao === 'INSERT' ? 'Registro criado' : log.acao === 'DELETE' ? 'Registro excluído' : 'Campos alterados'}
                                {' — '}{TABELA_LABEL[log.tabela] || log.tabela}
                              </h4>
                            </div>
                            {log.acao === 'UPDATE' ? (
                              <div className="space-y-1.5">
                                {(campos && campos.length > 0 ? campos : Object.keys(log.dados_depois || {})).map(key => {
                                  const antes = log.dados_antes?.[key]
                                  const depois = log.dados_depois?.[key]
                                  return (
                                    <div key={key} className="flex items-start gap-3 bg-amber-50/50 rounded-lg px-3 py-2">
                                      <span className="text-[10px] font-mono font-bold text-gray-600 min-w-[140px] pt-0.5">{key}</span>
                                      <span className="text-xs text-red-600 line-through min-w-[120px]">{fmtVal(antes)}</span>
                                      <span className="text-gray-400 text-xs">→</span>
                                      <span className="text-xs text-green-700 font-semibold">{fmtVal(depois)}</span>
                                    </div>
                                  )
                                })}
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                                {Object.entries(log.acao === 'DELETE' ? (log.dados_antes || {}) : (log.dados_depois || {}))
                                  .filter(([k]) => k !== 'id')
                                  .map(([key, val]) => (
                                    <div key={key} className={`rounded-lg px-3 py-1.5 ${log.acao === 'DELETE' ? 'bg-red-50/50' : 'bg-green-50/50'}`}>
                                      <span className="text-[10px] font-mono text-gray-500 block">{key}</span>
                                      <span className={`text-xs ${log.acao === 'DELETE' ? 'text-red-700' : 'text-green-700'}`}>{fmtVal(val)}</span>
                                    </div>
                                  ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">
                Anterior
              </button>
              <span className="text-xs text-gray-500">Página {page + 1} de {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">
                Próxima
              </button>
            </div>
          )}
        </>
      ) : (
        /* === ABA BACKUPS === */
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">Snapshots diários das tabelas críticas. Retidos por 30 dias.</p>
            <button onClick={runBackupNow} disabled={backupRunning}
              className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-semibold hover:bg-brand-dark disabled:opacity-50 flex items-center gap-2">
              <RefreshCw className={`w-4 h-4 ${backupRunning ? 'animate-spin' : ''}`} />
              {backupRunning ? 'Executando...' : 'Executar backup agora'}
            </button>
          </div>

          {backupLoading ? (
            <div className="text-center text-gray-400 py-10">Carregando backups...</div>
          ) : Object.keys(backupsByDate).length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-10 text-center">
              <Database className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Nenhum backup encontrado.</p>
              <p className="text-xs text-gray-400 mt-1">Clique em "Executar backup agora" para criar o primeiro snapshot.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(backupsByDate).map(([date, items]) => {
                const totalRows = items.reduce((s, i) => s + (i.total_rows || 0), 0)
                return (
                  <div key={date} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Database className="w-4 h-4 text-brand" />
                        <span className="text-sm font-bold text-gray-900">
                          {new Date(date + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {items.length} tabela(s) · {totalRows.toLocaleString('pt-BR')} registros
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {items.map(b => (
                        <div key={b.id} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                          <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                          <span className="text-xs text-gray-700 font-medium">{TABELA_LABEL[b.tabela] || b.tabela}</span>
                          <span className="text-[10px] text-gray-400 ml-auto">{b.total_rows} reg.</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
