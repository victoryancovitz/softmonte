'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import BackButton from '@/components/BackButton'
import { useToast } from '@/components/Toast'
import SearchInput from '@/components/SearchInput'
import SortableHeader, { SortDir, applySort } from '@/components/SortableHeader'
import { formatTipoPagamento, formatStatus, TIPO_PAGAMENTO_EXTRA } from '@/lib/formatters'
import { DollarSign, AlertTriangle, Plus, RefreshCw, Trash2 } from 'lucide-react'

const TIPOS: { v: string; l: string; cor: string }[] = [
  { v: 'bonus', l: 'Bônus', cor: 'bg-green-100 text-green-700' },
  { v: 'bonus_por_fora', l: 'Bônus por fora', cor: 'bg-amber-100 text-amber-700' },
  { v: 'comissao', l: 'Comissão', cor: 'bg-blue-100 text-blue-700' },
  { v: 'premio_producao', l: 'Prêmio produção', cor: 'bg-violet-100 text-violet-700' },
  { v: 'gratificacao', l: 'Gratificação', cor: 'bg-teal-100 text-teal-700' },
  { v: 'ajuda_custo', l: 'Ajuda de custo', cor: 'bg-sky-100 text-sky-700' },
  { v: 'adiantamento', l: 'Adiantamento', cor: 'bg-gray-100 text-gray-600' },
  { v: 'vale_extra', l: 'Vale extra', cor: 'bg-gray-100 text-gray-600' },
  { v: 'outro', l: 'Outro', cor: 'bg-gray-100 text-gray-600' },
]

