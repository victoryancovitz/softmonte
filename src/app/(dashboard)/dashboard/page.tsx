import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = createClient()
  const hoje = new Date()

  const [funcs, obras, estoque, docs, alertas, efetivo_hoje] = await Promise.all([
    supabase.from('funcionarios').select('id,status', { count: 'exact' }),
    supabase.from('obras').select('id,nome,cliente,local,status').eq('status','ativo'),
    supabase.from('estoque_itens').select('id,nome,quantidade,quantidade_minima').filter('quantidade','lte','quantidade_minima'),
    supabase.from('documentos').select('id').lte('vencimento', new Date(Date.now() + 30*86400000).toISOString().split('T')[0]),
    supabase.from('vw_alertas').select('*').order('dias_restantes'),
    supabase.from('efetivo_diario').select('id', { count: 'exact' }).eq('data', `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`),
  ])

  const nFuncs = funcs.count ?? 0
  const nObras = obras.data?.length ?? 0
  const nEstoque = estoque.data?.length ?? 0
  const nDocs = docs.data?.length ?? 0
  const nAlertas = alertas.data?.length ?? 0
  const nEfetivoHoje = efetivo_hoje.count ?? 0

  const KPIs = [
    { label: 'Funcionários', value: nFuncs, sub: 'cadastrados', href: '/funcionarios', color: 'bg-brand/5 border-brand/10', valueColor: 'text-brand' },
    { label: 'Obras ativas', value: nObras, sub: 'em andamento', href: '/obras', color: 'bg-green-50 border-green-100', valueColor: 'text-green-700' },
    { label: 'Efetivo hoje', value: nEfetivoHoje, sub: 'registros', href: '/efetivo', color: 'bg-blue-50 border-blue-100', valueColor: 'text-blue-700' },
    { label: 'Estoque crítico', value: nEstoque, sub: 'itens abaixo do mín.', href: '/estoque', color: nEstoque > 0 ? 'bg-amber-50 border-amber-100' : 'bg-gray-50 border-gray-100', valueColor: nEstoque > 0 ? 'text-amber-700' : 'text-gray-400' },
    { label: 'Docs vencendo', value: nDocs, sub: 'próx. 30 dias', href: '/documentos', color: nDocs > 0 ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100', valueColor: nDocs > 0 ? 'text-red-700' : 'text-gray-400' },
    { label: 'Alertas', value: nAlertas, sub: 'atenção necessária', href: '/relatorios', color: nAlertas > 0 ? 'bg-orange-50 border-orange-100' : 'bg-gray-50 border-gray-100', valueColor: nAlertas > 0 ? 'text-orange-700' : 'text-gray-400' },
  ]

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-display text-brand">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {hoje.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* KPIs clicáveis */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {KPIs.map(k => (
          <Link key={k.label} href={k.href}
            className={`rounded-2xl border p-5 ${k.color} hover:shadow-sm transition-all group cursor-pointer`}>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{k.label}</div>
            <div className={`text-3xl font-bold font-display ${k.valueColor}`}>{k.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{k.sub}</div>
            <div className="text-[10px] text-brand mt-2 opacity-0 group-hover:opacity-100 transition-opacity">Ver detalhes →</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Obras ativas */}
        <div className="bg-white rounded-2xl border border-gray-200">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-brand font-display">Obras ativas</h2>
            <Link href="/obras" className="text-xs text-brand hover:underline">Ver todas →</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {obras.data && obras.data.length > 0 ? obras.data.map((o: any) => (
              <Link key={o.id} href={`/obras/${o.id}`} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 group block">
                <div>
                  <div className="text-sm font-semibold text-gray-900 group-hover:text-brand transition-colors">{o.nome}</div>
                  <div className="text-xs text-gray-400">{o.cliente} · {o.local}</div>
                </div>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium flex-shrink-0">Ativo</span>
              </Link>
            )) : (
              <div className="px-5 py-6 text-center text-gray-400 text-sm">Nenhuma obra ativa.</div>
            )}
          </div>
        </div>

        {/* Alertas */}
        <div className="bg-white rounded-2xl border border-gray-200">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-brand font-display">Alertas</h2>
            <Link href="/relatorios" className="text-xs text-brand hover:underline">Relatórios →</Link>
          </div>
          <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
            {alertas.data && alertas.data.length > 0 ? alertas.data.map((a: any) => (
              <div key={a.referencia_id + a.tipo} className={`px-5 py-3 flex items-start gap-3 ${a.dias_restantes < 0 ? 'bg-red-50/50' : a.dias_restantes <= 7 ? 'bg-amber-50/50' : ''}`}>
                <span className="text-base flex-shrink-0">{a.dias_restantes < 0 ? '🚨' : a.dias_restantes <= 7 ? '⚠️' : '📅'}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-gray-800 truncate">{a.descricao}</div>
                  <div className={`text-xs mt-0.5 ${a.dias_restantes < 0 ? 'text-red-600' : 'text-amber-600'}`}>
                    {a.tipo === 'contrato_vencendo' ? 'Contrato' : 'Documento'} —{' '}
                    {a.dias_restantes < 0 ? `venceu há ${Math.abs(a.dias_restantes)} dias` : `vence em ${a.dias_restantes} dias`}
                  </div>
                </div>
              </div>
            )) : (
              <div className="px-5 py-8 text-center">
                <div className="text-2xl mb-2">✅</div>
                <p className="text-sm text-gray-500">Nenhum alerta no momento!</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-5 p-4 bg-brand/5 rounded-2xl border border-brand/10">
        <h3 className="text-xs font-bold text-brand uppercase tracking-wider mb-3">Ações rápidas</h3>
        <div className="flex flex-wrap gap-2">
          {[
            { href: '/efetivo', label: '✅ Efetivo de hoje' },
            { href: '/boletins/nova', label: '📄 Novo BM' },
            { href: '/funcionarios/novo', label: '👷 Novo funcionário' },
            { href: '/financeiro/novo', label: '💰 Lançamento fin.' },
            { href: '/documentos/novo', label: '📎 Novo documento' },
            { href: '/assistente', label: '🤖 Assistente IA' },
          ].map(a => (
            <Link key={a.href} href={a.href}
              className="text-xs px-3 py-2 bg-white border border-brand/20 text-brand rounded-xl hover:bg-brand hover:text-white transition-all font-medium">
              {a.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
