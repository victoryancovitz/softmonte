import { createClient } from '@/lib/supabase-server'
import { getRole } from '@/lib/get-role'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DesativarFuncionarioBtn } from '@/components/DeleteActions'
import BackButton from '@/components/BackButton'
import FuncionarioDocumentos from '@/components/FuncionarioDocumentos'
import FuncionarioHistorico from '@/components/FuncionarioHistorico'

export default async function FuncionarioPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: f } = await supabase.from('funcionarios').select('*').eq('id', params.id).single()
  if (!f) notFound()
  const isArquivado = f.deleted_at !== null
  const role = await getRole()

  const hoje = new Date()
  const trintaDiasAtras = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]

  const [{ data: alocacoes }, { data: faltas }, { data: docsFunc }, { data: efetivo30 }, { data: docsGerados }, { data: prazosArr }, { data: admissaoArr }, { data: desligamentoArr }, { count: faltasCount }] = await Promise.all([
    supabase.from('alocacoes').select('*, obras(nome, status)').eq('funcionario_id', params.id).order('data_inicio', { ascending: false }),
    supabase.from('faltas').select('*').eq('funcionario_id', params.id).order('data', { ascending: false }).limit(20),
    supabase.from('documentos').select('*').eq('funcionario_id', params.id).is('deleted_at', null).order('vencimento'),
    supabase.from('efetivo_diario').select('data,tipo_dia,obras(nome)').eq('funcionario_id', params.id).gte('data', trintaDiasAtras).order('data', { ascending: false }),
    supabase.from('documentos_gerados').select('*').eq('funcionario_id', params.id).order('created_at', { ascending: false }),
    supabase.from('vw_prazos_legais').select('*').eq('funcionario_id', params.id).limit(1),
    supabase.from('admissoes_workflow').select('id, status, concluida_em, created_at').eq('funcionario_id', params.id).order('created_at', { ascending: false }).limit(1),
    supabase.from('desligamentos_workflow').select('id, status, concluido_em, created_at').eq('funcionario_id', params.id).eq('status', 'em_andamento').order('created_at', { ascending: false }).limit(1),
    supabase.from('faltas').select('id', { count: 'exact', head: true }).eq('funcionario_id', params.id).in('tipo', ['falta_injustificada','falta_justificada']),
  ])
  const prazos = prazosArr?.[0] ?? null
  const admissao = admissaoArr?.[0] ?? null
  const desligamento = desligamentoArr?.[0] ?? null

  // Calculate prazo badges
  function prazoBadge(date: string | null) {
    if (!date) return null
    const dias = Math.ceil((new Date(date+'T12:00').getTime() - hoje.getTime()) / 86400000)
    if (dias < 0) return { label: 'Vencido', cls: 'bg-red-100 text-red-700' }
    if (dias < 15) return { label: `Vence em ${dias}d`, cls: 'bg-amber-100 text-amber-700' }
    return { label: 'Vigente', cls: 'bg-green-100 text-green-700' }
  }

  // CLT vacation rule: 12 months acquisitive period + 12 months concession period
  // Atrasado se admissão + 24 meses já passou
  let feriasAtrasada = false
  let podeFerias = false
  let proximoPeriodoFerias: Date | null = null
  if (f.admissao) {
    const admissaoDate = new Date(f.admissao + 'T12:00')
    const podeApartirDe = new Date(admissaoDate)
    podeApartirDe.setMonth(podeApartirDe.getMonth() + 12)
    const limite = new Date(admissaoDate)
    limite.setMonth(limite.getMonth() + 24)
    podeFerias = hoje >= podeApartirDe
    feriasAtrasada = hoje >= limite
    proximoPeriodoFerias = podeApartirDe
  }

  const campos = [
    { label: 'Matrícula', value: f.matricula },
    { label: 'ID Ponto', value: f.id_ponto },
    { label: 'CPF', value: f.cpf },
    { label: 'RG', value: f.re },
    { label: 'PIS', value: f.pis },
    { label: 'Título de Eleitor', value: f.titulo_eleitor },
    { label: 'Data de Nascimento', value: f.data_nascimento ? new Date(f.data_nascimento+'T12:00').toLocaleDateString('pt-BR') : null },
    { label: 'Naturalidade', value: f.naturalidade },
    { label: 'Estado Civil', value: f.estado_civil },
    { label: 'Raça/Cor', value: f.raca_cor },
    { label: 'Nome do Pai', value: f.nome_pai },
    { label: 'Nome da Mãe', value: f.nome_mae },
    { label: 'Telefone', value: f.telefone },
    { label: 'Endereço', value: f.endereco },
    { label: 'Cidade', value: f.cidade_endereco },
    { label: 'CEP', value: f.cep },
    { label: 'Admissão', value: f.admissao ? new Date(f.admissao+'T12:00').toLocaleDateString('pt-BR') : null },
    { label: 'Banco', value: f.banco },
    { label: 'Agência / Conta', value: f.agencia_conta },
    { label: 'PIX', value: f.pix },
    { label: 'VT Estrutura', value: f.vt_estrutura },
  ]

  const prazo1Badge = prazoBadge(f.prazo1)
  const prazo2Badge = prazoBadge(f.prazo2)

  const STATUS_COLOR: Record<string, string> = {
    disponivel: 'bg-green-100 text-green-700',
    alocado: 'bg-blue-100 text-blue-700',
    afastado: 'bg-yellow-100 text-yellow-700',
    inativo: 'bg-gray-100 text-gray-500',
  }

  const ALERTA_BADGE: Record<string, { label: string; cls: string }> = {
    experiencia_1_vencendo: { label: 'Exp. 1 vence', cls: 'bg-amber-100 text-amber-700' },
    experiencia_2_vencendo: { label: 'Exp. vence', cls: 'bg-red-100 text-red-700' },
    ferias_vencidas: { label: 'Ferias vencidas', cls: 'bg-red-100 text-red-700' },
    ferias_urgente: { label: 'Ferias urgente', cls: 'bg-orange-100 text-orange-700' },
    contrato_vencendo: { label: 'Contrato vence', cls: 'bg-amber-100 text-amber-700' },
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/funcionarios" />
        <Link href="/funcionarios" className="text-gray-400 hover:text-gray-600">Funcionarios</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700">{f.nome}</span>
      </div>

      {/* Admission banner */}
      {!admissao && f.status !== 'inativo' && (
        <div className="mb-4 p-4 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-800">Este funcionario ainda nao tem processo de admissao registrado.</p>
            <p className="text-xs text-blue-600 mt-0.5">Inicie o checklist de admissao para documentos, exame, EPI e eSocial.</p>
          </div>
          <Link href={`/rh/admissoes/novo?funcionario_id=${f.id}`}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 flex-shrink-0 ml-4">
            Iniciar Admissao
          </Link>
        </div>
      )}
      {admissao?.status === 'em_andamento' && (
        <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-sm font-semibold text-amber-800">Admissao em andamento</span>
          </div>
          <Link href={`/rh/admissoes`} className="text-xs text-amber-700 font-semibold hover:underline">Continuar</Link>
        </div>
      )}
      {admissao?.status === 'concluida' && (
        <div className="mb-4 p-3 rounded-xl bg-green-50 border border-green-200 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-sm font-semibold text-green-700">Admissao concluida</span>
          {admissao.concluida_em && (
            <span className="text-xs text-green-600">em {new Date(admissao.concluida_em).toLocaleDateString('pt-BR')}</span>
          )}
        </div>
      )}

      {/* Dismissal in progress banner */}
      {desligamento && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm font-semibold text-red-800">Desligamento em andamento</span>
          </div>
          <Link href={`/rh/desligamentos`} className="text-xs text-red-700 font-semibold hover:underline">Continuar</Link>
        </div>
      )}

      {prazos?.alerta_tipo && prazos.alerta_tipo !== 'ok' && (
        <div className={`mb-4 p-3 rounded-xl text-sm flex items-center gap-2 border ${
          prazos.alerta_tipo.includes('vencid') || prazos.alerta_tipo.includes('experiencia_2') ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-800'
        }`}>
          <span className={`w-2 h-2 rounded-full inline-block ${prazos.alerta_tipo.includes('vencid') || prazos.alerta_tipo.includes('experiencia_2') ? 'bg-red-500' : 'bg-amber-500'}`} />
          <span>{ALERTA_BADGE[prazos.alerta_tipo]?.label ?? prazos.alerta_tipo}</span>
        </div>
      )}

      {f.nao_renovar && !isArquivado && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-300 rounded-xl text-sm text-amber-900">
          <div className="flex items-center gap-2">
            <span>⚠</span>
            <strong>NÃO RENOVAR</strong>
            {f.observacao_renovacao && <span className="text-amber-700">— {f.observacao_renovacao}</span>}
          </div>
        </div>
      )}

      {isArquivado && (
        <div className="mb-4 p-3 bg-gray-100 border border-gray-300 rounded-xl text-sm text-gray-700">
          <div className="flex items-center gap-2">
            <span>📁</span>
            <strong>Vínculo arquivado</strong>
            <span>— Funcionário desligado em {f.deleted_at ? new Date(f.deleted_at).toLocaleDateString('pt-BR') : '—'}.</span>
          </div>
          {f.motivo_saida && (
            <div className="mt-1 text-xs text-gray-600">
              Motivo: <strong>{f.motivo_saida}</strong>
              {f.motivo_justa_causa && <span className="block mt-0.5 text-red-700">Justa causa: {f.motivo_justa_causa}</span>}
            </div>
          )}
        </div>
      )}

      {!isArquivado && f.status === 'inativo' && f.motivo_saida && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
          <strong>Motivo do desligamento:</strong> {f.motivo_saida}
          {f.motivo_justa_causa && <div className="mt-1 text-xs">Detalhamento: {f.motivo_justa_causa}</div>}
        </div>
      )}

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-display text-brand">{f.nome_guerra ?? f.nome}</h1>
          {f.nome_guerra && <p className="text-sm text-gray-500 mt-0.5">({f.nome})</p>}
          <div className="flex items-center gap-3 mt-2">
            <span className="text-gray-600">{f.cargo}</span>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLOR[f.status] ?? 'bg-gray-100'}`}>{f.status}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/funcionarios/${f.id}/editar`}
            className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
            Editar
          </Link>
          {f.status !== 'inativo' && !desligamento && (
            <Link href={`/rh/desligamentos/novo?funcionario_id=${f.id}`}
              className="px-4 py-2 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors">
              Iniciar Desligamento
            </Link>
          )}
          {f.status !== 'inativo' && <DesativarFuncionarioBtn funcId={f.id} role={role} />}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5">
        {/* Dados */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-sm font-bold text-brand font-display mb-4">Dados cadastrais</h2>
          <div className="space-y-3">
            {campos.filter(c => c.value).map(c => (
              <div key={c.label} className="flex justify-between">
                <span className="text-xs text-gray-500">{c.label}</span>
                <span className="text-sm font-medium text-gray-800">{c.value}</span>
              </div>
            ))}
            {f.prazo1 && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500" title="Vence 45 dias após a admissão. Deve ser prorrogado ou efetivado antes desta data.">
                  1º Período de Experiência
                  <span className="ml-1 text-gray-300 cursor-help">ⓘ</span>
                </span>
                <span className="text-sm font-medium text-gray-800 flex items-center gap-2">
                  {new Date(f.prazo1+'T12:00').toLocaleDateString('pt-BR')}
                  {prazo1Badge && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${prazo1Badge.cls}`}>{prazo1Badge.label}</span>}
                </span>
              </div>
            )}
            {f.prazo2 && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500" title="Vence 90 dias após a admissão (máximo legal CLT). Após esta data, o contrato se torna por prazo indeterminado.">
                  2º Período de Experiência
                  <span className="ml-1 text-gray-300 cursor-help">ⓘ</span>
                </span>
                <span className="text-sm font-medium text-gray-800 flex items-center gap-2">
                  {new Date(f.prazo2+'T12:00').toLocaleDateString('pt-BR')}
                  {prazo2Badge && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${prazo2Badge.cls}`}>{prazo2Badge.label}</span>}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-xs text-gray-500">Custo/hora</span>
              <span className="text-sm font-medium text-gray-800">
                {f.custo_hora ? `R$ ${Number(f.custo_hora).toFixed(2)}` : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Alocacoes */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
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
            <p className="text-sm text-gray-400">Sem alocacoes.</p>
          )}
        </div>
      </div>

      {/* Prazos Legais */}
      {prazos && (
        <div className="mt-5 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-sm font-bold text-brand font-display mb-4">Prazos Legais</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {prazos.prazo_experiencia_1 && (
              <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
                <span className="text-xs text-gray-500">1o Prazo experiencia</span>
                <span className="text-sm font-medium">{new Date(prazos.prazo_experiencia_1+'T12:00').toLocaleDateString('pt-BR')}</span>
              </div>
            )}
            {prazos.prazo_experiencia_2 && (
              <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
                <span className="text-xs text-gray-500">Fim da experiencia</span>
                <span className="text-sm font-medium">{new Date(prazos.prazo_experiencia_2+'T12:00').toLocaleDateString('pt-BR')}</span>
              </div>
            )}
            <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
              <span className="text-xs text-gray-500">Converteu para CLT</span>
              <span className={`text-sm font-medium ${prazos.ja_converteu_clt ? 'text-green-700' : 'text-gray-400'}`}>
                {prazos.ja_converteu_clt ? `Sim — ${prazos.converte_clt_em ? new Date(prazos.converte_clt_em+'T12:00').toLocaleDateString('pt-BR') : ''}` : 'Não'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
              <span className="text-xs text-gray-500">Faltas registradas</span>
              {(faltasCount ?? 0) > 0 ? (
                <Link href={`/faltas?funcionario=${f.id}`} className="text-sm font-medium text-amber-700 hover:underline">
                  {faltasCount} falta{(faltasCount ?? 0) > 1 ? 's' : ''} registrada{(faltasCount ?? 0) > 1 ? 's' : ''} →
                </Link>
              ) : (
                <span className="text-sm font-medium text-gray-400">Nenhuma falta registrada</span>
              )}
            </div>
            {f.admissao && (
              <>
                <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
                  <span className="text-xs text-gray-500" title="Funcionário pode tirar férias após 12 meses de admissão (CLT)">
                    Pode tirar férias a partir de
                    <span className="ml-1 text-gray-300 cursor-help">ⓘ</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{proximoPeriodoFerias?.toLocaleDateString('pt-BR')}</span>
                    {podeFerias && !feriasAtrasada && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold">DISPONÍVEL</span>}
                  </div>
                </div>
                {feriasAtrasada && (
                  <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
                    <span className="text-xs text-gray-500" title="Período concessivo de 12 meses já expirou (admissão + 24 meses)">
                      Status férias
                      <span className="ml-1 text-gray-300 cursor-help">ⓘ</span>
                    </span>
                    <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-bold">EM ATRASO</span>
                  </div>
                )}
              </>
            )}
            <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
              <span className="text-xs text-gray-500">Saldo de férias</span>
              <span className="text-sm font-bold text-brand">{prazos.saldo_ferias ?? 0} dias</span>
            </div>
            {prazos.proximas_ferias_inicio && (
              <div className="flex justify-between items-center py-1.5 border-b border-gray-50 col-span-1 sm:col-span-2">
                <span className="text-xs text-gray-500">Proximas ferias</span>
                <span className="text-xs font-medium text-green-700">
                  {new Date(prazos.proximas_ferias_inicio+'T12:00').toLocaleDateString('pt-BR')} → {prazos.proximas_ferias_fim ? new Date(prazos.proximas_ferias_fim+'T12:00').toLocaleDateString('pt-BR') : '—'}
                  {prazos.proximas_ferias_status && <span className="ml-2 bg-green-100 text-green-700 px-1.5 py-0.5 rounded text-[10px]">{prazos.proximas_ferias_status}</span>}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Faltas e Atestados */}
      <div className="mt-5 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-brand font-display">Faltas e Atestados</h2>
          <Link href="/faltas/nova" className="text-xs text-brand hover:underline">+ Registrar</Link>
        </div>
        {faltas && faltas.length > 0 ? (
          <div className="space-y-2">
            {faltas.map((ft: any) => {
              const TIPO_BADGE: Record<string, string> = {
                falta_injustificada: 'bg-red-100 text-red-700',
                falta_justificada: 'bg-orange-100 text-orange-700',
                atestado_medico: 'bg-blue-100 text-blue-700',
                atestado_acidente: 'bg-blue-100 text-blue-700',
                licenca_maternidade: 'bg-green-100 text-green-700',
                licenca_paternidade: 'bg-green-100 text-green-700',
                folga_compensatoria: 'bg-gray-100 text-gray-600',
                feriado: 'bg-gray-100 text-gray-600',
                suspensao: 'bg-red-100 text-red-700',
                outro: 'bg-gray-100 text-gray-600',
              }
              const TIPO_LABEL: Record<string, string> = {
                falta_injustificada: 'FALTA', falta_justificada: 'JUST.',
                atestado_medico: 'ATESTADO', atestado_acidente: 'ACIDENTE',
                licenca_maternidade: 'LIC. MAT.', licenca_paternidade: 'LIC. PAT.',
                folga_compensatoria: 'FOLGA', feriado: 'FERIADO',
                suspensao: 'SUSPENSAO', outro: 'OUTRO',
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

      {/* Historico de Ponto (ultimos 30 dias) */}
      <div className="mt-5 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="text-sm font-bold text-brand font-display mb-4">Ponto — ultimos 30 dias</h2>
        {efetivo30 && efetivo30.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {efetivo30.map((e: any, i: number) => (
              <div key={i} className="w-8 h-8 rounded-lg bg-green-100 text-green-700 text-[10px] font-bold flex items-center justify-center" title={`${new Date(e.data+'T12:00').toLocaleDateString('pt-BR')} · ${e.obras?.nome}`}>
                {new Date(e.data+'T12:00').getDate()}
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-gray-400">Nenhum registro de ponto nos ultimos 30 dias.</p>}
        <p className="text-xs text-gray-400 mt-2">{efetivo30?.length ?? 0} dias presentes</p>
      </div>

      {/* Documentos */}
      <FuncionarioDocumentos funcionarioId={f.id} documentos={docsFunc ?? []} />

      {/* Histórico na Empresa */}
      <FuncionarioHistorico cpf={f.cpf} funcionarioAtualId={f.id} admissaoAtual={f.admissao} />

      {/* Advertencias e Termos */}
      <div className="mt-5 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-brand font-display">Advertencias e Termos</h2>
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
                advertencia: 'ADVERTENCIA',
                termo: 'TERMO',
                comunicado: 'COMUNICADO',
              }
              return (
                <div key={d.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${CAT_BADGE[cat] ?? 'bg-gray-100 text-gray-600'}`}>
                      {CAT_LABEL[cat] ?? (cat?.toUpperCase() || 'DOC')}
                    </span>
                    <span className="text-sm text-gray-700">{d.nome_modelo}</span>
                  </div>
                  <span className="text-xs text-gray-400">{new Date(d.created_at).toLocaleDateString('pt-BR')}</span>
                </div>
              )
            })}
          </div>
        ) : <p className="text-sm text-gray-400">Nenhuma advertencia ou termo registrado.</p>}
      </div>
    </div>
  )
}
