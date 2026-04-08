import { createClient } from '@/lib/supabase-server'
import { getRole } from '@/lib/get-role'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DesativarFuncionarioBtn } from '@/components/DeleteActions'
import BackButton from '@/components/BackButton'
import FuncionarioDocumentos from '@/components/FuncionarioDocumentos'
import FuncionarioHistorico from '@/components/FuncionarioHistorico'
import FuncionarioHistoricoSalarial from '@/components/FuncionarioHistoricoSalarial'
import FuncionarioTabs, { Tab, TAB_ICONS } from '@/components/FuncionarioTabs'

const STATUS_COLOR: Record<string, string> = {
  disponivel: 'bg-green-100 text-green-700 border-green-200',
  alocado: 'bg-blue-100 text-blue-700 border-blue-200',
  afastado: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  inativo: 'bg-gray-100 text-gray-500 border-gray-200',
}

const TIPO_VINCULO_LABEL: Record<string, string> = {
  experiencia_45_45: 'Experiência 45+45 dias',
  experiencia_30_60: 'Experiência 30+60 dias',
  experiencia_90: 'Experiência 90 dias',
  determinado_6m: 'Determinado 6 meses',
  determinado_12m: 'Determinado 12 meses',
  indeterminado: 'Indeterminado (CLT)',
  temporario: 'Temporário',
}

