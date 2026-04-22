import { createClient } from '@/lib/supabase-server'
import { getRole } from '@/lib/get-role'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DesativarFuncionarioBtn } from '@/components/DeleteActions'
import BackButton from '@/components/BackButton'
import FuncionarioDocumentos from '@/components/FuncionarioDocumentos'
import FuncionarioTabs, { Tab } from '@/components/FuncionarioTabs'
import PromocaoButton from '@/components/PromocaoButton'
import { User, Briefcase, DollarSign, Clock, FileText, History } from 'lucide-react'
import AdmissaoStepPanel from '@/components/AdmissaoStepPanel'
import AdmissaoBannerWrapper from '@/components/AdmissaoBannerWrapper'
import DecisaoRenovacaoCard from '@/components/rh/DecisaoRenovacaoCard'
import AdmissaoDrawerTrigger from '@/components/admissao/AdmissaoDrawerTrigger'
import { ADMISSAO_STEPS_FIELDS } from '@/lib/admissao-steps-config'

import TabVisaoGeral from './tabs/TabVisaoGeral'
import TabContrato from './tabs/TabContrato'
import TabRemuneracao from './tabs/TabRemuneracao'
import TabHolerites from './tabs/TabHolerites'
import TabPonto from './tabs/TabPonto'

const TAB_ICONS = {
  visao: <User className="w-3.5 h-3.5" />,
  contrato: <Briefcase className="w-3.5 h-3.5" />,
  remuneracao: <DollarSign className="w-3.5 h-3.5" />,
  ponto: <Clock className="w-3.5 h-3.5" />,
  docs: <FileText className="w-3.5 h-3.5" />,
  historico: <History className="w-3.5 h-3.5" />,
}

const STATUS_COLOR: Record<string, string> = {
  pendente: 'bg-amber-100 text-amber-700 border-amber-200',
  em_admissao: 'bg-violet-100 text-violet-700 border-violet-200',
  disponivel: 'bg-green-100 text-green-700 border-green-200',
  alocado: 'bg-blue-100 text-blue-700 border-blue-200',
  afastado: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  inativo: 'bg-gray-100 text-gray-500 border-gray-200',
}

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Aguardando admissão',
  em_admissao: 'Em admissão',
  disponivel: 'Disponível',
  alocado: 'Alocado',
  afastado: 'Afastado',
  inativo: 'Inativo',
}