export default function PagamentosExtrasPage() {
  const [pagamentos, setPagamentos] = useState<any[]>([])
  const [alertas, setAlertas] = useState<any[]>([])
  const [obras, setObras] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tipoFiltro, setTipoFiltro] = useState('')
  const [obraFiltro, setObraFiltro] = useState('')
  const [competenciaFiltro, setCompetenciaFiltro] = useState('')
  const [statusFiltro, setStatusFiltro] = useState('')
  const [recorrenteFiltro, setRecorrenteFiltro] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [busca, setBusca] = useState('')
  const supabase = createClient()
  const toast = useToast()

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

  async function load() {
    const [{ data: pag }, { data: al }, { data: obs }] = await Promise.all([
      supabase.from('pagamentos_extras')
        .select('*, funcionarios(id,nome,cargo), obras(nome)')
        .is('deleted_at', null)
        .order('competencia', { ascending: false })
        .limit(500),
      supabase.from('vw_alertas_habitualidade').select('*').limit(10),
      supabase.from('obras').select('id,nome').is('deleted_at', null).order('nome'),
    ])
    setPagamentos(pag || [])
    setAlertas(al || [])
    setObras(obs || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    let result = pagamentos.filter(p => {
      if (tipoFiltro && p.tipo !== tipoFiltro) return false
      if (obraFiltro && p.obra_id !== obraFiltro) return false
      if (competenciaFiltro && !p.competencia.startsWith(competenciaFiltro)) return false
      if (statusFiltro && p.status !== statusFiltro) return false
      if (recorrenteFiltro && !p.recorrente) return false
      if (busca.trim()) {
        const q = busca.toLowerCase()
        if (
          !p.funcionarios?.nome?.toLowerCase().includes(q) &&
          !p.descricao?.toLowerCase().includes(q) &&
          !p.funcionarios?.cargo?.toLowerCase().includes(q)
        ) return false
      }
      return true
    })
    result = applySort(result, sortField, sortDir, ['valor'])
    return result
  }, [pagamentos, busca, tipoFiltro, obraFiltro, competenciaFiltro, statusFiltro, recorrenteFiltro, sortField, sortDir])

  const fmt = (v: any) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  // Totalizadores por tipo
  const totaisPorTipo = TIPOS.map(t => ({
    ...t,
    total: filtered.filter(p => p.tipo === t.v).reduce((s, p) => s + Number(p.valor), 0),
    qtd: filtered.filter(p => p.tipo === t.v).length,
  })).filter(t => t.qtd > 0)

  const totalGeral = filtered.reduce((s, p) => s + Number(p.valor), 0)
  const totalBaseLegal = filtered.filter(p => p.entra_base_legal).reduce((s, p) => s + Number(p.valor), 0)
  const totalDre = filtered.filter(p => p.entra_dre).reduce((s, p) => s + Number(p.valor), 0)
  const totalPorFora = filtered.filter(p => p.tipo === 'bonus_por_fora').reduce((s, p) => s + Number(p.valor), 0)

  async function gerarRecorrencias() {
    setRegenerating(true)
    try {
      const { data, error } = await supabase.rpc('gerar_pagamentos_recorrentes')
      if (error) throw error
      const n = data?.[0]?.criados ?? 0
      toast.success(`${n} pagamentos recorrentes gerados`)
      load()
    } catch (e: any) {
      toast.error('Erro: ' + e.message)
    } finally {
      setRegenerating(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Cancelar este pagamento? Se havia lançamento no financeiro, ele será removido.')) return
    const pag = pagamentos.find(p => p.id === id)
    const { data: { user } } = await supabase.auth.getUser()
    if (pag?.financeiro_lancamento_id) {
      await supabase.from('financeiro_lancamentos').update({ deleted_at: new Date().toISOString(), deleted_by: user?.id ?? null }).eq('id', pag.financeiro_lancamento_id)
    }
    await supabase.from('pagamentos_extras').update({ deleted_at: new Date().toISOString(), deleted_by: user?.id ?? null }).eq('id', id)
    toast.success('Pagamento cancelado')
    load()
  }

  if (loading) return <div className="p-6 text-gray-400 text-sm">Carregando...</div>

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/rh" />
        <span className="text-gray-400">RH</span>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700">Pagamentos Extras</span>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold font-display text-brand mb-1">Pagamentos Extras</h1>
          <p className="text-sm text-gray-500">Bônus, comissões, prêmios, gratificações, adiantamentos e pagamentos por fora.</p>
        </div>
        <button onClick={gerarRecorrencias} disabled={regenerating}
          className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-semibold hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
          Gerar recorrências
        </button>
      </div>

      {/* Alerta habitualidade */}
      {alertas.length > 0 && (
        <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-bold text-amber-800 mb-2">
                Risco de habitualidade em {alertas.length} funcionário(s)
              </h3>
              <div className="space-y-1">
                {alertas.slice(0, 5).map(a => (
                  <div key={a.funcionario_id} className="flex items-center justify-between text-xs">
                    <Link href={`/funcionarios/${a.funcionario_id}`} className="text-amber-800 font-semibold hover:underline">
                      {a.nome}
                    </Link>
                    <span className="text-amber-700">
                      {a.meses_seguidos} meses consecutivos · total {fmt(a.total_periodo)}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-amber-700 mt-2 italic">
                Pagamentos recorrentes de bônus em 3+ meses podem caracterizar salário-utilidade pela Justiça do Trabalho. Considere formalizar.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-gray-100 border-l-4 border-l-blue-500 p-4">
          <div className="text-[11px] font-semibold text-gray-400 uppercase">Total filtrado</div>
          <div className="text-lg font-bold text-gray-900 font-display">{fmt(totalGeral)}</div>
          <div className="text-[10px] text-gray-400">{filtered.length} pagamentos</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 border-l-4 border-l-green-500 p-4">
          <div className="text-[11px] font-semibold text-gray-400 uppercase">Base legal</div>
          <div className="text-lg font-bold text-green-700 font-display">{fmt(totalBaseLegal)}</div>
          <div className="text-[10px] text-green-600">Integra rescisão</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 border-l-4 border-l-amber-500 p-4">
          <div className="text-[11px] font-semibold text-gray-400 uppercase">Entra no DRE</div>
          <div className="text-lg font-bold text-amber-700 font-display">{fmt(totalDre)}</div>
          <div className="text-[10px] text-amber-600">Custo da obra</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 border-l-4 border-l-red-500 p-4">
          <div className="text-[11px] font-semibold text-gray-400 uppercase">Por fora</div>
          <div className="text-lg font-bold text-red-700 font-display">{fmt(totalPorFora)}</div>
          <div className="text-[10px] text-red-600">Risco trabalhista</div>
        </div>
      </div>

      {/* Totalizador por tipo */}
      {totaisPorTipo.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-5">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Por tipo</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {totaisPorTipo.map(t => (
              <div key={t.v} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${t.cor}`}>{formatTipoPagamento(t.v)}</span>
                <div className="text-right">
                  <div className="text-xs font-bold text-gray-900">{fmt(t.total)}</div>
                  <div className="text-[10px] text-gray-400">{t.qtd}x</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Busca e Filtros */}
      <div className="mb-3">
        <SearchInput value={busca} onChange={setBusca} placeholder="Buscar por funcionário ou descrição..." />
      </div>
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <select value={tipoFiltro} onChange={e => setTipoFiltro(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
          <option value="">Todos os tipos</option>
          {Object.entries(TIPO_PAGAMENTO_EXTRA).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select value={statusFiltro} onChange={e => setStatusFiltro(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
          <option value="">Todos os status</option>
          <option value="previsto">{formatStatus('previsto')}</option>
          <option value="pago">{formatStatus('pago')}</option>
          <option value="cancelado">{formatStatus('cancelado')}</option>
        </select>
        <select value={obraFiltro} onChange={e => setObraFiltro(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
          <option value="">Todas as obras</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
        <input type="month" value={competenciaFiltro} onChange={e => setCompetenciaFiltro(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          placeholder="Competência" />
        <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer select-none">
          <input type="checkbox" checked={recorrenteFiltro} onChange={e => setRecorrenteFiltro(e.target.checked)}
            className="rounded border-gray-300 text-brand focus:ring-brand" />
          Recorrentes
        </label>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <SortableHeader label="Competência" field="competencia" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Funcionário" field="funcionarios.nome" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Tipo" field="tipo" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Descrição" field="descricao" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Obra" field="obras.nome" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Valor" field="valor" currentField={sortField} currentDir={sortDir} onSort={handleSort} align="right" />
              <SortableHeader label="Status" field="status" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? filtered.map(p => {
              const tipoInfo = TIPOS.find(t => t.v === p.tipo)
              return (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/80">
                  <td className="px-4 py-2.5 text-xs text-gray-600 font-mono">
                    {new Date(p.competencia + 'T12:00').toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-2.5">
                    <Link href={`/funcionarios/${p.funcionario_id}`} className="font-semibold text-gray-900 hover:text-brand">
                      {p.funcionarios?.nome}
                    </Link>
                    <div className="text-[10px] text-gray-400">{p.funcionarios?.cargo}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${tipoInfo?.cor ?? 'bg-gray-100'}`}>
                      {formatTipoPagamento(p.tipo)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-600 truncate max-w-[200px]">{p.descricao || '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{p.obras?.nome || '—'}</td>
                  <td className="px-4 py-2.5 font-bold text-gray-900 text-right">{fmt(p.valor)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        p.status === 'pago' ? 'bg-green-100 text-green-700' :
                        p.status === 'previsto' ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>{formatStatus(p.status).toUpperCase()}</span>
                      {p.entra_dre && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-blue-100 text-blue-700">DRE</span>
                      )}
                      {p.recorrente && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-violet-100 text-violet-700">Recorrente</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <button onClick={() => handleDelete(p.id)} className="text-red-500 hover:text-red-700">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              )
            }) : (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                <DollarSign className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p>Nenhum pagamento registrado. Use a ficha do funcionário para criar um.</p>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
