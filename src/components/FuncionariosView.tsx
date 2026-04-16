'use client'
import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import SortableHeader, { applySort, type SortDir } from '@/components/SortableHeader'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { TIPO_VINCULO } from '@/lib/formatters'

const STATUS_COLOR: Record<string, string> = {
  pendente:    'bg-amber-100 text-amber-700',
  em_admissao: 'bg-violet-100 text-violet-700',
  disponivel:  'bg-green-100 text-green-700',
  alocado:     'bg-blue-100 text-blue-700',
  afastado:    'bg-orange-100 text-orange-700',
  inativo:     'bg-red-100 text-red-700',
}

const STATUS_LABEL: Record<string, string> = {
  pendente:    'Aguardando admissão',
  em_admissao: 'Em admissão',
  disponivel:  'Disponível',
  alocado:     'Alocado',
  afastado:    'Afastado',
  inativo:     'Inativo',
}

const ALERTA_BADGE: Record<string, { label: string; cls: string }> = {
  experiencia_1_vencendo: { label: 'Exp. 1 vence', cls: 'bg-amber-100 text-amber-700' },
  experiencia_2_vencendo: { label: 'Exp. vence', cls: 'bg-red-100 text-red-700' },
  ferias_vencidas: { label: 'Férias vencidas', cls: 'bg-red-100 text-red-700' },
  ferias_urgente: { label: 'Férias urgente', cls: 'bg-orange-100 text-orange-700' },
  contrato_vencendo: { label: 'Contrato vence', cls: 'bg-amber-100 text-amber-700' },
}