const FALTAS_TIPO_BADGE: Record<string, string> = {
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

const FALTAS_TIPO_LABEL: Record<string, string> = {
  falta_injustificada: 'FALTA', falta_justificada: 'JUST.',
  atestado_medico: 'ATESTADO', atestado_acidente: 'ACIDENTE',
  licenca_maternidade: 'LIC. MAT.', licenca_paternidade: 'LIC. PAT.',
  folga_compensatoria: 'FOLGA', feriado: 'FERIADO',
  suspensao: 'SUSPENSAO', outro: 'OUTRO',
}

export default async function FuncionarioPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: f } = await supabase.from('funcionarios').select('*').eq('id', params.id).single()
  if (!f) notFound()
  const isArquivado = f.deleted_at !== null
  const role = await getRole()
  const hoje = new Date()
  const trintaDiasAtras = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]

  const [
    { data: alocacoes }, { data: faltas }, { data: docsFunc }, { data: efetivo30 },
    { data: docsGerados }, { data: prazosArr }, { data: admissaoArr }, { data: desligamentoArr },
    { count: faltasCount }, { count: docsCount }, { data: rescisao },
  ] = await Promise.all([
    supabase.from('alocacoes').select('*, obras(nome, status)').eq('funcionario_id', params.id).order('data_inicio', { ascending: false }),
    supabase.from('faltas').select('*').eq('funcionario_id', params.id).order('data', { ascending: false }).limit(20),
    supabase.from('documentos').select('*').eq('funcionario_id', params.id).is('deleted_at', null).order('vencimento'),
    supabase.from('efetivo_diario').select('data,tipo_dia,obras(nome)').eq('funcionario_id', params.id).gte('data', trintaDiasAtras).order('data', { ascending: false }),
    supabase.from('documentos_gerados').select('*').eq('funcionario_id', params.id).order('created_at', { ascending: false }),
    supabase.from('vw_prazos_legais').select('*').eq('funcionario_id', params.id).limit(1),
    supabase.from('admissoes_workflow').select('id, status, concluida_em, created_at').eq('funcionario_id', params.id).order('created_at', { ascending: false }).limit(1),
    supabase.from('desligamentos_workflow').select('id, status, concluido_em, created_at').eq('funcionario_id', params.id).eq('status', 'em_andamento').order('created_at', { ascending: false }).limit(1),
    supabase.from('faltas').select('id', { count: 'exact', head: true }).eq('funcionario_id', params.id).in('tipo', ['falta_injustificada','falta_justificada']),
    supabase.from('documentos').select('id', { count: 'exact', head: true }).eq('funcionario_id', params.id).is('deleted_at', null),
    supabase.from('rescisoes').select('id, status, valor_liquido').eq('funcionario_id', params.id).is('deleted_at', null).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  const prazos = prazosArr?.[0] ?? null
  const admissao = admissaoArr?.[0] ?? null
  const desligamento = desligamentoArr?.[0] ?? null

  function prazoBadge(date: string | null) {
    if (!date) return null
    const dias = Math.ceil((new Date(date+'T12:00').getTime() - hoje.getTime()) / 86400000)
    if (dias < 0) return { label: 'Vencido', cls: 'bg-red-100 text-red-700' }
    if (dias < 15) return { label: `Vence em ${dias}d`, cls: 'bg-amber-100 text-amber-700' }
    return { label: 'Vigente', cls: 'bg-green-100 text-green-700' }
  }

  const fmtR = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const fmtD = (d: string | null | undefined) => d ? new Date(d + 'T12:00').toLocaleDateString('pt-BR') : '—'

  // Férias CLT
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

  // Remuneração
  const salarioBase = Number(f.salario_base ?? 0)
  const insalPct = Number(f.insalubridade_pct ?? 0)
  const pericPct = Number(f.periculosidade_pct ?? 0)
  const insalVal = salarioBase * insalPct / 100
  const pericVal = salarioBase * pericPct / 100
  const salarioBruto = salarioBase + insalVal + pericVal
  const vtMensal = Number(f.vt_mensal ?? 0)
  const vrDiario = Number(f.vr_diario ?? 0)
  const vrMensal = vrDiario * 21
  const vaMensal = Number(f.va_mensal ?? 0)
  const planoSaude = Number(f.plano_saude_mensal ?? 0)
  const outros = Number(f.outros_beneficios ?? 0)
  const totalBeneficios = vtMensal + vrMensal + vaMensal + planoSaude + outros

  const prazo1Badge = prazoBadge(f.prazo1)
  const prazo2Badge = prazoBadge(f.prazo2)
  const alocacaoAtiva = alocacoes?.find((a: any) => a.ativo)
  const diasTrabalhados30 = efetivo30?.length ?? 0
  const iniciais = (f.nome_guerra || f.nome).split(' ').slice(0, 2).map((p: string) => p[0]).join('').toUpperCase()

  // ========= TABS =========
  const tabVisaoGeral: Tab = {
    id: 'visao', label: 'Visão geral', icon: TAB_ICONS.visao,
    content: (
      <div className="space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Dados pessoais</h2>
            <dl className="space-y-2 text-sm">
              {[
                ['Matrícula', f.matricula],
                ['ID Ponto', f.id_ponto],
                ['CPF', f.cpf],
                ['RG', f.re],
                ['PIS', f.pis],
                ['Título Eleitor', f.titulo_eleitor],
                ['Data nascimento', f.data_nascimento ? fmtD(f.data_nascimento) : null],
                ['Naturalidade', f.naturalidade],
                ['Estado civil', f.estado_civil],
                ['Raça/Cor', f.raca_cor],
                ['Nome do pai', f.nome_pai],
                ['Nome da mãe', f.nome_mae],
              ].filter(([, v]) => v).map(([k, v]) => (
                <div key={k as string} className="flex justify-between gap-2 py-1 border-b border-gray-50 last:border-0">
                  <dt className="text-[11px] text-gray-500">{k}</dt>
                  <dd className="text-xs font-medium text-gray-800 text-right">{v as string}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Contato & banco</h2>
            <dl className="space-y-2 text-sm">
              {[
                ['Telefone', f.telefone],
                ['Endereço', f.endereco],
                ['Cidade', f.cidade_endereco],
                ['CEP', f.cep],
                ['Banco', f.banco],
                ['Agência/Conta', f.agencia_conta],
                ['PIX', f.pix],
                ['VT Estrutura', f.vt_estrutura],
              ].filter(([, v]) => v).map(([k, v]) => (
                <div key={k as string} className="flex justify-between gap-2 py-1 border-b border-gray-50 last:border-0">
                  <dt className="text-[11px] text-gray-500">{k}</dt>
                  <dd className="text-xs font-medium text-gray-800 text-right">{v as string}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {/* Alocações */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Obras e alocações</h2>
          {alocacoes && alocacoes.length > 0 ? (
            <div className="space-y-2">
              {alocacoes.map((a: any) => (
                <div key={a.id} className={`flex items-center justify-between p-3 rounded-lg border ${a.ativo ? 'border-green-200 bg-green-50/50' : 'border-gray-100 bg-gray-50/50'}`}>
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{a.obras?.nome}</div>
                    <div className="text-xs text-gray-500">{a.cargo_na_obra}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-gray-500">{fmtD(a.data_inicio)} {a.data_fim && `→ ${fmtD(a.data_fim)}`}</div>
                    {a.ativo ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-bold">ATIVO</span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-bold">ENCERRADO</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-xs text-gray-400 italic">Nenhuma alocação registrada.</p>}
        </div>
      </div>
    ),
  }

  const tabContrato: Tab = {
    id: 'contrato', label: 'Contrato', icon: TAB_ICONS.contrato,
    content: (
      <div className="space-y-5">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Contrato e vínculo</h2>
            <Link href={`/funcionarios/${f.id}/editar`} className="text-[11px] text-brand hover:underline">Editar</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            {[
              ['Tipo de vínculo', f.tipo_vinculo ? (TIPO_VINCULO_LABEL[f.tipo_vinculo] ?? f.tipo_vinculo) : '—'],
              ['Data de admissão', fmtD(f.admissao)],
              ['Cargo', f.cargo],
              ['Turno', f.turno],
              ['Jornada', `${f.horas_mes ?? 220}h/mês`],
              ['Status', <span key="s" className={`text-[11px] px-2 py-0.5 rounded-full font-bold border ${STATUS_COLOR[f.status] ?? 'bg-gray-100'}`}>{f.status}</span>],
            ].map(([k, v], i) => (
              <div key={i} className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-[11px] text-gray-500">{k}</span>
                <span className="text-xs font-medium text-gray-800">{v}</span>
              </div>
            ))}
            {f.prazo1 && (
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-[11px] text-gray-500">1º período exp.</span>
                <span className="text-xs font-medium flex items-center gap-1.5">
                  {fmtD(f.prazo1)}
                  {prazo1Badge && <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${prazo1Badge.cls}`}>{prazo1Badge.label}</span>}
                </span>
              </div>
            )}
            {f.prazo2 && (
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-[11px] text-gray-500">2º período exp.</span>
                <span className="text-xs font-medium flex items-center gap-1.5">
                  {fmtD(f.prazo2)}
                  {prazo2Badge && <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${prazo2Badge.cls}`}>{prazo2Badge.label}</span>}
                </span>
              </div>
            )}
            <div className="flex justify-between py-1 border-b border-gray-50">
              <span className="text-[11px] text-gray-500">Renovação</span>
              <span className={`text-xs font-medium ${f.nao_renovar ? 'text-red-700' : 'text-gray-800'}`}>
                {f.nao_renovar ? '⚠ NÃO RENOVAR' : 'Permitida'}
              </span>
            </div>
          </div>
          {f.nao_renovar && f.observacao_renovacao && (
            <p className="text-[11px] text-red-600 mt-3 p-2 bg-red-50 rounded-lg">Motivo: {f.observacao_renovacao}</p>
          )}
        </div>

        {/* Prazos legais & férias */}
        {prazos && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Prazos legais & férias</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              {f.admissao && (
                <>
                  <div className="flex justify-between py-1 border-b border-gray-50">
                    <span className="text-[11px] text-gray-500">Pode tirar férias</span>
                    <span className="text-xs font-medium flex items-center gap-2">
                      {proximoPeriodoFerias?.toLocaleDateString('pt-BR')}
                      {podeFerias && !feriasAtrasada && <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold">DISPONÍVEL</span>}
                      {feriasAtrasada && <span className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-bold">EM ATRASO</span>}
                    </span>
                  </div>
                </>
              )}
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-[11px] text-gray-500">Saldo de férias</span>
                <span className="text-xs font-bold text-brand">{prazos.saldo_ferias ?? 0} dias</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-[11px] text-gray-500">Converteu p/ CLT</span>
                <span className={`text-xs font-medium ${prazos.ja_converteu_clt ? 'text-green-700' : 'text-gray-400'}`}>
                  {prazos.ja_converteu_clt ? 'Sim' : 'Não'}
                </span>
              </div>
              {prazos.proximas_ferias_inicio && (
                <div className="flex justify-between py-1 border-b border-gray-50 sm:col-span-2">
                  <span className="text-[11px] text-gray-500">Próximas férias</span>
                  <span className="text-xs font-medium text-green-700">
                    {fmtD(prazos.proximas_ferias_inicio)} → {fmtD(prazos.proximas_ferias_fim)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    ),
  }

  const tabRemuneracao: Tab = {
    id: 'remuneracao', label: 'Remuneração', icon: TAB_ICONS.remuneracao,
    content: (
      <div className="space-y-5">
        {salarioBase > 0 || totalBeneficios > 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Salário e benefícios</h2>
              <Link href={`/funcionarios/${f.id}/editar`} className="text-[11px] text-brand hover:underline">Editar</Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-[11px] text-gray-500">Salário base</span>
                <span className="text-sm font-bold text-gray-900">{fmtR(salarioBase)}</span>
              </div>
              {insalPct > 0 && (
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-[11px] text-gray-500">Insalubridade ({insalPct}%)</span>
                  <span className="text-xs font-medium text-gray-800">{fmtR(insalVal)}</span>
                </div>
              )}
              {pericPct > 0 && (
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-[11px] text-gray-500">Periculosidade ({pericPct}%)</span>
                  <span className="text-xs font-medium text-gray-800">{fmtR(pericVal)}</span>
                </div>
              )}
              <div className="sm:col-span-2 flex justify-between py-2 bg-blue-50 px-3 rounded-lg">
                <span className="text-[11px] font-bold text-blue-700 uppercase">Salário bruto</span>
                <span className="text-sm font-bold text-blue-700">{fmtR(salarioBruto)}</span>
              </div>
              {totalBeneficios > 0 && (
                <>
                  {vtMensal > 0 && <div className="flex justify-between py-1 border-b border-gray-50"><span className="text-[11px] text-gray-500">VT</span><span className="text-xs font-medium">{fmtR(vtMensal)}</span></div>}
                  {vrDiario > 0 && <div className="flex justify-between py-1 border-b border-gray-50"><span className="text-[11px] text-gray-500">VR ({fmtR(vrDiario)}×21)</span><span className="text-xs font-medium">{fmtR(vrMensal)}</span></div>}
                  {vaMensal > 0 && <div className="flex justify-between py-1 border-b border-gray-50"><span className="text-[11px] text-gray-500">VA</span><span className="text-xs font-medium">{fmtR(vaMensal)}</span></div>}
                  {planoSaude > 0 && <div className="flex justify-between py-1 border-b border-gray-50"><span className="text-[11px] text-gray-500">Plano saúde</span><span className="text-xs font-medium">{fmtR(planoSaude)}</span></div>}
                  {outros > 0 && <div className="flex justify-between py-1 border-b border-gray-50"><span className="text-[11px] text-gray-500">Outros</span><span className="text-xs font-medium">{fmtR(outros)}</span></div>}
                  <div className="sm:col-span-2 flex justify-between py-2 bg-purple-50 px-3 rounded-lg">
                    <span className="text-[11px] font-bold text-purple-700 uppercase">Total benefícios</span>
                    <span className="text-sm font-bold text-purple-700">{fmtR(totalBeneficios)}</span>
                  </div>
                </>
              )}
              <div className="sm:col-span-2 flex justify-between pt-3 border-t-2 border-brand/20">
                <span className="text-xs font-bold uppercase text-gray-600">Custo líquido (sem encargos)</span>
                <span className="text-base font-black text-brand">{fmtR(salarioBruto + totalBeneficios)}</span>
              </div>
            </div>
            <p className="text-[10px] text-gray-400 mt-2">Não inclui encargos patronais (INSS 20%, FGTS 8%, RAT, Sistema S) e provisões (13º, férias, FGTS). Custo completo com encargos: ver Margem DRE.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 p-6 text-center">
            <p className="text-sm text-gray-400 mb-2">Salário e benefícios não cadastrados.</p>
            <Link href={`/funcionarios/${f.id}/editar`} className="text-xs text-brand hover:underline font-semibold">+ Preencher agora</Link>
          </div>
        )}

        {/* Histórico salarial */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Histórico salarial</h2>
            <Link href="/rh/correcoes" className="text-[11px] text-brand hover:underline">Correções coletivas →</Link>
          </div>
          <FuncionarioHistoricoSalarial funcionarioId={f.id} />
        </div>
      </div>
    ),
  }

  const tabPonto: Tab = {
    id: 'ponto', label: 'Ponto & faltas', icon: TAB_ICONS.ponto,
    badge: (faltasCount ?? 0) > 0 ? faltasCount! : undefined,
    content: (
      <div className="space-y-5">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Ponto — últimos 30 dias</h2>
            <span className="text-[11px] text-gray-500">{diasTrabalhados30} dias presentes</span>
          </div>
          {efetivo30 && efetivo30.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {efetivo30.map((e: any, i: number) => (
                <div key={i} className="w-9 h-9 rounded-lg bg-green-100 text-green-700 text-[11px] font-bold flex items-center justify-center"
                  title={`${fmtD(e.data)} · ${e.obras?.nome || ''}`}>
                  {new Date(e.data + 'T12:00').getDate()}
                </div>
              ))}
            </div>
          ) : <p className="text-xs text-gray-400 italic">Nenhum registro.</p>}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Faltas e atestados</h2>
            <Link href="/faltas/nova" className="text-[11px] text-brand hover:underline">+ Registrar</Link>
          </div>
          {faltas && faltas.length > 0 ? (
            <div className="space-y-1">
              {faltas.map((ft: any) => (
                <div key={ft.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${FALTAS_TIPO_BADGE[ft.tipo] ?? 'bg-gray-100 text-gray-600'}`}>
                      {FALTAS_TIPO_LABEL[ft.tipo] ?? ft.tipo}
                    </span>
                    <span className="text-xs text-gray-500">{fmtD(ft.data)}</span>
                  </div>
                  <span className="text-xs text-gray-400 truncate max-w-[250px]">{ft.observacao || ''}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-xs text-gray-400 italic">Nenhuma falta ou atestado.</p>}
        </div>
      </div>
    ),
  }

  const tabDocs: Tab = {
    id: 'docs', label: 'Documentos', icon: TAB_ICONS.docs,
    badge: (docsCount ?? 0) > 0 ? docsCount! : undefined,
    content: (
      <div className="space-y-5">
        <FuncionarioDocumentos funcionarioId={f.id} documentos={docsFunc ?? []} />

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Advertências & termos</h2>
            <Link href="/documentos/gerar" className="text-[11px] text-brand hover:underline">Gerar novo</Link>
          </div>
          {docsGerados && docsGerados.length > 0 ? (
            <div className="space-y-1">
              {docsGerados.map((d: any) => {
                const cat = d.dados_preenchidos?.categoria ?? ''
                const CAT_BADGE: Record<string, string> = {
                  advertencia: 'bg-red-100 text-red-700',
                  termo: 'bg-blue-100 text-blue-700',
                  comunicado: 'bg-purple-100 text-purple-700',
                }
                return (
                  <div key={d.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${CAT_BADGE[cat] ?? 'bg-gray-100 text-gray-600'}`}>
                        {cat?.toUpperCase() || 'DOC'}
                      </span>
                      <span className="text-xs text-gray-700">{d.nome_modelo}</span>
                    </div>
                    <span className="text-[11px] text-gray-400">{new Date(d.created_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                )
              })}
            </div>
          ) : <p className="text-xs text-gray-400 italic">Nenhuma advertência ou termo.</p>}
        </div>
      </div>
    ),
  }

  const tabHistorico: Tab = {
    id: 'historico', label: 'Histórico', icon: TAB_ICONS.historico,
    content: (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Histórico na empresa</h2>
        <FuncionarioHistorico cpf={f.cpf} funcionarioAtualId={f.id} admissaoAtual={f.admissao} />
      </div>
    ),
  }

  const tabs: Tab[] = [tabVisaoGeral, tabContrato, tabRemuneracao, tabPonto, tabDocs, tabHistorico]

  // ========= LAYOUT =========
  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-4 text-sm">
        <BackButton fallback="/funcionarios" />
        <Link href="/funcionarios" className="text-gray-400 hover:text-gray-600">Funcionários</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700 truncate max-w-xs">{f.nome_guerra || f.nome}</span>
      </div>

      {/* Hero header card */}
      <div className="bg-gradient-to-br from-white to-brand/5 rounded-2xl shadow-sm border border-gray-100 p-5 mb-5">
        <div className="flex items-start gap-4 flex-wrap">
          {/* Avatar */}
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-brand text-white text-xl sm:text-2xl font-bold flex items-center justify-center flex-shrink-0 shadow-md">
            {iniciais}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold font-display text-gray-900 truncate">{f.nome_guerra || f.nome}</h1>
            {f.nome_guerra && <p className="text-xs text-gray-500 truncate">({f.nome})</p>}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-sm text-gray-700 font-medium">{f.cargo || '—'}</span>
              <span className="text-gray-300">·</span>
              <span className="text-xs text-gray-500">Matrícula {f.matricula || '—'}</span>
              <span className="text-gray-300">·</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${STATUS_COLOR[f.status] ?? 'bg-gray-100'}`}>
                {(f.status || '').toUpperCase()}
              </span>
              {alocacaoAtiva && (
                <Link href={`/obras/${alocacaoAtiva.obra_id}`} className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-100 text-blue-700 hover:bg-blue-200">
                  {alocacaoAtiva.obras?.nome}
                </Link>
              )}
              {f.nao_renovar && <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-700">⚠ NÃO RENOVAR</span>}
              {isArquivado && <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-gray-100 text-gray-500">📁 ARQUIVADO</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/funcionarios/${f.id}/editar`}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold hover:bg-gray-50">
              Editar
            </Link>
            {f.status !== 'inativo' && !desligamento && (
              <Link href={`/rh/desligamentos/novo?funcionario_id=${f.id}`}
                className="px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-50">
                Iniciar desligamento
              </Link>
            )}
            {f.status !== 'inativo' && <DesativarFuncionarioBtn funcId={f.id} role={role} />}
          </div>
        </div>

        {/* Quick stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-gray-100">
          <div>
            <div className="text-[10px] text-gray-400 uppercase font-bold">Admissão</div>
            <div className="text-sm font-bold text-gray-900">{fmtD(f.admissao)}</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-400 uppercase font-bold">Salário</div>
            <div className="text-sm font-bold text-gray-900">{salarioBase > 0 ? fmtR(salarioBase) : '—'}</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-400 uppercase font-bold">Dias (30d)</div>
            <div className="text-sm font-bold text-gray-900">{diasTrabalhados30}</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-400 uppercase font-bold">Faltas total</div>
            <div className={`text-sm font-bold ${(faltasCount ?? 0) > 5 ? 'text-red-700' : 'text-gray-900'}`}>{faltasCount ?? 0}</div>
          </div>
        </div>
      </div>

      {/* Banners / alerts */}
      {!admissao && f.status !== 'inativo' && (
        <div className="mb-4 p-3 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-between gap-3">
          <div className="text-sm">
            <strong className="text-blue-800">Sem processo de admissão</strong>
            <span className="text-blue-600 text-xs ml-2">Inicie o checklist de admissão.</span>
          </div>
          <Link href={`/rh/admissoes/novo?funcionario_id=${f.id}`}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 flex-shrink-0">
            Iniciar
          </Link>
        </div>
      )}
      {admissao?.status === 'em_andamento' && (
        <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-sm font-semibold text-amber-800">Admissão em andamento</span>
          </div>
          <Link href="/rh/admissoes" className="text-xs text-amber-700 font-semibold hover:underline">Continuar</Link>
        </div>
      )}
      {desligamento && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm font-semibold text-red-800">Desligamento em andamento</span>
          </div>
          <Link href="/rh/desligamentos" className="text-xs text-red-700 font-semibold hover:underline">Continuar</Link>
        </div>
      )}
      {rescisao && (
        <div className="mb-4 p-3 rounded-xl bg-violet-50 border border-violet-200 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-violet-800">Rescisão {rescisao.status}</span>
              <span className="text-xs text-violet-600">líquido: {fmtR(Number(rescisao.valor_liquido || 0))}</span>
            </div>
          </div>
          <Link href={`/rh/rescisoes/${rescisao.id}`} className="text-xs text-violet-700 font-semibold hover:underline">Abrir rescisão →</Link>
        </div>
      )}
      {isArquivado && (
        <div className="mb-4 p-3 bg-gray-100 border border-gray-300 rounded-xl text-sm text-gray-700">
          📁 Vínculo arquivado — desligado em {fmtD(f.deleted_at)}
          {f.motivo_saida && <span className="block text-xs mt-1">Motivo: <strong>{f.motivo_saida}</strong></span>}
        </div>
      )}

      {/* Tabs */}
      <FuncionarioTabs tabs={tabs} />
    </div>
  )
}
