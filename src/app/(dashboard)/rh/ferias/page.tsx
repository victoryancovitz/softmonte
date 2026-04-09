'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import BackButton from '@/components/BackButton'
import SearchInput from '@/components/SearchInput'
import { useToast } from '@/components/Toast'
import { Palmtree, AlertCircle, CalendarCheck, Clock, Users, Check, X } from 'lucide-react'

interface Funcionario {
  id: string
  nome: string
  cargo: string
  admissao: string
  status: string
}

interface Ferias {
  id: string
  funcionario_id: string
  data_inicio_gozo: string | null
  data_fim_gozo: string | null
  dias_gozados: number
  dias_vendidos: number
  status: string
  funcionarios: { nome: string; cargo: string; admissao: string } | null
}

type TabFilter = 'todos' | 'vencidas' | 'programadas'

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pendente: { label: 'Pendente', cls: 'bg-gray-100 text-gray-600' },
  programada: { label: 'Programada', cls: 'bg-blue-100 text-blue-700' },
  aprovada: { label: 'Aprovada', cls: 'bg-green-100 text-green-700' },
  realizada: { label: 'Realizada', cls: 'bg-emerald-100 text-emerald-700' },
  vencida: { label: 'Vencida', cls: 'bg-red-100 text-red-700' },
}

function diffMonths(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
}

function diffYears(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime()
  return Math.floor(ms / (365.25 * 24 * 60 * 60 * 1000))
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}

