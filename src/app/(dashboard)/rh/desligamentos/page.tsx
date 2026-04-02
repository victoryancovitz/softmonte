'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import BackButton from '@/components/BackButton'
import {
  UserMinus, CheckCircle2, Clock, ChevronDown, ChevronRight,
  Plus, CalendarCheck, MessageSquare, AlertTriangle, FileText,
} from 'lucide-react'

interface DesligamentoWorkflow {
  id: string
  funcionario_id: string
  obra_id: string | null
  tipo_desligamento: string
  data_prevista_saida: string
  status: string
  saldo_banco_horas: number | null
  dias_ferias_proporcionais: number | null
  aviso_previo: boolean
  aviso_previo_data: string | null
  aviso_previo_obs: string | null
  devolucao_epi: boolean
  devolucao_epi_data: string | null
  devolucao_epi_obs: string | null
  devolucao_ferramentas: boolean
  devolucao_ferramentas_data: string | null
  devolucao_ferramentas_obs: string | null
  exame_demissional: boolean
  exame_demissional_data: string | null
  exame_demissional_obs: string | null
  baixa_ctps: boolean
  baixa_ctps_data: string | null
  baixa_ctps_obs: string | null
  calculo_rescisao: boolean
  calculo_rescisao_data: string | null
  calculo_rescisao_obs: string | null
  homologacao: boolean
  homologacao_data: string | null
  homologacao_obs: string | null
  esocial: boolean
  esocial_data: string | null
  esocial_obs: string | null
  acerto_banco_horas: boolean
  acerto_banco_horas_data: string | null
  acerto_banco_horas_obs: string | null
  funcionarios: { nome: string; cargo: string } | null
  obras: { nome: string } | null
}

interface Funcionario {
  id: string
  nome: string
  cargo: string
  status: string
}

const CHECKLIST_ITEMS = [
  { key: 'aviso_previo', label: 'Aviso Previo' },
  { key: 'devolucao_epi', label: 'Devolucao de EPI' },
  { key: 'devolucao_ferramentas', label: 'Devolucao de Ferramentas' },
  { key: 'exame_demissional', label: 'Exame Demissional' },
  { key: 'baixa_ctps', label: 'Baixa CTPS' },
  { key: 'calculo_rescisao', label: 'Calculo Rescisao' },
  { key: 'homologacao', label: 'Homologacao' },
  { key: 'esocial', label: 'eSocial' },
  { key: 'acerto_banco_horas', label: 'Acerto Banco de Horas' },
] as const

const TIPO_LABELS: Record<string, { label: string; cls: string }> = {
  sem_justa_causa: { label: 'Sem Justa Causa', cls: 'bg-red-100 text-red-700' },
  justa_causa: { label: 'Justa Causa', cls: 'bg-red-200 text-red-800' },
  pedido_demissao: { label: 'Pedido Demissao', cls: 'bg-amber-100 text-amber-700' },
  termino_contrato: { label: 'Termino Contrato', cls: 'bg-blue-100 text-blue-700' },
  acordo: { label: 'Acordo', cls: 'bg-purple-100 text-purple-700' },
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}

