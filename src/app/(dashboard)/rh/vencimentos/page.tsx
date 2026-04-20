'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import SearchInput from '@/components/SearchInput'
import { useToast } from '@/components/Toast'
import { formatStatus, formatTipoVinculo } from '@/lib/formatters'

// ── Types ──

interface UnifiedItem {
  key: string
  funcionario_id: string
  funcionario_nome: string
  categoria: 'CONTRATO' | 'ASO' | 'DOCUMENTO' | string // NR-XX for treinamentos
  vencimento: string // ISO date
  dias: number
  meta?: Record<string, any>
}

type CategoriaFilter = 'Todos' | 'Contratos' | 'ASO' | 'NRs' | 'Documentos'
type StatusFilter = 'Todos' | 'Vencidos' | '30d' | '60d'

// ── Helpers ──

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + 'T12:00:00')
  const now = new Date(); now.setHours(12, 0, 0, 0)
  return Math.round((target.getTime() - now.getTime()) / 86400000)
}

function formatDate(d: string | null): string {
  if (!d) return '--'
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}

function badgeFor(dias: number) {
  if (dias < 0) return { label: 'Vencido', cls: 'bg-red-100 text-red-700 border-red-200' }
  if (dias <= 30) return { label: `${dias}d`, cls: 'bg-amber-100 text-amber-700 border-amber-200' }
  if (dias <= 60) return { label: `${dias}d`, cls: 'bg-orange-100 text-orange-700 border-orange-200' }
  return { label: `${dias}d`, cls: 'bg-green-100 text-green-700 border-green-200' }
}

function dotColor(dias: number) {
  if (dias < 0) return 'bg-red-500'
  if (dias <= 30) return 'bg-amber-500'
  if (dias <= 60) return 'bg-orange-400'
  return 'bg-green-500'
}

// ── Component ──

