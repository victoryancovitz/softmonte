'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import BackButton from '@/components/BackButton'
import SearchInput from '@/components/SearchInput'
import { useToast } from '@/components/Toast'
import EmptyState from '@/components/ui/EmptyState'
import {
  UserPlus, CheckCircle2, Clock, ChevronDown, ChevronRight,
  Plus, CalendarCheck, MessageSquare,
} from 'lucide-react'

const ETAPAS = [
  { key: 'etapa_docs_pessoais', label: 'Documentos Pessoais' },
  { key: 'etapa_exame_admissional', label: 'Exame Admissional' },
  { key: 'etapa_ctps', label: 'CTPS' },
  { key: 'etapa_contrato_assinado', label: 'Contrato Assinado' },
  { key: 'etapa_dados_bancarios', label: 'Dados Bancários' },
  { key: 'etapa_epi_entregue', label: 'EPI Entregue' },
  { key: 'etapa_nr_obrigatorias', label: 'Treinamentos NR' },
  { key: 'etapa_integracao', label: 'Integração SST' },
  { key: 'etapa_uniforme', label: 'Uniforme' },
  { key: 'etapa_esocial', label: 'eSocial' },
] as const

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}

function getProgress(adm: any): { done: number; total: number; pct: number; nextPending: string | null } {
  const total = ETAPAS.length
  let done = 0
  let nextPending: string | null = null
  for (const etapa of ETAPAS) {
    const val = adm[etapa.key]
    if (val?.ok === true) {
      done++
    } else if (!nextPending) {
      nextPending = etapa.label
    }
  }
  return { done, total, pct: Math.round((done / total) * 100), nextPending }
}

export default function AdmissoesPage() {
  const supabase = createClient()
  const toast = useToast()
  const [admissoes, setAdmissoes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [busca, setBusca] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data } = await supabase
      .from('admissoes_workflow')
      .select('*, funcionarios(id, nome, cargo), obras(nome)')
      .order('created_at', { ascending: false })
    setAdmissoes(data ?? [])
    setLoading(false)
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function toggleEtapa(admId: string, key: string, currentVal: any) {
    const isOk = currentVal?.ok === true
    const updated = isOk ? { ok: false } : { ok: true, data: new Date().toISOString().split('T')[0] }
    await supabase.from('admissoes_workflow').update({ [key]: updated, updated_at: new Date().toISOString() }).eq('id', admId)
    loadData()
  }

  async function concluirAdmissao(admId: string) {
    if (!window.confirm('Concluir esta admissão?')) return
    await supabase.from('admissoes_workflow').update({
      status: 'concluida',
      concluida_em: new Date().toISOString(),
    }).eq('id', admId)
    toast.success('Admissão concluída!')
    loadData()
  }

  const filtered = admissoes.filter(a => !busca || a.funcionarios?.nome?.toLowerCase().includes(busca.toLowerCase()))
  const emAndamento = filtered.filter(a => a.status === 'em_andamento')
  const concluidas = filtered.filter(a => a.status === 'concluida')

  const now = new Date()
  const concluidasMes = admissoes.filter(a => {
    if (a.status !== 'concluida' || !a.concluida_em) return false
    const d = new Date(a.concluida_em)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <BackButton fallback="/rh" />
          <div>
            <h1 className="text-xl font-bold font-display text-brand">Admissões</h1>
            <p className="text-sm text-gray-500 mt-0.5">{emAndamento.length} em andamento</p>
          </div>
        </div>
        <Link href="/rh/admissoes/novo"
          className="px-4 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Nova Admissão
        </Link>
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
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Concluídas este Mês</p>
          </div>
          <p className="text-2xl font-bold text-green-600">{concluidasMes}</p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <SearchInput value={busca} onChange={setBusca} placeholder="Buscar admissão..." />
      </div>

      {/* Cards */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Carregando...</div>
      ) : emAndamento.length === 0 && concluidas.length === 0 ? (
        <EmptyState
          titulo="Nenhuma admissão registrada"
          descricao="Cadastre um funcionário e inicie o processo de admissão."
          icone={<UserPlus className="w-12 h-12" />}
          acao={{ label: 'Ir para Funcionários', href: '/funcionarios' }}
        />
      ) : emAndamento.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-gray-400">
          Nenhuma admissão em andamento.
        </div>
      ) : (
        <div className="space-y-3">
          {emAndamento.map(adm => {
            const isOpen = expanded.has(adm.id)
            const progress = getProgress(adm)
            const allDone = progress.done === progress.total

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
                      <div className="flex items-center gap-2">
                        <Link href={`/funcionarios/${adm.funcionarios?.id}`} className="font-semibold text-gray-900 hover:text-brand"
                          onClick={e => e.stopPropagation()}>
                          {adm.funcionarios?.nome ?? '—'}
                        </Link>
                      </div>
                      <p className="text-xs text-gray-500">
                        {adm.funcionarios?.cargo ?? ''} &middot; {adm.obras?.nome ?? '—'} &middot; Prevista: {formatDate(adm.data_prevista_inicio)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {progress.nextPending && (
                      <span className="hidden sm:inline text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium">
                        Proximo: {progress.nextPending}
                      </span>
                    )}
                    <span className="text-xs font-semibold text-gray-500">{progress.done}/{progress.total}</span>
                    <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${progress.pct === 100 ? 'bg-green-500' : progress.pct >= 50 ? 'bg-amber-400' : 'bg-brand'}`}
                        style={{ width: `${progress.pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-gray-600">{progress.pct}%</span>
                  </div>
                </button>

                {/* Expanded checklist */}
                {isOpen && (
                  <div className="border-t border-gray-100 p-5">
                    <div className="space-y-3">
                      {ETAPAS.map(etapa => {
                        const val = adm[etapa.key] ?? {}
                        const checked = val.ok === true

                        return (
                          <div key={etapa.key} className={`flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl border ${checked ? 'bg-green-50/50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                            <label className="flex items-center gap-3 min-w-[220px] cursor-pointer">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleEtapa(adm.id, etapa.key, val)}
                                className="rounded border-gray-300 text-brand focus:ring-brand/30 w-5 h-5"
                              />
                              <span className={`text-sm font-medium ${checked ? 'text-green-700 line-through' : 'text-gray-800'}`}>
                                {etapa.label}
                              </span>
                            </label>
                            {val.data && (
                              <span className="flex items-center gap-1 text-xs text-gray-400">
                                <CalendarCheck className="w-3.5 h-3.5" />
                                {formatDate(val.data)}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {allDone && (
                      <div className="mt-4 flex justify-end">
                        <button
                          onClick={() => concluirAdmissao(adm.id)}
                          className="px-6 py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 flex items-center gap-2"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Concluir Admissão
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
      {concluidas.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Concluídas</h2>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Funcionário', 'Cargo', 'Obra', 'Data Prevista', 'Concluída em'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {concluidas.map(adm => (
                  <tr key={adm.id} className="border-b border-gray-50 hover:bg-gray-50/80">
                    <td className="px-4 py-3">
                      <Link href={`/funcionarios/${adm.funcionarios?.id}`} className="font-semibold text-gray-900 hover:text-brand">
                        {adm.funcionarios?.nome ?? '—'}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{adm.funcionarios?.cargo ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{adm.obras?.nome ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(adm.data_prevista_inicio)}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        {adm.concluida_em ? new Date(adm.concluida_em).toLocaleDateString('pt-BR') : 'Concluída'}
                      </span>
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
