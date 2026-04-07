import { createClient } from '@/lib/supabase-server'
import { getRole } from '@/lib/get-role'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ObraStatusBtns } from '@/components/DeleteActions'
import BackButton from '@/components/BackButton'
import EntityDocumentos from '@/components/EntityDocumentos'

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
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const tabs = [
  { key: 'geral', label: 'Geral' },
  { key: 'equipe', label: 'Equipe' },
  { key: 'efetivo', label: 'Efetivo' },
  { key: 'boletins', label: 'Boletins' },
  { key: 'financeiro', label: 'Financeiro' },
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
    { data: cronograma },
    { data: diario },
    { data: rncData },
    { data: transferencias },
  ] = await Promise.all([
    supabase.from('obras').select('*').eq('id', params.id).is('deleted_at', null).maybeSingle(),
    supabase.from('alocacoes').select('*, funcionarios(id, nome, nome_guerra, cargo, matricula, id_ponto, status, deleted_at, admissao)').eq('obra_id', params.id).eq('ativo', true),
    supabase.from('boletins_medicao').select('*').eq('obra_id', params.id).is('deleted_at', null).order('numero'),
    getRole(),
    supabase.from('efetivo_diario').select('id, data, tipo_dia, funcionario_id, observacao, funcionarios(nome)').eq('obra_id', params.id).gte('data', trintaDiasAtras).order('data', { ascending: false }),
    supabase.from('financeiro_lancamentos').select('*').eq('obra_id', params.id).is('deleted_at', null).order('data_competencia', { ascending: false }),
    supabase.from('contrato_composicao').select('*').eq('obra_id', params.id).order('funcao_nome'),
    supabase.from('aditivos').select('*').eq('obra_id', params.id).order('numero'),
    supabase.from('cronograma_etapas').select('*').eq('obra_id', params.id).order('ordem'),
    supabase.from('diario_obra').select('*').eq('obra_id', params.id).order('data', { ascending: false }).limit(30),
    supabase.from('rnc').select('*').eq('obra_id', params.id).order('created_at', { ascending: false }),
    supabase.from('transferencias').select('*, funcionarios(nome)').eq('obra_origem_id', params.id).order('data_transferencia', { ascending: false }),
  ])

  if (!obra) notFound()

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
  const ativosIds = new Set((alocados ?? []).map((a: any) => a.funcionarios?.id).filter(Boolean))
  const desligados = Object.values(funcsComPontoMap).filter((f: any) => !ativosIds.has(f.id))

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
          <p className="text-gray-500 mt-1">{obra.cliente} · {obra.local}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${STATUS_BADGE[obra.status] ?? 'bg-gray-100 text-gray-600'}`}>{obra.status}</span>
          <Link href={`/obras/${obra.id}/editar`} className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">Editar</Link>
          <ObraStatusBtns obraId={obra.id} status={obra.status} role={role} />
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto mb-5 bg-white rounded-xl shadow-sm border border-gray-100 p-1">
        {tabs.map(t => (
          <Link key={t.key} href={`/obras/${params.id}?tab=${t.key}`}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === t.key ? 'bg-brand text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}>
            {t.label}
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
              <div className="text-2xl font-bold">{alocados?.length ?? 0}</div>
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
                <span className="ml-2 font-medium">{obra.local ?? '—'}</span>
              </div>
              <div>
                <span className="text-gray-500">Status:</span>
                <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[obra.status] ?? 'bg-gray-100 text-gray-600'}`}>{obra.status}</span>
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
                        <td className="px-4 py-2 font-medium">{c.funcao_nome}</td>
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
                Ativos no momento ({alocados?.length ?? 0})
              </h2>
              <Link href="/alocacao/nova" className="text-xs text-brand hover:underline font-medium">+ Alocar funcionário</Link>
            </div>
            {alocados && alocados.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {alocados.map((a: any) => {
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
                          const funcDocs = docsComDias.filter((d: any) => d.funcionario_id === f?.id)
                          const aso = funcDocs.find((d: any) => d.tipo === 'ASO')
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">Efetivo Diário — últimos 30 dias</h2>
            <Link href="/efetivo" className="text-xs text-brand hover:underline font-medium">Ir para Efetivo</Link>
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
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[b.status] ?? 'bg-gray-100 text-gray-600'}`}>{b.status}</span>
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
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[l.status] ?? 'bg-gray-100 text-gray-600'}`}>{l.status}</span>
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

          {/* Documentos de funcionários alocados */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-brand font-display">Documentos dos funcionários alocados ({docsComDias.length})</h2>
            </div>
            {docsComDias.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {docsComDias.map((d: any) => (
                  <div key={d.id} className="py-2 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">{d.tipo}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {d.funcionarios?.nome ?? '—'}
                        {d.vencimento && ` · Venc. ${new Date(d.vencimento + 'T12:00').toLocaleDateString('pt-BR')}`}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${docStatusColor(d.dias)}`}>
                      {docStatusLabel(d.dias)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Nenhum documento dos funcionários alocados.</p>
            )}
          </div>
        </div>
      )}

      {/* ===== CRONOGRAMA ===== */}
      {activeTab === 'cronograma' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">{cronograma?.length ?? 0} etapas</h2>
          </div>
          {cronograma && cronograma.length > 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-50">
              {cronograma.map((e: any) => (
                <div key={e.id} className={`px-4 py-3 ${e.nivel > 0 ? 'pl-10' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className={`text-sm ${e.nivel === 0 ? 'font-bold' : 'font-medium'} text-gray-900`}>{e.nome}</span>
                      {e.milestone && <span className="ml-2 text-xs bg-brand/10 text-brand px-2 py-0.5 rounded">Marco</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        e.status === 'concluido' ? 'bg-green-100 text-green-700' :
                        e.status === 'em_andamento' ? 'bg-blue-100 text-blue-700' :
                        e.status === 'atrasado' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                      }`}>{e.status}</span>
                      <span className="text-xs text-gray-400">{e.percentual_fisico}%</span>
                    </div>
                  </div>
                  {(e.data_inicio_plan || e.data_fim_plan) && (
                    <div className="text-xs text-gray-400 mt-1">
                      Plan: {e.data_inicio_plan ? new Date(e.data_inicio_plan+'T12:00').toLocaleDateString('pt-BR') : '—'} → {e.data_fim_plan ? new Date(e.data_fim_plan+'T12:00').toLocaleDateString('pt-BR') : '—'}
                    </div>
                  )}
                  <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-brand rounded-full" style={{ width: `${e.percentual_fisico}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center text-gray-400 text-sm">Nenhuma etapa cadastrada.</div>
          )}
        </div>
      )}

      {/* ===== DIARIO ===== */}
      {activeTab === 'diario' && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Diário da Obra</h2>
          {diario && diario.length > 0 ? (
            <div className="space-y-3">
              {diario.map((d: any) => (
                <div key={d.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{new Date(d.data+'T12:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}</span>
                      {d.clima && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{d.clima}</span>}
                    </div>
                    <span className="text-xs text-gray-400">{d.efetivo_presente} presentes</span>
                  </div>
                  {d.servicos_executados && <p className="text-xs text-gray-600 mb-1">{d.servicos_executados}</p>}
                  {d.ocorrencias && <p className="text-xs text-red-600">{d.ocorrencias}</p>}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center text-gray-400 text-sm">Nenhum registro no diário.</div>
          )}
        </div>
      )}

      {/* ===== RNC ===== */}
      {activeTab === 'rnc' && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Registros de Não Conformidade</h2>
          {rncData && rncData.length > 0 ? (
            <div className="space-y-3">
              {rncData.map((r: any) => {
                const impactColor: Record<string,string> = { critico:'bg-red-100 text-red-700', alto:'bg-orange-100 text-orange-700', medio:'bg-yellow-100 text-yellow-700', baixo:'bg-gray-100 text-gray-600' }
                const statusColor: Record<string,string> = { aberta:'bg-blue-100 text-blue-700', em_tratamento:'bg-amber-100 text-amber-700', fechada:'bg-green-100 text-green-700' }
                return (
                  <div key={r.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">RNC #{r.numero}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${impactColor[r.impacto] ?? 'bg-gray-100'}`}>{r.impacto?.toUpperCase()}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${statusColor[r.status] ?? 'bg-gray-100'}`}>{r.status}</span>
                      </div>
                      <span className="text-xs text-gray-400">{r.responsavel_nome}</span>
                    </div>
                    <p className="text-xs text-gray-700">{r.descricao}</p>
                    {r.acao_corretiva && <p className="text-xs text-gray-500 mt-1">Ação: {r.acao_corretiva}</p>}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center text-gray-400 text-sm">Nenhuma RNC registrada.</div>
          )}
        </div>
      )}
    </div>
  )
}
