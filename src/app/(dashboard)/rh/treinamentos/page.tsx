'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import BackButton from '@/components/BackButton'
import { useToast } from '@/components/Toast'
import EmptyState from '@/components/ui/EmptyState'
import {
  GraduationCap, CheckCircle2, Clock, XCircle, AlertTriangle,
  ChevronDown, ChevronRight, Plus, Users, ShieldAlert,
} from 'lucide-react'

interface TreinamentoTipo {
  id: string
  nome: string
  validade_meses: number
  nr: string | null
}

interface TreinamentoFuncionario {
  id: string
  funcionario_id: string
  tipo_id: string
  data_realizacao: string
  data_vencimento: string
  numero_certificado: string | null
  funcionarios: { id: string; nome: string; cargo: string } | null
  treinamentos_tipos: { id: string; nome: string; nr: string | null; validade_meses: number } | null
}

interface Funcionario {
  id: string
  nome: string
  cargo: string
}

type TabType = 'por_funcionario' | 'vencimentos'

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + 'T12:00:00')
  const now = new Date()
  now.setHours(12, 0, 0, 0)
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function statusIcon(daysLeft: number) {
  if (daysLeft < 0) return { icon: <XCircle className="w-4 h-4 text-red-500" />, label: 'Vencido', cls: 'bg-red-100 text-red-700' }
  if (daysLeft <= 60) return { icon: <Clock className="w-4 h-4 text-amber-500" />, label: 'Vencendo', cls: 'bg-amber-100 text-amber-700' }
  return { icon: <CheckCircle2 className="w-4 h-4 text-green-500" />, label: 'OK', cls: 'bg-green-100 text-green-700' }
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}