export default function DesligamentosPage() {
  const supabase = createClient()
  const [desligamentos, setDesligamentos] = useState<DesligamentoWorkflow[]>([])
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [showNewForm, setShowNewForm] = useState(false)
  const [newFuncId, setNewFuncId] = useState('')
  const [newTipo, setNewTipo] = useState('')
  const [newDataSaida, setNewDataSaida] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const [deslRes, funcRes] = await Promise.all([
      supabase
        .from('desligamentos_workflow')
        .select('*, funcionarios(nome, cargo), obras(nome)')
        .order('data_prevista_saida', { ascending: true }),
      supabase
        .from('funcionarios')
        .select('id, nome, cargo, status')
        .eq('status', 'alocado')
        .order('nome'),
    ])
    setDesligamentos(deslRes.data ?? [])
    setFuncionarios(funcRes.data ?? [])
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

  function getProgress(desl: DesligamentoWorkflow): number {
    const total = CHECKLIST_ITEMS.length
    const done = CHECKLIST_ITEMS.filter(item => (desl as any)[item.key] === true).length
    return Math.round((done / total) * 100)
  }

  function allChecked(desl: DesligamentoWorkflow): boolean {
    return CHECKLIST_ITEMS.every(item => (desl as any)[item.key] === true)
  }

  async function toggleCheckItem(deslId: string, key: string, currentValue: boolean) {
    const updates: Record<string, any> = {
      [key]: !currentValue,
    }
    if (!currentValue) {
      updates[`${key}_data`] = new Date().toISOString().split('T')[0]
    } else {
      updates[`${key}_data`] = null
    }

    await supabase.from('desligamentos_workflow').update(updates).eq('id', deslId)
    loadData()
  }

  async function updateObs(deslId: string, key: string, value: string) {
    await supabase.from('desligamentos_workflow').update({ [`${key}_obs`]: value || null }).eq('id', deslId)
  }

  async function updateDateField(deslId: string, key: string, value: string) {
    await supabase.from('desligamentos_workflow').update({ [`${key}_data`]: value || null }).eq('id', deslId)
  }

  async function concluirDesligamento(desl: DesligamentoWorkflow) {
    const confirmed = window.confirm('Concluir este desligamento? O funcionario sera marcado como inativo e suas alocacoes serao encerradas.')
    if (!confirmed) return

    // Update workflow status
    await supabase.from('desligamentos_workflow').update({ status: 'concluido' }).eq('id', desl.id)

    // Update funcionario status to inativo
    await supabase.from('funcionarios').update({ status: 'inativo' }).eq('id', desl.funcionario_id)

    // Encerrar alocacoes ativas
    await supabase
      .from('alocacoes')
      .update({ ativo: false, data_fim: new Date().toISOString().split('T')[0] })
      .eq('funcionario_id', desl.funcionario_id)
      .eq('ativo', true)

    loadData()
  }

  async function handleNovoDesligamento() {
    if (!newFuncId || !newTipo || !newDataSaida) {
      alert('Preencha todos os campos.')
      return
    }
    setSaving(true)

    // Get funcionario's current obra from active alocacao
    const { data: alocacao } = await supabase
      .from('alocacoes')
      .select('obra_id')
      .eq('funcionario_id', newFuncId)
      .eq('ativo', true)
      .limit(1)
      .single()

    // Get banco de horas saldo
    const { data: bancoHoras } = await supabase
      .from('banco_horas')
      .select('saldo_acumulado')
      .eq('funcionario_id', newFuncId)
      .order('ano', { ascending: false })
      .order('mes', { ascending: false })
      .limit(1)
      .single()

    const insertData: Record<string, any> = {
      funcionario_id: newFuncId,
      obra_id: alocacao?.obra_id ?? null,
      tipo_desligamento: newTipo,
      data_prevista_saida: newDataSaida,
      status: 'em_andamento',
      saldo_banco_horas: bancoHoras?.saldo_acumulado ?? 0,
      dias_ferias_proporcionais: null,
    }
    CHECKLIST_ITEMS.forEach(item => {
      insertData[item.key] = false
      insertData[`${item.key}_data`] = null
      insertData[`${item.key}_obs`] = null
    })

    await supabase.from('desligamentos_workflow').insert(insertData)

    setShowNewForm(false)
    setNewFuncId('')
    setNewTipo('')
    setNewDataSaida('')
    setSaving(false)
    loadData()
  }

  const emAndamento = desligamentos.filter(d => d.status === 'em_andamento')
  const concluidos = desligamentos.filter(d => d.status === 'concluido')

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <BackButton fallback="/rh" />
          <div>
            <h1 className="text-xl font-bold font-display text-brand">Desligamentos</h1>
            <p className="text-sm text-gray-500 mt-0.5">{emAndamento.length} desligamento(s) em andamento</p>
          </div>
        </div>
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          className="px-4 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Novo Desligamento
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
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Concluidos</p>
          </div>
          <p className="text-2xl font-bold text-green-600">{concluidos.length}</p>
        </div>
      </div>

      {/* New desligamento form */}
      {showNewForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
          <h2 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
            <UserMinus className="w-4 h-4" /> Novo Desligamento
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
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Tipo Desligamento</label>
              <select
                value={newTipo}
                onChange={e => setNewTipo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
              >
                <option value="">Selecione...</option>
                <option value="sem_justa_causa">Sem Justa Causa</option>
                <option value="justa_causa">Justa Causa</option>
                <option value="pedido_demissao">Pedido de Demissao</option>
                <option value="termino_contrato">Termino de Contrato</option>
                <option value="acordo">Acordo</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Data Prevista Saida</label>
              <input
                type="date"
                value={newDataSaida}
                onChange={e => setNewDataSaida(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleNovoDesligamento}
              disabled={saving}
              className="px-4 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Criar Desligamento'}
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
          Nenhum desligamento em andamento.
        </div>
      ) : (
        <div className="space-y-3">
          {emAndamento.map(desl => {
            const isOpen = expanded.has(desl.id)
            const progress = getProgress(desl)
            const done = CHECKLIST_ITEMS.filter(item => (desl as any)[item.key] === true).length
            const canComplete = allChecked(desl)
            const tipoInfo = TIPO_LABELS[desl.tipo_desligamento] ?? { label: desl.tipo_desligamento, cls: 'bg-gray-100 text-gray-600' }

            return (
              <div key={desl.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Card header */}
                <button
                  onClick={() => toggleExpand(desl.id)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900">{desl.funcionarios?.nome ?? '—'}</p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tipoInfo.cls}`}>{tipoInfo.label}</span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {desl.funcionarios?.cargo ?? ''} &middot; {desl.obras?.nome ?? '—'} &middot; Saida: {formatDate(desl.data_prevista_saida)}
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
                    {/* Info badges */}
                    <div className="flex flex-wrap gap-3 mb-4">
                      <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
                        <Clock className="w-4 h-4 text-blue-500" />
                        <div>
                          <p className="text-xs text-blue-600 font-semibold">Saldo Banco de Horas</p>
                          <p className="text-sm font-bold text-blue-800">
                            {desl.saldo_banco_horas != null ? `${desl.saldo_banco_horas >= 0 ? '+' : ''}${desl.saldo_banco_horas}h` : 'N/A'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                        <FileText className="w-4 h-4 text-green-500" />
                        <div>
                          <p className="text-xs text-green-600 font-semibold">Ferias Proporcionais</p>
                          <p className="text-sm font-bold text-green-800">
                            {desl.dias_ferias_proporcionais != null ? `${desl.dias_ferias_proporcionais} dia(s)` : 'N/A'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {CHECKLIST_ITEMS.map(item => {
                        const checked = (desl as any)[item.key] === true
                        const dateVal = (desl as any)[`${item.key}_data`] ?? ''
                        const obsVal = (desl as any)[`${item.key}_obs`] ?? ''

                        return (
                          <div key={item.key} className={`flex flex-col sm:flex-row sm:items-start gap-3 p-3 rounded-xl border ${checked ? 'bg-green-50/50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                            <label className="flex items-center gap-3 min-w-[220px] cursor-pointer">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleCheckItem(desl.id, item.key, checked)}
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
                                  onChange={e => updateDateField(desl.id, item.key, e.target.value)}
                                  className="px-2 py-1 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand/30 w-36"
                                />
                              </div>
                              <div className="flex items-center gap-2 flex-1">
                                <MessageSquare className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                <textarea
                                  defaultValue={obsVal}
                                  onBlur={e => updateObs(desl.id, item.key, e.target.value)}
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
                          onClick={() => concluirDesligamento(desl)}
                          className="px-6 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 flex items-center gap-2"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Concluir Desligamento
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

      {/* Concluidos section */}
      {concluidos.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Concluidos</h2>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Funcionario', 'Cargo', 'Tipo', 'Data Saida', 'Status'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {concluidos.map(desl => {
                  const tipoInfo = TIPO_LABELS[desl.tipo_desligamento] ?? { label: desl.tipo_desligamento, cls: 'bg-gray-100 text-gray-600' }
                  return (
                    <tr key={desl.id} className="border-b border-gray-50 hover:bg-gray-50/80">
                      <td className="px-4 py-3 font-semibold text-gray-900">{desl.funcionarios?.nome ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{desl.funcionarios?.cargo ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tipoInfo.cls}`}>{tipoInfo.label}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(desl.data_prevista_saida)}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Concluido</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
