'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import BackButton from '@/components/BackButton'
import { useToast } from '@/components/Toast'
import EmptyState from '@/components/ui/EmptyState'
import SearchInput from '@/components/SearchInput'
import {
  GraduationCap, CheckCircle2, Clock, XCircle, AlertTriangle,
  ChevronDown, ChevronRight, Plus, Users, ShieldAlert, FileWarning,
} from 'lucide-react'
import ConfirmButton from '@/components/ConfirmButton'

/* ═══ Types ═══ */

interface ViewRow {
  funcionario_id: string
  funcionario: string
  funcao: string
  codigo: string
  treinamento: string
  validade_meses: number
  data_realizacao: string | null
  data_vencimento: string | null
  status: string | null
  dias_para_vencer: number | null
  situacao: string          // ok | vencendo_30d | vencendo_60d | vencido | vitalicio (=pendente)
  obra_id: string | null
  obra: string | null
}

interface TreinamentoTipo {
  id: string
  nome: string
  codigo: string | null
  validade_meses: number
  ativo: boolean
}

interface Funcionario {
  id: string
  nome: string
  cargo: string
}

type TabType = 'por_funcionario' | 'por_nr'
type SituacaoFilter = 'todos' | 'ok' | 'vencendo' | 'vencido' | 'pendente'

/* ═══ Helpers ═══ */

function normalizeSituacao(s: string): 'ok' | 'vencendo' | 'vencido' | 'pendente' {
  if (s === 'ok') return 'ok'
  if (s === 'vencendo_30d' || s === 'vencendo_60d') return 'vencendo'
  if (s === 'vencido') return 'vencido'
  return 'pendente' // vitalicio = nunca fez = pendente
}

const SITUACAO_CONFIG = {
  ok:       { label: 'Em dia',    cls: 'bg-green-100 text-green-700', icon: CheckCircle2, iconCls: 'text-green-500' },
  vencendo: { label: 'Vencendo',  cls: 'bg-amber-100 text-amber-700', icon: Clock,        iconCls: 'text-amber-500' },
  vencido:  { label: 'Vencido',   cls: 'bg-red-100 text-red-700',     icon: XCircle,      iconCls: 'text-red-500' },
  pendente: { label: 'Pendente',  cls: 'bg-gray-100 text-gray-600',   icon: FileWarning,  iconCls: 'text-gray-400' },
} as const

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}

function diasLabel(dias: number | null, situacao: string): string {
  if (dias === null) return ''
  const norm = normalizeSituacao(situacao)
  if (norm === 'vencido') return `${Math.abs(dias)}d atras`
  return `${dias}d`
}

/* ═══ Component ═══ */

