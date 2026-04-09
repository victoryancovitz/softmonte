'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import BackButton from '@/components/BackButton'
import SearchInput from '@/components/SearchInput'
import { useToast } from '@/components/Toast'
import EmptyState from '@/components/ui/EmptyState'
import {
  UserMinus, CheckCircle2, Clock, ChevronDown, ChevronRight,
  Plus, CalendarCheck, FileText,
} from 'lucide-react'

const ETAPAS = [
  { key: 'etapa_aviso_previo', label: 'Aviso Prévio' },
  { key: 'etapa_devolucao_epi', label: 'Devolução de EPI' },
  { key: 'etapa_devolucao_ferramentas', label: 'Devolução de Ferramentas' },
  { key: 'etapa_exame_demissional', label: 'Exame Demissional' },
  { key: 'etapa_baixa_ctps', label: 'Baixa CTPS' },
  { key: 'etapa_calculo_rescisao', label: 'Cálculo Rescisão' },
  { key: 'etapa_homologacao', label: 'Homologação' },
  { key: 'etapa_esocial', label: 'eSocial' },
  { key: 'etapa_acerto_banco_horas', label: 'Acerto Banco de Horas' },
] as const

const TIPO_LABELS: Record<string, { label: string; cls: string }> = {
  demissao_sem_justa_causa: { label: 'Sem Justa Causa', cls: 'bg-red-100 text-red-700' },
  sem_justa_causa: { label: 'Sem Justa Causa', cls: 'bg-red-100 text-red-700' },
  demissao_por_justa_causa: { label: 'Por Justa Causa', cls: 'bg-red-200 text-red-800' },
  justa_causa: { label: 'Por Justa Causa', cls: 'bg-red-200 text-red-800' },
  pedido_demissao: { label: 'Pedido de Demissão', cls: 'bg-amber-100 text-amber-700' },
  termino_contrato: { label: 'Término de Contrato', cls: 'bg-blue-100 text-blue-700' },
  acordo: { label: 'Acordo Mútuo', cls: 'bg-purple-100 text-purple-700' },
  acordo_mutual: { label: 'Acordo Mútuo', cls: 'bg-purple-100 text-purple-700' },
  aposentadoria: { label: 'Aposentadoria', cls: 'bg-gray-100 text-gray-600' },
  falecimento: { label: 'Falecimento', cls: 'bg-gray-200 text-gray-700' },
}

/** Fallback: converte snake_case para Title Case */
function formatSnake(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}

function getProgress(desl: any): { done: number; total: number; pct: number; nextPending: string | null } {
  const total = ETAPAS.length
  let done = 0
  let nextPending: string | null = null
  for (const etapa of ETAPAS) {
    const val = desl[etapa.key]
    if (val?.ok === true) {
      done++
    } else if (!nextPending) {
      nextPending = etapa.label
    }
  }
  return { done, total, pct: Math.round((done / total) * 100), nextPending }
}

