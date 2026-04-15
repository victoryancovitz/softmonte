'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import BackButton from '@/components/BackButton'
import SearchInput from '@/components/SearchInput'
import { useToast } from '@/components/Toast'
import EmptyState from '@/components/ui/EmptyState'
import { etapaOk, ETAPAS_KEYS, contarConcluidas } from '@/lib/admissao-utils'
import {
  UserPlus, CheckCircle2, Clock, Plus, ArrowRight, Timer,
} from 'lucide-react'

/* ─── Constants ─── */

const TOTAL_ETAPAS = ETAPAS_KEYS.length

function formatDate(d: string | null): string {
  if (!d) return '---'
  try {
    const date = d.length <= 10 ? new Date(d + 'T12:00:00') : new Date(d)
    if (isNaN(date.getTime())) return '---'
    return date.toLocaleDateString('pt-BR')
  } catch { return '---' }
}

function avgDays(admissoes: any[]): string {
  const completed = admissoes.filter(a => a.status === 'concluida' && a.concluida_em && a.created_at)
  if (completed.length === 0) return '---'
  const total = completed.reduce((sum, a) => {
    const start = new Date(a.created_at).getTime()
    const end = new Date(a.concluida_em).getTime()
    return sum + (end - start) / (1000 * 60 * 60 * 24)
  }, 0)
  return Math.round(total / completed.length) + ' dias'
}

type TabFilter = 'em_andamento' | 'concluida' | 'todas'

export default function AdmissoesPage() {
  const supabase = createClient()
  const toast = useToast()
  const [admissoes, setAdmissoes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [tab, setTab] = useState<TabFilter>('em_andamento')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [{ data }, { data: alocs }] = await Promise.all([
      supabase.from('admissoes_workflow')
        .select('*, funcionarios(id, nome, cargo, funcao_id, matricula), obras(nome)')
        .order('created_at', { ascending: false }),
      supabase.from('alocacoes')
        .select('funcionario_id, obra_id, obras(nome)')
        .order('data_inicio', { ascending: false }),
    ])

    const ultimaAloc: Record<string, string> = {}
    ;(alocs ?? []).forEach((a: any) => {
      if (a.funcionario_id && a.obras?.nome && !ultimaAloc[a.funcionario_id]) {
        ultimaAloc[a.funcionario_id] = a.obras.nome
      }
    })

    const enriched = (data ?? []).map((a: any) => ({
      ...a,
      _obraNome: a.obras?.nome || (a.funcionarios?.id ? ultimaAloc[a.funcionarios.id] : null) || null,
      _done: contarConcluidas(a),
    }))
    setAdmissoes(enriched)
    setLoading(false)
  }

  /* ─── Derived data ─── */

  const now = new Date()
  const emAndamentoCount = admissoes.filter(a => a.status === 'em_andamento').length
  const concluidasMes = admissoes.filter(a => {
    if (a.status !== 'concluida' || !a.concluida_em) return false
    const d = new Date(a.concluida_em)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length
  const tempoMedio = avgDays(admissoes)

  const filtered = useMemo(() => {
    return admissoes.filter(a => {
      if (busca && !a.funcionarios?.nome?.toLowerCase().includes(busca.toLowerCase())) return false
      if (tab === 'em_andamento' && a.status !== 'em_andamento') return false
      if (tab === 'concluida' && a.status !== 'concluida') return false
      return true
    })
  }, [admissoes, busca, tab])

  /* ─── Render ─── */

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <BackButton fallback="/rh" />
          <div>
            <h1 className="text-xl font-bold font-display text-brand">Admissoes</h1>
            <p className="text-sm text-gray-500 mt-0.5">{emAndamentoCount} em andamento</p>
          </div>
        </div>
        <Link
          href="/rh/admissoes/wizard"
          className="px-4 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nova Admissao
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-amber-500" />
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Em Andamento</p>
          </div>
          <p className="text-2xl font-bold text-amber-600">{emAndamentoCount}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Concluidas no Mes</p>
          </div>
          <p className="text-2xl font-bold text-green-600">{concluidasMes}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Timer className="w-4 h-4 text-blue-500" />
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Tempo Medio</p>
          </div>
          <p className="text-2xl font-bold text-blue-600">{tempoMedio}</p>
        </div>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          {([
            { key: 'em_andamento', label: 'Em andamento' },
            { key: 'concluida', label: 'Concluidas' },
            { key: 'todas', label: 'Todas' },
          ] as { key: TabFilter; label: string }[]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                tab === t.key ? 'bg-white text-brand shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex-1 min-w-[200px]">
          <SearchInput value={busca} onChange={setBusca} placeholder="Buscar por nome..." />
        </div>
        <span className="text-xs text-gray-400">{filtered.length} resultado(s)</span>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Carregando...</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          titulo={tab === 'em_andamento' ? 'Nenhuma admissao em andamento' : 'Nenhuma admissao encontrada'}
          descricao="Cadastre um funcionario e inicie o processo de admissao."
          icone={<UserPlus className="w-12 h-12" />}
          acao={{ label: 'Nova Admissao', href: '/rh/admissoes/wizard' }}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map(adm => {
            const done = adm._done
            const pct = Math.round((done / TOTAL_ETAPAS) * 100)
            const isConcluida = adm.status === 'concluida'

            return (
              <div
                key={adm.id}
                className={`bg-white rounded-xl shadow-sm border overflow-hidden ${
                  isConcluida ? 'border-green-200' : 'border-gray-100'
                }`}
              >
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/funcionarios/${adm.funcionarios?.id}`}
                          className="font-semibold text-gray-900 hover:text-brand truncate"
                        >
                          {adm.funcionarios?.nome ?? '---'}
                        </Link>
                        {isConcluida && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">
                            Concluida em {formatDate(adm.concluida_em)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {adm.funcionarios?.cargo ?? ''}{adm._obraNome ? ` \u00B7 ${adm._obraNome}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0">
                    {/* Progress */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-500">{done}/{TOTAL_ETAPAS}</span>
                      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            pct === 100 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-400' : 'bg-brand'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    {/* Action */}
                    {isConcluida ? (
                      <span className="px-3 py-1.5 text-xs font-medium text-green-600 bg-green-50 rounded-lg">
                        <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />
                        Concluida
                      </span>
                    ) : (
                      <Link
                        href={`/rh/admissoes/wizard/${adm.id}`}
                        className="flex items-center gap-1 px-3 py-1.5 bg-brand text-white rounded-lg text-xs font-bold hover:bg-brand-dark transition-colors"
                      >
                        Continuar wizard <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
