import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'
import { getRole } from '@/lib/get-role'

export default async function DashboardPage() {
  const supabase = createClient()
  const hoje = new Date()

  const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`
  const mesInicio = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`
  const em30dias = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]

  const { data: { user } } = await supabase.auth.getUser()
  const role = await getRole()
  const isAdmin = role === 'admin'
  const isFinanceiro = role === 'financeiro' || isAdmin
  const isRh = role === 'rh' || isAdmin
  const isOp = role === 'encarregado' || role === 'engenheiro' || isAdmin

  const [
    funcs, obras, estoque, docs, alertas, efetivo_hoje,
    faltas_mes, hh_mes, bms_abertos, bms_enviados,
    perfil, contratos_vencidos, contratos_vencendo,
  ] = await Promise.all([
    supabase.from('funcionarios').select('id,status,prazo1', { count: 'exact' }).is('deleted_at', null),
    supabase.from('obras').select('id,nome,cliente,local,status,data_inicio,data_prev_fim').eq('status', 'ativo').is('deleted_at', null),
    supabase.from('estoque_itens').select('id,nome,quantidade,quantidade_minima').filter('quantidade', 'lte', 'quantidade_minima').is('deleted_at', null),
    supabase.from('documentos').select('id').lte('vencimento', em30dias).is('deleted_at', null),
    supabase.from('vw_alertas').select('*').order('dias_restantes').limit(100),
    supabase.from('efetivo_diario').select('id', { count: 'exact' }).eq('data', hojeStr),
    supabase.from('faltas').select('id', { count: 'exact' }).eq('tipo', 'falta_injustificada').gte('data', mesInicio),
    supabase.from('hh_lancamentos').select('horas_normais,horas_extras,horas_noturnas').gte('data', mesInicio),
    supabase.from('boletins_medicao').select('id', { count: 'exact' }).eq('status', 'aberto').is('deleted_at', null),
    supabase.from('boletins_medicao').select('id,enviado_em', { count: 'exact' }).eq('status', 'enviado').is('deleted_at', null),
    user ? supabase.from('profiles').select('*').eq('user_id', user.id).single() : Promise.resolve({ data: null }),
    supabase.from('funcionarios').select('id', { count: 'exact' }).lt('prazo1', hojeStr).is('deleted_at', null),
    supabase.from('funcionarios').select('id', { count: 'exact' }).gte('prazo1', hojeStr).lte('prazo1', em30dias).is('deleted_at', null),
  ])

  const nObras = obras.data?.length ?? 0
  const nEfetivoHoje = efetivo_hoje.count ?? 0
  const nBMsAbertos = bms_abertos.count ?? 0
  const nBMsEnviados = bms_enviados.count ?? 0
  const nContratosVencidos = contratos_vencidos.count ?? 0
  const nContratosVencendo = contratos_vencendo.count ?? 0
  const nDocs = docs.data?.length ?? 0
  const nEstoque = estoque.data?.length ?? 0
  const nAlertas = alertas.data?.length ?? 0

  const totalHH = (hh_mes.data ?? []).reduce((acc: number, r: any) => {
    return acc + (Number(r.horas_normais) || 0) + (Number(r.horas_extras) || 0) + (Number(r.horas_noturnas) || 0)
  }, 0)

  // Dados financeiros (apenas para admin/financeiro)
  let finReceita = 0, finDespesa = 0, finAberto = 0, saldoContas = 0
  let admissoesAndamento = 0, desligamentosAndamento = 0, docsVencidos = 0, nrVencendo = 0
  let absenteismoCriticos: any[] = []
  let absenteismoAlto: any[] = []
  let habitualidade: any[] = []
  if (isFinanceiro) {
    const [{ data: fin }, { data: contas }] = await Promise.all([
      supabase.from('financeiro_lancamentos').select('tipo,status,valor').is('deleted_at', null).gte('data_competencia', mesInicio),
      supabase.from('vw_contas_saldo').select('saldo_atual'),
    ])
    ;(fin ?? []).forEach((r: any) => {
      const v = Number(r.valor) || 0
      if (r.tipo === 'receita' && r.status === 'pago') finReceita += v
      if (r.tipo === 'despesa' && r.status === 'pago') finDespesa += v
      if (r.status === 'em_aberto') finAberto += v
    })
    saldoContas = (contas ?? []).reduce((s: number, c: any) => s + Number(c.saldo_atual ?? 0), 0)
  }
  if (isRh) {
    const [{ count: adm }, { count: des }, { count: dv }, { data: absData }, { data: habData }] = await Promise.all([
      supabase.from('admissoes_workflow').select('id', { count: 'exact', head: true }).eq('status', 'em_andamento'),
      supabase.from('desligamentos_workflow').select('id', { count: 'exact', head: true }).eq('status', 'em_andamento'),
      supabase.from('documentos').select('id', { count: 'exact', head: true }).lte('vencimento', hojeStr).is('deleted_at', null),
      supabase.from('vw_absenteismo').select('funcionario_id,nome,cargo,obra,taxa_falta_pct,taxa_injustificada_pct,total_faltas,faltas_injustificadas,ano,mes,funcionario_ativo')
        .eq('ano', hoje.getFullYear()).eq('mes', hoje.getMonth() + 1)
        .eq('funcionario_ativo', true),
      supabase.from('vw_alertas_habitualidade').select('*').limit(10),
    ])
    admissoesAndamento = adm ?? 0
    desligamentosAndamento = des ?? 0
    docsVencidos = dv ?? 0
    absenteismoCriticos = (absData || []).filter((r: any) => Number(r.taxa_falta_pct) >= 15)
    absenteismoAlto = (absData || []).filter((r: any) => Number(r.taxa_falta_pct) >= 8 && Number(r.taxa_falta_pct) < 15)
    habitualidade = habData || []
  }
  const fmtR = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const profileData = perfil?.data as any
  const fullName = profileData?.nome ?? 'Usuário'
  const firstName = fullName.split(' ')[0]

  const spHour = parseInt(hoje.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }))
  const greeting = spHour >= 6 && spHour < 12 ? 'Bom dia' : spHour >= 12 && spHour < 18 ? 'Boa tarde' : 'Boa noite'

  const hojeFormatted = hoje.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  })

  // KPI icon SVGs (inline to avoid lucide server-component issues)
  const icons = {
    building: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 21h18M9 8h1M9 12h1M9 16h1M14 8h1M14 12h1M14 16h1"/><path d="M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16"/></svg>',
    users: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>',
    clock: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
    file: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>',
    alertTriangle: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
    shield: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    fileCheck: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M9 15l2 2 4-4"/></svg>',
    inbox: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M22 12h-6l-2 3H10l-2-3H2"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/></svg>',
    mapPin: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    checkSquare: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>',
    filePlus: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M12 18v-6M9 15h6"/></svg>',
    userPlus: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>',
    sparkles: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3zM5 19l.5 1.5L7 21l-1.5.5L5 23l-.5-1.5L3 21l1.5-.5L5 19z"/></svg>',
  }

  const kpisOp = [
    { label: 'Obras Ativas', value: nObras, href: '/obras', icon: icons.building, accent: 'border-l-blue-600', iconBg: 'bg-blue-50 text-blue-600' },
    { label: 'Efetivo Hoje', value: nEfetivoHoje, href: '/ponto', icon: icons.users, accent: 'border-l-indigo-500', iconBg: 'bg-indigo-50 text-indigo-600' },
    { label: 'HH Mês', value: `${totalHH}h`, href: '/ponto', icon: icons.clock, accent: 'border-l-violet-500', iconBg: 'bg-violet-50 text-violet-600' },
    { label: 'BMs Abertos', value: nBMsAbertos, href: '/boletins', icon: icons.file, accent: 'border-l-cyan-500', iconBg: 'bg-cyan-50 text-cyan-600' },
  ]

  const kpisAlert = [
    { label: 'Contratos Vencidos', value: nContratosVencidos, href: '/funcionarios', icon: icons.alertTriangle, accent: 'border-l-red-500', bg: nContratosVencidos > 0 ? 'bg-red-50/60' : '', valColor: nContratosVencidos > 0 ? 'text-red-700' : 'text-gray-400' },
    { label: 'Vencendo 30d', value: nContratosVencendo, href: '/funcionarios', icon: icons.shield, accent: 'border-l-amber-500', bg: nContratosVencendo > 0 ? 'bg-amber-50/60' : '', valColor: nContratosVencendo > 0 ? 'text-amber-700' : 'text-gray-400' },
    { label: 'Docs Vencendo', value: nDocs, href: '/rastreio', icon: icons.fileCheck, accent: 'border-l-orange-500', bg: nDocs > 0 ? 'bg-orange-50/60' : '', valColor: nDocs > 0 ? 'text-orange-700' : 'text-gray-400' },
    { label: 'BMs Aguardando', value: nBMsEnviados, href: '/boletins', icon: icons.inbox, accent: 'border-l-yellow-500', bg: nBMsEnviados > 0 ? 'bg-yellow-50/60' : '', valColor: nBMsEnviados > 0 ? 'text-yellow-700' : 'text-gray-400' },
  ]

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1200px] mx-auto">

      {/* ── HEADER ── */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold font-display text-brand tracking-tight">
          {greeting}, {firstName}
        </h1>
        <p className="text-sm text-gray-400 mt-1.5 font-medium">
          {hojeFormatted} &middot; {nObras} obra{nObras !== 1 ? 's' : ''} ativa{nObras !== 1 ? 's' : ''} &middot; {nAlertas} alerta{nAlertas !== 1 ? 's' : ''}
        </p>
      </div>

      {/* ── ALERTA RH: Absenteísmo crítico ── */}
      {isRh && (absenteismoCriticos.length > 0 || absenteismoAlto.length > 0) && (
        <div className={`mb-6 rounded-xl border p-4 ${
          absenteismoCriticos.length > 0 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
        }`}>
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
              absenteismoCriticos.length > 0 ? 'bg-red-100' : 'bg-amber-100'
            }`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={absenteismoCriticos.length > 0 ? '#dc2626' : '#d97706'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className={`text-sm font-bold ${absenteismoCriticos.length > 0 ? 'text-red-800' : 'text-amber-800'}`}>
                {absenteismoCriticos.length > 0
                  ? `Atenção RH: ${absenteismoCriticos.length} funcionário${absenteismoCriticos.length > 1 ? 's' : ''} com absenteísmo crítico este mês (≥15%)`
                  : `${absenteismoAlto.length} funcionário${absenteismoAlto.length > 1 ? 's' : ''} com absenteísmo alto este mês (≥8%)`
                }
              </h3>
              <div className="mt-2 space-y-1">
                {absenteismoCriticos.slice(0, 3).map((r: any) => (
                  <div key={r.funcionario_id} className="flex items-center justify-between text-xs">
                    <Link href={`/funcionarios/${r.funcionario_id}`} className="text-red-700 font-semibold hover:underline truncate max-w-xs">
                      {r.nome}
                    </Link>
                    <span className="text-red-600">
                      {r.cargo} · {Number(r.taxa_falta_pct).toFixed(1)}% ({r.total_faltas} faltas)
                    </span>
                  </div>
                ))}
                {absenteismoCriticos.length === 0 && absenteismoAlto.slice(0, 3).map((r: any) => (
                  <div key={r.funcionario_id} className="flex items-center justify-between text-xs">
                    <Link href={`/funcionarios/${r.funcionario_id}`} className="text-amber-700 font-semibold hover:underline truncate max-w-xs">
                      {r.nome}
                    </Link>
                    <span className="text-amber-600">
                      {r.cargo} · {Number(r.taxa_falta_pct).toFixed(1)}% ({r.total_faltas} faltas)
                    </span>
                  </div>
                ))}
                {absenteismoCriticos.length > 3 && (
                  <div className="text-xs text-red-600 italic">
                    + {absenteismoCriticos.length - 3} outros...
                  </div>
                )}
              </div>
              <div className="mt-3 flex gap-2">
                <Link href="/relatorios/absenteismo"
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg ${
                    absenteismoCriticos.length > 0
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-amber-600 text-white hover:bg-amber-700'
                  }`}>
                  Ver ranking completo →
                </Link>
                <Link href="/faltas"
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50">
                  Ver faltas
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ALERTA RH: Habitualidade de pagamentos extras ── */}
      {isRh && habitualidade.length > 0 && (
        <div className="mb-6 rounded-xl border p-4 bg-amber-50 border-amber-200">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-amber-100">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-amber-800">
                Risco de habitualidade: {habitualidade.length} funcionário(s) com bônus recorrente
              </h3>
              <p className="text-xs text-amber-700 mt-0.5">
                Pagamentos recorrentes em 3+ meses podem caracterizar salário-utilidade pela Justiça do Trabalho.
              </p>
              <div className="mt-2 space-y-1">
                {habitualidade.slice(0, 3).map((h: any) => (
                  <div key={h.funcionario_id} className="flex items-center justify-between text-xs">
                    <Link href={`/funcionarios/${h.funcionario_id}`} className="text-amber-700 font-semibold hover:underline truncate max-w-xs">
                      {h.nome}
                    </Link>
                    <span className="text-amber-600">
                      {h.cargo} · {h.meses_seguidos} meses consecutivos
                    </span>
                  </div>
                ))}
                {habitualidade.length > 3 && (
                  <div className="text-xs text-amber-600 italic">+ {habitualidade.length - 3} outros...</div>
                )}
              </div>
              <div className="mt-3 flex gap-2">
                <Link href="/rh/pagamentos-extras"
                  className="text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700">
                  Ver pagamentos extras →
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── KPIs OPERACIONAIS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-4">
        {kpisOp.map(k => (
          <Link key={k.label} href={k.href}
            className={`bg-white rounded-xl border border-gray-100 border-l-4 ${k.accent} p-4 hover:shadow-md transition-all duration-200 block group`}>
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-9 h-9 rounded-lg ${k.iconBg} flex items-center justify-center`}
                dangerouslySetInnerHTML={{ __html: k.icon }} />
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider leading-tight">{k.label}</div>
            </div>
            <div className="text-3xl font-bold text-gray-900 font-display">{k.value}</div>
          </Link>
        ))}
      </div>

      {/* ── KPIs FINANCEIROS (admin/financeiro) ── */}
      {isFinanceiro && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-4">
          <Link href="/financeiro/contas" className="bg-white rounded-xl border border-gray-100 border-l-4 border-l-emerald-500 p-4 hover:shadow-md transition-all block">
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Saldo em contas</div>
            <div className={`text-2xl font-bold font-display ${saldoContas < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{fmtR(saldoContas)}</div>
          </Link>
          <Link href="/financeiro" className="bg-white rounded-xl border border-gray-100 border-l-4 border-l-green-500 p-4 hover:shadow-md transition-all block">
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Receita do mês</div>
            <div className="text-2xl font-bold font-display text-green-700">{fmtR(finReceita)}</div>
          </Link>
          <Link href="/financeiro" className="bg-white rounded-xl border border-gray-100 border-l-4 border-l-red-500 p-4 hover:shadow-md transition-all block">
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Despesa do mês</div>
            <div className="text-2xl font-bold font-display text-red-700">{fmtR(finDespesa)}</div>
          </Link>
          <Link href="/financeiro" className="bg-white rounded-xl border border-gray-100 border-l-4 border-l-amber-500 p-4 hover:shadow-md transition-all block">
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Em aberto</div>
            <div className="text-2xl font-bold font-display text-amber-700">{fmtR(finAberto)}</div>
          </Link>
        </div>
      )}

      {/* ── KPIs RH ── */}
      {isRh && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-4">
          <Link href="/rh/admissoes" className="bg-white rounded-xl border border-gray-100 border-l-4 border-l-pink-500 p-4 hover:shadow-md transition-all block">
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Admissões em andamento</div>
            <div className="text-2xl font-bold font-display text-pink-700">{admissoesAndamento}</div>
          </Link>
          <Link href="/rh/desligamentos" className="bg-white rounded-xl border border-gray-100 border-l-4 border-l-red-500 p-4 hover:shadow-md transition-all block">
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Desligamentos em andamento</div>
            <div className="text-2xl font-bold font-display text-red-700">{desligamentosAndamento}</div>
          </Link>
          <Link href="/rastreio" className="bg-white rounded-xl border border-gray-100 border-l-4 border-l-orange-500 p-4 hover:shadow-md transition-all block">
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Documentos vencidos</div>
            <div className="text-2xl font-bold font-display text-orange-700">{docsVencidos}</div>
          </Link>
          <Link href="/funcionarios" className="bg-white rounded-xl border border-gray-100 border-l-4 border-l-amber-500 p-4 hover:shadow-md transition-all block">
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Contratos vencendo 30d</div>
            <div className="text-2xl font-bold font-display text-amber-700">{nContratosVencendo}</div>
          </Link>
        </div>
      )}

      {/* ── KPIs ALERTAS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-8">
        {kpisAlert.map(k => (
          <Link key={k.label} href={k.href}
            className={`bg-white rounded-xl border border-gray-100 border-l-4 ${k.accent} p-4 ${k.bg} hover:shadow-md transition-all duration-200 block`}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-gray-50 text-gray-400 flex items-center justify-center"
                dangerouslySetInnerHTML={{ __html: k.icon }} />
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider leading-tight">{k.label}</div>
            </div>
            <div className={`text-3xl font-bold font-display ${k.valColor}`}>{k.value}</div>
          </Link>
        ))}
      </div>

      {/* ── OBRAS + ALERTAS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 mb-8">

        {/* Obras */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Obras ativas</h2>
            <Link href="/obras" className="text-xs font-semibold text-brand hover:underline">Ver todas</Link>
          </div>
          {obras.data && obras.data.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {obras.data.map((o: any) => {
                const inicio = o.data_inicio ? new Date(o.data_inicio + 'T12:00') : null
                const fim = o.data_prev_fim ? new Date(o.data_prev_fim + 'T12:00') : null
                let progresso = 0
                if (inicio && fim) {
                  const total = fim.getTime() - inicio.getTime()
                  const passado = Date.now() - inicio.getTime()
                  progresso = Math.min(Math.max(Math.round(passado / total * 100), 0), 100)
                }
                return (
                  <Link key={o.id} href={`/obras/${o.id}`}
                    className="bg-white rounded-xl shadow-sm hover:shadow-lg border border-transparent hover:border-brand/10 p-5 transition-all duration-200 block group">
                    <div className="flex items-start justify-between mb-2">
                      <div className="font-semibold text-gray-900 group-hover:text-brand transition-colors text-sm">{o.nome}</div>
                      <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-200">Ativo</span>
                    </div>
                    <div className="text-xs text-gray-400 flex items-center gap-1 mb-3">
                      <span dangerouslySetInnerHTML={{ __html: icons.mapPin }} />
                      {o.cliente} &middot; {o.local}
                    </div>
                    {inicio && fim && (
                      <div>
                        <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
                          <span>{inicio.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}</span>
                          <span>{progresso}%</span>
                          <span>{fim.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${progresso}%` }} />
                        </div>
                      </div>
                    )}
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-400 text-sm">Nenhuma obra ativa.</div>
          )}
        </div>

        {/* Alertas */}
        <div className="lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Alertas</h2>
            <Link href="/relatorios" className="text-xs font-semibold text-brand hover:underline">Relatórios</Link>
          </div>
          <div className="bg-white rounded-xl shadow-sm max-h-[420px] overflow-y-auto">
            {alertas.data && alertas.data.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {alertas.data.map((a: any) => {
                  const d = a.dias_restantes
                  const isExpired = d < 0
                  const borderColor = isExpired ? 'border-l-red-500' : d <= 7 ? 'border-l-red-400' : d <= 20 ? 'border-l-orange-400' : 'border-l-yellow-400'
                  const dotColor = isExpired ? 'bg-red-500' : d <= 7 ? 'bg-red-400' : d <= 20 ? 'bg-orange-400' : 'bg-yellow-400'

                  return (
                    <div key={a.referencia_id + a.tipo}
                      className={`px-4 py-3 border-l-[3px] ${borderColor} flex items-start gap-3`}>
                      <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${dotColor}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-gray-800 truncate">{a.descricao}</div>
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          {a.tipo === 'contrato_vencendo' ? 'Contrato' : 'Documento'} &mdash;{' '}
                          {isExpired ? <span className="text-red-600 font-medium">venceu há {Math.abs(d)}d</span> : <span>vence em {d}d</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="px-5 py-10 text-center">
                <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
                </div>
                <p className="text-sm text-gray-500 font-medium">Tudo em dia</p>
                <p className="text-xs text-gray-400 mt-0.5">Nenhum alerta no momento</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── AÇÕES RÁPIDAS (por role) ── */}
      <div>
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Ações rápidas</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          {(() => {
            type QA = { href: string; icon: string; label: string; color: string }
            const all: QA[] = []
            if (isOp) {
              all.push({ href: '/ponto', icon: icons.checkSquare, label: 'Lançar ponto', color: 'text-emerald-600 bg-emerald-50' })
              all.push({ href: '/boletins/nova', icon: icons.filePlus, label: 'Novo BM', color: 'text-blue-600 bg-blue-50' })
            }
            if (isRh || isAdmin) {
              all.push({ href: '/funcionarios/novo', icon: icons.userPlus, label: 'Novo funcionário', color: 'text-violet-600 bg-violet-50' })
              all.push({ href: '/rh/admissoes', icon: icons.fileCheck, label: 'Admissões', color: 'text-pink-600 bg-pink-50' })
            }
            if (isFinanceiro) {
              all.push({ href: '/financeiro/novo', icon: icons.filePlus, label: 'Novo lançamento', color: 'text-green-600 bg-green-50' })
              all.push({ href: '/financeiro/contas', icon: icons.building, label: 'Contas correntes', color: 'text-emerald-600 bg-emerald-50' })
              all.push({ href: '/forecast', icon: icons.clock, label: 'Forecast', color: 'text-cyan-600 bg-cyan-50' })
            }
            if (isAdmin) {
              all.push({ href: '/assistente', icon: icons.sparkles, label: 'Assistente IA', color: 'text-amber-600 bg-amber-50' })
            }
            // Default fallback if none added
            if (all.length === 0) {
              all.push({ href: '/funcionarios', icon: icons.users, label: 'Funcionários', color: 'text-violet-600 bg-violet-50' })
            }
            return all.slice(0, 4)
          })().map(a => (
            <Link key={a.href} href={a.href}
              className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md hover:border-brand/20 transition-all duration-200 flex items-center gap-3 group block">
              <div className={`w-10 h-10 rounded-lg ${a.color} flex items-center justify-center flex-shrink-0`}
                dangerouslySetInnerHTML={{ __html: a.icon }} />
              <span className="text-sm font-semibold text-gray-700 group-hover:text-brand transition-colors">{a.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