export default function TreinamentosPage() {
  const supabase = createClient()
  const toast = useToast()
  const [tab, setTab] = useState<TabType>('por_funcionario')
  const [treinamentos, setTreinamentos] = useState<TreinamentoFuncionario[]>([])
  const [tipos, setTipos] = useState<TreinamentoTipo[]>([])
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [showForm, setShowForm] = useState(false)
  const [selectedFuncs, setSelectedFuncs] = useState<Set<string>>(new Set())
  const [formTipoId, setFormTipoId] = useState('')
  const [formDataRealizacao, setFormDataRealizacao] = useState('')
  const [formDataVencimento, setFormDataVencimento] = useState('')
  const [formCertificado, setFormCertificado] = useState('')
  const [saving, setSaving] = useState(false)
  const [funcSearchTerm, setFuncSearchTerm] = useState('')

  // Renew modal state
  const [renewTarget, setRenewTarget] = useState<TreinamentoFuncionario | null>(null)
  const [renewForm, setRenewForm] = useState({ data_realizacao: '', data_vencimento: '', instituicao: '', certificado: '' })
  const [renewFile, setRenewFile] = useState<File | null>(null)
  const [renewSaving, setRenewSaving] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const [treinRes, tiposRes, funcRes] = await Promise.all([
      supabase
        .from('treinamentos_funcionarios')
        .select('*, funcionarios(id, nome, cargo), treinamentos_tipos(id, nome, nr, validade_meses)')
        .order('data_vencimento', { ascending: true }),
      supabase.from('treinamentos_tipos').select('*').order('nome'),
      supabase.from('funcionarios').select('id, nome, cargo').in('status', ['alocado', 'disponivel', 'pendente']).order('nome'),
    ])
    setTreinamentos(treinRes.data ?? [])
    setTipos(tiposRes.data ?? [])
    setFuncionarios(funcRes.data ?? [])
    setLoading(false)
  }

  // Group by funcionario
  const byFuncionario = treinamentos.reduce<Record<string, { func: { id: string; nome: string; cargo: string }; items: TreinamentoFuncionario[] }>>((acc, t) => {
    const funcId = t.funcionario_id
    if (!acc[funcId]) {
      acc[funcId] = {
        func: t.funcionarios ?? { id: funcId, nome: 'Desconhecido', cargo: '' },
        items: [],
      }
    }
    acc[funcId].items.push(t)
    return acc
  }, {})

  // Vencimentos list sorted by urgency
  const vencimentosList = [...treinamentos].map(t => ({
    ...t,
    daysLeft: daysUntil(t.data_vencimento),
  })).sort((a, b) => a.daysLeft - b.daysLeft)

  const totalVencidos = vencimentosList.filter(v => v.daysLeft < 0).length
  const totalVencendo30 = vencimentosList.filter(v => v.daysLeft >= 0 && v.daysLeft <= 30).length
  const totalVencendo60 = vencimentosList.filter(v => v.daysLeft > 30 && v.daysLeft <= 60).length

  function toggleExpand(funcId: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(funcId)) next.delete(funcId)
      else next.add(funcId)
      return next
    })
  }

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
    if (selectedFuncs.size === 0) {
      toast.warning('Selecione pelo menos um funcionario.')
      return
    }
    if (!formTipoId) {
      toast.warning('Selecione o tipo de treinamento.')
      return
    }
    if (!formDataRealizacao || !formDataVencimento) {
      toast.warning('Preencha as datas.')
      return
    }

    setSaving(true)
    const records = Array.from(selectedFuncs).map(funcId => ({
      funcionario_id: funcId,
      tipo_id: formTipoId,
      data_realizacao: formDataRealizacao,
      data_vencimento: formDataVencimento,
      numero_certificado: formCertificado || null,
    }))

    await supabase.from('treinamentos_funcionarios').insert(records)

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

  function openRenew(t: TreinamentoFuncionario) {
    const hoje = new Date().toISOString().split('T')[0]
    const validadeMeses = t.treinamentos_tipos?.validade_meses ?? 12
    const venc = new Date(hoje + 'T12:00:00')
    venc.setMonth(venc.getMonth() + validadeMeses)
    setRenewForm({ data_realizacao: hoje, data_vencimento: venc.toISOString().split('T')[0], instituicao: '', certificado: '' })
    setRenewFile(null)
    setRenewTarget(t)
  }

  async function handleRenew() {
    if (!renewTarget || !renewForm.data_realizacao || !renewForm.data_vencimento) return
    setRenewSaving(true)

    let arquivo_url = null
    let arquivo_nome = null
    if (renewFile) {
      const ext = renewFile.name.split('.').pop()
      const path = `treinamentos/${renewTarget.funcionario_id}/${renewTarget.tipo_id}_${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('softmonte').upload(path, renewFile)
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('softmonte').getPublicUrl(path)
        arquivo_url = urlData.publicUrl
        arquivo_nome = renewFile.name
      }
    }

    // Mark old record as replaced
    await supabase.from('treinamentos_funcionarios')
      .update({ status: 'substituido' })
      .eq('id', renewTarget.id)

    await supabase.from('treinamentos_funcionarios').insert({
      funcionario_id: renewTarget.funcionario_id,
      tipo_id: renewTarget.tipo_id,
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

  const filteredFuncs = funcionarios.filter(f =>
    f.nome.toLowerCase().includes(funcSearchTerm.toLowerCase()) ||
    f.cargo.toLowerCase().includes(funcSearchTerm.toLowerCase())
  )

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <BackButton fallback="/rh" />
          <div>
            <h1 className="text-xl font-bold font-display text-brand">Treinamentos &amp; NRs</h1>
            <p className="text-sm text-gray-500 mt-0.5">{treinamentos.length} registro(s)</p>
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <GraduationCap className="w-4 h-4 text-brand" />
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Total Registros</p>
          </div>
          <p className="text-2xl font-bold text-gray-800">{treinamentos.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="w-4 h-4 text-red-500" />
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Vencidos</p>
          </div>
          <p className="text-2xl font-bold text-red-600">{totalVencidos}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Vencendo 30d</p>
          </div>
          <p className="text-2xl font-bold text-amber-600">{totalVencendo30}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-yellow-500" />
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Vencendo 60d</p>
          </div>
          <p className="text-2xl font-bold text-yellow-600">{totalVencendo60}</p>
        </div>
      </div>

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
                    {t.nr ? `${t.nr} - ` : ''}{t.nome}
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
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Numero Certificado</label>
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
              placeholder="Buscar funcionario..."
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 mb-2"
            />
            <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100">
              {filteredFuncs.map(f => (
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
              {filteredFuncs.length === 0 && (
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

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        <button
          onClick={() => setTab('por_funcionario')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
            tab === 'por_funcionario' ? 'bg-white text-brand shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users className="w-4 h-4" /> Por Funcionario
        </button>
        <button
          onClick={() => setTab('vencimentos')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
            tab === 'vencimentos' ? 'bg-white text-brand shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <ShieldAlert className="w-4 h-4" /> Vencimentos
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Carregando...</div>
      ) : tab === 'por_funcionario' ? (
        /* Por Funcionario - Accordion */
        <div className="space-y-2">
          {Object.entries(byFuncionario).length === 0 ? (
            <EmptyState
              titulo="Nenhum treinamento registrado"
              descricao="Registre treinamentos NR para acompanhar vencimentos e conformidade."
              icone={<GraduationCap className="w-12 h-12" />}
              acao={{ label: 'Registrar Treinamento', href: '#' }}
            />
          ) : Object.entries(byFuncionario).map(([funcId, { func, items }]) => {
            const isOpen = expanded.has(funcId)
            const vencidos = items.filter(i => daysUntil(i.data_vencimento) < 0).length
            const vencendo = items.filter(i => {
              const d = daysUntil(i.data_vencimento)
              return d >= 0 && d <= 60
            }).length

            return (
              <div key={funcId} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <button
                  onClick={() => toggleExpand(funcId)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                    <div className="text-left">
                      <p className="font-semibold text-gray-900">{func.nome}</p>
                      <p className="text-xs text-gray-500">{func.cargo} &middot; {items.length} treinamento(s)</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {vencidos > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">{vencidos} vencido(s)</span>
                    )}
                    {vencendo > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">{vencendo} vencendo</span>
                    )}
                    {vencidos === 0 && vencendo === 0 && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Em dia</span>
                    )}
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t border-gray-100">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          {['Treinamento', 'NR', 'Realizacao', 'Vencimento', 'Certificado', 'Status', ''].map(h => (
                            <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {items.map(item => {
                          const days = daysUntil(item.data_vencimento)
                          const st = statusIcon(days)
                          return (
                            <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/80">
                              <td className="px-4 py-2 font-medium text-gray-900">{item.treinamentos_tipos?.nome ?? '—'}</td>
                              <td className="px-4 py-2">
                                {item.treinamentos_tipos?.nr ? (
                                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{item.treinamentos_tipos.nr}</span>
                                ) : '—'}
                              </td>
                              <td className="px-4 py-2 text-gray-600 text-xs">{formatDate(item.data_realizacao)}</td>
                              <td className="px-4 py-2 text-gray-600 text-xs">{formatDate(item.data_vencimento)}</td>
                              <td className="px-4 py-2 text-gray-500 text-xs">{item.numero_certificado ?? '—'}</td>
                              <td className="px-4 py-2">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>
                                  {st.icon} {st.label} {days >= 0 ? `(${days}d)` : `(${Math.abs(days)}d atras)`}
                                </span>
                              </td>
                              <td className="px-4 py-2">
                                {days <= 60 && (
                                  <button onClick={() => openRenew(item)} className="text-xs text-brand font-semibold hover:underline">Renovar</button>
                                )}
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
        /* Vencimentos - flat list */
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Funcionario', 'Treinamento', 'NR', 'Vencimento', 'Dias', 'Urgencia', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vencimentosList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400">Nenhum registro encontrado.</td>
                </tr>
              ) : vencimentosList.map(item => {
                const st = statusIcon(item.daysLeft)
                return (
                  <tr key={item.id} className={`border-b border-gray-50 hover:bg-gray-50/80 ${item.daysLeft < 0 ? 'bg-red-50' : item.daysLeft <= 30 ? 'bg-amber-50/50' : ''}`}>
                    <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">{item.funcionarios?.nome ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-800">{item.treinamentos_tipos?.nome ?? '—'}</td>
                    <td className="px-4 py-3">
                      {item.treinamentos_tipos?.nr ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{item.treinamentos_tipos.nr}</span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{formatDate(item.data_vencimento)}</td>
                    <td className={`px-4 py-3 font-bold ${item.daysLeft < 0 ? 'text-red-600' : item.daysLeft <= 30 ? 'text-amber-600' : item.daysLeft <= 60 ? 'text-yellow-600' : 'text-green-600'}`}>
                      {item.daysLeft < 0 ? `${Math.abs(item.daysLeft)}d atrasado` : `${item.daysLeft}d`}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>
                        {st.icon} {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {item.daysLeft <= 60 && (
                        <button onClick={() => openRenew(item)} className="text-xs text-brand font-semibold hover:underline">Renovar</button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {/* Renew Modal */}
      {renewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setRenewTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-sm font-bold font-display text-brand mb-1">
              Renovar {renewTarget.treinamentos_tipos?.nome ?? 'Treinamento'}
            </h2>
            <p className="text-xs text-gray-500 mb-4">{renewTarget.funcionarios?.nome}</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Data de realizacao</label>
                <input type="date" value={renewForm.data_realizacao}
                  onChange={e => {
                    const v = e.target.value
                    const venc = new Date(v + 'T12:00:00')
                    venc.setMonth(venc.getMonth() + (renewTarget.treinamentos_tipos?.validade_meses ?? 12))
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
                <label className="block text-xs font-semibold text-gray-600 mb-1">Numero do certificado</label>
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
                {renewSaving ? 'Salvando...' : 'Salvar renovacao'}
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