export default function FeriasPage() {
  const supabase = createClient()
  const toast = useToast()
  const [ferias, setFerias] = useState<Ferias[]>([])
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [tab, setTab] = useState<TabFilter>('todos')
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState<string | null>(null)
  const [formData, setFormData] = useState({ data_inicio_gozo: '', data_fim_gozo: '', dias_vendidos: 0 })
  const [saving, setSaving] = useState(false)
  const [busca, setBusca] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const [feriasRes, funcRes] = await Promise.all([
      supabase
        .from('ferias')
        .select('*, funcionarios(nome, cargo, admissao)')
        .order('created_at', { ascending: false }),
      supabase
        .from('funcionarios')
        .select('id, nome, cargo, admissao, status')
        .in('status', ['alocado', 'disponivel', 'pendente'])
        .order('nome'),
    ])
    setFerias(feriasRes.data ?? [])
    setFuncionarios(funcRes.data ?? [])
    setLoading(false)
  }

  const now = new Date()

  // Build consolidated view: all funcionarios + their ferias status
  const consolidated = funcionarios.map(func => {
    const funcFerias = ferias.filter(f => f.funcionario_id === func.id)
    const totalDiasGozados = funcFerias.reduce((s, f) => s + (f.dias_gozados || 0), 0)
    const totalDiasVendidos = funcFerias.reduce((s, f) => s + (f.dias_vendidos || 0), 0)
    const admDate = new Date(func.admissao + 'T12:00:00')
    const anosEmpresa = diffYears(admDate, now)
    const mesesDesdeAdmissao = diffMonths(admDate, now)
    const diasDireito = Math.max(0, Math.floor(mesesDesdeAdmissao / 12) * 30)
    const diasRestantes = diasDireito - totalDiasGozados - totalDiasVendidos

    // Check if vencida: > 24 months without ferias
    const ultimaFerias = funcFerias.filter(f => f.status === 'realizada').sort((a, b) =>
      (b.data_fim_gozo ?? '').localeCompare(a.data_fim_gozo ?? '')
    )[0]
    const referenceDate = ultimaFerias?.data_fim_gozo ? new Date(ultimaFerias.data_fim_gozo + 'T12:00:00') : admDate
    const mesesSemFerias = diffMonths(referenceDate, now)
    const isVencida = mesesSemFerias >= 24

    // Current ferias status
    const activeFeria = funcFerias.find(f => ['programada', 'aprovada'].includes(f.status))

    return {
      ...func,
      admDate,
      anosEmpresa,
      diasDireito,
      totalDiasGozados,
      diasRestantes,
      isVencida,
      mesesSemFerias,
      activeFeria,
      ferias: funcFerias,
      status: isVencida ? 'vencida' : activeFeria ? activeFeria.status : diasRestantes > 0 ? 'pendente' : 'em_dia',
    }
  })

  const filtered = consolidated.filter(c => {
    if (tab === 'vencidas') return c.isVencida
    if (tab === 'programadas') return c.activeFeria != null
    return true
  }).filter(c => !busca || c.nome?.toLowerCase().includes(busca.toLowerCase()))

  const totalVencidas = consolidated.filter(c => c.isVencida).length
  const totalProgramadas = consolidated.filter(c => c.activeFeria != null).length

  async function handleProgramar(funcId: string) {
    if (!formData.data_inicio_gozo || !formData.data_fim_gozo) {
      toast.warning('Preencha as datas de inicio e fim.')
      return
    }
    setSaving(true)
    const inicio = new Date(formData.data_inicio_gozo + 'T12:00:00')
    const fim = new Date(formData.data_fim_gozo + 'T12:00:00')
    const diasGozados = Math.round((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)) + 1 - (formData.dias_vendidos || 0)

    await supabase.from('ferias').insert({
      funcionario_id: funcId,
      data_inicio_gozo: formData.data_inicio_gozo,
      data_fim_gozo: formData.data_fim_gozo,
      dias_gozados: diasGozados,
      dias_vendidos: formData.dias_vendidos || 0,
      status: 'programada',
    })

    setFormOpen(null)
    setFormData({ data_inicio_gozo: '', data_fim_gozo: '', dias_vendidos: 0 })
    setSaving(false)
    loadData()
  }

  async function updateFeriasStatus(feriasId: string, newStatus: string) {
    await supabase.from('ferias').update({ status: newStatus }).eq('id', feriasId)
    loadData()
  }

  const statusActions: Record<string, { next: string; label: string }> = {
    programada: { next: 'aprovada', label: 'Aprovar' },
    aprovada: { next: 'realizada', label: 'Marcar Realizada' },
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <BackButton fallback="/rh" />
        <div>
          <h1 className="text-xl font-bold font-display text-brand">Gestão de Férias</h1>
          <p className="text-sm text-gray-500 mt-0.5">{consolidated.length} funcionário(s)</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-brand" />
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Total</p>
          </div>
          <p className="text-2xl font-bold text-gray-800">{consolidated.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Vencidas</p>
          </div>
          <p className="text-2xl font-bold text-red-600">{totalVencidas}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <CalendarCheck className="w-4 h-4 text-blue-500" />
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Programadas</p>
          </div>
          <p className="text-2xl font-bold text-blue-600">{totalProgramadas}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Palmtree className="w-4 h-4 text-green-500" />
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Em dia</p>
          </div>
          <p className="text-2xl font-bold text-green-600">{consolidated.length - totalVencidas}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        {([
          { key: 'todos', label: 'Todos' },
          { key: 'vencidas', label: `Férias Vencidas (${totalVencidas})` },
          { key: 'programadas', label: `Programadas (${totalProgramadas})` },
        ] as { key: TabFilter; label: string }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === t.key ? 'bg-white text-brand shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4">
        <SearchInput value={busca} onChange={setBusca} placeholder="Buscar funcionário..." />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {['Nome', 'Admissão', 'Anos Empresa', 'Dias Direito', 'Dias Gozados', 'Dias Restantes', 'Status', 'Ações'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-400">Carregando...</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-400">Nenhum registro encontrado.</td>
              </tr>
            ) : filtered.map(row => (
              <tr key={row.id} className={`border-b border-gray-50 hover:bg-gray-50/80 ${row.isVencida ? 'bg-red-50' : ''}`}>
                <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">{row.nome}</td>
                <td className="px-4 py-3 text-gray-600 text-xs">{formatDate(row.admissao)}</td>
                <td className="px-4 py-3 text-gray-600">{row.anosEmpresa} ano(s)</td>
                <td className="px-4 py-3 text-gray-800 font-medium">{row.diasDireito}</td>
                <td className="px-4 py-3 text-gray-600">{row.totalDiasGozados}</td>
                <td className={`px-4 py-3 font-semibold ${row.diasRestantes > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                  {row.diasRestantes}
                </td>
                <td className="px-4 py-3">
                  {row.isVencida ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                      <AlertCircle className="w-3 h-3" /> Vencida
                    </span>
                  ) : row.activeFeria ? (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[row.activeFeria.status]?.cls ?? 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_BADGE[row.activeFeria.status]?.label ?? row.activeFeria.status}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                      Pendente
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {row.activeFeria && statusActions[row.activeFeria.status] && (
                      <button
                        onClick={() => updateFeriasStatus(row.activeFeria!.id, statusActions[row.activeFeria!.status].next)}
                        className="px-3 py-1 text-xs font-semibold rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                      >
                        {statusActions[row.activeFeria.status].label}
                      </button>
                    )}
                    {!row.activeFeria && (
                      <button
                        onClick={() => {
                          setFormOpen(formOpen === row.id ? null : row.id)
                          setFormData({ data_inicio_gozo: '', data_fim_gozo: '', dias_vendidos: 0 })
                        }}
                        className="px-3 py-1 text-xs font-semibold rounded-lg bg-brand/10 text-brand hover:bg-brand/20 transition-colors"
                      >
                        Programar
                      </button>
                    )}
                  </div>
                  {/* Inline form */}
                  {formOpen === row.id && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 mb-1">Início Gozo</label>
                          <input
                            type="date"
                            value={formData.data_inicio_gozo}
                            onChange={e => setFormData(prev => ({ ...prev, data_inicio_gozo: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 mb-1">Fim Gozo</label>
                          <input
                            type="date"
                            value={formData.data_fim_gozo}
                            onChange={e => setFormData(prev => ({ ...prev, data_fim_gozo: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 mb-1">Dias Vendidos</label>
                          <input
                            type="number"
                            min={0}
                            max={10}
                            value={formData.dias_vendidos}
                            onChange={e => setFormData(prev => ({ ...prev, dias_vendidos: parseInt(e.target.value) || 0 }))}
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleProgramar(row.id)}
                          disabled={saving}
                          className="px-4 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50"
                        >
                          {saving ? 'Salvando...' : 'Confirmar Programação'}
                        </button>
                        <button
                          onClick={() => setFormOpen(null)}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-300"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
