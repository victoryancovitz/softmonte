'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import BackButton from '@/components/BackButton'
import SearchInput from '@/components/SearchInput'
import SortableHeader, { SortDir, applySort } from '@/components/SortableHeader'
import EmptyState from '@/components/ui/EmptyState'
import { formatMotivoCorrecao, formatStatus, MOTIVO_CORRECAO } from '@/lib/formatters'
import { TrendingUp, Plus } from 'lucide-react'

export default function CorrecoesPage() {
  const [correcoes, setCorrecoes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const supabase = createClient()

  // Filtros
  const [busca, setBusca] = useState('')
  const [motivoFiltro, setMotivoFiltro] = useState('')
  const [statusFiltro, setStatusFiltro] = useState('')
  const [periodoInicio, setPeriodoInicio] = useState('')
  const [periodoFim, setPeriodoFim] = useState('')

  // Sort
  const [sortField, setSortField] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>(null)

  function handleSort(field: string) {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc')
      if (sortDir === 'desc') setSortField(null)
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  useEffect(() => {
    ;(async () => {
      try {
        const { data, error: qErr } = await supabase.from('correcoes_salariais')
          .select('*, funcoes(nome), obras(nome)')
          .order('data_efetivo', { ascending: false })
        if (qErr) throw qErr
        setCorrecoes(data || [])
      } catch (e: any) {
        setError('Erro ao carregar correções: ' + (e?.message || 'desconhecido'))
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const filtered = useMemo(() => {
    let result = correcoes.filter(c => {
      if (motivoFiltro && c.motivo !== motivoFiltro) return false
      if (statusFiltro && c.status !== statusFiltro) return false
      if (periodoInicio && c.data_efetivo < periodoInicio) return false
      if (periodoFim && c.data_efetivo > periodoFim) return false
      if (busca.trim()) {
        const q = busca.toLowerCase()
        if (
          !c.titulo?.toLowerCase().includes(q) &&
          !c.funcoes?.nome?.toLowerCase().includes(q) &&
          !c.obras?.nome?.toLowerCase().includes(q)
        ) return false
      }
      return true
    })
    result = applySort(result, sortField, sortDir, ['funcionarios_afetados', 'total_reajuste', 'percentual', 'valor_fixo'])
    return result
  }, [correcoes, busca, motivoFiltro, statusFiltro, periodoInicio, periodoFim, sortField, sortDir])

  const fmt = (v: any) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  // Extrair statuses únicos para o dropdown
  const statusOptions = useMemo(() => {
    const set = new Set(correcoes.map(c => c.status).filter(Boolean))
    return Array.from(set).sort()
  }, [correcoes])

  if (loading) return <div className="p-6 text-gray-400 text-sm">Carregando...</div>

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/rh" />
        <span className="text-gray-400">RH</span>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700">Correções Salariais</span>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold font-display text-brand mb-1">Correções Salariais</h1>
          <p className="text-sm text-gray-500">Acordos coletivos, dissídios, méritos — aplicados em massa com rastreabilidade.</p>
        </div>
        <Link href="/rh/correcoes/nova" className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-semibold hover:bg-brand-dark flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nova correção
        </Link>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200">{error}</div>}

      {/* Filtros */}
      <div className="mb-3">
        <SearchInput value={busca} onChange={setBusca} placeholder="Buscar por título, função ou obra..." />
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        <select value={motivoFiltro} onChange={e => setMotivoFiltro(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
          <option value="">Todos os motivos</option>
          {Object.entries(MOTIVO_CORRECAO).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select value={statusFiltro} onChange={e => setStatusFiltro(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
          <option value="">Todos os status</option>
          {statusOptions.map(s => (
            <option key={s} value={s}>{formatStatus(s)}</option>
          ))}
        </select>
        <div className="flex items-center gap-1">
          <input type="date" value={periodoInicio} onChange={e => setPeriodoInicio(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="De" />
          <span className="text-gray-400 text-xs">a</span>
          <input type="date" value={periodoFim} onChange={e => setPeriodoFim(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Até" />
        </div>
      </div>

      {correcoes.length === 0 ? (
        <EmptyState
          titulo="Nenhuma correção cadastrada"
          descricao="Cadastre uma correção salarial para dissídios, acordos coletivos, méritos e promoções."
          icone={<TrendingUp className="w-10 h-10" />}
          acao={{ label: '+ Nova Correção', href: '/rh/correcoes/nova' }}
        />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <SortableHeader label="Título" field="titulo" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
                <SortableHeader label="Motivo" field="motivo" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Escopo</th>
                <SortableHeader label="Efetivo em" field="data_efetivo" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Tipo</th>
                <SortableHeader label="Reajuste" field="percentual" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
                <SortableHeader label="Afetados" field="funcionarios_afetados" currentField={sortField} currentDir={sortDir} onSort={handleSort} align="center" />
                <SortableHeader label="Total" field="total_reajuste" currentField={sortField} currentDir={sortDir} onSort={handleSort} align="right" />
                <SortableHeader label="Status" field="status" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? filtered.map(c => (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/80">
                  <td className="px-4 py-3">
                    <Link href={`/rh/correcoes/${c.id}`} className="font-semibold text-gray-900 hover:text-brand">{c.titulo}</Link>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{formatMotivoCorrecao(c.motivo)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {c.funcoes?.nome && <div>Função: {c.funcoes.nome}</div>}
                    {c.obras?.nome && <div>Obra: {c.obras.nome}</div>}
                    {!c.funcoes?.nome && !c.obras?.nome && <span>Todos</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{new Date(c.data_efetivo + 'T12:00').toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-3 text-xs">
                    {c.tipo_reajuste === 'percentual' ? 'Percentual' : c.tipo_reajuste === 'valor_fixo' ? 'Valor fixo' : 'Novo salário'}
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    {c.tipo_reajuste === 'percentual' ? `+${Number(c.percentual).toFixed(2)}%` : fmt(c.valor_fixo)}
                  </td>
                  <td className="px-4 py-3 text-center">{c.funcionarios_afetados || '—'}</td>
                  <td className="px-4 py-3 font-bold text-green-700 text-right">{fmt(c.total_reajuste)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      c.status === 'aplicada' ? 'bg-green-100 text-green-700' :
                      c.status === 'revertida' ? 'bg-gray-100 text-gray-500' :
                      'bg-amber-100 text-amber-700'
                    }`}>{formatStatus(c.status).toUpperCase()}</span>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">
                  <TrendingUp className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p>Nenhuma correção encontrada com esses filtros.</p>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
