'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import BackButton from '@/components/BackButton'
import { useToast } from '@/components/Toast'
import {
  FileText, GraduationCap, Stethoscope,
  CheckCircle2, XCircle, Clock, AlertTriangle, CalendarPlus,
} from 'lucide-react'

interface DocAlerta {
  id: string
  tipo: string
  vencimento: string
  arquivo_url: string | null
  funcionario_id: string
  funcionarios: any
}

interface TreinAlerta {
  id: string
  data_vencimento: string
  funcionario_id: string
  tipo_id: string
  funcionarios: any
  treinamentos_tipos: any
}

interface FuncAso {
  id: string
  nome: string
  cargo: string
  obra_nome: string | null
  aso_vencimento: string | null
  aso_tipo: 'sem_aso' | 'vencido' | 'vencendo' | null
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + 'T12:00:00')
  const now = new Date(); now.setHours(12, 0, 0, 0)
  return Math.round((target.getTime() - now.getTime()) / 86400000)
}

function semaforo(dias: number) {
  if (dias < 0) return { cor: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', label: 'Vencido', icon: <XCircle className="w-4 h-4 text-red-500" />, group: 'vencido' as const }
  if (dias <= 30) return { cor: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', label: `${dias}d`, icon: <Clock className="w-4 h-4 text-amber-500" />, group: 'vence30' as const }
  return { cor: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', label: `${dias}d`, icon: <AlertTriangle className="w-4 h-4 text-blue-500" />, group: 'vence60' as const }
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}

type StatusFilter = 'todos' | 'vencido' | 'a_vencer'

export default function RastreioPage() {
  const supabase = createClient()
  const toast = useToast()
  const [docs, setDocs] = useState<DocAlerta[]>([])
  const [treins, setTreins] = useState<TreinAlerta[]>([])
  const [asos, setAsos] = useState<FuncAso[]>([])
  const [obras, setObras] = useState<{ id: string; nome: string }[]>([])
  const [obraFiltro, setObraFiltro] = useState('')
  const [statusFiltro, setStatusFiltro] = useState<StatusFilter>('todos')
  const [loading, setLoading] = useState(true)

  const [agendandoAso, setAgendandoAso] = useState<FuncAso | null>(null)
  const [asoDate, setAsoDate] = useState('')
  const [asoObs, setAsoObs] = useState('')
  const [asoSaving, setAsoSaving] = useState(false)

  // Allocation map for obra filtering
  const [alocMap, setAlocMap] = useState<Map<string, string>>(new Map())
  const [alocObraIdMap, setAlocObraIdMap] = useState<Map<string, string>>(new Map())

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const em60 = new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0]

    const [docsRes, treinRes, funcRes, obrasRes, alocsRes, allAsosRes] = await Promise.all([
      supabase.from('documentos').select('id, tipo, vencimento, arquivo_url, funcionario_id, funcionarios(id, nome, cargo)')
        .not('vencimento', 'is', null).lte('vencimento', em60).order('vencimento'),
      supabase.from('treinamentos_funcionarios').select('id, data_vencimento, funcionario_id, tipo_id, funcionarios(id, nome, cargo), treinamentos_tipos(id, codigo, nome)')
        .lte('data_vencimento', em60).order('data_vencimento'),
      supabase.from('funcionarios').select('id, nome, cargo, status').neq('status', 'inativo').order('nome'),
      supabase.from('obras').select('id, nome').eq('status', 'ativa').order('nome'),
      supabase.from('alocacoes').select('funcionario_id, obra_id, obras(nome)').eq('ativo', true),
      supabase.from('documentos').select('funcionario_id, vencimento').eq('tipo', 'ASO').order('vencimento', { ascending: false }),
    ])

    setDocs(docsRes.data ?? [])
    setTreins(treinRes.data ?? [])
    setObras(obrasRes.data ?? [])

    // Build allocation maps
    const nameMap = new Map<string, string>()
    const idMap = new Map<string, string>()
    ;(alocsRes.data ?? []).forEach((a: any) => {
      nameMap.set(a.funcionario_id, a.obras?.nome ?? '')
      idMap.set(a.funcionario_id, a.obra_id)
    })
    setAlocMap(nameMap)
    setAlocObraIdMap(idMap)

    // Build ASO map
    const asoMap = new Map<string, string>()
    ;(allAsosRes.data ?? []).forEach((a: any) => {
      if (!asoMap.has(a.funcionario_id)) asoMap.set(a.funcionario_id, a.vencimento)
    })

    const pendentes: FuncAso[] = (funcRes.data ?? []).map((f: any) => {
      const asoVenc = asoMap.get(f.id) ?? null
      const dias = asoVenc ? daysUntil(asoVenc) : -999
      return {
        id: f.id, nome: f.nome, cargo: f.cargo,
        obra_nome: nameMap.get(f.id) ?? null,
        aso_vencimento: asoVenc,
        aso_tipo: !asoVenc ? 'sem_aso' as const : dias < 0 ? 'vencido' as const : dias <= 30 ? 'vencendo' as const : null,
      }
    }).filter((f: FuncAso) => f.aso_tipo !== null)
    setAsos(pendentes)
    setLoading(false)
  }

  async function agendarAso() {
    if (!agendandoAso || !asoDate) return
    setAsoSaving(true)
    const venc = new Date(asoDate + 'T12:00:00')
    venc.setFullYear(venc.getFullYear() + 1)
    await supabase.from('documentos').insert({
      funcionario_id: agendandoAso.id,
      tipo: 'ASO',
      emissao: asoDate,
      vencimento: venc.toISOString().split('T')[0],
      observacao: asoObs || 'Agendado',
    })
    toast.success('ASO agendado!', 'Aparecera em documentos para acompanhamento.')
    setAgendandoAso(null)
    setAsoDate('')
    setAsoObs('')
    setAsoSaving(false)
    loadData()
  }

  // Filter helpers
  function passesObraFilter(funcId: string) {
    if (!obraFiltro) return true
    return alocObraIdMap.get(funcId) === obraFiltro
  }
  function passesStatusFilter(dias: number) {
    if (statusFiltro === 'todos') return true
    if (statusFiltro === 'vencido') return dias < 0
    return dias >= 0
  }

  const filteredDocs = docs.filter(d => passesObraFilter(d.funcionario_id) && passesStatusFilter(daysUntil(d.vencimento)))
  const filteredTreins = treins.filter(t => passesObraFilter(t.funcionario_id) && passesStatusFilter(daysUntil(t.data_vencimento)))
  const filteredAsos = asos.filter(a => {
    if (obraFiltro && alocObraIdMap.get(a.id) !== obraFiltro) return false
    return true
  })

  // Group docs into 3 buckets
  const docsVencidos = filteredDocs.filter(d => daysUntil(d.vencimento) < 0)
  const docsVence30 = filteredDocs.filter(d => { const dd = daysUntil(d.vencimento); return dd >= 0 && dd <= 30 })
  const docsVence60 = filteredDocs.filter(d => { const dd = daysUntil(d.vencimento); return dd > 30 && dd <= 60 })

  const treinsVencidos = filteredTreins.filter(t => daysUntil(t.data_vencimento) < 0)
  const treinsVence30 = filteredTreins.filter(t => { const dd = daysUntil(t.data_vencimento); return dd >= 0 && dd <= 30 })
  const treinsVence60 = filteredTreins.filter(t => { const dd = daysUntil(t.data_vencimento); return dd > 30 && dd <= 60 })

  // KPIs
  const totalVencidos = docsVencidos.length + treinsVencidos.length
  const totalVence30 = docsVence30.length + treinsVence30.length
  const totalVence60 = docsVence60.length + treinsVence60.length
  const totalSemAso = filteredAsos.length

  // Group ASO by obra
  const asoByObra = new Map<string, FuncAso[]>()
  filteredAsos.forEach(f => {
    const obra = f.obra_nome || 'Sem obra'
    if (!asoByObra.has(obra)) asoByObra.set(obra, [])
    asoByObra.get(obra)!.push(f)
  })

  function DocGroup({ items, title, color }: { items: DocAlerta[]; title: string; color: 'red' | 'amber' | 'blue' }) {
    if (items.length === 0) return null
    const cls = { red: 'bg-red-50 border-red-200 text-red-700', amber: 'bg-amber-50 border-amber-200 text-amber-700', blue: 'bg-blue-50 border-blue-200 text-blue-700' }
    const badge = { red: 'bg-red-100 text-red-700', amber: 'bg-amber-100 text-amber-700', blue: 'bg-blue-100 text-blue-700' }
    const dot = { red: 'bg-red-500', amber: 'bg-amber-500', blue: 'bg-blue-500' }
    return (
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className={`w-2.5 h-2.5 rounded-full ${dot[color]}`} />
          <span className={`text-xs font-bold uppercase tracking-wide ${color === 'red' ? 'text-red-600' : color === 'amber' ? 'text-amber-600' : 'text-blue-600'}`}>
            {title} ({items.length})
          </span>
        </div>
        <div className="space-y-1.5">
          {items.map(doc => {
            const dias = daysUntil(doc.vencimento)
            return (
              <div key={doc.id} className={`flex items-center justify-between p-2.5 rounded-lg border ${cls[color]}`}>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold bg-white/60 px-2 py-0.5 rounded">{doc.tipo}</span>
                  <Link href={`/funcionarios/${doc.funcionario_id}`} className="text-sm font-medium hover:underline">
                    {doc.funcionarios?.nome ?? '—'}
                  </Link>
                  <span className="text-xs opacity-70">{doc.funcionarios?.cargo}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs">{formatDate(doc.vencimento)}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badge[color]}`}>
                    {dias < 0 ? `${Math.abs(dias)}d atrasado` : `${dias}d`}
                  </span>
                  <Link href={`/documentos/novo?funcionario=${doc.funcionario_id}&tipo=${doc.tipo}`}
                    className="text-xs font-semibold text-brand hover:underline">Renovar</Link>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  function TreinGroup({ items, title, color }: { items: TreinAlerta[]; title: string; color: 'red' | 'amber' | 'blue' }) {
    if (items.length === 0) return null
    const badge = { red: 'bg-red-100 text-red-700', amber: 'bg-amber-100 text-amber-700', blue: 'bg-blue-100 text-blue-700' }
    const dot = { red: 'bg-red-500', amber: 'bg-amber-500', blue: 'bg-blue-500' }
    const rowCls = { red: 'hover:bg-red-50/50', amber: 'hover:bg-amber-50/50', blue: 'hover:bg-blue-50/50' }
    return (
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className={`w-2.5 h-2.5 rounded-full ${dot[color]}`} />
          <span className={`text-xs font-bold uppercase tracking-wide ${color === 'red' ? 'text-red-600' : color === 'amber' ? 'text-amber-600' : 'text-blue-600'}`}>
            {title} ({items.length})
          </span>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Funcionario', 'NR', 'Vencimento', 'Dias', ''].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(t => {
                const dias = daysUntil(t.data_vencimento)
                return (
                  <tr key={t.id} className={`border-b border-gray-50 ${rowCls[color]}`}>
                    <td className="px-4 py-2.5">
                      <Link href={`/funcionarios/${t.funcionario_id}`} className="font-semibold text-gray-900 hover:text-brand">
                        {t.funcionarios?.nome ?? '—'}
                      </Link>
                      <p className="text-xs text-gray-400">{t.funcionarios?.cargo}</p>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs font-bold text-brand bg-brand/10 px-2 py-0.5 rounded">{t.treinamentos_tipos?.codigo}</span>
                      <span className="ml-2 text-gray-600 text-xs">{t.treinamentos_tipos?.nome}</span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{formatDate(t.data_vencimento)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badge[color]}`}>
                        {dias < 0 ? `${Math.abs(dias)}d atrasado` : `${dias}d`}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <Link href={`/rh/treinamentos?renovar=${t.funcionario_id}&tipo=${t.tipo_id}`}
                        className="text-xs font-semibold text-brand hover:underline">Renovar</Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  if (loading) return <div className="p-6 text-center text-gray-400">Carregando...</div>

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <BackButton fallback="/dashboard" />
          <div>
            <h1 className="text-xl font-bold font-display text-brand">Rastreio de Vencimentos</h1>
            <p className="text-sm text-gray-500 mt-0.5">Documentos, treinamentos e ASOs</p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="w-4 h-4 text-red-500" />
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Total Vencidos</p>
          </div>
          <p className="text-2xl font-bold text-red-600">{totalVencidos}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-amber-500" />
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Vencem em 30d</p>
          </div>
          <p className="text-2xl font-bold text-amber-600">{totalVence30}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-blue-500" />
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Vencem em 60d</p>
          </div>
          <p className="text-2xl font-bold text-blue-600">{totalVence60}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Stethoscope className="w-4 h-4 text-red-500" />
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Sem ASO Valido</p>
          </div>
          <p className="text-2xl font-bold text-red-600">{totalSemAso}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Obra</label>
          <select value={obraFiltro} onChange={e => setObraFiltro(e.target.value)}
            className="w-full sm:w-60 px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand/30">
            <option value="">Todas as obras</option>
            {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Status</label>
          <select value={statusFiltro} onChange={e => setStatusFiltro(e.target.value as StatusFilter)}
            className="w-full sm:w-48 px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand/30">
            <option value="todos">Todos</option>
            <option value="vencido">Vencidos</option>
            <option value="a_vencer">A vencer</option>
          </select>
        </div>
      </div>

      {/* Section 1 — Documentos */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-5 h-5 text-brand" />
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Documentos</h2>
          <span className="text-xs text-gray-400">({filteredDocs.length})</span>
        </div>

        {filteredDocs.length === 0 ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center text-green-700 text-sm">
            <CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-green-500" />
            Nenhum documento vencido ou a vencer.
          </div>
        ) : (
          <>
            <DocGroup items={docsVencidos} title="Vencidos" color="red" />
            <DocGroup items={docsVence30} title="Vencem em ate 30 dias" color="amber" />
            <DocGroup items={docsVence60} title="Vencem entre 31-60 dias" color="blue" />
          </>
        )}
      </div>

      {/* Section 2 — Treinamentos NR */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <GraduationCap className="w-5 h-5 text-brand" />
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Treinamentos NR</h2>
          <span className="text-xs text-gray-400">({filteredTreins.length})</span>
        </div>

        {filteredTreins.length === 0 ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center text-green-700 text-sm">
            <CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-green-500" />
            Nenhum treinamento vencido ou a vencer.
          </div>
        ) : (
          <>
            <TreinGroup items={treinsVencidos} title="Vencidos" color="red" />
            <TreinGroup items={treinsVence30} title="Vencem em ate 30 dias" color="amber" />
            <TreinGroup items={treinsVence60} title="Vencem entre 31-60 dias" color="blue" />
          </>
        )}
      </div>

      {/* Section 3 — ASOs */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Stethoscope className="w-5 h-5 text-brand" />
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Funcionarios sem ASO Valido</h2>
          <span className="text-xs text-gray-400">({filteredAsos.length})</span>
        </div>

        {asoByObra.size === 0 ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center text-green-700 text-sm">
            <CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-green-500" />
            Todos os ASOs estao em dia.
          </div>
        ) : (
          <div className="space-y-4">
            {Array.from(asoByObra.entries()).map(([obra, funcs]) => (
              <div key={obra} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-700">{obra}</span>
                  <span className="text-xs text-gray-400">{funcs.length} funcionario(s)</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {funcs.map(f => {
                    const dias = f.aso_vencimento ? daysUntil(f.aso_vencimento) : -999
                    return (
                      <div key={f.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50/80">
                        <div className="flex items-center gap-3">
                          {f.aso_tipo === 'sem_aso'
                            ? <XCircle className="w-4 h-4 text-red-500" />
                            : dias < 0
                              ? <XCircle className="w-4 h-4 text-red-500" />
                              : <Clock className="w-4 h-4 text-amber-500" />}
                          <div>
                            <Link href={`/funcionarios/${f.id}`} className="text-sm font-semibold text-gray-900 hover:text-brand">{f.nome}</Link>
                            <p className="text-xs text-gray-400">{f.cargo}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {f.aso_tipo === 'sem_aso' ? (
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Nunca registrado</span>
                          ) : (
                            <>
                              <span className="text-xs text-gray-500">Ultima: {formatDate(f.aso_vencimento)}</span>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${dias < 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                {dias < 0 ? `${Math.abs(dias)}d atrasado` : `${dias}d`}
                              </span>
                            </>
                          )}
                          <button onClick={() => { setAgendandoAso(f); setAsoDate(new Date().toISOString().split('T')[0]); setAsoObs('') }}
                            className="text-xs text-amber-600 font-semibold hover:underline flex items-center gap-1">
                            <CalendarPlus className="w-3 h-3" /> Agendar
                          </button>
                          <Link href={`/documentos/novo?funcionario=${f.id}&tipo=ASO`}
                            className="text-xs text-brand font-semibold hover:underline">
                            {f.aso_tipo === 'sem_aso' ? 'Adicionar' : 'Renovar'}
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Agendar ASO Modal */}
      {agendandoAso && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setAgendandoAso(null)}>
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-sm font-bold font-display text-brand mb-1">Agendar ASO</h2>
            <p className="text-xs text-gray-500 mb-4">{agendandoAso.nome} — {agendandoAso.cargo}</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Data prevista do exame</label>
                <input type="date" value={asoDate} onChange={e => setAsoDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Observacao</label>
                <input type="text" value={asoObs} onChange={e => setAsoObs(e.target.value)} placeholder="Opcional"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={agendarAso} disabled={asoSaving || !asoDate}
                className="px-5 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50">
                {asoSaving ? 'Salvando...' : 'Agendar'}
              </button>
              <button onClick={() => setAgendandoAso(null)}
                className="px-5 py-2 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
