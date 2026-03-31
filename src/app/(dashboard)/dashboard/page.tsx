import { createClient } from '@/lib/supabase-server'

export default async function DashboardPage() {
  const supabase = createClient()

  const [{ count: totalFunc }, { count: totalObras }, { data: estoqueAlerta }] = await Promise.all([
    supabase.from('funcionarios').select('*', { count: 'exact', head: true }),
    supabase.from('obras').select('*', { count: 'exact', head: true }).eq('status', 'ativo'),
    supabase.from('estoque_itens').select('*').filter('quantidade', 'lte', 'quantidade_minima'),
  ])

  const { data: docAlerta } = await supabase
    .from('documentos')
    .select('*, funcionarios(nome)')
    .lte('vencimento', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    .gte('vencimento', new Date().toISOString().split('T')[0])
    .order('vencimento', { ascending: true })
    .limit(5)

  const { data: obras } = await supabase
    .from('obras')
    .select('*')
    .eq('status', 'ativo')
    .limit(5)

  const kpis = [
    { label: 'Funcionários', value: totalFunc ?? 0, sub: 'cadastrados', color: 'text-gray-900' },
    { label: 'Obras ativas', value: totalObras ?? 0, sub: 'em andamento', color: 'text-gray-900' },
    { label: 'Estoque crítico', value: estoqueAlerta?.length ?? 0, sub: 'itens abaixo do mínimo', color: (estoqueAlerta?.length ?? 0) > 0 ? 'text-red-600' : 'text-gray-900' },
    { label: 'Docs vencendo', value: docAlerta?.length ?? 0, sub: 'próximos 30 dias', color: (docAlerta?.length ?? 0) > 0 ? 'text-amber-600' : 'text-gray-900' },
  ]

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Visão geral da Softmonte</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {kpis.map(k => (
          <div key={k.label} className="bg-gray-100 rounded-xl p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{k.label}</div>
            <div className={`text-2xl font-semibold ${k.color}`}>{k.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Obras */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold mb-4">Obras ativas</h2>
          {obras && obras.length > 0 ? (
            <div className="space-y-3">
              {obras.map(o => (
                <div key={o.id} className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{o.nome}</div>
                    <div className="text-xs text-gray-400">{o.cliente} · {o.local}</div>
                  </div>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Ativo</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Nenhuma obra cadastrada ainda.</p>
          )}
        </div>

        {/* Documentos */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold mb-4">Documentos vencendo em 30 dias</h2>
          {docAlerta && docAlerta.length > 0 ? (
            <div className="space-y-3">
              {docAlerta.map((d: any) => {
                const dias = Math.ceil((new Date(d.vencimento).getTime() - Date.now()) / 86400000)
                return (
                  <div key={d.id} className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">{d.funcionarios?.nome ?? '—'}</div>
                      <div className="text-xs text-gray-400">{d.tipo} · vence {new Date(d.vencimento).toLocaleDateString('pt-BR')}</div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${dias <= 7 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                      {dias}d
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Nenhum documento vencendo nos próximos 30 dias.</p>
          )}
        </div>
      </div>
    </div>
  )
}
