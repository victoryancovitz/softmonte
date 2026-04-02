'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import BackButton from '@/components/BackButton'
import {
  UserPlus, CheckCircle2, Clock, ChevronDown, ChevronRight,
  Plus, Users, CalendarCheck, FileText, MessageSquare,
} from 'lucide-react'

interface AdmissaoWorkflow {
  id: string
  funcionario_id: string
  obra_id: string
  data_prevista: string
  status: string
  documentos_pessoais: boolean
  documentos_pessoais_data: string | null
  documentos_pessoais_obs: string | null
  exame_admissional: boolean
  exame_admissional_data: string | null
  exame_admissional_obs: string | null
  ctps: boolean
  ctps_data: string | null
  ctps_obs: string | null
  contrato_assinado: boolean
  contrato_assinado_data: string | null
  contrato_assinado_obs: string | null
  dados_bancarios: boolean
  dados_bancarios_data: string | null
  dados_bancarios_obs: string | null
  epi_entregue: boolean
  epi_entregue_data: string | null
  epi_entregue_obs: string | null
  treinamentos_nr: boolean
  treinamentos_nr_data: string | null
  treinamentos_nr_obs: string | null
  integracao_sst: boolean
  integracao_sst_data: string | null
  integracao_sst_obs: string | null
  uniforme: boolean
  uniforme_data: string | null
  uniforme_obs: string | null
  esocial: boolean
  esocial_data: string | null
  esocial_obs: string | null
  funcionarios: { nome: string; cargo: string } | null
  obras: { nome: string } | null
}

interface Funcionario {
  id: string
  nome: string
  cargo: string
  status: string
}

interface Obra {
  id: string
  nome: string
}

const CHECKLIST_ITEMS = [
  { key: 'documentos_pessoais', label: 'Documentos Pessoais' },
  { key: 'exame_admissional', label: 'Exame Admissional' },
  { key: 'ctps', label: 'CTPS' },
  { key: 'contrato_assinado', label: 'Contrato Assinado' },
  { key: 'dados_bancarios', label: 'Dados Bancarios' },
  { key: 'epi_entregue', label: 'EPI Entregue' },
  { key: 'treinamentos_nr', label: 'Treinamentos NR' },
  { key: 'integracao_sst', label: 'Integracao SST' },
  { key: 'uniforme', label: 'Uniforme' },
  { key: 'esocial', label: 'eSocial' },
] as const

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}

