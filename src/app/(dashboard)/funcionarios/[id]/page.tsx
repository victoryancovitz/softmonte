import { createClient } from '@/lib/supabase-server'
import { getRole } from '@/lib/get-role'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DesativarFuncionarioBtn } from '@/components/DeleteActions'

export default async function FuncionarioPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: f } = await supabase.from('funcionarios').select('*').eq('id', params.id).single()
  if (!f) notFound()
  const role = await getRole()

  const hoje = new Date()
  const trintaDiasAtras = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]

  const [{ data: alocacoes }, { data: faltas }, { data: docsFunc }, { data: efetivo30 }, { data: docsGerados }] = await Promise.all([
    supabase.from('alocacoes').select('*, obras(nome, status)').eq('funcionario_id', params.id).order('data_inicio', { ascending: false }),
    supabase.from('faltas').select('*').eq('funcionario_id', params.id).order('data', { ascending: false }).limit(20),
    supabase.from('documentos').select('*').eq('funcionario_id', params.id).order('vencimento'),
    supabase.from('efetivo_diario').select('data,tipo_dia,obras(nome)').eq('funcionario_id', params.id).gte('data', trintaDiasAtras).order('data', { ascending: false }),
    supabase.from('documentos_gerados').select('*').eq('funcionario_id', params.id).order('created_at', { ascending: false }),
  ])

  const campos = [
    { label: 'Matrícula', value: f.matricula },
    { label: 'RE', value: f.re },
    { label: 'CPF', value: f.cpf },
    { label: 'PIS', value: f.pis },
    { label: 'Data de Nascimento', value: f.data_nascimento ? new Date(f.data_nascimento+'T12:00').toLocaleDateString('pt-BR') : null },
    { label: 'Admissão', value: f.admissao ? new Date(f.admissao+'T12:00').toLocaleDateString('pt-BR') : null },
    { label: 'Prazo 1', value: f.prazo1 ? new Date(f.prazo1+'T12:00').toLocaleDateString('pt-BR') : null },
    { label: 'Prazo 2', value: f.prazo2 ? new Date(f.prazo2+'T12:00').toLocaleDateString('pt-BR') : null },
    { label: 'Banco', value: f.banco },
    { label: 'Agência / Conta', value: f.agencia_conta },
    { label: 'PIX', value: f.pix },
    { label: 'VT Estrutura', value: f.vt_estrutura },
    { label: 'Tamanho Bota', value: f.tamanho_bota },
    { label: 'Uniforme', value: f.tamanho_uniforme },
  ]

  const STATUS_COLOR: Record<string, string> = {
    disponivel: 'bg-green-100 text-green-700',
    alocado: 'bg-blue-100 text-blue-700',
    afastado: 'bg-yellow-100 text-yellow-700',
    inativo: 'bg-gray-100 text-gray-500',
  }

  const p1 = f.prazo1 ? new Date(f.prazo1+'T12:00') : null
  const diasP1 = p1 ? Math.ceil((p1.getTime() - Date.now()) / 86400000) : null
  const alertaP1 = diasP1 !== null && diasP1 <= 30 && diasP1 >= 0

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <Link href="/funcionarios" className="text-gray-400 hover:text-gray-600">Funcionários</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700">{f.nome}</span>
      </div>

      {alertaP1 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 flex items-center gap-2">
          ⚠️ <span>Contrato vencendo em <strong>{diasP1} dias</strong> ({p1?.toLocaleDateString('pt-BR')})</span>
        </div>
      )}

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-display text-brand">{f.nome}</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-gray-600">{f.cargo}</span>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLOR[f.status] ?? 'bg-gray-100'}`}>{f.status}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/funcionarios/${f.id}/editar`}
            className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
            ✏️ Editar
          </Link>
          {f.status !== 'inativo' && <DesativarFuncionarioBtn funcId={f.id} role={role} />}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Dados */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="text-sm font-bold text-brand font-display mb-4">Dados cadastrais</h2>
          <div className="space-y-3">
            {campos.filter(c => c.value).map(c => (
              <div key={c.label} className="flex justify-between">
                <span className="text-xs text-gray-500">{c.label}</span>
                <span className="text-sm font-medium text-gray-800">{c.value}</span>
              </div>
            ))}
            <div className="flex justify-between">
              <span className="text-xs text-gray-500">Custo/hora</span>
              <span className="text-sm font-medium text-gray-800">
                {f.custo_hora ? `R$ ${Number(f.custo_hora).toFixed(2)}` : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Alocações */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="text-sm font-bold text-brand font-display mb-4">Obras</h2>
          {alocacoes && alocacoes.length > 0 ? (
            <div className="space-y-2">
              {alocacoes.map((a: any) => (
                <div key={a.id} className={`p-3 rounded-xl border ${a.ativo ? 'border-green-200 bg-green-50' : 'border-gray-100 bg-gray-50'}`}>
                  <div className="text-sm font-semibold text-gray-900">{a.obras?.nome}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{a.cargo_na_obra}</div>
                  <div className="text-xs text-gray-400">
                    Desde {a.data_inicio ? new Date(a.data_inicio+'T12:00').toLocaleDateString('pt-BR') : '—'}
                    {a.ativo ? <span className="ml-2 text-green-600 font-medium">Ativo</span> : <span className="ml-2 text-gray-400">Encerrado</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Sem alocações.</p>
          )}
        </div>
      </div>

      {/* Faltas e Atestados */}
      <div className="mt-5 bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-brand font-display">Faltas e Atestados</h2>
          <Link href="/faltas/nova" className="text-xs text-brand hover:underline">+ Registrar</Link>
        </div>
        {faltas && faltas.length > 0 ? (
          <div className="space-y-2">
            {faltas.map((ft: any) => {
              const TIPO_BADGE: Record<string, string> = {
                falta_injustificada: 'bg-red-100 text-red-700',
                atestado_medico: 'bg-blue-100 text-blue-700',
                licenca: 'bg-green-100 text-green-700',
                folga: 'bg-gray-100 text-gray-600',
                atraso: 'bg-amber-100 text-amber-700',
              }
              const TIPO_LABEL: Record<string, string> = {
                falta_injustificada: 'FALTA', atestado_medico: 'ATESTADO',
                licenca: 'LICENÇA', folga: 'FOLGA', atraso: 'ATRASO',
              }
              return (
                <div key={ft.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${TIPO_BADGE[ft.tipo] ?? 'bg-gray-100 text-gray-600'}`}>
                      {TIPO_LABEL[ft.tipo] ?? ft.tipo}
                    </span>
                    <span className="text-xs text-gray-500">{new Date(ft.data+'T12:00').toLocaleDateString('pt-BR')}</span>
                  </div>
                  <span className="text-xs text-gray-400 truncate max-w-[200px]">{ft.observacao || '—'}</span>
                </div>
              )
            })}
          </div>
        ) : <p className="text-sm text-gray-400">Nenhuma falta ou atestado registrado.</p>}
      </div>

      {/* Histórico de Ponto (últimos 30 dias) */}
      <div className="mt-5 bg-white rounded-2xl border border-gray-200 p-5">
        <h2 className="text-sm font-bold text-brand font-display mb-4">Ponto — últimos 30 dias</h2>
        {efetivo30 && efetivo30.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {efetivo30.map((e: any, i: number) => (
              <div key={i} className="w-8 h-8 rounded-lg bg-green-100 text-green-700 text-[10px] font-bold flex items-center justify-center" title={`${new Date(e.data+'T12:00').toLocaleDateString('pt-BR')} · ${e.obras?.nome}`}>
                {new Date(e.data+'T12:00').getDate()}
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-gray-400">Nenhum registro de ponto nos últimos 30 dias.</p>}
        <p className="text-xs text-gray-400 mt-2">{efetivo30?.length ?? 0} dias presentes</p>
      </div>

      {/* Documentos */}
      <div className="mt-5 bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-brand font-display">Documentos</h2>
          <Link href={`/documentos/novo?funcionario=${f.id}`} className="text-xs text-brand hover:underline">+ Novo</Link>
        </div>
        {docsFunc && docsFunc.length > 0 ? (
          <div className="space-y-2">
            {docsFunc.map((d: any) => {
              const dias = d.vencimento ? Math.ceil((new Date(d.vencimento+'T12:00').getTime() - hoje.getTime()) / 86400000) : null
              return (
                <div key={d.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold bg-brand/10 text-brand px-2 py-0.5 rounded">{d.tipo}</span>
                    <span className="text-xs text-gray-500">{d.vencimento ? new Date(d.vencimento+'T12:00').toLocaleDateString('pt-BR') : '—'}</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    dias === null ? 'bg-gray-100 text-gray-500' : dias < 0 ? 'bg-red-100 text-red-700' : dias <= 30 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {dias === null ? 'Sem venc.' : dias < 0 ? 'VENCIDO' : dias <= 30 ? `${dias}d` : 'OK'}
                  </span>
                </div>
              )
            })}
          </div>
        ) : <p className="text-sm text-gray-400">Nenhum documento cadastrado.</p>}
      </div>

      {/* Advertências e Termos */}
      <div className="mt-5 bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-brand font-display">Advertências e Termos</h2>
          <Link href="/documentos/gerar" className="text-xs text-brand hover:underline">Gerar novo</Link>
        </div>
        {docsGerados && docsGerados.length > 0 ? (
          <div className="space-y-2">
            {docsGerados.map((d: any) => {
              const cat = d.dados_preenchidos?.categoria ?? ''
              const CAT_BADGE: Record<string, string> = {
                advertencia: 'bg-red-100 text-red-700',
                termo: 'bg-blue-100 text-blue-700',
                comunicado: 'bg-purple-100 text-purple-700',
              }
              const CAT_LABEL: Record<string, string> = {
                advertencia: 'ADVERTÊNCIA',
                termo: 'TERMO',
                comunicado: 'COMUNICADO',
              }
              return (
                <div key={d.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${CAT_BADGE[cat] ?? 'bg-gray-100 text-gray-600'}`}>
                      {CAT_LABEL[cat] ?? cat?.toUpperCase() || 'DOC'}
                    </span>
                    <span className="text-sm text-gray-700">{d.nome_modelo}</span>
                  </div>
                  <span className="text-xs text-gray-400">{new Date(d.created_at).toLocaleDateString('pt-BR')}</span>
                </div>
              )
            })}
          </div>
        ) : <p className="text-sm text-gray-400">Nenhuma advertência ou termo registrado.</p>}
      </div>
    </div>
  )
}
