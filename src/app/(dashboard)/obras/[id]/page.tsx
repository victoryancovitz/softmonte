import { createClient } from '@/lib/supabase-server'
import { getRole } from '@/lib/get-role'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ObraStatusBtns } from '@/components/DeleteActions'
import BackButton from '@/components/BackButton'
import EntityDocumentos from '@/components/EntityDocumentos'
import DocsAlocadosSection from './DocsAlocadosSection'
import CronogramaTab from './CronogramaTab'
import DiarioTab from './DiarioTab'
import RncTab from './RncTab'
import AditivosTab from './AditivosTab'
import { formatStatus } from '@/lib/formatters'
import ContasBancariasObra from './ContasBancariasObra'
import { fmt } from '@/lib/cores'

const TIPOS_DOC_OBRA = [
  { value: 'contrato', label: 'Contrato' },
  { value: 'aditivo', label: 'Aditivo' },
  { value: 'proposta', label: 'Proposta' },
  { value: 'projeto', label: 'Projeto' },
  { value: 'outro', label: 'Outro' },
]

const STATUS_BADGE: Record<string, string> = {
  ativo: 'bg-green-100 text-green-700',
  aberto: 'bg-blue-100 text-blue-700',
  fechado: 'bg-gray-100 text-gray-600',
  enviado: 'bg-amber-100 text-amber-700',
  aprovado: 'bg-green-100 text-green-700',
  pago: 'bg-emerald-100 text-emerald-700',
  pendente: 'bg-yellow-100 text-yellow-700',
  em_aberto: 'bg-blue-100 text-blue-700',
  cancelado: 'bg-red-100 text-red-700',
  concluido: 'bg-green-100 text-green-700',
  em_andamento: 'bg-blue-100 text-blue-700',
  pausado: 'bg-gray-100 text-gray-500',
  provisionado: 'bg-purple-100 text-purple-700',
  atrasado: 'bg-red-100 text-red-700',
}



const tabs = [
  { key: 'geral', label: 'Geral' },
  { key: 'equipe', label: 'Equipe' },
  { key: 'efetivo', label: 'Efetivo' },
  { key: 'boletins', label: 'Boletins' },
  { key: 'financeiro', label: 'Financeiro' },
  { key: 'aditivos', label: 'Aditivos' },
  { key: 'documentos', label: 'Documentos' },
  { key: 'cronograma', label: 'Cronograma' },
  { key: 'diario', label: 'Diário' },
  { key: 'rnc', label: 'RNC' },
]