export default function DesligamentosPage() {
  const supabase = createClient()
  const toast = useToast()
  const [desligamentos, setDesligamentos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [busca, setBusca] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data } = await supabase
      .from('desligamentos_workflow')
      .select('*, funcionarios(id, nome, cargo), obras(nome)')
      .order('created_at', { ascending: false })
    setDesligamentos(data ?? [])
    setLoading(false)
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function toggleEtapa(deslId: string, key: string, currentVal: any) {
    const isOk = currentVal?.ok === true
    const updated = isOk ? { ok: false } : { ok: true, data: new Date().toISOString().split('T')[0] }
    await supabase.from('desligamentos_workflow').update({ [key]: updated, updated_at: new Date().toISOString() }).eq('id', deslId)
    loadData()
  }

  async function concluirDesligamento(desl: any) {
    if (!window.confirm('Concluir este desligamento? O funcionario sera marcado como inativo e uma rescisão será criada automaticamente.')) return

    const dataSaida = desl.data_prevista_saida || new Date().toISOString().split('T')[0]

    // Mapeia tipo_desligamento do workflow → tipo da tabela rescisoes
    const tipoMap: Record<string, string> = {
      sem_justa_causa: 'sem_justa_causa',
      justa_causa: 'justa_causa',
      pedido_demissao: 'pedido_demissao',
      termino_contrato: 'fim_contrato_determinado',
      acordo: 'comum_acordo',
    }
    const tipoRescisao = tipoMap[desl.tipo_desligamento] || 'sem_justa_causa'
    const avisoTipo = tipoRescisao === 'justa_causa' ? 'nao_aplicavel' : 'indenizado'

    await supabase.from('desligamentos_workflow').update({
      status: 'concluido',
      concluido_em: new Date().toISOString(),
      data_real_saida: dataSaida,
    }).eq('id', desl.id)

    await supabase.from('funcionarios').update({ status: 'inativo' }).eq('id', desl.funcionario_id)

    await supabase.from('alocacoes').update({
      ativo: false,
      data_fim: dataSaida,
    }).eq('funcionario_id', desl.funcionario_id).eq('ativo', true)

    // Verifica se já existe rescisão pra esse funcionário
    const { data: rescExistente } = await supabase.from('rescisoes')
      .select('id').eq('funcionario_id', desl.funcionario_id).is('deleted_at', null).limit(1).maybeSingle()

    if (!rescExistente) {
      // Calcula rescisão via função Postgres
      const { data: calc, error: cErr } = await supabase.rpc('calcular_rescisao', {
        p_funcionario_id: desl.funcionario_id,
        p_data_desligamento: dataSaida,
        p_tipo: tipoRescisao,
        p_aviso_tipo: avisoTipo,
      })
      if (cErr) {
        toast.error('Desligamento concluído, mas rescisão falhou: ' + cErr.message)
      } else if (calc) {
        // Busca alocação mais recente pra linkar
        const { data: aloc } = await supabase.from('alocacoes')
          .select('id, obra_id').eq('funcionario_id', desl.funcionario_id)
          .order('data_inicio', { ascending: false }).limit(1).maybeSingle()
        const { data: { user } } = await supabase.auth.getUser()

        const { data: rescInserida } = await supabase.from('rescisoes').insert({
          funcionario_id: desl.funcionario_id,
          alocacao_id: aloc?.id ?? null,
          obra_id: aloc?.obra_id ?? null,
          tipo: tipoRescisao,
          aviso_previo_tipo: avisoTipo,
          aviso_previo_dias: calc.aviso_dias,
          data_aviso: dataSaida,
          data_desligamento: dataSaida,
          salario_base_rescisao: calc.salario_base,
          salario_total_rescisao: calc.salario_total,
          saldo_salario: calc.saldo_salario,
          aviso_previo_valor: calc.aviso_previo_valor,
          ferias_vencidas: calc.ferias_vencidas,
          ferias_proporcionais: calc.ferias_proporcionais,
          terco_ferias: calc.terco_ferias,
          decimo_proporcional: calc.decimo_proporcional,
          fgts_mes: calc.fgts_mes,
          fgts_aviso: calc.fgts_aviso,
          fgts_13: calc.fgts_13,
          fgts_saldo_estimado: calc.fgts_saldo_estimado,
          multa_fgts_40: calc.multa_fgts_40,
          desconto_inss: calc.desconto_inss,
          desconto_irrf: calc.desconto_irrf,
          total_proventos: calc.total_proventos,
          total_descontos: calc.total_descontos,
          valor_liquido: calc.valor_liquido,
          custo_total_empresa: calc.valor_empresa_total,
          status: 'rascunho',
          observacao: `Criada automaticamente pela conclusão do desligamento ${desl.id}`,
          created_by: user?.id ?? null,
        }).select().single()

        if (rescInserida) {
          toast.success('Desligamento concluído e rescisão criada', `Líquido calculado: ${Number(calc.valor_liquido).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} — revise em /rh/rescisoes`)
          loadData()
          return
        }
      }
    }

    toast.success('Desligamento concluido!', `Funcionario marcado como inativo`)
    loadData()
  }

  const filtered = desligamentos.filter(d => !busca || d.funcionarios?.nome?.toLowerCase().includes(busca.toLowerCase()))
  const emAndamento = filtered.filter(d => d.status === 'em_andamento')
  const concluidos = filtered.filter(d => d.status === 'concluido')

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <BackButton fallback="/rh" />
          <div>
            <h1 className="text-xl font-bold font-display text-brand">Desligamentos</h1>
            <p className="text-sm text-gray-500 mt-0.5">{emAndamento.length} em andamento</p>
          </div>
        </div>
        <Link href="/rh/desligamentos/novo"
          className="px-4 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Novo Desligamento
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
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Concluidos</p>
          </div>
          <p className="text-2xl font-bold text-green-600">{concluidos.length}</p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <SearchInput value={busca} onChange={setBusca} placeholder="Buscar desligamento..." />
      </div>

      {/* Cards */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Carregando...</div>
      ) : emAndamento.length === 0 && concluidos.length === 0 ? (
        <EmptyState
          titulo="Nenhum desligamento registrado"
          descricao="Desligamentos podem ser iniciados a partir do perfil do funcionario."
          icone={<UserMinus className="w-12 h-12" />}
        />
      ) : emAndamento.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-gray-400">
          Nenhum desligamento em andamento.
        </div>
      ) : (
        <div className="space-y-3">
          {emAndamento.map(desl => {
            const isOpen = expanded.has(desl.id)
            const progress = getProgress(desl)
            const allDone = progress.done === progress.total
            const tipoInfo = TIPO_LABELS[desl.tipo_desligamento] ?? { label: formatSnake(desl.tipo_desligamento || ''), cls: 'bg-gray-100 text-gray-600' }

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
                        <Link href={`/funcionarios/${desl.funcionarios?.id}`} className="font-semibold text-gray-900 hover:text-brand"
                          onClick={e => e.stopPropagation()}>
                          {desl.funcionarios?.nome ?? '—'}
                        </Link>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tipoInfo.cls}`}>{tipoInfo.label}</span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {desl.funcionarios?.cargo ?? ''} &middot; {desl.obras?.nome ?? '—'} &middot; Saida: {formatDate(desl.data_real_saida ?? desl.data_prevista_saida)}
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
                    {/* Info badges */}
                    <div className="flex flex-wrap gap-3 mb-4">
                      <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
                        <Clock className="w-4 h-4 text-blue-500" />
                        <div>
                          <p className="text-xs text-blue-600 font-semibold">Banco de Horas</p>
                          <p className="text-sm font-bold text-blue-800">
                            {desl.saldo_banco_horas_saida != null ? `${Number(desl.saldo_banco_horas_saida) >= 0 ? '+' : ''}${desl.saldo_banco_horas_saida}h` : 'N/A'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                        <FileText className="w-4 h-4 text-green-500" />
                        <div>
                          <p className="text-xs text-green-600 font-semibold">Ferias</p>
                          <p className="text-sm font-bold text-green-800">
                            {desl.saldo_ferias_saida != null ? `${desl.saldo_ferias_saida} dia(s)` : 'N/A'}
                          </p>
                        </div>
                      </div>
                      {desl.prazo_esocial_s2299 && (
                        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                          <CalendarCheck className="w-4 h-4 text-amber-500" />
                          <div>
                            <p className="text-xs text-amber-600 font-semibold">Prazo eSocial</p>
                            <p className="text-sm font-bold text-amber-800">{formatDate(desl.prazo_esocial_s2299)}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      {ETAPAS.map(etapa => {
                        const val = desl[etapa.key] ?? {}
                        const checked = val.ok === true

                        return (
                          <div key={etapa.key} className={`flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl border ${checked ? 'bg-green-50/50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                            <label className="flex items-center gap-3 min-w-[220px] cursor-pointer">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleEtapa(desl.id, etapa.key, val)}
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
                  {['Funcionário', 'Cargo', 'Tipo', 'Data Saída', 'Concluído em'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {concluidos.map(desl => {
                  const tipoInfo = TIPO_LABELS[desl.tipo_desligamento] ?? { label: formatSnake(desl.tipo_desligamento || ''), cls: 'bg-gray-100 text-gray-600' }
                  return (
                    <tr key={desl.id} className="border-b border-gray-50 hover:bg-gray-50/80">
                      <td className="px-4 py-3">
                        <Link href={`/funcionarios/${desl.funcionarios?.id}`} className="font-semibold text-gray-900 hover:text-brand">
                          {desl.funcionarios?.nome ?? '—'}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{desl.funcionarios?.cargo ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tipoInfo.cls}`}>{tipoInfo.label}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(desl.data_real_saida ?? desl.data_prevista_saida)}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          {desl.concluido_em ? new Date(desl.concluido_em).toLocaleDateString('pt-BR') : 'Concluído'}
                        </span>
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