export default async function FuncionarioPage({ params, searchParams }: { params: { id: string }, searchParams: { from?: string, workflow_id?: string, step?: string } }) {
  const supabase = createClient()
  const { data: f } = await supabase.from('funcionarios').select('*, centros_custo(id, codigo, nome, tipo)').eq('id', params.id).single()
  if (!f) notFound()
  const isArquivado = f.deleted_at !== null
  const role = await getRole()
  const hoje = new Date()
  const trintaDiasAtras = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]

  const [
    { data: alocacoes }, { data: faltas }, { data: docsFunc }, { data: efetivo30 },
    { data: docsGerados }, { data: prazosArr }, { data: admissaoArr }, { data: desligamentoArr },
    { count: faltasCount }, { count: docsCount }, { data: rescisao },
    { data: vinculosHistorico }, { data: arquivadosHistorico },
    { data: holeriteItens }, { data: holeriteAssinaturas }, { data: holeriteEnvios },
    { data: overrideAtivo },
  ] = await Promise.all([
    supabase.from('alocacoes').select('*, obras!inner(nome, status, deleted_at)').eq('funcionario_id', params.id).is('obras.deleted_at', null).order('data_inicio', { ascending: false }),
    supabase.from('faltas').select('*').eq('funcionario_id', params.id).order('data', { ascending: false }).limit(20),
    supabase.from('documentos').select('*').eq('funcionario_id', params.id).is('deleted_at', null).order('vencimento'),
    supabase.from('efetivo_diario').select('data,tipo_dia,obras(nome)').eq('funcionario_id', params.id).gte('data', trintaDiasAtras).order('data', { ascending: false }),
    supabase.from('documentos_gerados').select('*').eq('funcionario_id', params.id).order('created_at', { ascending: false }),
    supabase.from('vw_prazos_legais').select('*').eq('funcionario_id', params.id).limit(1),
    supabase.from('admissoes_workflow').select('*').eq('funcionario_id', params.id).order('created_at', { ascending: false }).limit(1),
    supabase.from('desligamentos_workflow').select('id, status, concluido_em, created_at').eq('funcionario_id', params.id).eq('status', 'em_andamento').order('created_at', { ascending: false }).limit(1),
    supabase.from('faltas').select('id', { count: 'exact', head: true }).eq('funcionario_id', params.id).in('tipo', ['falta_injustificada','falta_justificada']),
    supabase.from('documentos').select('id', { count: 'exact', head: true }).eq('funcionario_id', params.id).is('deleted_at', null),
    supabase.from('rescisoes').select('id, status, valor_liquido').eq('funcionario_id', params.id).is('deleted_at', null).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    // Histórico de vínculos pelo CPF
    f.cpf
      ? supabase.from('vinculos_funcionario').select('*').eq('cpf', f.cpf).order('admissao', { ascending: false })
      : Promise.resolve({ data: [] }),
    f.cpf
      ? supabase.from('funcionarios').select('id, nome, cargo, admissao, deleted_at, matricula, id_ponto').eq('cpf', f.cpf).not('deleted_at', 'is', null).order('admissao', { ascending: false })
      : Promise.resolve({ data: [] }),
    // Holerites do funcionário
    supabase.from('folha_itens').select('id, folha_id, salario_base, valor_bruto, valor_liquido, dias_trabalhados, dias_descontados, desconto_inss, desconto_irrf, outros_descontos, created_at, folha_fechamentos(ano, mes, obras(nome))').eq('funcionario_id', params.id).order('created_at', { ascending: false }).limit(24),
    supabase.from('holerite_assinaturas').select('folha_item_id, status, assinado_em').eq('funcionario_id', params.id),
    supabase.from('holerite_envios').select('folha_item_id, enviado_em').eq('funcionario_id', params.id).eq('status', 'enviado'),
    supabase.from('admissao_overrides').select('*').eq('funcionario_id', params.id).eq('regularizado', false).maybeSingle(),
  ])
  const [
    { data: funcoes },
    { data: historicoSalarial },
    { data: historicoFuncional },
  ] = await Promise.all([
    supabase.from('funcoes').select('id, nome, salario_base, horas_mes, insalubridade_pct').eq('ativo', true),
    supabase.from('funcionario_historico_salarial').select('*').eq('funcionario_id', params.id).order('data_efetivo', { ascending: false }),
    supabase.from('historico_funcional').select('*').eq('funcionario_id', params.id).order('data_vigencia', { ascending: false }),
  ])

  const prazos = prazosArr?.[0] ?? null
  const admissao = admissaoArr?.[0] ?? null
  const desligamento = desligamentoArr?.[0] ?? null

  // Processar holerites
  const holerites = (holeriteItens ?? []) as any[]
  const sigMap = new Map((holeriteAssinaturas ?? []).map((s: any) => [s.folha_item_id, s]))
  const envMap = new Map((holeriteEnvios ?? []).map((s: any) => [s.folha_item_id, s]))
  const ultimoHolerite: any = holerites[0] ?? null
  const holeriteAssinados = holerites.filter((h: any) => sigMap.has(h.id)).length

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
  const alocacoesAtivas = (alocacoes ?? []).filter((a: any) => a.ativo)
  const alocacaoAtiva = alocacoesAtivas[0]
  const diasTrabalhados30 = efetivo30?.length ?? 0
  const iniciais = (f.nome_guerra || f.nome).split(' ').slice(0, 2).map((p: string) => p[0]).join('').toUpperCase()

  // Histórico de vínculos
  const vinculosAnteriores = (vinculosHistorico ?? []) as any[]
  const arquivadosAnteriores = (arquivadosHistorico ?? []) as any[]
  const totalVinculos = vinculosAnteriores.length + arquivadosAnteriores.length

  // ========= ADMISSAO CONTEXT =========
  const isAdmissaoFlow = searchParams.from === 'admissao' && searchParams.workflow_id
  const admissaoStep = searchParams.step || 'docs_pessoais'
  const admissaoStepConfig = isAdmissaoFlow ? ADMISSAO_STEPS_FIELDS[admissaoStep] : null

  // ========= TABS =========
  const tabVisaoGeral: Tab = {
    id: 'visao', label: 'Visão geral', icon: TAB_ICONS.visao,
    content: <TabVisaoGeral f={f} alocacoes={alocacoes} fmtD={fmtD} />,
  }

  const tabContrato: Tab = {
    id: 'contrato', label: 'Contrato', icon: TAB_ICONS.contrato,
    content: (
      <TabContrato
        f={f} prazos={prazos} prazo1Badge={prazo1Badge} prazo2Badge={prazo2Badge}
        podeFerias={podeFerias} feriasAtrasada={feriasAtrasada}
        proximoPeriodoFerias={proximoPeriodoFerias} fmtD={fmtD}
      />
    ),
  }

  const tabRemuneracao: Tab = {
    id: 'remuneracao', label: 'Remuneração', icon: TAB_ICONS.remuneracao,
    content: (
      <TabRemuneracao
        f={f} salarioBase={salarioBase} insalPct={insalPct} insalVal={insalVal}
        pericPct={pericPct} pericVal={pericVal} salarioBruto={salarioBruto}
        vtMensal={vtMensal} vrDiario={vrDiario} vrMensal={vrMensal}
        vaMensal={vaMensal} planoSaude={planoSaude} outros={outros}
        totalBeneficios={totalBeneficios} ultimoHolerite={ultimoHolerite}
        holerites={holerites} holeriteAssinados={holeriteAssinados}
        sigMap={sigMap} envMap={envMap} historicoSalarial={historicoSalarial}
        alocacaoAtiva={alocacaoAtiva} fmtR={fmtR} fmtD={fmtD}
      />
    ),
  }

  const tabHolerites: Tab = {
    id: 'holerites', label: 'Holerites', icon: <FileText className="w-3.5 h-3.5" />,
    badge: holerites.length > 0 ? holerites.length : undefined,
    content: (
      <TabHolerites
        funcionarioId={f.id} holerites={holerites} holeriteAssinados={holeriteAssinados}
        ultimoHolerite={ultimoHolerite} sigMap={sigMap} envMap={envMap} fmtR={fmtR}
      />
    ),
  }

  const tabPonto: Tab = {
    id: 'ponto', label: 'Ponto & faltas', icon: TAB_ICONS.ponto,
    badge: (faltasCount ?? 0) > 0 ? faltasCount! : undefined,
    content: <TabPonto efetivo30={efetivo30} faltas={faltas} diasTrabalhados30={diasTrabalhados30} fmtD={fmtD} />,
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

  const TIPO_HISTORICO_LABEL: Record<string, string> = {
    admissao: 'Admissão', promocao: 'Promoção', transferencia: 'Transferência',
    reajuste_salarial: 'Reajuste salarial', mudanca_turno: 'Mudança de turno', mudanca_obra: 'Mudança de obra',
  }
  const TIPO_HISTORICO_COR: Record<string, string> = {
    admissao: 'bg-green-100 text-green-700', promocao: 'bg-blue-100 text-blue-700',
    transferencia: 'bg-purple-100 text-purple-700', reajuste_salarial: 'bg-amber-100 text-amber-700',
    mudanca_turno: 'bg-gray-100 text-gray-600', mudanca_obra: 'bg-indigo-100 text-indigo-700',
  }

  const tabHistorico: Tab = {
    id: 'historico', label: 'Histórico', icon: TAB_ICONS.historico,
    badge: (historicoFuncional ?? []).length > 0 ? (historicoFuncional as any[]).length : undefined,
    content: (
      <div className="space-y-5">
      {/* Histórico funcional (promoções, mudanças) */}
      {(historicoFuncional as any[] ?? []).length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Histórico funcional</h2>
          <div className="space-y-2">
            {(historicoFuncional as any[]).map((h: any) => (
              <div key={h.id} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50/50">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0 mt-0.5 ${TIPO_HISTORICO_COR[h.tipo] ?? 'bg-gray-100 text-gray-600'}`}>
                  {TIPO_HISTORICO_LABEL[h.tipo] ?? h.tipo}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700">
                      {h.cargo_anterior && h.cargo_novo ? `${h.cargo_anterior} → ${h.cargo_novo}` : h.cargo_novo || h.tipo}
                    </span>
                    <span className="text-[11px] text-gray-400">{fmtD(h.data_vigencia)}</span>
                  </div>
                  {(h.salario_anterior || h.salario_novo) && (
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {h.salario_anterior ? `${fmtR(Number(h.salario_anterior))} → ` : ''}
                      {h.salario_novo ? fmtR(Number(h.salario_novo)) : ''}
                    </p>
                  )}
                  {h.motivo && <p className="text-[11px] text-gray-400 mt-0.5">{h.motivo}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vínculos */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Histórico na empresa</h2>
          {totalVinculos > 0 && <span className="text-[11px] text-gray-400">{totalVinculos + 1} vínculos</span>}
        </div>
        {totalVinculos === 0 ? (
          <p className="text-xs text-gray-400 italic">Primeiro vínculo com a empresa.</p>
        ) : (
          <div className="space-y-2">
            <div className="p-3 rounded-lg border border-green-200 bg-green-50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-gray-600">
                  Vínculo atual <span className="ml-1 text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">ATUAL</span>
                </span>
                <div className="flex items-center gap-2 text-[10px] text-gray-500">
                  {f.id_ponto && <span>ID: {f.id_ponto}</span>}
                  {f.matricula && <span>Mat: {f.matricula}</span>}
                </div>
              </div>
              <div className="text-xs text-gray-500">
                {f.admissao ? new Date(f.admissao + 'T12:00').toLocaleDateString('pt-BR') : '—'} → Em andamento
                {f.cargo && <span className="ml-2 text-gray-400">· {f.cargo}</span>}
              </div>
            </div>
            {arquivadosAnteriores.map((a: any) => (
              <Link key={a.id} href={`/funcionarios/${a.id}?arquivado=1`} className="block hover:opacity-80">
                <div className="p-3 rounded-lg border border-gray-200 bg-gray-50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-gray-600">Vínculo arquivado</span>
                    <div className="flex items-center gap-2 text-[10px] text-gray-500">
                      {a.id_ponto && <span>ID: {a.id_ponto}</span>}
                      {a.matricula && <span>Mat: {a.matricula}</span>}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {a.admissao ? new Date(a.admissao + 'T12:00').toLocaleDateString('pt-BR') : '—'}
                    {' → '}
                    {a.deleted_at ? new Date(a.deleted_at).toLocaleDateString('pt-BR') : '—'}
                    {a.cargo && <span className="ml-2 text-gray-400">· {a.cargo}</span>}
                  </div>
                </div>
              </Link>
            ))}
            {vinculosAnteriores.map((v: any) => (
              <div key={v.id} className="p-3 rounded-lg border border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-gray-600">Vínculo anterior</span>
                </div>
                <div className="text-xs text-gray-500">
                  {v.admissao ? new Date(v.admissao + 'T12:00').toLocaleDateString('pt-BR') : '—'}
                  {' → '}
                  {v.demissao ? new Date(v.demissao + 'T12:00').toLocaleDateString('pt-BR') : '—'}
                  {v.cargo && <span className="ml-2 text-gray-400">· {v.cargo}</span>}
                </div>
                {v.motivo_saida && <div className="text-[10px] text-gray-400 mt-1">Motivo: {v.motivo_saida}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
    ),
  }

  const tabs: Tab[] = [tabVisaoGeral, tabContrato, tabRemuneracao, tabHolerites, tabPonto, tabDocs, tabHistorico]

  // ========= LAYOUT =========
  return (
    <div className={`p-4 sm:p-6 max-w-6xl mx-auto ${isAdmissaoFlow ? 'md:mr-[280px]' : ''}`}>
      {isAdmissaoFlow && admissaoStepConfig && (
        <AdmissaoBannerWrapper
          funcName={f.nome_guerra || f.nome}
          stepLabel={admissaoStepConfig.label}
        />
      )}
      <div className="flex items-center gap-2 mb-4 text-sm">
        <BackButton fallback="/funcionarios" />
        <Link href="/funcionarios" className="text-gray-400 hover:text-gray-600">Funcionários</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700 truncate max-w-xs">{f.nome_guerra || f.nome}</span>
      </div>

      {/* Hero header card */}
      <div className="bg-gradient-to-br from-white to-brand/5 rounded-2xl shadow-sm border border-gray-100 p-5 mb-5">
        <div className="flex items-start gap-4 flex-wrap">
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
                {(STATUS_LABEL[f.status] ?? f.status ?? '').toUpperCase()}
              </span>
              {alocacoesAtivas.map((a: any) => (
                <Link key={a.id} href={`/obras/${a.obra_id}`}
                  className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-100 text-blue-700 hover:bg-blue-200">
                  {a.obras?.nome}
                </Link>
              ))}
              {alocacoesAtivas.length > 1 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-purple-100 text-purple-700" title="Funcionário alocado em múltiplas obras">
                  ⚡ MULTI ({alocacoesAtivas.length})
                </span>
              )}
              {(f as any).centros_custo && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  (f as any).centros_custo.tipo === 'obra' ? 'bg-blue-100 text-blue-700' :
                  (f as any).centros_custo.tipo === 'administrativo' ? 'bg-violet-100 text-violet-700' :
                  (f as any).centros_custo.tipo === 'suporte_obra' ? 'bg-amber-100 text-amber-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {(f as any).centros_custo.codigo} — {(f as any).centros_custo.nome}
                </span>
              )}
              {f.nao_renovar && <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-700">⚠ NÃO RENOVAR</span>}
              {isArquivado && <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-gray-100 text-gray-500">📁 ARQUIVADO</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {f.status !== 'inativo' && !isArquivado && (
              <PromocaoButton funcionario={f} funcoes={funcoes ?? []} />
            )}
            <Link href={`/funcionarios/${f.id}/editar${isAdmissaoFlow ? `?from=admissao&workflow_id=${searchParams.workflow_id}&step=${admissaoStep}` : ''}`}
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
      {f.status === 'pendente' && !isArquivado && (
        <Link href={`/rh/admissoes/novo?funcionario_id=${f.id}`}
          className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-3 hover:bg-amber-100 transition-colors">
          <div className="text-sm">
            <strong className="text-amber-800">⚠️ Admissão pendente</strong>
            <span className="text-amber-700 text-xs ml-2">Clique para iniciar o processo de admissão.</span>
          </div>
          <span className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-bold flex-shrink-0">
            Iniciar admissão →
          </span>
        </Link>
      )}
      {!admissao && !['pendente', 'inativo'].includes(f.status) && (
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
        <AdmissaoDrawerTrigger funcionario={f} workflow={admissao} />
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
      {f.status === 'inativo' && !isArquivado && (
        <div className="mb-4 p-4 rounded-xl bg-gray-100 border-2 border-gray-300">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">🚫</span>
            <div>
              <strong className="text-gray-800">Funcionário desligado</strong>
              {rescisao?.status === 'paga' && <span className="ml-2 text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-semibold">Rescisão paga</span>}
            </div>
          </div>
          {f.motivo_saida && <p className="text-xs text-gray-600 mb-3">Motivo: <strong>{f.motivo_saida}</strong></p>}
          <div className="flex flex-wrap gap-2">
            <Link href={`/rh/admissoes/novo?funcionario_id=${f.id}`}
              className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700">
              Reabrir admissão
            </Link>
            {desligamento && (
              <Link href={`/rh/desligamentos`}
                className="px-3 py-1.5 border border-gray-300 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-50">
                Ver desligamento
              </Link>
            )}
            {/* Reativar sem processo: via SQL admin apenas (edge case) */}
          </div>
        </div>
      )}

      {/* Override emergencial banner */}
      {overrideAtivo && (() => {
        const prazoDate = new Date(overrideAtivo.prazo_regularizacao + 'T12:00')
        const diasRestantes = Math.ceil((prazoDate.getTime() - hoje.getTime()) / 86400000)
        const corBanner = diasRestantes < 0 ? 'bg-red-50 border-red-300' : diasRestantes <= 3 ? 'bg-orange-50 border-orange-300' : 'bg-yellow-50 border-yellow-300'
        const corTexto = diasRestantes < 0 ? 'text-red-800' : diasRestantes <= 3 ? 'text-orange-800' : 'text-yellow-800'
        const etapas: string[] = overrideAtivo.etapas_pendentes ?? []
        return (
          <div className={`mb-4 p-3 rounded-xl border ${corBanner}`}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold ${corTexto}`}>
                  Liberado emergencialmente em {fmtD(overrideAtivo.data_liberacao)} | Motivo: {overrideAtivo.motivo} | Prazo: {fmtD(overrideAtivo.prazo_regularizacao)}
                  {diasRestantes < 0 && <span className="ml-1 text-red-600 font-bold">(VENCIDO)</span>}
                </p>
                {etapas.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {etapas.map((e: string) => (
                      <span key={e} className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-red-100 text-red-700 border border-red-200">{e}</span>
                    ))}
                  </div>
                )}
              </div>
              <Link href="/rh/admissoes" className={`text-xs font-semibold hover:underline flex-shrink-0 ${corTexto}`}>
                Ir para admissão &rarr;
              </Link>
            </div>
          </div>
        )
      })()}

      {/* Card de decisão de renovação (experiência 45+45) */}
      <DecisaoRenovacaoCard funcionario_id={f.id} />

      {/* Tabs */}
      <FuncionarioTabs tabs={tabs} />

      {isAdmissaoFlow && (
        <AdmissaoStepPanel
          funcionario={f}
          step={admissaoStep}
          workflowId={searchParams.workflow_id!}
        />
      )}
    </div>
  )
}
