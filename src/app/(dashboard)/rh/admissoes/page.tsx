'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import BackButton from '@/components/BackButton'
import SearchInput from '@/components/SearchInput'
import { useToast } from '@/components/Toast'
import EmptyState from '@/components/ui/EmptyState'
import {
  UserPlus, CheckCircle2, Clock, ChevronDown, ChevronRight,
  Plus,
} from 'lucide-react'
import ChecklistAdmissao from './ChecklistAdmissao'

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
    if (val === true || (typeof val === 'object' && val?.ok === true)) {
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
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroObra, setFiltroObra] = useState('')
  const [filtroDe, setFiltroDe] = useState('')
  const [filtroAte, setFiltroAte] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [{ data }, { data: alocs }] = await Promise.all([
      supabase.from('admissoes_workflow')
        .select('*, funcionarios(id, nome, cargo, funcao_id, matricula, pis, ctps_numero, ctps_serie, ctps_uf, banco, agencia_conta, pix, vt_estrutura, insalubridade_pct, tamanho_uniforme, tamanho_bota), obras(nome)')
        .order('created_at', { ascending: false }),
      supabase.from('alocacoes')
        .select('funcionario_id, obra_id, obras(nome)')
        .order('data_inicio', { ascending: false }),
    ])
    // Mapa: última alocação por funcionário (para preencher obra quando NULL)
    const ultimaAloc: Record<string, string> = {}
    ;(alocs ?? []).forEach((a: any) => {
      if (a.funcionario_id && a.obras?.nome && !ultimaAloc[a.funcionario_id]) {
        ultimaAloc[a.funcionario_id] = a.obras.nome
      }
    })
    // Enriquecer admissões sem obra com a última alocação conhecida
    const enriched = (data ?? []).map((a: any) => ({
      ...a,
      _obraNome: a.obras?.nome || (a.funcionarios?.id ? ultimaAloc[a.funcionarios.id] : null) || null,
    }))
    setAdmissoes(enriched)
    setLoading(false)
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }


  const obrasUnicas = useMemo(() => {
    const map = new Map<string, string>()
    admissoes.forEach(a => { if (a._obraNome) map.set(a.obra_id ?? a._obraNome, a._obraNome) })
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [admissoes])

  const filtered = admissoes.filter(a => {
    if (busca && !a.funcionarios?.nome?.toLowerCase().includes(busca.toLowerCase())) return false
    if (filtroStatus && a.status !== filtroStatus) return false
    if (filtroObra && a._obraNome !== filtroObra) return false
    if (filtroDe && (!a.created_at || a.created_at.slice(0, 10) < filtroDe)) return false
    if (filtroAte && (!a.created_at || a.created_at.slice(0, 10) > filtroAte)) return false
    return true
  })
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

      {/* Filtros */}
      <div className="mb-4 space-y-2">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex-1 min-w-[200px]">
            <SearchInput value={busca} onChange={setBusca} placeholder="Buscar admissao..." />
          </div>
          <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
            <option value="">Todos os status</option>
            <option value="em_andamento">Em Andamento</option>
            <option value="concluida">Concluida</option>
          </select>
          {obrasUnicas.length > 0 && (
            <select value={filtroObra} onChange={e => setFiltroObra(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
              <option value="">Todas as obras</option>
              {obrasUnicas.map(([key, nome]) => <option key={key} value={nome}>{nome}</option>)}
            </select>
          )}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <label className="text-xs text-gray-500">Período de:</label>
          <input type="date" value={filtroDe} onChange={e => setFiltroDe(e.target.value)}
            className="px-2 py-1 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand" />
          <label className="text-xs text-gray-500">ate:</label>
          <input type="date" value={filtroAte} onChange={e => setFiltroAte(e.target.value)}
            className="px-2 py-1 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand" />
          {(busca || filtroStatus || filtroObra || filtroDe || filtroAte) && (
            <button onClick={() => { setBusca(''); setFiltroStatus(''); setFiltroObra(''); setFiltroDe(''); setFiltroAte('') }}
              className="ml-auto text-xs text-red-600 hover:underline font-medium">Limpar filtros</button>
          )}
          <span className="text-xs text-gray-400">{filtered.length} resultado(s)</span>
        </div>
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
                        {adm.funcionarios?.cargo ?? ''} &middot; {adm._obraNome ?? '—'} &middot; Prevista: {formatDate(adm.data_prevista_inicio)}
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
                    <ChecklistAdmissao
                      workflow={adm}
                      funcionario={adm.funcionarios ?? { id: adm.funcionario_id }}
                      onUpdate={loadData}
                    />
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
                    <td className="px-4 py-3 text-gray-600">{adm._obraNome ?? '—'}</td>
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