export default async function ObraDetailPage({ params, searchParams }: { params: { id: string }; searchParams: { tab?: string } }) {
  const supabase = createClient()
  const activeTab = searchParams.tab ?? 'geral'

  const trintaDiasAtras = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  const hoje = new Date()

  const [
    { data: obra },
    { data: alocados },
    { data: boletins },
    role,
    { data: efetivo },
    { data: lancamentos },
    { data: composicao },
    { data: aditivosData },
    { data: transferencias },
    { data: contasCorrentes },
  ] = await Promise.all([
    supabase.from('obras').select('*').eq('id', params.id).is('deleted_at', null).maybeSingle(),
    supabase.from('alocacoes').select('*, funcionarios(id, nome, nome_guerra, cargo, matricula, id_ponto, status, deleted_at, admissao)').eq('obra_id', params.id).eq('ativo', true).order('data_inicio'),
    supabase.from('boletins_medicao').select('*').eq('obra_id', params.id).is('deleted_at', null).order('numero'),
    getRole(),
    supabase.from('efetivo_diario').select('id, data, tipo_dia, funcionario_id, observacao, funcionarios(nome)').eq('obra_id', params.id).gte('data', trintaDiasAtras).order('data', { ascending: false }),
    supabase.from('financeiro_lancamentos').select('*').eq('obra_id', params.id).is('deleted_at', null).order('data_competencia', { ascending: false }),
    supabase.from('contrato_composicao').select('*').eq('obra_id', params.id).order('funcao_nome'),
    supabase.from('aditivos').select('*').eq('obra_id', params.id).order('numero'),
    supabase.from('transferencias').select('*, funcionarios(nome)').eq('obra_origem_id', params.id).order('data_transferencia', { ascending: false }),
    supabase.from('contas_correntes').select('id, nome, banco').eq('ativo', true).is('deleted_at', null).order('is_padrao', { ascending: false }).order('nome'),
  ])

  if (!obra) notFound()

  // Deduplicar alocações por funcionario_id (manter a mais antiga, já ordenado ASC)
  const alocadosUnicos: any[] = Object.values(
    (alocados ?? []).reduce((map: Record<string, any>, a: any) => {
      const fId = a.funcionarios?.id
      if (fId && !map[fId]) map[fId] = a
      return map
    }, {})
  )

  // Buscar todos os funcionários que já tiveram efetivo_diario nesta obra (incluindo desligados)
  const { data: comPontoData } = await supabase
    .from('efetivo_diario')
    .select('funcionario_id, funcionarios(id, nome, nome_guerra, cargo, matricula, id_ponto, status, deleted_at, admissao)')
    .eq('obra_id', params.id)
  const funcsComPontoMap: Record<string, any> = {}
  ;((comPontoData ?? []) as any[]).forEach((r: any) => {
    if (r.funcionarios) funcsComPontoMap[r.funcionarios.id] = r.funcionarios
  })

  // Separar em ativos (com alocação ativa) e desligados (sem alocação ativa, mas com ponto registrado ou soft-deleted)
  const ativosIds = new Set(alocadosUnicos.map((a: any) => a.funcionarios?.id).filter(Boolean))
  const desligados = Object.values(funcsComPontoMap).filter((f: any) => !ativosIds.has(f.id))

  // Todos os funcionários do efetivo: alocados + com registro de efetivo_diario (sem duplicatas)
  const efetivoFuncsMap: Record<string, any> = {}
  alocadosUnicos.forEach((a: any) => {
    if (a.funcionarios) efetivoFuncsMap[a.funcionarios.id] = a.funcionarios
  })
  Object.entries(funcsComPontoMap).forEach(([id, f]) => {
    if (!efetivoFuncsMap[id]) efetivoFuncsMap[id] = f
  })

  // Detecta funcionários com multi-alocação (alocados também em OUTRAS obras ativas)
  const funcIdsAlocados = Array.from(ativosIds)
  let multiMap: Record<string, { obra_id: string; obra_nome: string }[]> = {}
  if (funcIdsAlocados.length > 0) {
    const { data: outras } = await supabase
      .from('alocacoes')
      .select('funcionario_id, obra_id, obras(nome)')
      .in('funcionario_id', funcIdsAlocados)
      .eq('ativo', true)
      .neq('obra_id', params.id)
    ;(outras ?? []).forEach((r: any) => {
      if (!multiMap[r.funcionario_id]) multiMap[r.funcionario_id] = []
      multiMap[r.funcionario_id].push({ obra_id: r.obra_id, obra_nome: r.obras?.nome || '' })
    })
  }

  // Fetch documentos for allocated funcionarios
  const funcIds = Array.from(ativosIds)
  const { data: documentos } = funcIds.length > 0
    ? await supabase.from('documentos').select('*, funcionarios(nome)').in('funcionario_id', funcIds).is('deleted_at', null).order('vencimento', { ascending: true })
    : { data: [] as any[] }

  // Efetivo grouped by date
  const efetivoByDate: Record<string, { count: number; registros: any[] }> = {}
  ;(efetivo ?? []).forEach((e: any) => {
    if (!efetivoByDate[e.data]) efetivoByDate[e.data] = { count: 0, registros: [] }
    efetivoByDate[e.data].count++
    efetivoByDate[e.data].registros.push(e)
  })
  const efetivoSorted = Object.entries(efetivoByDate).sort(([a], [b]) => b.localeCompare(a))

  // Financeiro summary
  const totalReceita = (lancamentos ?? []).filter((l: any) => l.tipo === 'receita').reduce((s: number, l: any) => s + Number(l.valor), 0)
  const totalDespesa = (lancamentos ?? []).filter((l: any) => l.tipo === 'despesa').reduce((s: number, l: any) => s + Number(l.valor), 0)
  const margem = totalReceita - totalDespesa

  // Documentos with dias
  const docsComDias = (documentos ?? []).map((d: any) => ({
    ...d,
    dias: d.vencimento ? Math.ceil((new Date(d.vencimento + 'T12:00').getTime() - hoje.getTime()) / 86400000) : null,
  }))

  const aditivosPendentes = (aditivosData ?? []).filter((a: any) => a.status === 'pendente').length

  const docStatusColor = (dias: number | null) => {
    if (dias === null) return 'bg-gray-100 text-gray-500'
    if (dias < 0) return 'bg-red-100 text-red-700'
    if (dias <= 30) return 'bg-amber-100 text-amber-700'
    return 'bg-green-100 text-green-700'
  }

  const docStatusLabel = (dias: number | null) => {
    if (dias === null) return 'Sem vencimento'
    if (dias < 0) return `Vencido há ${Math.abs(dias)}d`
    if (dias <= 30) return `Vence em ${dias}d`
    return 'Regular'
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3 mb-6">
        <BackButton fallback="/obras" />
        <Link href="/obras" className="text-gray-400 hover:text-gray-600 text-sm">Obras</Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-medium">{obra.nome}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold font-display text-gray-900">{obra.nome}</h1>
          <p className="text-gray-500 mt-1">{obra.cliente} · {obra.local || obra.cidade || '—'}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${STATUS_BADGE[obra.status] ?? 'bg-gray-100 text-gray-600'}`}>{formatStatus(obra.status)}</span>
          <Link href={`/obras/${obra.id}/editar`} className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">Editar</Link>
          <ObraStatusBtns obraId={obra.id} status={obra.status} role={role} />
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto mb-5 bg-white rounded-xl shadow-sm border border-gray-100 p-1">
        {tabs.map(t => (
          <Link key={t.key} href={`/obras/${params.id}?tab=${t.key}`}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-1.5 ${
              activeTab === t.key ? 'bg-brand text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}>
            {t.label}
            {t.key === 'aditivos' && aditivosPendentes > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold leading-none ${
                activeTab === 'aditivos' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'
              }`}>{aditivosPendentes}</span>
            )}
          </Link>
        ))}
      </div>

      {/* Tab content */}

      {/* ===== GERAL ===== */}
      {activeTab === 'geral' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="text-xs text-gray-500 mb-1">Equipe alocada</div>
              <div className="text-2xl font-bold">{alocadosUnicos.length}</div>
              <div className="text-xs text-gray-400">funcionários</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="text-xs text-gray-500 mb-1">Boletins</div>
              <div className="text-2xl font-bold">{boletins?.length ?? 0}</div>
              <div className="text-xs text-gray-400">medições</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="text-xs text-gray-500 mb-1">Período</div>
              <div className="text-sm font-semibold">{obra.data_inicio ? new Date(obra.data_inicio + 'T12:00').toLocaleDateString('pt-BR') : '—'}</div>
              <div className="text-xs text-gray-400">até {obra.data_prev_fim ? new Date(obra.data_prev_fim + 'T12:00').toLocaleDateString('pt-BR') : '—'}</div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-sm font-semibold mb-4">Informações da Obra</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
              <div>
                <span className="text-gray-500">Nome:</span>
                <span className="ml-2 font-medium">{obra.nome}</span>
              </div>
              <div>
                <span className="text-gray-500">Cliente:</span>
                <span className="ml-2 font-medium">{obra.cliente ?? '—'}</span>
              </div>
              <div>
                <span className="text-gray-500">Local:</span>
                <span className="ml-2 font-medium">{obra.local || obra.cidade || '—'}</span>
              </div>
              <div>
                <span className="text-gray-500">Status:</span>
                <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[obra.status] ?? 'bg-gray-100 text-gray-600'}`}>{formatStatus(obra.status)}</span>
              </div>
              <div>
                <span className="text-gray-500">Início:</span>
                <span className="ml-2 font-medium">{obra.data_inicio ? new Date(obra.data_inicio + 'T12:00').toLocaleDateString('pt-BR') : '—'}</span>
              </div>
              <div>
                <span className="text-gray-500">Previsão fim:</span>
                <span className="ml-2 font-medium">{obra.data_prev_fim ? new Date(obra.data_prev_fim + 'T12:00').toLocaleDateString('pt-BR') : '—'}</span>
              </div>
            </div>
          </div>

          {/* Banner: composição vazia em obra ativa */}
          {(!composicao || composicao.length === 0) && obra.status === 'ativo' && (
            <div className="mt-5 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <span className="text-amber-500 text-lg leading-none">⚠️</span>
              <div className="text-sm text-amber-800">
                Esta obra não possui composição contratual definida. Sem ela, o Forecast e o pré-preenchimento do BM não funcionam.
                <Link href={`/obras/${obra.id}/editar`} className="ml-2 text-amber-700 font-semibold underline hover:text-amber-900">Definir Composição →</Link>
              </div>
            </div>
          )}

          {/* Contrato HH */}
          <div className="mt-5 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-sm font-semibold mb-4">Composição Contratual</h2>
            {composicao && composicao.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-100">
                    {['Função','Qtd Contratada','Horas/Mês','Custo/Hora','Origem'].map(h => (
                      <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {composicao.map((c: any) => (
                      <tr key={c.id} className="border-b border-gray-50">
                        <td className="px-4 py-2 font-medium">
                          {c.funcao_nome}
                          {c.origem === 'aditivo' && <span className="text-[10px] px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded font-semibold ml-1">Aditivo</span>}
                          {c.data_fim && <span className="text-[10px] text-gray-400 ml-1">até {new Date(c.data_fim + 'T12:00').toLocaleDateString('pt-BR')}</span>}
                        </td>
                        <td className="px-4 py-2">{c.quantidade_contratada}</td>
                        <td className="px-4 py-2">{c.horas_mes}h</td>
                        <td className="px-4 py-2">R$ {Number(c.custo_hora_contratado || 0).toFixed(2)}</td>
                        <td className="px-4 py-2"><span className={`text-xs px-2 py-0.5 rounded-full ${c.origem === 'aditivo' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{c.origem}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-sm text-gray-400">Sem composição contratual definida.</p>}
          </div>

          {/* Aditivos */}
          {aditivosData && aditivosData.length > 0 && (
            <div className="mt-5 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h2 className="text-sm font-semibold mb-4">Aditivos</h2>
              <div className="space-y-2">
                {aditivosData.map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <span className="text-sm font-medium">Aditivo #{a.numero}</span>
                      <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${a.status === 'aprovado' ? 'bg-green-100 text-green-700' : a.status === 'pendente' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>{a.status}</span>
                      <span className="ml-2 text-xs text-gray-400">{a.tipo}</span>
                    </div>
                    <span className="text-xs text-gray-400">{a.descricao}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contas Bancárias do Contrato */}
          <ContasBancariasObra obraId={obra.id} contaRecebimentoId={obra.conta_recebimento_id} contaPagamentoId={obra.conta_pagamento_id} contas={contasCorrentes ?? []} />
        </>
      )}

      {/* ===== EQUIPE ===== */}
      {activeTab === 'equipe' && (
        <div className="space-y-6">
          {/* ATIVOS */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                Ativos no momento ({alocadosUnicos.length})
              </h2>
              <Link href="/alocacao/nova" className="text-xs text-brand hover:underline font-medium">+ Alocar funcionário</Link>
            </div>
            {alocadosUnicos.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {alocadosUnicos.map((a: any) => {
                  const f = a.funcionarios
                  const nome = f?.nome_guerra ?? f?.nome ?? 'Sem nome'
                  const initials = (f?.nome ?? '').split(' ').filter(Boolean).slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
                  return (
                    <Link key={a.id} href={`/funcionarios/${f?.id}`}
                      className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-3 hover:border-brand/30 hover:shadow-md transition-all">
                      <div className="w-10 h-10 rounded-full bg-brand/10 text-brand flex items-center justify-center text-sm font-bold shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold truncate">{nome}</div>
                        <div className="text-xs text-gray-500">{a.cargo_na_obra ?? f?.cargo ?? '—'}</div>
                        <div className="text-xs text-gray-400">{f?.id_ponto ? `ID Ponto ${f.id_ponto}` : f?.matricula ? `Mat. ${f.matricula}` : '—'}</div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap justify-end shrink-0">
                        {(() => {
                          const funcDocs = docsComDias.filter((d: any) => d.funcionario_id === f?.id && d.tipo === 'ASO')
                          // Pick the ASO with the latest vencimento (best validity)
                          const asoValido = funcDocs.filter((d: any) => d.dias !== null && d.dias > 0).sort((a: any, b: any) => b.dias - a.dias)[0]
                          const asoMaisRecente = funcDocs.sort((a: any, b: any) => (b.dias ?? -Infinity) - (a.dias ?? -Infinity))[0]
                          const aso = asoValido ?? asoMaisRecente
                          const badges: { label: string; cls: string; title: string }[] = []
                          if (!aso) {
                            badges.push({ label: 'Sem ASO', cls: 'bg-red-100 text-red-700', title: 'Nenhum ASO cadastrado' })
                          } else if (aso.dias !== null && aso.dias < 0) {
                            badges.push({ label: 'ASO vencido', cls: 'bg-red-100 text-red-700', title: `ASO vencido ha ${Math.abs(aso.dias)} dia(s)` })
                          } else if (aso.dias !== null && aso.dias <= 30) {
                            badges.push({ label: `ASO ${aso.dias}d`, cls: 'bg-amber-100 text-amber-700', title: `ASO vence em ${aso.dias} dia(s)` })
                          }
                          return badges.map((b, i) => (
                            <span key={i} className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${b.cls}`} title={b.title}>{b.label}</span>
                          ))
                        })()}
                        {multiMap[f?.id]?.length > 0 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-purple-100 text-purple-700"
                                title={`Também alocado em: ${multiMap[f?.id].map(m => m.obra_nome).join(', ')}`}>
                            ⚡ Multi ({multiMap[f?.id].length + 1})
                          </span>
                        )}
                        <span className="text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded font-semibold">Ativo</span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-8 text-center text-gray-400 text-sm">
                Nenhum funcionário ativo nesta obra.
              </div>
            )}
          </div>

          {/* DESLIGADOS */}
          {desligados.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                Desligados / Histórico ({desligados.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {desligados.map((f: any) => {
                  const nome = f.nome_guerra ?? f.nome ?? 'Sem nome'
                  const initials = (f.nome ?? '').split(' ').filter(Boolean).slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
                  const demissao = f.deleted_at ? new Date(f.deleted_at).toLocaleDateString('pt-BR') : null
                  return (
                    <Link key={f.id} href={`/funcionarios/${f.id}`}
                      className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center gap-3 opacity-75 hover:opacity-100 hover:shadow-md transition-all">
                      <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center text-sm font-bold shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold truncate text-gray-700">{nome}</div>
                        <div className="text-xs text-gray-500">{f.cargo ?? '—'}</div>
                        <div className="text-xs text-gray-400">
                          {f.id_ponto ? `ID Ponto ${f.id_ponto}` : f.matricula ? `Mat. ${f.matricula}` : '—'}
                          {demissao && <span className="ml-2 text-red-500">· Desligado em {demissao}</span>}
                        </div>
                      </div>
                      <span className="text-[10px] text-red-700 bg-red-100 px-2 py-0.5 rounded font-bold shrink-0">Desligado</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== EFETIVO ===== */}
      {activeTab === 'efetivo' && (
        <div>
          {/* Lista de funcionários do efetivo (alocados + com registro de ponto) */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700">Funcionários no Efetivo ({Object.keys(efetivoFuncsMap).length})</h2>
              <Link href="/efetivo" className="text-xs text-brand hover:underline font-medium">Ir para Efetivo</Link>
            </div>
            {Object.keys(efetivoFuncsMap).length > 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100">
                {Object.values(efetivoFuncsMap).map((f: any) => {
                  const nome = f.nome_guerra ?? f.nome ?? 'Sem nome'
                  const temPonto = !!funcsComPontoMap[f.id]
                  const temAlocacao = ativosIds.has(f.id)
                  return (
                    <Link key={f.id} href={`/funcionarios/${f.id}`} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 block">
                      <div>
                        <div className="text-sm font-semibold">{nome}</div>
                        <div className="text-xs text-gray-500">{f.cargo ?? '—'}{f.id_ponto ? ` · ID Ponto ${f.id_ponto}` : ''}</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {temAlocacao && <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-green-100 text-green-700">Alocado</span>}
                        {temPonto && <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-blue-100 text-blue-700">Com ponto</span>}
                        {!temAlocacao && <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-gray-100 text-gray-500">Sem alocação ativa</span>}
                      </div>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-8 text-center text-gray-400 text-sm">
                Nenhum funcionário no efetivo desta obra.
              </div>
            )}
          </div>

          {/* Registros diários */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">Efetivo Diário — últimos 30 dias</h2>
          </div>
          {efetivoSorted.length > 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100">
              {efetivoSorted.map(([data, info]) => (
                <div key={data} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">{new Date(data + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {info.registros.slice(0, 3).map((r: any) => r.funcionarios?.nome?.split(' ')[0]).filter(Boolean).join(', ')}
                      {info.count > 3 && ` +${info.count - 3}`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-brand">{info.count}</div>
                    <div className="text-xs text-gray-400">presentes</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-12 text-center text-gray-400 text-sm">
              Nenhum registro de efetivo nos últimos 30 dias.
            </div>
          )}
        </div>
      )}

      {/* ===== BOLETINS ===== */}
      {activeTab === 'boletins' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">{boletins?.length ?? 0} boletins de medição</h2>
            <Link href="/boletins/nova" className="text-xs text-brand hover:underline font-medium">+ Novo BM</Link>
          </div>
          {boletins && boletins.length > 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100">
              {boletins.map((b: any) => (
                <Link key={b.id} href={`/boletins/${b.id}`} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 block">
                  <div>
                    <div className="text-sm font-semibold">BM {String(b.numero).padStart(2, '0')}</div>
                    <div className="text-xs text-gray-500">
                      {new Date(b.data_inicio + 'T12:00').toLocaleDateString('pt-BR')} — {new Date(b.data_fim + 'T12:00').toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {b.nfe_numero ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-green-100 text-green-700">NF Emitida</span>
                    ) : b.status === 'aprovado' && !b.nfe_numero ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-700">Aguard. NF</span>
                    ) : null}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[b.status] ?? 'bg-gray-100 text-gray-600'}`}>{formatStatus(b.status)}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-12 text-center text-gray-400 text-sm">
              Nenhum boletim criado para esta obra.
            </div>
          )}
        </div>
      )}

      {/* ===== FINANCEIRO ===== */}
      {activeTab === 'financeiro' && (
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="text-xs text-gray-500 mb-1">Total Receita</div>
              <div className="text-xl font-bold text-green-700">{fmt(totalReceita)}</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="text-xs text-gray-500 mb-1">Total Despesa</div>
              <div className="text-xl font-bold text-red-700">{fmt(totalDespesa)}</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="text-xs text-gray-500 mb-1">Margem</div>
              <div className={`text-xl font-bold ${margem >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(margem)}</div>
            </div>
          </div>

          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">{lancamentos?.length ?? 0} lançamentos</h2>
            <Link href="/financeiro" className="text-xs text-brand hover:underline font-medium">Ir para Financeiro</Link>
          </div>
          {lancamentos && lancamentos.length > 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100">
              {lancamentos.map((l: any) => (
                <div key={l.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${l.tipo === 'receita' ? 'bg-green-500' : 'bg-red-500'}`} />
                      {l.descricao ?? l.categoria ?? l.tipo}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {l.data_competencia ? new Date(l.data_competencia + 'T12:00').toLocaleDateString('pt-BR') : '—'}
                      {l.categoria && ` · ${l.categoria}`}
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <span className={`text-sm font-semibold ${l.tipo === 'receita' ? 'text-green-700' : 'text-red-700'}`}>
                      {l.tipo === 'receita' ? '+' : '-'}{fmt(Number(l.valor))}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[l.status] ?? 'bg-gray-100 text-gray-600'}`}>{formatStatus(l.status)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-12 text-center text-gray-400 text-sm">
              Nenhum lançamento financeiro para esta obra.
            </div>
          )}
        </div>
      )}

      {/* ===== DOCUMENTOS ===== */}
      {activeTab === 'documentos' && (
        <div className="space-y-4">
          {/* Documentos da obra (contratos, aditivos, etc.) */}
          <EntityDocumentos
            table="obra_documentos"
            fkColumn="obra_id"
            fkValue={params.id}
            storagePath="obras"
            tiposPermitidos={TIPOS_DOC_OBRA}
            showValor={true}
            title="Contratos, Aditivos e Documentos da Obra"
          />

          {/* Documentos de funcionários alocados — com filtros e agrupamento */}
          <DocsAlocadosSection docs={docsComDias} />
        </div>
      )}

      {/* ===== ADITIVOS ===== */}
      {activeTab === 'aditivos' && <AditivosTab obra={obra} aditivos={aditivosData ?? []} composicao={composicao ?? []} />}

      {/* ===== CRONOGRAMA ===== */}
      {activeTab === 'cronograma' && <CronogramaTab obraId={params.id} />}

      {/* ===== DIARIO ===== */}
      {activeTab === 'diario' && <DiarioTab obraId={params.id} />}

      {/* ===== RNC ===== */}
      {activeTab === 'rnc' && <RncTab obraId={params.id} />}
    </div>
  )
}