export default function FuncionariosView({
  funcs,
  hoje,
  alertas = {},
  cargosUnicos = [],
  obraAtualMap = {},
  obrasUnicas = [],
}: {
  funcs: any[]
  hoje: string
  alertas?: Record<string, string>
  cargosUnicos?: string[]
  obraAtualMap?: Record<string, { id: string; nome: string }>
  obrasUnicas?: [string, string][]
}) {
  const router = useRouter()
  const sp = useSearchParams()
  const toast = useToast()
  const supabase = createClient()
  const hojeDate = new Date(hoje + 'T12:00:00')

  // Multi-selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkRunning, setBulkRunning] = useState(false)

  // Initial state from URL
  const [view, setView] = useState<'cards' | 'table'>('cards')
  const [searchInput, setSearchInput] = useState(sp.get('q') ?? '')
  const [q, setQ] = useState(sp.get('q') ?? '')
  const [status, setStatus] = useState(sp.get('status') ?? '')
  const [cargo, setCargo] = useState(sp.get('cargo') ?? '')
  const [admDe, setAdmDe] = useState(sp.get('adm_de') ?? '')
  const [admAte, setAdmAte] = useState(sp.get('adm_ate') ?? '')
  const [obraAtual, setObraAtual] = useState(sp.get('obra') ?? '')
  const [tipoVinculo, setTipoVinculo] = useState(sp.get('vinculo') ?? '')
  const [sortField, setSortField] = useState<string | null>(sp.get('sort') ?? 'nome')
  const [sortDir, setSortDir] = useState<SortDir>((sp.get('dir') as SortDir) ?? 'asc')

  // Restore from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    const savedView = localStorage.getItem('funcionarios_view') as 'cards' | 'table' | null
    if (savedView === 'cards' || savedView === 'table') setView(savedView)
    if (sp.toString()) return
    const saved = localStorage.getItem('funcionarios_filters')
    if (saved) {
      try {
        const o = JSON.parse(saved)
        if (o.q) { setQ(o.q); setSearchInput(o.q) }
        // Só restaurar status válidos
        const validStatus = ['', 'ativos', 'pendente', 'em_admissao', 'alocado', 'disponivel', 'afastado', 'inativo']
        if (o.status && validStatus.includes(o.status)) setStatus(o.status)
        if (o.cargo) setCargo(o.cargo)
        if (o.admDe) setAdmDe(o.admDe)
        if (o.admAte) setAdmAte(o.admAte)
        if (o.obraAtual) setObraAtual(o.obraAtual)
        if (o.tipoVinculo) setTipoVinculo(o.tipoVinculo)
        if (o.sortField) setSortField(o.sortField)
        if (o.sortDir) setSortDir(o.sortDir)
      } catch {}
    }
  }, [])

  // Persist view toggle
  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('funcionarios_view', view)
  }, [view])

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setQ(searchInput), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  // Sync to URL
  useEffect(() => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (status) params.set('status', status)
    if (cargo) params.set('cargo', cargo)
    if (admDe) params.set('adm_de', admDe)
    if (admAte) params.set('adm_ate', admAte)
    if (obraAtual) params.set('obra', obraAtual)
    if (tipoVinculo) params.set('vinculo', tipoVinculo)
    if (sortField && sortField !== 'nome') params.set('sort', sortField)
    if (sortDir && sortDir !== 'asc') params.set('dir', sortDir)
    const qs = params.toString()
    router.replace(qs ? `/funcionarios?${qs}` : '/funcionarios', { scroll: false })
    if (typeof window !== 'undefined') {
      localStorage.setItem('funcionarios_filters', JSON.stringify({ q, status, cargo, admDe, admAte, obraAtual, tipoVinculo, sortField, sortDir }))
    }
  }, [q, status, cargo, admDe, admAte, obraAtual, tipoVinculo, sortField, sortDir])

  function toggleSort(field: string) {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc')
      if (sortDir === 'desc') setSortField(null)
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  // Apply filters in real time
  const filtered = useMemo(() => {
    let result = funcs
    if (q) {
      const ql = q.toLowerCase()
      result = result.filter(f =>
        f.nome?.toLowerCase().includes(ql) ||
        f.nome_guerra?.toLowerCase().includes(ql) ||
        f.cpf?.replace(/\D/g, '').includes(ql.replace(/\D/g, '')) ||
        f.matricula?.toLowerCase().includes(ql) ||
        f.id_ponto?.toLowerCase().includes(ql) ||
        f.cargo?.toLowerCase().includes(ql)
      )
    }
    if (status === 'inativo') result = result.filter(f => f.deleted_at != null)
    else if (status === 'ativos') result = result.filter(f => f.deleted_at == null && (f.status === 'alocado' || f.status === 'disponivel'))
    else if (status) result = result.filter(f => f.status === status && f.deleted_at == null)
    if (cargo) result = result.filter(f => f.cargo === cargo)
    if (admDe) result = result.filter(f => f.admissao && f.admissao >= admDe)
    if (admAte) result = result.filter(f => f.admissao && f.admissao <= admAte)
    if (obraAtual) result = result.filter(f => obraAtualMap[f.id]?.id === obraAtual)
    if (tipoVinculo) result = result.filter(f => f.tipo_vinculo === tipoVinculo)
    return applySort(result, sortField, sortDir, ['matricula'])
  }, [funcs, q, status, cargo, admDe, admAte, obraAtual, tipoVinculo, sortField, sortDir, obraAtualMap])

  // Pagination
  const PAGE_SIZE = 30
  const [page, setPage] = useState(1)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginatedFiltered = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Reset page when filters change
  useEffect(() => { setPage(1) }, [q, status, cargo, admDe, admAte, obraAtual, tipoVinculo, sortField, sortDir])

  const hasFilter = q || status || cargo || admDe || admAte || obraAtual || tipoVinculo

  function clearFilters() {
    setQ(''); setSearchInput(''); setStatus(''); setCargo(''); setAdmDe(''); setAdmAte(''); setObraAtual(''); setTipoVinculo('')
    setSortField('nome'); setSortDir('asc')
    if (typeof window !== 'undefined') localStorage.removeItem('funcionarios_filters')
    router.replace('/funcionarios', { scroll: false })
  }

  // Selection helpers
  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  function toggleSelectAll() {
    const visiveis = filtered.filter(f => f.deleted_at == null).map(f => f.id)
    if (visiveis.every(id => selectedIds.has(id))) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(visiveis))
    }
  }
  function clearSelection() { setSelectedIds(new Set()) }

  async function bulkDesligar() {
    if (selectedIds.size === 0) return
    if (!confirm(`Desligar ${selectedIds.size} funcionário(s) selecionado(s)? Os vínculos serão arquivados.`)) return
    setBulkRunning(true)
    const { data: { user } } = await supabase.auth.getUser()
    const ids = Array.from(selectedIds)
    const { error } = await supabase.from('funcionarios')
      .update({ deleted_at: new Date().toISOString(), deleted_by: user?.id ?? null, status: 'inativo' })
      .in('id', ids)
    setBulkRunning(false)
    if (error) { toast.error('Erro no desligamento em lote: ' + error.message); return }
    toast.success(`${ids.length} funcionário(s) desligados`)
    clearSelection()
    router.refresh()
  }

  async function bulkAlterarStatus(novoStatus: string) {
    if (selectedIds.size === 0) return
    setBulkRunning(true)
    const ids = Array.from(selectedIds)
    const { error } = await supabase.from('funcionarios').update({ status: novoStatus }).in('id', ids)
    setBulkRunning(false)
    if (error) { toast.error('Erro: ' + error.message); return }
    toast.success(`${ids.length} funcionário(s) atualizados`)
    clearSelection()
    router.refresh()
  }

  return (
    <>
      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Buscar por nome, CPF, ID Ponto ou cargo..."
              className="w-full px-3 py-2 pr-7 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
            {searchInput && (
              <button onClick={() => setSearchInput('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">✕</button>
            )}
          </div>
          <select value={status} onChange={e => setStatus(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
            <option value="">Todos</option>
            <option value="ativos">Ativos</option>
            <option value="pendente">Aguardando admissão</option>
            <option value="em_admissao">Em admissão</option>
            <option value="disponivel">Disponível</option>
            <option value="alocado">Alocado</option>
            <option value="afastado">Afastado</option>
            <option value="inativo">Desligados</option>
          </select>
          <select value={cargo} onChange={e => setCargo(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
            <option value="">Todos os cargos</option>
            {cargosUnicos.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {obrasUnicas.length > 0 && (
            <select value={obraAtual} onChange={e => setObraAtual(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
              <option value="">Todas as obras</option>
              {obrasUnicas.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
            </select>
          )}
          <select value={tipoVinculo} onChange={e => setTipoVinculo(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
            <option value="">Todos os vinculos</option>
            {Object.entries(TIPO_VINCULO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <div className="flex border border-gray-200 rounded-lg overflow-hidden flex-shrink-0">
            <button onClick={() => setView('cards')}
              className={`px-3 py-2 text-xs font-medium transition-all ${view === 'cards' ? 'bg-brand text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
              Cards
            </button>
            <button onClick={() => setView('table')}
              className={`px-3 py-2 text-xs font-medium transition-all ${view === 'table' ? 'bg-brand text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
              Tabela
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <label className="text-xs text-gray-500">Admissão de:</label>
          <input type="date" value={admDe} onChange={e => setAdmDe(e.target.value)}
            className="px-2 py-1 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand" />
          <label className="text-xs text-gray-500">até:</label>
          <input type="date" value={admAte} onChange={e => setAdmAte(e.target.value)}
            className="px-2 py-1 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand" />
          {hasFilter && (
            <button type="button" onClick={clearFilters}
              className="ml-auto text-xs text-red-600 hover:underline font-medium">
              ✕ Limpar filtros
            </button>
          )}
          <span className={`text-xs text-gray-400 ${hasFilter ? '' : 'ml-auto'}`}>{filtered.length} resultado(s)</span>
        </div>
      </div>

      {/* Barra de ação em lote */}
      {selectedIds.size > 0 && (
        <div className="mb-4 p-3 bg-brand text-white rounded-xl flex items-center gap-3 sticky top-16 z-20 shadow-lg">
          <span className="font-bold text-sm">{selectedIds.size} selecionado{selectedIds.size > 1 ? 's' : ''}</span>
          <div className="flex-1 flex gap-2">
            <button onClick={() => bulkAlterarStatus('disponivel')} disabled={bulkRunning}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-semibold">Marcar disponível</button>
            <button onClick={() => bulkAlterarStatus('alocado')} disabled={bulkRunning}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-semibold">Marcar alocado</button>
            <button onClick={() => bulkAlterarStatus('afastado')} disabled={bulkRunning}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-semibold">Marcar afastado</button>
            <button onClick={bulkDesligar} disabled={bulkRunning}
              className="px-3 py-1.5 bg-red-500 hover:bg-red-600 rounded-lg text-xs font-bold">
              {bulkRunning ? '...' : '🗑 Desligar'}
            </button>
          </div>
          <button onClick={clearSelection} className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs">
            ✕ Cancelar
          </button>
        </div>
      )}

      {/* Content */}
      {filtered.length > 0 ? (
        view === 'cards' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
            {paginatedFiltered.map((f: any) => {
              const p1 = f.prazo1 ? new Date(f.prazo1 + 'T12:00') : null
              const dias = p1 ? Math.ceil((p1.getTime() - hojeDate.getTime()) / 86400000) : null
              const vencido = dias !== null && dias < 0
              const alerta = dias !== null && dias <= 30 && dias >= 0
              const desligado = f.deleted_at != null
              const checked = selectedIds.has(f.id)
              return (
                <div key={f.id} className={`bg-white rounded-xl border p-4 hover:shadow-md transition-all duration-200 relative group ${
                  desligado ? 'border-gray-200 opacity-60 hover:opacity-100' : checked ? 'border-brand border-2' : 'border-gray-200 hover:border-brand/30'
                }`}>
                  {!desligado && (
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSelect(f.id)}
                      onClick={e => e.stopPropagation()}
                      className="absolute top-3 left-3 w-4 h-4 rounded text-brand focus:ring-brand z-10"
                    />
                  )}
                  <Link href={`/funcionarios/${f.id}`} className="block">
                  <div className="flex items-start justify-between mb-3 pl-6">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm font-display ${
                      desligado ? 'bg-gray-100 text-gray-400' : 'bg-brand/10 text-brand'
                    }`}>
                      {f.nome?.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                    </div>
                    {desligado ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-red-100 text-red-700">
                        Desligado em {new Date(f.deleted_at).toLocaleDateString('pt-BR')}
                      </span>
                    ) : (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${STATUS_COLOR[f.status] ?? 'bg-gray-100'}`}>
                        {STATUS_LABEL[f.status] ?? f.status}
                      </span>
                    )}
                  </div>
                  <div className="font-semibold text-sm text-gray-900 group-hover:text-brand transition-colors">{f.nome_guerra ?? f.nome}</div>
                  {f.nome_guerra && <div className="text-[10px] text-gray-400 truncate">{f.nome}</div>}
                  <div className="text-xs text-gray-500 mt-0.5">
                    {f.cargo}
                    {f.id_ponto ? ` · ID ${f.id_ponto}` : f.matricula ? ` · Mat ${f.matricula}` : ''}
                    {!f.id_ponto && !desligado && <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 font-semibold" title="Sem marcações importadas do Secullum">Sem ID Ponto</span>}
                  </div>
                  {desligado && (
                    <div className="mt-2 pt-2 border-t border-gray-100 text-[10px] text-red-600 font-medium">
                      Desligado em {new Date(f.deleted_at).toLocaleDateString('pt-BR')}
                    </div>
                  )}
                  {p1 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className={`text-xs font-medium flex items-center gap-1 ${vencido ? 'text-red-600' : alerta ? 'text-amber-600' : 'text-gray-400'}`}>
                        Exp. 1: {p1.toLocaleDateString('pt-BR')}
                        {vencido && <span className="ml-1 bg-red-100 text-red-700 px-1.5 rounded text-[10px] font-bold">VENCIDO</span>}
                        {alerta && <span className="ml-1 bg-amber-100 text-amber-700 px-1.5 rounded text-[10px]">{dias}d</span>}
                      </div>
                    </div>
                  )}
                  {(!f.cpf || !Number(f.salario_base) || !f.funcao_id) && !desligado && (
                    <div className="mt-2 pt-2 border-t border-gray-100 flex flex-wrap gap-1">
                      {!f.cpf && <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-700">Sem CPF</span>}
                      {!Number(f.salario_base) && <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-700">Sem salario</span>}
                      {!f.funcao_id && <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-700">Sem funcao</span>}
                    </div>
                  )}
                  {alertas[f.id] && ALERTA_BADGE[alertas[f.id]] && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${ALERTA_BADGE[alertas[f.id]].cls}`}>
                        {ALERTA_BADGE[alertas[f.id]].label}
                      </span>
                    </div>
                  )}
                  </Link>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-3 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={filtered.filter(f => f.deleted_at == null).length > 0 && filtered.filter(f => f.deleted_at == null).every(f => selectedIds.has(f.id))}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded text-brand focus:ring-brand"
                    />
                  </th>
                  <SortableHeader label="ID Ponto" field="id_ponto" currentField={sortField} currentDir={sortDir} onSort={toggleSort} />
                  <SortableHeader label="Nome" field="nome" currentField={sortField} currentDir={sortDir} onSort={toggleSort} />
                  <SortableHeader label="Cargo" field="cargo" currentField={sortField} currentDir={sortDir} onSort={toggleSort} />
                  <SortableHeader label="Admissão" field="admissao" currentField={sortField} currentDir={sortDir} onSort={toggleSort} />
                  <SortableHeader label="1º Período" field="prazo1" currentField={sortField} currentDir={sortDir} onSort={toggleSort} />
                  <SortableHeader label="Status" field="status" currentField={sortField} currentDir={sortDir} onSort={toggleSort} />
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {paginatedFiltered.map((f: any) => {
                  const p1 = f.prazo1 ? new Date(f.prazo1 + 'T12:00') : null
                  const dias = p1 ? Math.ceil((p1.getTime() - hojeDate.getTime()) / 86400000) : null
                  const vencido = dias !== null && dias < 0
                  const alerta = dias !== null && dias <= 30 && dias >= 0
                  const desligado = f.deleted_at != null
                  const checked = selectedIds.has(f.id)
                  return (
                    <tr key={f.id} className={`border-b border-gray-50 hover:bg-gray-50 group ${desligado ? 'opacity-60' : ''} ${checked ? 'bg-brand/5' : ''}`}>
                      <td className="px-3 py-3">
                        {!desligado && (
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSelect(f.id)}
                            className="w-4 h-4 rounded text-brand focus:ring-brand"
                          />
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono">
                        {f.id_ponto ? (
                          <span className="text-gray-400">{f.id_ponto}</span>
                        ) : !desligado ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 font-semibold" title="Sem marcações importadas do Secullum">Sem ID</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        <Link href={`/funcionarios/${f.id}`} className="hover:text-brand transition-colors">
                          {f.nome_guerra ?? f.nome}
                          {f.nome_guerra && <span className="ml-1 text-[10px] text-gray-400 font-normal">({f.nome})</span>}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{f.cargo}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{f.admissao ? new Date(f.admissao+'T12:00').toLocaleDateString('pt-BR') : '—'}</td>
                      <td className={`px-4 py-3 text-xs font-medium ${vencido ? 'text-red-600' : alerta ? 'text-amber-600' : 'text-gray-500'}`}>
                        {p1 ? p1.toLocaleDateString('pt-BR') : '—'}
                        {vencido && <span className="ml-1 bg-red-100 text-red-700 px-1.5 rounded text-[10px] font-bold">VENCIDO</span>}
                        {alerta && <span className="ml-1 bg-amber-100 text-amber-700 px-1.5 rounded text-[10px]">{dias}d</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1">
                        {desligado ? (
                          <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-red-100 text-red-700">
                            Desligado em {new Date(f.deleted_at).toLocaleDateString('pt-BR')}
                          </span>
                        ) : (
                          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold capitalize ${STATUS_COLOR[f.status] ?? 'bg-gray-100'}`}>
                            {f.status === 'disponivel' ? 'Disponível' : f.status}
                          </span>
                        )}
                        {!desligado && !f.cpf && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-700">Sem CPF</span>}
                        {!desligado && !Number(f.salario_base) && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-700">Sem salario</span>}
                        {!desligado && !f.funcao_id && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-700">Sem funcao</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-3 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link href={`/funcionarios/${f.id}`} className="text-xs text-brand hover:underline">Ver</Link>
                          <Link href={`/funcionarios/${f.id}/editar`} className="text-xs text-gray-500 hover:text-gray-800">Editar</Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {/* Pagination */}
      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-center gap-4 mt-4 text-sm">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium"
          >
            Anterior
          </button>
          <span className="text-xs text-gray-500">
            Página {page} de {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium"
          >
            Próxima
          </button>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="mx-auto mb-4 text-gray-300">
            <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="2"/>
            <circle cx="24" cy="20" r="8" stroke="currentColor" strokeWidth="2"/>
            <path d="M8 42c0-8.8 7.2-16 16-16s16 7.2 16 16" stroke="currentColor" strokeWidth="2"/>
          </svg>
          <p className="text-gray-500 text-sm font-medium">Nenhum funcionário encontrado.</p>
          {hasFilter ? (
            <button onClick={clearFilters} className="mt-3 inline-block px-4 py-2 border border-gray-200 rounded-xl text-sm hover:bg-gray-50">
              Limpar filtros
            </button>
          ) : (
            <Link href="/funcionarios/novo" className="mt-3 inline-block px-4 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark">+ Novo funcionário</Link>
          )}
        </div>
      )}
    </>
  )
}