export default function VencimentosPage() {
  const supabase = createClient()
  const toast = useToast()

  const [items, setItems] = useState<UnifiedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [catFilter, setCatFilter] = useState<CategoriaFilter>('Todos')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('Todos')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => { loadData() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    setLoading(true)
    const today = new Date()
    today.setHours(12, 0, 0, 0)
    const todayStr = today.toISOString().split('T')[0]
    const em90 = new Date(today.getTime() + 90 * 86400000).toISOString().split('T')[0]

    const [prazosRes, docsRes, treinsRes] = await Promise.all([
      // Contratos de experiencia
      supabase.from('vw_prazos_legais')
        .select('funcionario_id, nome, tipo_vinculo, prazo_experiencia_1, prazo_experiencia_2, converte_clt_em, alerta_tipo')
        .in('alerta_tipo', ['experiencia_1_vencendo']),
      // Documentos vencendo (inclui ASOs)
      supabase.from('documentos')
        .select('id, tipo, vencimento, funcionario_id, funcionarios(id, nome)')
        .is('deleted_at', null)
        .not('vencimento', 'is', null)
        .gte('vencimento', todayStr)
        .lte('vencimento', em90)
        .order('vencimento'),
      // Treinamentos NR vencidos/a vencer
      supabase.from('treinamentos_funcionarios')
        .select('id, data_vencimento, funcionario_id, tipo_id, status, funcionarios(id, nome), treinamentos_tipos(id, codigo, nome)')
        .in('status', ['vencido', 'a_vencer'])
        .order('data_vencimento'),
    ])

    // Also fetch docs that are already expired (vencimento < today)
    const docsVencidosRes = await supabase.from('documentos')
      .select('id, tipo, vencimento, funcionario_id, funcionarios(id, nome)')
      .is('deleted_at', null)
      .not('vencimento', 'is', null)
      .lt('vencimento', todayStr)
      .order('vencimento')

    const unified: UnifiedItem[] = []

    // 1. Contratos de experiencia
    ;(prazosRes.data ?? []).forEach((p: any) => {
      const isP1 = p.alerta_tipo === 'experiencia_1_vencendo'
      const venc = isP1 ? p.prazo_experiencia_1 : p.prazo_experiencia_2
      if (!venc) return
      unified.push({
        key: `contrato-${p.funcionario_id}-${p.alerta_tipo}`,
        funcionario_id: p.funcionario_id,
        funcionario_nome: p.nome ?? '--',
        categoria: 'CONTRATO',
        vencimento: venc,
        dias: daysUntil(venc),
        meta: {
          tipo_vinculo: p.tipo_vinculo,
          alerta_tipo: p.alerta_tipo,
          prazo1: p.prazo_experiencia_1,
          prazo2: p.prazo_experiencia_2,
          converte_clt_em: p.converte_clt_em,
        },
      })
    })

    // 2. Documentos (dentro de 90 dias)
    ;(docsRes.data ?? []).forEach((d: any) => {
      const isAso = (d.tipo ?? '').toUpperCase() === 'ASO'
      unified.push({
        key: `doc-${d.id}`,
        funcionario_id: d.funcionario_id,
        funcionario_nome: d.funcionarios?.nome ?? '--',
        categoria: isAso ? 'ASO' : 'DOCUMENTO',
        vencimento: d.vencimento,
        dias: daysUntil(d.vencimento),
        meta: { tipo: d.tipo, doc_id: d.id },
      })
    })

    // 2b. Documentos ja vencidos
    ;(docsVencidosRes.data ?? []).forEach((d: any) => {
      const isAso = (d.tipo ?? '').toUpperCase() === 'ASO'
      unified.push({
        key: `doc-${d.id}`,
        funcionario_id: d.funcionario_id,
        funcionario_nome: d.funcionarios?.nome ?? '--',
        categoria: isAso ? 'ASO' : 'DOCUMENTO',
        vencimento: d.vencimento,
        dias: daysUntil(d.vencimento),
        meta: { tipo: d.tipo, doc_id: d.id },
      })
    })

    // 3. Treinamentos NR
    ;(treinsRes.data ?? []).forEach((t: any) => {
      const codigo = t.treinamentos_tipos?.codigo ?? 'NR'
      unified.push({
        key: `trein-${t.id}`,
        funcionario_id: t.funcionario_id,
        funcionario_nome: t.funcionarios?.nome ?? '--',
        categoria: codigo,
        vencimento: t.data_vencimento,
        dias: daysUntil(t.data_vencimento),
        meta: { tipo_id: t.tipo_id, trein_id: t.id, codigo, nome_trein: t.treinamentos_tipos?.nome, status: t.status },
      })
    })

    // Sort by urgency (dias ASC)
    unified.sort((a, b) => a.dias - b.dias)
    setItems(unified)
    setLoading(false)
  }

  // ── Filters ──

  const filtered = useMemo(() => {
    let list = items

    // Busca textual
    if (busca.trim()) {
      const q = busca.toLowerCase()
      list = list.filter(i => i.funcionario_nome.toLowerCase().includes(q))
    }

    // Categoria
    if (catFilter !== 'Todos') {
      list = list.filter(i => {
        if (catFilter === 'Contratos') return i.categoria === 'CONTRATO'
        if (catFilter === 'ASO') return i.categoria === 'ASO'
        if (catFilter === 'NRs') return i.categoria.startsWith('NR')
        if (catFilter === 'Documentos') return i.categoria === 'DOCUMENTO'
        return true
      })
    }

    // Status
    if (statusFilter !== 'Todos') {
      list = list.filter(i => {
        if (statusFilter === 'Vencidos') return i.dias < 0
        if (statusFilter === '30d') return i.dias >= 0 && i.dias <= 30
        if (statusFilter === '60d') return i.dias > 30 && i.dias <= 60
        return true
      })
    }

    return list
  }, [items, busca, catFilter, statusFilter])

  // ── KPIs ──

  const kpiContratos = useMemo(() => items.filter(i => i.categoria === 'CONTRATO').length, [items])
  const kpiAsos = useMemo(() => items.filter(i => i.categoria === 'ASO').length, [items])
  const kpiNRs = useMemo(() => items.filter(i => i.categoria.startsWith('NR')).length, [items])

  // ── Actions for contracts ──

  async function handleCiente(funcId: string, itemKey: string) {
    setActionLoading(itemKey)
    const { error } = await supabase.from('funcionarios').update({ alerta_ciente_em: new Date().toISOString() }).eq('id', funcId)
    if (error) { toast.error('Erro ao salvar', error.message); setActionLoading(null); return }
    toast.success('Ciente registrado')
    setItems(prev => prev.filter(i => i.key !== itemKey))
    setActionLoading(null)
  }

  async function handleRenovarCLT(funcId: string, itemKey: string) {
    setActionLoading(itemKey)
    const { error } = await supabase.from('funcionarios').update({
      tipo_vinculo: 'indeterminado',
      renovacao_decisao: 'renovar',
      renovacao_decisao_em: new Date().toISOString(),
    }).eq('id', funcId)
    if (error) { toast.error('Erro ao renovar', error.message); setActionLoading(null); return }
    toast.success('Contrato renovado para CLT Indeterminado')
    setItems(prev => prev.filter(i => i.key !== itemKey))
    setActionLoading(null)
  }

  async function handleNaoRenovar(funcId: string, itemKey: string) {
    setActionLoading(itemKey)
    const { error } = await supabase.from('funcionarios').update({
      nao_renovar: true,
      renovacao_decisao: 'nao_renovar',
      renovacao_decisao_em: new Date().toISOString(),
    }).eq('id', funcId)
    if (error) { toast.error('Erro ao salvar', error.message); setActionLoading(null); return }
    toast.warning('Marcado como nao renovar')
    setItems(prev => prev.filter(i => i.key !== itemKey))
    setActionLoading(null)
  }

  // ── Render ──

  if (loading) return <div className="p-6 text-center text-gray-400">Carregando vencimentos...</div>

  const catChips: CategoriaFilter[] = ['Todos', 'Contratos', 'ASO', 'NRs', 'Documentos']
  const statusChips: StatusFilter[] = ['Todos', 'Vencidos', '30d', '60d']

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-bold font-display text-brand">Central de Vencimentos</h1>
        <p className="text-sm text-gray-500 mt-0.5">Lista unificada de tudo que está vencendo ou vencido</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">Contratos Urgentes</p>
          <p className="text-2xl font-bold text-red-600">{kpiContratos}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">ASOs Vencendo</p>
          <p className="text-2xl font-bold text-amber-600">{kpiAsos}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">NRs Vencendo</p>
          <p className="text-2xl font-bold text-orange-600">{kpiNRs}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3 mb-6">
        <div className="max-w-md">
          <SearchInput value={busca} onChange={setBusca} placeholder="Buscar por nome do funcionário..." />
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide self-center mr-1">Categoria:</span>
          {catChips.map(c => (
            <button key={c} onClick={() => setCatFilter(c)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                catFilter === c
                  ? 'bg-brand text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide self-center mr-1">Status:</span>
          {statusChips.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                statusFilter === s
                  ? 'bg-brand text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s === 'Vencidos' ? 'Vencidos' : s}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center text-green-700 text-sm">
          <svg className="w-8 h-8 mx-auto mb-2 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Nenhum vencimento encontrado com os filtros atuais.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => {
            const badge = badgeFor(item.dias)
            const isContract = item.categoria === 'CONTRATO'
            const isLoading = actionLoading === item.key

            return (
              <div key={item.key} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  {/* Left: dot + info */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${dotColor(item.dias)}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/funcionarios/${item.funcionario_id}`}
                          className="text-sm font-semibold text-gray-900 hover:text-brand truncate">
                          {item.funcionario_nome}
                        </Link>
                        <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded bg-gray-100 text-gray-600 flex-shrink-0">
                          {item.categoria}
                        </span>
                        {isContract && item.meta?.tipo_vinculo && (
                          <span className="text-[10px] text-gray-400">
                            {formatTipoVinculo(item.meta.tipo_vinculo)}
                          </span>
                        )}
                        {item.meta?.tipo && item.categoria === 'DOCUMENTO' && (
                          <span className="text-[10px] text-gray-400">{item.meta.tipo}</span>
                        )}
                        {item.meta?.nome_trein && (
                          <span className="text-[10px] text-gray-400">{item.meta.nome_trein}</span>
                        )}
                        {item.meta?.status && (
                          <span className="text-[10px] text-gray-400">{formatStatus(item.meta.status)}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span>Vencimento: {formatDate(item.vencimento)}</span>
                        {isContract && item.meta?.prazo1 && (
                          <span>Prazo 1: {formatDate(item.meta.prazo1)}</span>
                        )}
                        {isContract && item.meta?.prazo2 && (
                          <span>Prazo 2: {formatDate(item.meta.prazo2)}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: badge + actions */}
                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap sm:flex-nowrap">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${badge.cls}`}>
                      {item.dias < 0 ? `${Math.abs(item.dias)}d atrasado` : badge.label}
                    </span>

                    {isContract ? (
                      <div className="flex gap-1.5">
                        <button onClick={() => handleCiente(item.funcionario_id, item.key)} disabled={isLoading}
                          className="px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                          Ciente
                        </button>
                        <button onClick={() => handleRenovarCLT(item.funcionario_id, item.key)} disabled={isLoading}
                          className="px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors">
                          Renovar pra CLT
                        </button>
                        <button onClick={() => handleNaoRenovar(item.funcionario_id, item.key)} disabled={isLoading}
                          className="px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 disabled:opacity-50 transition-colors">
                          Não Renovar
                        </button>
                      </div>
                    ) : item.categoria === 'ASO' ? (
                      <Link href={`/documentos/novo?funcionario=${item.funcionario_id}&tipo=ASO`}
                        className="px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-brand text-white hover:bg-brand-dark transition-colors">
                        Renovar ASO
                      </Link>
                    ) : item.categoria.startsWith('NR') ? (
                      <Link href={`/rh/treinamentos?renovar=${item.funcionario_id}&tipo=${item.meta?.tipo_id}`}
                        className="px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-brand text-white hover:bg-brand-dark transition-colors">
                        Renovar NR
                      </Link>
                    ) : (
                      <Link href={`/documentos/novo?funcionario=${item.funcionario_id}&tipo=${item.meta?.tipo ?? ''}`}
                        className="px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-brand text-white hover:bg-brand-dark transition-colors">
                        Renovar
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <p className="text-xs text-gray-400 mt-6 text-center">{filtered.length} item(ns) encontrado(s)</p>
    </div>
  )
}
