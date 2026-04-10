'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import SearchInput from '@/components/SearchInput'
import { ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react'

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

export default function AuditoriaPage() {
  const supabase = createClient()
  const [logs, setLogs] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  // Filters
  const [busca, setBusca] = useState('')
  const [tabela, setTabela] = useState('')
  const [acao, setAcao] = useState('')
  const [dataDe, setDataDe] = useState('')
  const [dataAte, setDataAte] = useState('')

  // Stats
  const [statsHoje, setStatsHoje] = useState(0)
  const [statsSemana, setStatsSemana] = useState(0)
  const [topUser, setTopUser] = useState('')

  useEffect(() => { loadStats() }, [])
  useEffect(() => { loadData() }, [page, tabela, acao, dataDe, dataAte, busca])

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

    // Top user
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

  function DiffView({ antes, depois, campos }: { antes: any; depois: any; campos: string[] | null }) {
    if (!antes && !depois) return <p className="text-xs text-gray-400 italic">Sem dados</p>

    const allKeys = Array.from(new Set([
      ...Object.keys(antes || {}),
      ...Object.keys(depois || {}),
    ])).filter(k => k !== 'id').sort()

    const changedSet = new Set(campos || [])

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left px-3 py-1.5 font-semibold text-gray-500 w-1/4">Campo</th>
              {antes && <th className="text-left px-3 py-1.5 font-semibold text-red-500 w-[37.5%]">Antes</th>}
              {depois && <th className="text-left px-3 py-1.5 font-semibold text-green-600 w-[37.5%]">Depois</th>}
            </tr>
          </thead>
          <tbody>
            {allKeys.map(key => {
              const isChanged = changedSet.has(key)
              const valAntes = antes?.[key]
              const valDepois = depois?.[key]
              if (!isChanged && antes && depois) return null // skip unchanged for UPDATE
              return (
                <tr key={key} className={isChanged ? 'bg-amber-50' : ''}>
                  <td className="px-3 py-1 font-mono text-gray-600 border-b border-gray-100">{key}</td>
                  {antes && (
                    <td className="px-3 py-1 border-b border-gray-100 text-red-700 break-all">
                      {valAntes === null ? <span className="text-gray-300 italic">null</span> : typeof valAntes === 'object' ? JSON.stringify(valAntes) : String(valAntes)}
                    </td>
                  )}
                  {depois && (
                    <td className="px-3 py-1 border-b border-gray-100 text-green-700 break-all">
                      {valDepois === null ? <span className="text-gray-300 italic">null</span> : typeof valDepois === 'object' ? JSON.stringify(valDepois) : String(valDepois)}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

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
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-8"></th>
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
              const isOpen = expanded === log.id
              const campos = log.campos_alterados as string[] | null
              return (
                <tr key={log.id} className="border-b border-gray-50 group">
                  <td className="px-2 py-3">
                    <button onClick={() => setExpanded(isOpen ? null : log.id)}
                      className="p-1 rounded hover:bg-gray-100 text-gray-400">
                      {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
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
                        {campos.length > 3 && (
                          <span className="text-[10px] text-gray-400">+ {campos.length - 3} mais</span>
                        )}
                      </div>
                    ) : log.acao === 'UPDATE' ? (
                      <span className="text-[10px] text-gray-300">—</span>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Expanded diff */}
        {expanded && (() => {
          const log = logs.find(l => l.id === expanded)
          if (!log) return null
          return (
            <div className="border-t border-gray-200 bg-gray-50/50 px-6 py-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-gray-600 uppercase">
                  Diff — {ACAO_BADGE[log.acao]?.label || log.acao} em {TABELA_LABEL[log.tabela] || log.tabela}
                </h4>
                <button onClick={() => setExpanded(null)} className="text-xs text-gray-400 hover:text-gray-600">Fechar</button>
              </div>
              <DiffView
                antes={log.dados_antes}
                depois={log.dados_depois}
                campos={log.acao === 'UPDATE' ? log.campos_alterados : null}
              />
            </div>
          )
        })()}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">
            Anterior
          </button>
          <span className="text-xs text-gray-500">
            Página {page + 1} de {totalPages}
          </span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
            className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">
            Próxima
          </button>
        </div>
      )}
    </div>
  )
}
