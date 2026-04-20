import { createClient } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import BackButton from '@/components/BackButton'
import ProcessoTabs from './ProcessoTabs'
import AudienciasTab from '@/components/juridico/AudienciasTab'
import AcordoTab from '@/components/juridico/AcordoTab'

const TIPOS: Record<string, { label: string; color: string }> = {
  trabalhista: { label: 'Trabalhista', color: 'bg-red-100 text-red-700 border-red-200' },
  civel: { label: 'Cível', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  tributario: { label: 'Tributário', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  ambiental: { label: 'Ambiental', color: 'bg-green-100 text-green-700 border-green-200' },
  administrativo: { label: 'Administrativo', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  criminal: { label: 'Criminal', color: 'bg-gray-100 text-gray-700 border-gray-200' },
}

const STATUS: Record<string, { label: string; color: string }> = {
  inicial: { label: 'Inicial', color: 'bg-gray-100 text-gray-600 border-gray-200' },
  em_andamento: { label: 'Em andamento', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  aguardando_audiencia: { label: 'Aguardando audiência', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  aguardando_sentenca: { label: 'Aguardando sentença', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  recurso: { label: 'Recurso', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  acordo: { label: 'Acordo', color: 'bg-green-100 text-green-700 border-green-200' },
  encerrado: { label: 'Encerrado', color: 'bg-gray-200 text-gray-500 border-gray-300' },
  arquivado: { label: 'Arquivado', color: 'bg-gray-100 text-gray-400 border-gray-200' },
}

const PROGNOSTICOS: Record<string, { label: string; color: string }> = {
  provavel: { label: 'Provável', color: 'bg-red-100 text-red-700 border-red-200' },
  possivel: { label: 'Possível', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  remoto: { label: 'Remoto', color: 'bg-green-100 text-green-700 border-green-200' },
}

export default async function ProcessoPage({ params, searchParams }: { params: { id: string }; searchParams: { tab?: string } }) {
  const supabase = createClient()

  const { data: p } = await supabase
    .from('processos_juridicos')
    .select('*, advogados(id, nome, oab, uf_oab), funcionarios(id, nome), obras(id, nome), centros_custo(id, codigo, nome)')
    .eq('id', params.id)
    .single()

  if (!p) notFound()

  const [{ data: movimentacoes }, { data: anexos }, { data: lancamentos }] = await Promise.all([
    supabase.from('processo_movimentacoes').select('*').eq('processo_juridico_id', params.id).order('data', { ascending: false }),
    supabase.from('processo_anexos').select('*').eq('processo_juridico_id', params.id).is('deleted_at', null).order('created_at', { ascending: false }),
    supabase.from('financeiro_lancamentos').select('*').eq('processo_juridico_id', params.id).is('deleted_at', null).order('data_vencimento', { ascending: false }),
  ])

  const tab = searchParams.tab || 'geral'
  const fmt = (v: number | null) => v ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'
  const fmtDate = (d: string | null) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'

  const tipo = TIPOS[p.tipo]
  const status = STATUS[p.status]
  const prognostico = p.prognostico ? PROGNOSTICOS[p.prognostico] : null

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
        <BackButton fallback="/juridico/processos" />
        <Link href="/juridico/processos" className="hover:text-gray-700">Processos</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">{p.numero_cnj || 'Processo'}</span>
      </div>

      <div className="flex items-start justify-between mt-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BackButton fallback="/juridico/processos" />
            <h1 className="text-xl font-bold font-display text-brand font-mono">{p.numero_cnj || 'Sem CNJ'}</h1>
          </div>
          <p className="text-sm text-gray-600 ml-8">{p.parte_contraria}</p>
          <div className="flex flex-wrap gap-2 mt-2 ml-8">
            {tipo && <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${tipo.color}`}>{tipo.label}</span>}
            {status && <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${status.color}`}>{status.label}</span>}
            {prognostico && <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${prognostico.color}`}>{prognostico.label}</span>}
          </div>
          {(p.tribunal || p.vara || p.comarca) && (
            <p className="text-xs text-gray-500 mt-1 ml-8">
              {[p.tribunal, p.vara, p.comarca, p.uf].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <Link href={`/juridico/processos/${p.id}/editar`} className="px-4 py-2 border rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">
          Editar
        </Link>
      </div>

      {/* Tabs */}
      <ProcessoTabs currentTab={tab} processoId={p.id} />

      {/* Tab Content */}
      <div className="mt-6">
        {tab === 'geral' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <Section title="Dados do processo">
                <Field label="Nº CNJ" value={p.numero_cnj} mono />
                <Field label="Tipo" value={tipo?.label ?? p.tipo} />
                <Field label="Status" value={status?.label ?? p.status} />
                <Field label="Polo" value={p.polo === 'ativo' ? 'Polo Ativo (autor)' : p.polo === 'passivo' ? 'Polo Passivo (réu)' : p.polo} />
                <Field label="Objeto" value={p.objeto} />
                <Field label="Parte contrária" value={p.parte_contraria} />
                <Field label="CPF/CNPJ parte contrária" value={p.parte_contraria_cpf_cnpj} />
                {p.url_processo && (
                  <div className="flex justify-between text-sm py-1.5">
                    <span className="text-gray-500">URL</span>
                    <a href={p.url_processo} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline truncate max-w-[200px]">{p.url_processo}</a>
                  </div>
                )}
              </Section>

              <Section title="Tribunal">
                <Field label="Tribunal" value={p.tribunal} />
                <Field label="Vara" value={p.vara} />
                <Field label="Comarca" value={p.comarca} />
                <Field label="UF" value={p.uf} />
                <Field label="Distribuição" value={fmtDate(p.data_distribuicao)} />
                <Field label="Citação" value={fmtDate(p.data_citacao)} />
              </Section>
            </div>

            <div className="space-y-4">
              <Section title="Financeiro">
                <Field label="Valor da causa" value={fmt(p.valor_causa)} />
                <Field label="Valor provisionado" value={fmt(p.valor_provisionado)} />
                <Field label="Prognóstico" value={prognostico?.label ?? '—'} />
              </Section>

              <Section title="Vínculos">
                <Field label="Advogado" value={p.advogados?.nome} link={p.advogados ? `/juridico/advogados/${p.advogados.id}/editar` : undefined} />
                <Field label="Funcionário" value={p.funcionarios?.nome} link={p.funcionarios ? `/funcionarios/${p.funcionarios.id}` : undefined} />
                <Field label="Obra" value={p.obras?.nome} link={p.obras ? `/obras/${p.obras.id}` : undefined} />
                <Field label="Centro de custo" value={p.centros_custo ? `${p.centros_custo.codigo} - ${p.centros_custo.nome}` : null} />
              </Section>

              {p.observacoes && (
                <Section title="Observações">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{p.observacoes}</p>
                </Section>
              )}
            </div>
          </div>
        )}

        {tab === 'movimentacoes' && (
          <div>
            {(!movimentacoes || movimentacoes.length === 0) ? (
              <div className="text-center py-10 text-gray-400 text-sm">Nenhuma movimentação registrada.</div>
            ) : (
              <div className="space-y-3">
                {movimentacoes.map((m: any) => (
                  <div key={m.id} className="border rounded-xl p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{m.titulo || m.tipo}</p>
                        {m.descricao && <p className="text-sm text-gray-600 mt-1">{m.descricao}</p>}
                      </div>
                      <span className="text-xs text-gray-500 shrink-0">{fmtDate(m.data)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'audiencias' && (
          <AudienciasTab processo_id={p.id} />
        )}

        {tab === 'acordo' && (
          <AcordoTab processo_id={p.id} />
        )}

        {tab === 'anexos' && (
          <div>
            <div className="flex justify-end mb-4">
              <UploadAnexo processoId={p.id} />
            </div>
            {(!anexos || anexos.length === 0) ? (
              <div className="text-center py-10 text-gray-400 text-sm">Nenhum anexo encontrado.</div>
            ) : (
              <div className="space-y-2">
                {anexos.map((a: any) => (
                  <div key={a.id} className="border rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{a.nome || a.arquivo}</p>
                      {a.descricao && <p className="text-xs text-gray-500">{a.descricao}</p>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>{fmtDate(a.created_at?.split('T')[0])}</span>
                      {a.url && <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">Baixar</a>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'financeiro' && (
          <div>
            {(!lancamentos || lancamentos.length === 0) ? (
              <div className="text-center py-10 text-gray-400 text-sm">Nenhum lançamento financeiro vinculado.</div>
            ) : (
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="px-4 py-3">Descrição</th>
                      <th className="px-4 py-3">Tipo</th>
                      <th className="px-4 py-3">Vencimento</th>
                      <th className="px-4 py-3 text-right">Valor</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {lancamentos.map((l: any) => (
                      <tr key={l.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">{l.descricao || '—'}</td>
                        <td className="px-4 py-3">{l.tipo}</td>
                        <td className="px-4 py-3">{fmtDate(l.data_vencimento)}</td>
                        <td className="px-4 py-3 text-right">{fmt(l.valor)}</td>
                        <td className="px-4 py-3">{l.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border rounded-xl p-4">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">{title}</h3>
      <div className="divide-y">{children}</div>
    </div>
  )
}

function Field({ label, value, mono, link }: { label: string; value?: string | null; mono?: boolean; link?: string }) {
  const display = value || '—'
  return (
    <div className="flex justify-between text-sm py-1.5">
      <span className="text-gray-500">{label}</span>
      {link ? (
        <Link href={link} className="text-brand hover:underline">{display}</Link>
      ) : (
        <span className={`text-gray-800 ${mono ? 'font-mono' : ''}`}>{display}</span>
      )}
    </div>
  )
}

function UploadAnexo({ processoId }: { processoId: string }) {
  return (
    <form action={async (formData: FormData) => {
      'use server'
      // Upload logic placeholder - will be implemented with supabase storage
    }}>
      <label className="px-4 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark cursor-pointer">
        + Upload anexo
        <input type="file" className="hidden" name="file" />
      </label>
    </form>
  )
}
