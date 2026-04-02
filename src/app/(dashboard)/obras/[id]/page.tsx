import { createClient } from '@/lib/supabase-server'
import { getRole } from '@/lib/get-role'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ObraStatusBtns } from '@/components/DeleteActions'
import BackButton from '@/components/BackButton'

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
  ] = await Promise.all([
    supabase.from('obras').select('*').eq('id', params.id).single(),
    supabase.from('alocacoes').select('*, funcionarios(id, nome, cargo, matricula, status)').eq('obra_id', params.id).eq('ativo', true),
    supabase.from('boletins_medicao').select('*').eq('obra_id', params.id).order('numero'),
    getRole(),
    supabase.from('efetivo_diario').select('id, data, tipo_dia, funcionario_id, observacao, funcionarios(nome)').eq('obra_id', params.id).gte('data', trintaDiasAtras).order('data', { ascending: false }),
    supabase.from('financeiro_lancamentos').select('*').eq('obra_id', params.id).is('deleted_at', null).order('data_competencia', { ascending: false }),
  ])

  if (!obra) notFound()

  // Fetch documentos for allocated funcionarios
  const funcIds = (alocados ?? []).map((a: any) => a.funcionarios?.id).filter(Boolean)
  const { data: documentos } = funcIds.length > 0
    ? await supabase.from('documentos').select('*, funcionarios(nome)').in('funcionario_id', funcIds).order('vencimento', { ascending: true })
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
    <div className="p-6 max-w-5xl mx-auto">
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
      <div className="flex gap-1 mb-5 bg-white rounded-xl border border-gray-200 p-1">
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
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-xs text-gray-500 mb-1">Equipe alocada</div>
              <div className="text-2xl font-bold">{alocados?.length ?? 0}</div>
              <div className="text-xs text-gray-400">funcionários</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-xs text-gray-500 mb-1">Boletins</div>
              <div className="text-2xl font-bold">{boletins?.length ?? 0}</div>
              <div className="text-xs text-gray-400">medições</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-xs text-gray-500 mb-1">Período</div>
              <div className="text-sm font-semibold">{obra.data_inicio ? new Date(obra.data_inicio + 'T12:00').toLocaleDateString('pt-BR') : '—'}</div>
              <div className="text-xs text-gray-400">até {obra.data_prev_fim ? new Date(obra.data_prev_fim + 'T12:00').toLocaleDateString('pt-BR') : '—'}</div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold mb-4">Informações da Obra</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
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
        </>
      )}

      {/* ===== EQUIPE ===== */}
      {activeTab === 'equipe' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">{alocados?.length ?? 0} funcionários alocados</h2>
            <Link href="/alocacao/nova" className="text-xs text-brand hover:underline font-medium">+ Alocar funcionário</Link>
          </div>
          {alocados && alocados.length > 0 ? (
            <div className="grid grid-cols-2 gap-4">
              {alocados.map((a: any) => {
                const nome = a.funcionarios?.nome ?? 'Sem nome'
                const initials = nome.split(' ').filter(Boolean).slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
                return (
                  <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand/10 text-brand flex items-center justify-center text-sm font-bold shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold truncate">{nome}</div>
                      <div className="text-xs text-gray-500">{a.cargo_na_obra ?? a.funcionarios?.cargo ?? '—'}</div>
                      <div className="text-xs text-gray-400">Mat. {a.funcionarios?.matricula ?? '—'}</div>
                    </div>
                    <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded shrink-0">Ativo</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 px-4 py-12 text-center text-gray-400 text-sm">
              Nenhum funcionário alocado nesta obra.
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
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
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
            <div className="bg-white rounded-xl border border-gray-200 px-4 py-12 text-center text-gray-400 text-sm">
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
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
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
            <div className="bg-white rounded-xl border border-gray-200 px-4 py-12 text-center text-gray-400 text-sm">
              Nenhum boletim criado para esta obra.
            </div>
          )}
        </div>
      )}

      {/* ===== FINANCEIRO ===== */}
      {activeTab === 'financeiro' && (
        <div>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-xs text-gray-500 mb-1">Total Receita</div>
              <div className="text-xl font-bold text-green-700">{fmt(totalReceita)}</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-xs text-gray-500 mb-1">Total Despesa</div>
              <div className="text-xl font-bold text-red-700">{fmt(totalDespesa)}</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-xs text-gray-500 mb-1">Margem</div>
              <div className={`text-xl font-bold ${margem >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(margem)}</div>
            </div>
          </div>

          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">{lancamentos?.length ?? 0} lançamentos</h2>
            <Link href="/financeiro" className="text-xs text-brand hover:underline font-medium">Ir para Financeiro</Link>
          </div>
          {lancamentos && lancamentos.length > 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
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
            <div className="bg-white rounded-xl border border-gray-200 px-4 py-12 text-center text-gray-400 text-sm">
              Nenhum lançamento financeiro para esta obra.
            </div>
          )}
        </div>
      )}

      {/* ===== DOCUMENTOS ===== */}
      {activeTab === 'documentos' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">{docsComDias.length} documentos de funcionários alocados</h2>
            <Link href="/documentos/novo" className="text-xs text-brand hover:underline font-medium">+ Novo documento</Link>
          </div>
          {docsComDias.length > 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
              {docsComDias.map((d: any) => (
                <div key={d.id} className="px-4 py-3 flex items-center justify-between">
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
            <div className="bg-white rounded-xl border border-gray-200 px-4 py-12 text-center text-gray-400 text-sm">
              Nenhum documento encontrado para os funcionários alocados.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
