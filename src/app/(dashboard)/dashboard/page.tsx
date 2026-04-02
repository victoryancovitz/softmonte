import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'
import { getRole } from '@/lib/get-role'

export default async function DashboardPage() {
  const supabase = createClient()
  const hoje = new Date()

  const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`
  const mesInicio = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`
  const em30dias = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]

  // Fetch authenticated user for profile
  const { data: { user } } = await supabase.auth.getUser()

  const [
    funcs,
    obras,
    estoque,
    docs,
    alertas,
    efetivo_hoje,
    faltas_mes,
    hh_mes,
    bms_abertos,
    perfil,
    contratos_vencidos,
    contratos_vencendo,
  ] = await Promise.all([
    supabase.from('funcionarios').select('id,status,prazo1', { count: 'exact' }),
    supabase.from('obras').select('id,nome,cliente,local,status').eq('status', 'ativo'),
    supabase.from('estoque_itens').select('id,nome,quantidade,quantidade_minima').filter('quantidade', 'lte', 'quantidade_minima'),
    supabase.from('documentos').select('id').lte('vencimento', em30dias),
    supabase.from('vw_alertas').select('*').order('dias_restantes'),
    supabase.from('efetivo_diario').select('id', { count: 'exact' }).eq('data', hojeStr),
    supabase.from('faltas').select('id', { count: 'exact' }).eq('tipo', 'falta_injustificada').gte('data', mesInicio),
    supabase.from('hh_lancamentos').select('horas_normais,horas_extras,horas_noturnas').gte('data', mesInicio),
    supabase.from('boletins_medicao').select('id', { count: 'exact' }).eq('status', 'aberto'),
    user
      ? supabase.from('profiles').select('*').eq('user_id', user.id).single()
      : Promise.resolve({ data: null }),
    supabase.from('funcionarios').select('id', { count: 'exact' }).lt('prazo1', hojeStr),
    supabase.from('funcionarios').select('id', { count: 'exact' }).gte('prazo1', hojeStr).lte('prazo1', em30dias),
  ])

  const nFuncs = funcs.count ?? 0
  const nObras = obras.data?.length ?? 0
  const nEstoque = estoque.data?.length ?? 0
  const nDocs = docs.data?.length ?? 0
  const nAlertas = alertas.data?.length ?? 0
  const nEfetivoHoje = efetivo_hoje.count ?? 0
  const nFaltasMes = faltas_mes.count ?? 0
  const nBMsAbertos = bms_abertos.count ?? 0
  const nContratosVencidos = contratos_vencidos.count ?? 0
  const nContratosVencendo = contratos_vencendo.count ?? 0

  // Calculate total HH this month
  const totalHH = (hh_mes.data ?? []).reduce((acc: number, r: any) => {
    return acc + (Number(r.horas_normais) || 0) + (Number(r.horas_extras) || 0) + (Number(r.horas_noturnas) || 0)
  }, 0)

  // Profile info
  const profileData = perfil?.data as any
  const fullName = profileData?.nome ?? profileData?.name ?? 'Usuário'
  const firstName = fullName.split(' ')[0]

  // Greeting based on hour
  const hour = hoje.getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'

  // Format date
  const hojeFormatted = hoje.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  // KPIs Row 1 - Operational (blue-tinted)
  const kpisOperational = [
    {
      label: 'Obras Ativas',
      value: nObras,
      href: '/obras',
      bg: 'bg-blue-50 border-blue-100',
      valueColor: 'text-blue-700',
      dotColor: 'bg-blue-500',
    },
    {
      label: 'Efetivo Hoje',
      value: nEfetivoHoje,
      href: '/efetivo',
      bg: 'bg-blue-50 border-blue-100',
      valueColor: 'text-blue-700',
      dotColor: 'bg-blue-500',
    },
    {
      label: 'HH este mês',
      value: totalHH,
      href: '/hh',
      bg: 'bg-blue-50 border-blue-100',
      valueColor: 'text-blue-700',
      dotColor: 'bg-blue-500',
    },
    {
      label: 'BMs em aberto',
      value: nBMsAbertos,
      href: '/boletins',
      bg: 'bg-blue-50 border-blue-100',
      valueColor: 'text-blue-700',
      dotColor: 'bg-blue-500',
    },
  ]

  // KPIs Row 2 - Alerts (colored by severity)
  const kpisAlerts = [
    {
      label: 'Contratos vencidos',
      value: nContratosVencidos,
      href: '/funcionarios',
      bg: nContratosVencidos > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-100',
      valueColor: nContratosVencidos > 0 ? 'text-red-700' : 'text-gray-400',
      dotColor: 'bg-red-500',
    },
    {
      label: 'Vencendo 30d',
      value: nContratosVencendo,
      href: '/funcionarios',
      bg: nContratosVencendo > 0 ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-100',
      valueColor: nContratosVencendo > 0 ? 'text-amber-700' : 'text-gray-400',
      dotColor: 'bg-amber-500',
    },
    {
      label: 'Docs vencendo',
      value: nDocs,
      href: '/documentos',
      bg: nDocs > 0 ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-100',
      valueColor: nDocs > 0 ? 'text-amber-700' : 'text-gray-400',
      dotColor: 'bg-amber-500',
    },
    {
      label: 'Estoque crítico',
      value: nEstoque,
      href: '/estoque',
      bg: nEstoque > 0 ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-100',
      valueColor: nEstoque > 0 ? 'text-amber-700' : 'text-gray-400',
      dotColor: 'bg-amber-500',
    },
  ]

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* ZONE 1 - Greeting header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-display text-brand">
          {greeting}, {firstName} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {hojeFormatted} · {nObras} obras ativas · {nAlertas} alertas
        </p>
      </div>

      {/* ZONE 2 - KPIs Row 1: Operational */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        {kpisOperational.map((k) => (
          <Link
            key={k.label}
            href={k.href}
            className={`rounded-xl border p-4 ${k.bg} hover:shadow-sm transition-all relative block`}
          >
            {k.value > 0 && (
              <span className={`absolute top-3 right-3 w-2 h-2 rounded-full ${k.dotColor}`} />
            )}
            <div className={`text-2xl font-bold font-display ${k.valueColor}`}>{k.value}</div>
            <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">{k.label}</div>
          </Link>
        ))}
      </div>

      {/* ZONE 2 - KPIs Row 2: Alerts */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {kpisAlerts.map((k) => (
          <Link
            key={k.label}
            href={k.href}
            className={`rounded-xl border p-4 ${k.bg} hover:shadow-sm transition-all relative block`}
          >
            {k.value > 0 && (
              <span className={`absolute top-3 right-3 w-2 h-2 rounded-full ${k.dotColor}`} />
            )}
            <div className={`text-2xl font-bold font-display ${k.valueColor}`}>{k.value}</div>
            <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">{k.label}</div>
          </Link>
        ))}
      </div>

      {/* ZONE 3 - Two columns (2/3 + 1/3) */}
      <div className="grid grid-cols-3 gap-5 mb-6">
        {/* Left: Obras ativas as cards */}
        <div className="col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-brand font-display">Obras ativas</h2>
            <Link href="/obras" className="text-xs text-brand hover:underline">Ver todas →</Link>
          </div>
          {obras.data && obras.data.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {obras.data.map((o: any) => (
                <Link
                  key={o.id}
                  href={`/obras/${o.id}`}
                  className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-brand/30 transition-all block"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="font-semibold text-gray-900">{o.nome}</div>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Ativo</span>
                  </div>
                  <div className="text-xs text-gray-500">{o.cliente} · {o.local}</div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400 text-sm">
              Nenhuma obra ativa.
            </div>
          )}
        </div>

        {/* Right: Alertas feed */}
        <div className="col-span-1">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-brand font-display">Alertas</h2>
            <Link href="/relatorios" className="text-xs text-brand hover:underline">Relatórios →</Link>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 max-h-96 overflow-y-auto">
            {alertas.data && alertas.data.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {alertas.data.map((a: any) => {
                  const isExpired = a.dias_restantes < 0
                  const isUrgent = a.dias_restantes <= 7
                  const borderColor = isExpired ? 'border-red-500' : isUrgent ? 'border-amber-500' : 'border-blue-300'
                  const icon = isExpired ? '🚨' : isUrgent ? '⚠️' : '📅'

                  return (
                    <div
                      key={a.referencia_id + a.tipo}
                      className={`px-4 py-3 flex items-start gap-3 border-l-4 ${borderColor}`}
                    >
                      <span className="text-base flex-shrink-0 mt-0.5">{icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-gray-800 truncate">{a.descricao}</div>
                        <div className={`text-xs mt-0.5 ${isExpired ? 'text-red-600' : 'text-amber-600'}`}>
                          {a.tipo === 'contrato_vencendo' ? 'Contrato' : 'Documento'} —{' '}
                          {isExpired
                            ? `venceu há ${Math.abs(a.dias_restantes)} dias`
                            : `vence em ${a.dias_restantes} dias`}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="px-5 py-8 text-center">
                <div className="text-2xl mb-2">✅</div>
                <p className="text-sm text-gray-500">Nenhum alerta no momento!</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ZONE 4 - Quick actions grid */}
      <div>
        <h3 className="text-xs font-bold text-brand uppercase tracking-wider mb-3">Ações rápidas</h3>
        <div className="grid grid-cols-4 gap-3">
          {[
            { href: '/efetivo', emoji: '✅', label: 'Efetivo de hoje' },
            { href: '/boletins/nova', emoji: '📄', label: 'Novo BM' },
            { href: '/funcionarios/novo', emoji: '👷', label: 'Novo funcionário' },
            { href: '/assistente', emoji: '🤖', label: 'Assistente IA' },
          ].map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="bg-white rounded-xl border border-gray-200 p-3 hover:shadow-sm hover:border-brand/30 transition-all text-center block"
            >
              <div className="text-2xl mb-1">{a.emoji}</div>
              <div className="text-xs font-medium text-gray-700">{a.label}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