export default function TreinamentosPage() {
  const supabase = createClient()
  const toast = useToast()

  const [tab, setTab] = useState<TabType>('por_funcionario')
  const [rows, setRows] = useState<ViewRow[]>([])
  const [tipos, setTipos] = useState<TreinamentoTipo[]>([])
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // Filters
  const [search, setSearch] = useState('')
  const [filtroSituacao, setFiltroSituacao] = useState<SituacaoFilter>('todos')
  const [filtroNR, setFiltroNR] = useState('')

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [selectedFuncs, setSelectedFuncs] = useState<Set<string>>(new Set())
  const [formTipoId, setFormTipoId] = useState('')
  const [formDataRealizacao, setFormDataRealizacao] = useState('')
  const [formDataVencimento, setFormDataVencimento] = useState('')
  const [formCertificado, setFormCertificado] = useState('')
  const [saving, setSaving] = useState(false)
  const [funcSearchTerm, setFuncSearchTerm] = useState('')

  // Renew modal
  const [renewTarget, setRenewTarget] = useState<ViewRow | null>(null)
  const [renewForm, setRenewForm] = useState({ data_realizacao: '', data_vencimento: '', instituicao: '', certificado: '' })
  const [renewFile, setRenewFile] = useState<File | null>(null)
  const [renewSaving, setRenewSaving] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [viewRes, tiposRes, funcRes] = await Promise.all([
      supabase.from('vw_treinamentos_status').select('*').limit(2000),
      supabase.from('treinamentos_tipos').select('*').eq('ativo', true).order('nome'),
      supabase.from('funcionarios').select('id, nome, cargo').in('status', ['alocado', 'disponivel', 'pendente']).is('deleted_at', null).order('nome'),
    ])
    setRows(viewRes.data ?? [])
    setTipos(tiposRes.data ?? [])
    setFuncionarios(funcRes.data ?? [])
    setLoading(false)
  }

  /* ─── Filtered rows ─── */
  const filtered = useMemo(() => {
    let result = rows
    if (search) {
      const term = search.toLowerCase()
      result = result.filter(r =>
        r.funcionario.toLowerCase().includes(term) ||
        r.funcao.toLowerCase().includes(term) ||
        (r.obra ?? '').toLowerCase().includes(term)
      )
    }
    if (filtroSituacao !== 'todos') {
      result = result.filter(r => normalizeSituacao(r.situacao) === filtroSituacao)
    }
    if (filtroNR) {
      result = result.filter(r => r.codigo === filtroNR)
    }
    return result
  }, [rows, search, filtroSituacao, filtroNR])

  /* ─── KPIs ─── */
  const kpis = useMemo(() => {
    const ok = rows.filter(r => normalizeSituacao(r.situacao) === 'ok').length
    const vencendo = rows.filter(r => normalizeSituacao(r.situacao) === 'vencendo').length
    const vencido = rows.filter(r => normalizeSituacao(r.situacao) === 'vencido').length
    const pendente = rows.filter(r => normalizeSituacao(r.situacao) === 'pendente').length
    return { ok, vencendo, vencido, pendente, total: rows.length }
  }, [rows])

  /* ─── Tab: Por Funcionario ─── */
  const byFuncionario = useMemo(() => {
    const map: Record<string, { funcionario: string; funcao: string; obra: string | null; items: ViewRow[] }> = {}
    for (const r of filtered) {
      if (!map[r.funcionario_id]) {
        map[r.funcionario_id] = { funcionario: r.funcionario, funcao: r.funcao, obra: r.obra, items: [] }
      }
      map[r.funcionario_id].items.push(r)
    }
    return Object.entries(map).sort((a, b) => a[1].funcionario.localeCompare(b[1].funcionario))
  }, [filtered])

  /* ─── Tab: Por NR ─── */
  const byNR = useMemo(() => {
    const map: Record<string, { codigo: string; treinamento: string; ok: number; vencendo: number; vencido: number; pendente: number; total: number; items: ViewRow[] }> = {}
    for (const r of filtered) {
      if (!map[r.codigo]) {
        map[r.codigo] = { codigo: r.codigo, treinamento: r.treinamento, ok: 0, vencendo: 0, vencido: 0, pendente: 0, total: 0, items: [] }
      }
      const entry = map[r.codigo]
      const norm = normalizeSituacao(r.situacao)
      entry[norm]++
      entry.total++
      entry.items.push(r)
    }
    return Object.values(map).sort((a, b) => a.codigo.localeCompare(b.codigo))
  }, [filtered])

  /* ─── Unique NR codes for filter ─── */
  const nrCodes = useMemo(() => {
    const codes = new Set(rows.map(r => r.codigo))
    return Array.from(codes).sort()
  }, [rows])

  /* ─── Expand/collapse ─── */
  function toggleExpand(key: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  /* ─── Form helpers ─── */
  function toggleFuncSelect(funcId: string) {
    setSelectedFuncs(prev => {
      const next = new Set(prev)
      if (next.has(funcId)) next.delete(funcId)
      else next.add(funcId)
      return next
    })
  }

  function handleTipoChange(tipoId: string) {
    setFormTipoId(tipoId)
    if (formDataRealizacao && tipoId) {
      const tipo = tipos.find(t => t.id === tipoId)
      if (tipo && tipo.validade_meses) {
        const realizacao = new Date(formDataRealizacao + 'T12:00:00')
        realizacao.setMonth(realizacao.getMonth() + tipo.validade_meses)
        setFormDataVencimento(realizacao.toISOString().split('T')[0])
      }
    }
  }

  function handleRealizacaoChange(date: string) {
    setFormDataRealizacao(date)
    if (date && formTipoId) {
      const tipo = tipos.find(t => t.id === formTipoId)
      if (tipo && tipo.validade_meses) {
        const realizacao = new Date(date + 'T12:00:00')
        realizacao.setMonth(realizacao.getMonth() + tipo.validade_meses)
        setFormDataVencimento(realizacao.toISOString().split('T')[0])
      }
    }
  }

  async function handleSubmit() {
    if (selectedFuncs.size === 0) { toast.warning('Selecione pelo menos um funcionario.'); return }
    if (!formTipoId) { toast.warning('Selecione o tipo de treinamento.'); return }
    if (!formDataRealizacao || !formDataVencimento) { toast.warning('Preencha as datas.'); return }

    setSaving(true)
    const records = Array.from(selectedFuncs).map(funcId => ({
      funcionario_id: funcId,
      tipo_id: formTipoId,
      data_realizacao: formDataRealizacao,
      data_vencimento: formDataVencimento,
      numero_certificado: formCertificado || null,
    }))

    const { error } = await supabase.from('treinamentos_funcionarios').insert(records)
    if (error) {
      toast.error('Erro ao registrar treinamento.')
    } else {
      toast.success(`Treinamento registrado para ${records.length} funcionario(s).`)
    }

    setShowForm(false)
    setSelectedFuncs(new Set())
    setFormTipoId('')
    setFormDataRealizacao('')
    setFormDataVencimento('')
    setFormCertificado('')
    setFuncSearchTerm('')
    setSaving(false)
    loadData()
  }

  function openRenew(r: ViewRow) {
    const hoje = new Date().toISOString().split('T')[0]
    const validadeMeses = r.validade_meses || 12
    const venc = new Date(hoje + 'T12:00:00')
    venc.setMonth(venc.getMonth() + validadeMeses)
    setRenewForm({ data_realizacao: hoje, data_vencimento: venc.toISOString().split('T')[0], instituicao: '', certificado: '' })
    setRenewFile(null)
    setRenewTarget(r)
  }

  async function handleRenew() {
    if (!renewTarget || !renewForm.data_realizacao || !renewForm.data_vencimento) return
    setRenewSaving(true)

    let arquivo_url = null
    let arquivo_nome = null
    if (renewFile) {
      const ext = renewFile.name.split('.').pop()
      const path = `treinamentos/${renewTarget.funcionario_id}/${renewTarget.codigo}_${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('softmonte').upload(path, renewFile)
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('softmonte').getPublicUrl(path)
        arquivo_url = urlData.publicUrl
        arquivo_nome = renewFile.name
      }
    }

    // Find existing record to mark as replaced
    const { data: existing } = await supabase
      .from('treinamentos_funcionarios')
      .select('id')
      .eq('funcionario_id', renewTarget.funcionario_id)
      .eq('status', 'valido')
      .limit(1)

    if (existing && existing.length > 0) {
      await supabase.from('treinamentos_funcionarios')
        .update({ status: 'substituido' })
        .eq('id', existing[0].id)
    }

    // Find tipo_id from codigo
    const tipo = tipos.find(t => t.codigo === renewTarget.codigo)

    await supabase.from('treinamentos_funcionarios').insert({
      funcionario_id: renewTarget.funcionario_id,
      tipo_id: tipo?.id ?? null,
      data_realizacao: renewForm.data_realizacao,
      data_vencimento: renewForm.data_vencimento,
      numero_certificado: renewForm.certificado || null,
      instituicao: renewForm.instituicao || null,
      status: 'valido',
      ...(arquivo_url ? { arquivo_url, arquivo_nome } : {}),
    })

    toast.success('Treinamento renovado com sucesso')
    setRenewTarget(null)
    setRenewSaving(false)
    loadData()
  }

  async function handleDeleteTreinamento(item: ViewRow) {
    const tipo = tipos.find(t => t.codigo === item.codigo)
    if (!tipo) { toast.error('Tipo de treinamento nao encontrado'); return }
    const { data: { user } } = await supabase.auth.getUser()
    const { data: records } = await supabase.from('treinamentos_funcionarios')
      .select('id')
      .eq('funcionario_id', item.funcionario_id)
      .eq('tipo_id', tipo.id)
      .eq('status', 'valido')
      .is('deleted_at', null)
      .limit(1)
    if (records && records.length > 0) {
      const { error } = await supabase.from('treinamentos_funcionarios')
        .update({ deleted_at: new Date().toISOString(), deleted_by: user?.id ?? null })
        .eq('id', records[0].id)
      if (error) { toast.error('Erro ao excluir: ' + error.message); return }
    } else {
      toast.error('Registro nao encontrado')
      return
    }
    toast.success('Treinamento excluido')
    loadData()
  }

  const filteredFormFuncs = funcionarios.filter(f =>
    f.nome.toLowerCase().includes(funcSearchTerm.toLowerCase()) ||
    f.cargo.toLowerCase().includes(funcSearchTerm.toLowerCase())
  )

  /* ─── Chip component ─── */
  function SituacaoChip({ situacao, codigo, dias }: { situacao: string; codigo?: string; dias?: number | null }) {
    const norm = normalizeSituacao(situacao)
    const cfg = SITUACAO_CONFIG[norm]
    const Icon = cfg.icon
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${cfg.cls}`}>
        <Icon className={`w-3.5 h-3.5 ${cfg.iconCls}`} />
        {codigo && <span className="font-bold">{codigo}</span>}
        {!codigo && cfg.label}
        {dias !== undefined && dias !== null && (
          <span className="opacity-75">({diasLabel(dias, situacao)})</span>
        )}
      </span>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <BackButton fallback="/rh" />
          <div>
            <h1 className="text-xl font-bold font-display text-brand">Treinamentos &amp; NRs</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {rows.length} registro(s) &middot; {new Set(rows.map(r => r.funcionario_id)).size} funcionario(s)
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Registrar Treinamento
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
        {[
          { icon: GraduationCap, iconCls: 'text-brand', label: 'Total', value: kpis.total, valueCls: 'text-gray-800' },
          { icon: CheckCircle2, iconCls: 'text-green-500', label: 'Em Dia', value: kpis.ok, valueCls: 'text-green-600' },
          { icon: Clock, iconCls: 'text-amber-500', label: 'Vencendo', value: kpis.vencendo, valueCls: 'text-amber-600' },
          { icon: XCircle, iconCls: 'text-red-500', label: 'Vencidos', value: kpis.vencido, valueCls: 'text-red-600' },
          { icon: FileWarning, iconCls: 'text-gray-400', label: 'Pendentes', value: kpis.pendente, valueCls: 'text-gray-600' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-1">
              <kpi.icon className={`w-4 h-4 ${kpi.iconCls}`} />
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">{kpi.label}</p>
            </div>
            <p className={`text-2xl font-bold ${kpi.valueCls}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Gráfico status por NR */}
      {Object.keys(byNR).length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
          <h3 className="text-sm font-bold text-gray-800 mb-3">Status por Treinamento</h3>
          <div className="space-y-2">
            {Object.values(byNR).sort((a: any, b: any) => b.vencido - a.vencido || b.vencendo - a.vencendo).slice(0, 10).map((nr: any) => (
              <div key={nr.codigo}>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-gray-600 truncate">{nr.codigo} — {nr.treinamento}</span>
                  <span className="text-gray-400">{nr.total}</span>
                </div>
                <div className="flex h-3 rounded-full overflow-hidden bg-gray-100">
                  {nr.ok > 0 && <div className="bg-green-500" style={{ width: `${nr.ok/nr.total*100}%` }} title={`${nr.ok} em dia`} />}
                  {nr.vencendo > 0 && <div className="bg-amber-400" style={{ width: `${nr.vencendo/nr.total*100}%` }} title={`${nr.vencendo} vencendo`} />}
                  {nr.vencido > 0 && <div className="bg-red-500" style={{ width: `${nr.vencido/nr.total*100}%` }} title={`${nr.vencido} vencidos`} />}
                  {nr.pendente > 0 && <div className="bg-gray-300" style={{ width: `${nr.pendente/nr.total*100}%` }} title={`${nr.pendente} pendentes`} />}
                </div>
              </div>
            ))}
            <div className="flex gap-3 mt-2 text-[10px] text-gray-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Em dia</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> Vencendo</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Vencido</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300" /> Pendente</span>
            </div>
          </div>
        </div>
      )}

      {/* Form section */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
          <h2 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4" /> Registrar Treinamento
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Tipo de Treinamento</label>
              <select
                value={formTipoId}
                onChange={e => handleTipoChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
              >
                <option value="">Selecione...</option>
                {tipos.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.codigo ? `${t.codigo} - ` : ''}{t.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Data Realizacao</label>
              <input
                type="date"
                value={formDataRealizacao}
                onChange={e => handleRealizacaoChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Data Vencimento</label>
              <input
                type="date"
                value={formDataVencimento}
                onChange={e => setFormDataVencimento(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 bg-gray-50"
              />
              {formTipoId && (
                <p className="text-xs text-gray-400 mt-1">Auto-calculado com base na validade</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Número Certificado</label>
              <input
                type="text"
                value={formCertificado}
                onChange={e => setFormCertificado(e.target.value)}
                placeholder="Opcional"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>
          </div>

          {/* Multi-select funcionarios */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Funcionarios ({selectedFuncs.size} selecionado{selectedFuncs.size !== 1 ? 's' : ''})
            </label>
            <input
              type="text"
              value={funcSearchTerm}
              onChange={e => setFuncSearchTerm(e.target.value)}
              placeholder="Buscar funcionário..."
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 mb-2"
            />
            <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100">
              {filteredFormFuncs.map(f => (
                <label
                  key={f.id}
                  className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors ${
                    selectedFuncs.has(f.id) ? 'bg-brand/5' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedFuncs.has(f.id)}
                    onChange={() => toggleFuncSelect(f.id)}
                    className="rounded border-gray-300 text-brand focus:ring-brand/30"
                  />
                  <span className="text-sm font-medium text-gray-900">{f.nome}</span>
                  <span className="text-xs text-gray-500">{f.cargo}</span>
                </label>
              ))}
              {filteredFormFuncs.length === 0 && (
                <p className="px-3 py-4 text-center text-sm text-gray-400">Nenhum funcionario encontrado.</p>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="px-4 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50"
            >
              {saving ? 'Salvando...' : `Registrar para ${selectedFuncs.size} funcionario(s)`}
            </button>
            <button
              onClick={() => { setShowForm(false); setSelectedFuncs(new Set()); setFuncSearchTerm('') }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-300"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Filters + Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          <button
            onClick={() => { setTab('por_funcionario'); setExpanded(new Set()) }}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
              tab === 'por_funcionario' ? 'bg-white text-brand shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users className="w-4 h-4" /> Por Funcionario
          </button>
          <button
            onClick={() => { setTab('por_nr'); setExpanded(new Set()) }}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
              tab === 'por_nr' ? 'bg-white text-brand shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <ShieldAlert className="w-4 h-4" /> Por NR
          </button>
        </div>

        <div className="flex-1 max-w-sm">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar nome, funcao ou obra..." />
        </div>

        <select
          value={filtroSituacao}
          onChange={e => setFiltroSituacao(e.target.value as SituacaoFilter)}
          className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 bg-white"
        >
          <option value="todos">Todas situacoes</option>
          <option value="ok">Em dia</option>
          <option value="vencendo">Vencendo</option>
          <option value="vencido">Vencido</option>
          <option value="pendente">Pendente</option>
        </select>

        <select
          value={filtroNR}
          onChange={e => setFiltroNR(e.target.value)}
          className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 bg-white"
        >
          <option value="">Todos NRs</option>
          {nrCodes.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Carregando...</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          titulo="Nenhum treinamento encontrado"
          descricao={search || filtroSituacao !== 'todos' || filtroNR
            ? 'Tente ajustar os filtros.'
            : 'Registre treinamentos NR para acompanhar vencimentos e conformidade.'}
          icone={<GraduationCap className="w-12 h-12" />}
          acao={!search && filtroSituacao === 'todos' && !filtroNR ? { label: 'Registrar Treinamento', href: '#' } : undefined}
        />
      ) : tab === 'por_funcionario' ? (
        /* ═══ TAB: POR FUNCIONARIO ═══ */
        <div className="space-y-2">
          {byFuncionario.map(([funcId, group]) => {
            const isOpen = expanded.has(funcId)
            const counts = { ok: 0, vencendo: 0, vencido: 0, pendente: 0 }
            for (const item of group.items) counts[normalizeSituacao(item.situacao)]++

            return (
              <div key={funcId} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <button
                  onClick={() => toggleExpand(funcId)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
                    <div className="text-left min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{group.funcionario}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {group.funcao}
                        {group.obra && <> &middot; {group.obra}</>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap justify-end ml-3">
                    {group.items.map(item => (
                      <SituacaoChip key={item.codigo} situacao={item.situacao} codigo={item.codigo} />
                    ))}
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t border-gray-100">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          {['Treinamento', 'Código', 'Realização', 'Vencimento', 'Situação', ''].map(h => (
                            <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {group.items.map(item => {
                          const norm = normalizeSituacao(item.situacao)
                          const cfg = SITUACAO_CONFIG[norm]
                          const Icon = cfg.icon
                          return (
                            <tr key={item.codigo} className="border-b border-gray-50 hover:bg-gray-50/80">
                              <td className="px-4 py-2 font-medium text-gray-900">{item.treinamento}</td>
                              <td className="px-4 py-2">
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{item.codigo}</span>
                              </td>
                              <td className="px-4 py-2 text-gray-600 text-xs">{formatDate(item.data_realizacao)}</td>
                              <td className="px-4 py-2 text-gray-600 text-xs">{formatDate(item.data_vencimento)}</td>
                              <td className="px-4 py-2">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
                                  <Icon className={`w-3.5 h-3.5 ${cfg.iconCls}`} />
                                  {cfg.label}
                                  {item.dias_para_vencer !== null && (
                                    <span className="opacity-75">({diasLabel(item.dias_para_vencer, item.situacao)})</span>
                                  )}
                                </span>
                              </td>
                              <td className="px-4 py-2">
                                <span className="inline-flex items-center gap-2">
                                  {(norm === 'vencido' || norm === 'vencendo' || norm === 'pendente') && (
                                    <button onClick={() => openRenew(item)} className="text-xs text-brand font-semibold hover:underline">
                                      {norm === 'pendente' ? 'Registrar' : 'Renovar'}
                                    </button>
                                  )}
                                  {norm !== 'pendente' && (
                                    <ConfirmButton label="Excluir" onConfirm={() => handleDeleteTreinamento(item)}
                                      className="text-xs text-gray-400 hover:text-red-600" />
                                  )}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        /* ═══ TAB: POR NR ═══ */
        <div className="space-y-2">
          {byNR.map(nr => {
            const isOpen = expanded.has(nr.codigo)
            const pctOk = nr.total > 0 ? Math.round((nr.ok / nr.total) * 100) : 0

            return (
              <div key={nr.codigo} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <button
                  onClick={() => toggleExpand(nr.codigo)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
                    <div className="text-left min-w-0">
                      <p className="font-semibold text-gray-900">{nr.codigo}</p>
                      <p className="text-xs text-gray-500 truncate">{nr.treinamento} &middot; {nr.total} funcionario(s)</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-3">
                    {/* Progress bar */}
                    <div className="hidden sm:flex items-center gap-2 w-40">
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden flex">
                        {nr.ok > 0 && <div className="h-full bg-green-500" style={{ width: `${(nr.ok / nr.total) * 100}%` }} />}
                        {nr.vencendo > 0 && <div className="h-full bg-amber-400" style={{ width: `${(nr.vencendo / nr.total) * 100}%` }} />}
                        {nr.vencido > 0 && <div className="h-full bg-red-500" style={{ width: `${(nr.vencido / nr.total) * 100}%` }} />}
                        {nr.pendente > 0 && <div className="h-full bg-gray-300" style={{ width: `${(nr.pendente / nr.total) * 100}%` }} />}
                      </div>
                      <span className="text-xs font-bold text-gray-500 w-10 text-right">{pctOk}%</span>
                    </div>
                    {/* Count badges */}
                    <div className="flex items-center gap-1.5">
                      {nr.ok > 0 && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">{nr.ok}</span>}
                      {nr.vencendo > 0 && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">{nr.vencendo}</span>}
                      {nr.vencido > 0 && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">{nr.vencido}</span>}
                      {nr.pendente > 0 && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">{nr.pendente}</span>}
                    </div>
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t border-gray-100">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          {['Funcionário', 'Função', 'Obra', 'Realização', 'Vencimento', 'Situação', ''].map(h => (
                            <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {nr.items
                          .sort((a, b) => {
                            const order = { vencido: 0, vencendo: 1, pendente: 2, ok: 3 }
                            return (order[normalizeSituacao(a.situacao)] ?? 9) - (order[normalizeSituacao(b.situacao)] ?? 9)
                          })
                          .map(item => {
                            const norm = normalizeSituacao(item.situacao)
                            const cfg = SITUACAO_CONFIG[norm]
                            const Icon = cfg.icon
                            return (
                              <tr key={item.funcionario_id} className={`border-b border-gray-50 hover:bg-gray-50/80 ${
                                norm === 'vencido' ? 'bg-red-50/50' : norm === 'vencendo' ? 'bg-amber-50/30' : ''
                              }`}>
                                <td className="px-4 py-2 font-semibold text-gray-900 whitespace-nowrap">{item.funcionario}</td>
                                <td className="px-4 py-2 text-gray-600 text-xs">{item.funcao}</td>
                                <td className="px-4 py-2 text-gray-500 text-xs">{item.obra ?? '—'}</td>
                                <td className="px-4 py-2 text-gray-600 text-xs">{formatDate(item.data_realizacao)}</td>
                                <td className="px-4 py-2 text-gray-600 text-xs">{formatDate(item.data_vencimento)}</td>
                                <td className="px-4 py-2">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
                                    <Icon className={`w-3.5 h-3.5 ${cfg.iconCls}`} />
                                    {cfg.label}
                                    {item.dias_para_vencer !== null && (
                                      <span className="opacity-75">({diasLabel(item.dias_para_vencer, item.situacao)})</span>
                                    )}
                                  </span>
                                </td>
                                <td className="px-4 py-2">
                                  <span className="inline-flex items-center gap-2">
                                    {(norm === 'vencido' || norm === 'vencendo' || norm === 'pendente') && (
                                      <button onClick={() => openRenew(item)} className="text-xs text-brand font-semibold hover:underline">
                                        {norm === 'pendente' ? 'Registrar' : 'Renovar'}
                                      </button>
                                    )}
                                    {norm !== 'pendente' && (
                                      <ConfirmButton label="Excluir" onConfirm={() => handleDeleteTreinamento(item)}
                                        className="text-xs text-gray-400 hover:text-red-600" />
                                    )}
                                  </span>
                                </td>
                              </tr>
                            )
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Renew Modal */}
      {renewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setRenewTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-sm font-bold font-display text-brand mb-1">
              {normalizeSituacao(renewTarget.situacao) === 'pendente' ? 'Registrar' : 'Renovar'} {renewTarget.treinamento}
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              {renewTarget.funcionario} &middot; {renewTarget.codigo}
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Data de realizacao</label>
                <input type="date" value={renewForm.data_realizacao}
                  onChange={e => {
                    const v = e.target.value
                    const venc = new Date(v + 'T12:00:00')
                    venc.setMonth(venc.getMonth() + (renewTarget.validade_meses || 12))
                    setRenewForm(f => ({ ...f, data_realizacao: v, data_vencimento: venc.toISOString().split('T')[0] }))
                  }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Data de vencimento</label>
                <input type="date" value={renewForm.data_vencimento}
                  onChange={e => setRenewForm(f => ({ ...f, data_vencimento: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Instituicao</label>
                <input type="text" value={renewForm.instituicao} placeholder="Opcional"
                  onChange={e => setRenewForm(f => ({ ...f, instituicao: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Número do certificado</label>
                <input type="text" value={renewForm.certificado} placeholder="Opcional"
                  onChange={e => setRenewForm(f => ({ ...f, certificado: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Certificado PDF</label>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setRenewFile(e.target.files?.[0] ?? null)}
                  className="w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-brand file:text-white" />
              </div>
            </div>
            <div className="flex gap-3 mt-4 pt-3 border-t border-gray-100">
              <button onClick={handleRenew} disabled={renewSaving}
                className="px-5 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50">
                {renewSaving ? 'Salvando...' : normalizeSituacao(renewTarget.situacao) === 'pendente' ? 'Registrar' : 'Salvar renovacao'}
              </button>
              <button onClick={() => setRenewTarget(null)}
                className="px-5 py-2 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