export default function AdmissoesPage() {
  const supabase = createClient()
  const [admissoes, setAdmissoes] = useState<AdmissaoWorkflow[]>([])
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [obras, setObras] = useState<Obra[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [showNewForm, setShowNewForm] = useState(false)
  const [newFuncId, setNewFuncId] = useState('')
  const [newObraId, setNewObraId] = useState('')
  const [newDataPrevista, setNewDataPrevista] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const [admRes, funcRes, obrasRes] = await Promise.all([
      supabase
        .from('admissoes_workflow')
        .select('*, funcionarios(nome, cargo), obras(nome)')
        .order('data_prevista', { ascending: true }),
      supabase
        .from('funcionarios')
        .select('id, nome, cargo, status')
        .in('status', ['pendente', 'disponivel'])
        .order('nome'),
      supabase.from('obras').select('id, nome').eq('status', 'ativa').order('nome'),
    ])
    setAdmissoes(admRes.data ?? [])
    setFuncionarios(funcRes.data ?? [])
    setObras(obrasRes.data ?? [])
    setLoading(false)
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function getProgress(adm: AdmissaoWorkflow): number {
    const total = CHECKLIST_ITEMS.length
    const done = CHECKLIST_ITEMS.filter(item => (adm as any)[item.key] === true).length
    return Math.round((done / total) * 100)
  }

  function allChecked(adm: AdmissaoWorkflow): boolean {
    return CHECKLIST_ITEMS.every(item => (adm as any)[item.key] === true)
  }

  async function toggleCheckItem(admId: string, key: string, currentValue: boolean) {
    const updates: Record<string, any> = {
      [key]: !currentValue,
    }
    if (!currentValue) {
      updates[`${key}_data`] = new Date().toISOString().split('T')[0]
    } else {
      updates[`${key}_data`] = null
    }

    await supabase.from('admissoes_workflow').update(updates).eq('id', admId)
    loadData()
  }

  async function updateObs(admId: string, key: string, value: string) {
    await supabase.from('admissoes_workflow').update({ [`${key}_obs`]: value || null }).eq('id', admId)
  }

  async function updateDateField(admId: string, key: string, value: string) {
    await supabase.from('admissoes_workflow').update({ [`${key}_data`]: value || null }).eq('id', admId)
  }

  async function concluirAdmissao(admId: string) {
    const confirmed = window.confirm('Concluir esta admissao? O status sera atualizado para concluida.')
    if (!confirmed) return
    await supabase.from('admissoes_workflow').update({ status: 'concluida' }).eq('id', admId)
    loadData()
  }

  async function handleNovaAdmissao() {
    if (!newFuncId || !newObraId || !newDataPrevista) {
      alert('Preencha todos os campos.')
      return
    }
    setSaving(true)

    const insertData: Record<string, any> = {
      funcionario_id: newFuncId,
      obra_id: newObraId,
      data_prevista: newDataPrevista,
      status: 'em_andamento',
    }
    CHECKLIST_ITEMS.forEach(item => {
      insertData[item.key] = false
      insertData[`${item.key}_data`] = null
      insertData[`${item.key}_obs`] = null
    })

    await supabase.from('admissoes_workflow').insert(insertData)

    setShowNewForm(false)
    setNewFuncId('')
    setNewObraId('')
    setNewDataPrevista('')
    setSaving(false)
    loadData()
  }

  const emAndamento = admissoes.filter(a => a.status === 'em_andamento')
  const now = new Date()
  const mesAtual = now.getMonth()
  const anoAtual = now.getFullYear()
  const concluidasMes = admissoes.filter(a => {
    if (a.status !== 'concluida') return false
    const d = new Date(a.data_prevista + 'T12:00:00')
    return d.getMonth() === mesAtual && d.getFullYear() === anoAtual
  }).length

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <BackButton fallback="/rh" />
          <div>
            <h1 className="text-xl font-bold font-display text-brand">Admissoes em Andamento</h1>
            <p className="text-sm text-gray-500 mt-0.5">{emAndamento.length} admissao(oes) ativas</p>
          </div>
        </div>
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          className="px-4 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nova Admissao
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-amber-500" />
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Em Andamento</p>
          </div>
          <p className="text-2xl font-bold text-amber-600">{emAndamento.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Concluidas este Mes</p>
          </div>
          <p className="text-2xl font-bold text-green-600">{concluidasMes}</p>
        </div>
      </div>

      {/* New admission form */}
      {showNewForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
          <h2 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
            <UserPlus className="w-4 h-4" /> Nova Admissao
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Funcionario</label>
              <select
                value={newFuncId}
                onChange={e => setNewFuncId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
              >
                <option value="">Selecione...</option>
                {funcionarios.map(f => (
                  <option key={f.id} value={f.id}>{f.nome} — {f.cargo}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Obra</label>
              <select
                value={newObraId}
                onChange={e => setNewObraId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
              >
                <option value="">Selecione...</option>
                {obras.map(o => (
                  <option key={o.id} value={o.id}>{o.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Data Prevista</label>
              <input
                type="date"
                value={newDataPrevista}
                onChange={e => setNewDataPrevista(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleNovaAdmissao}
              disabled={saving}
              className="px-4 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Criar Admissao'}
            </button>
            <button
              onClick={() => setShowNewForm(false)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-300"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Cards */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Carregando...</div>
      ) : emAndamento.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-gray-400">
          Nenhuma admissao em andamento.
        </div>
      ) : (
        <div className="space-y-3">
          {emAndamento.map(adm => {
            const isOpen = expanded.has(adm.id)
            const progress = getProgress(adm)
            const done = CHECKLIST_ITEMS.filter(item => (adm as any)[item.key] === true).length
            const canComplete = allChecked(adm)

            return (
              <div key={adm.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Card header */}
                <button
                  onClick={() => toggleExpand(adm.id)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                    <div className="text-left">
                      <p className="font-semibold text-gray-900">{adm.funcionarios?.nome ?? '—'}</p>
                      <p className="text-xs text-gray-500">
                        {adm.funcionarios?.cargo ?? ''} &middot; {adm.obras?.nome ?? '—'} &middot; Prevista: {formatDate(adm.data_prevista)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-gray-500">{done}/{CHECKLIST_ITEMS.length}</span>
                    <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${progress === 100 ? 'bg-green-500' : progress >= 50 ? 'bg-amber-400' : 'bg-brand'}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-gray-600">{progress}%</span>
                  </div>
                </button>

                {/* Expanded checklist */}
                {isOpen && (
                  <div className="border-t border-gray-100 p-5">
                    <div className="space-y-3">
                      {CHECKLIST_ITEMS.map(item => {
                        const checked = (adm as any)[item.key] === true
                        const dateVal = (adm as any)[`${item.key}_data`] ?? ''
                        const obsVal = (adm as any)[`${item.key}_obs`] ?? ''

                        return (
                          <div key={item.key} className={`flex flex-col sm:flex-row sm:items-start gap-3 p-3 rounded-xl border ${checked ? 'bg-green-50/50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                            <label className="flex items-center gap-3 min-w-[220px] cursor-pointer">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleCheckItem(adm.id, item.key, checked)}
                                className="rounded border-gray-300 text-brand focus:ring-brand/30 w-5 h-5"
                              />
                              <span className={`text-sm font-medium ${checked ? 'text-green-700 line-through' : 'text-gray-800'}`}>
                                {item.label}
                              </span>
                            </label>
                            <div className="flex-1 flex flex-col sm:flex-row gap-2">
                              <div className="flex items-center gap-2">
                                <CalendarCheck className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                <input
                                  type="date"
                                  value={dateVal}
                                  onChange={e => updateDateField(adm.id, item.key, e.target.value)}
                                  className="px-2 py-1 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand/30 w-36"
                                />
                              </div>
                              <div className="flex items-center gap-2 flex-1">
                                <MessageSquare className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                <textarea
                                  defaultValue={obsVal}
                                  onBlur={e => updateObs(adm.id, item.key, e.target.value)}
                                  placeholder="Observacao..."
                                  rows={1}
                                  className="w-full px-2 py-1 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand/30 resize-none"
                                />
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {canComplete && (
                      <div className="mt-4 flex justify-end">
                        <button
                          onClick={() => concluirAdmissao(adm.id)}
                          className="px-6 py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 flex items-center gap-2"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Concluir Admissao
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Concluidas section */}
      {admissoes.filter(a => a.status === 'concluida').length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Concluidas</h2>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Funcionario', 'Cargo', 'Obra', 'Data Prevista', 'Status'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {admissoes.filter(a => a.status === 'concluida').map(adm => (
                  <tr key={adm.id} className="border-b border-gray-50 hover:bg-gray-50/80">
                    <td className="px-4 py-3 font-semibold text-gray-900">{adm.funcionarios?.nome ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{adm.funcionarios?.cargo ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{adm.obras?.nome ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(adm.data_prevista)}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Concluida</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
