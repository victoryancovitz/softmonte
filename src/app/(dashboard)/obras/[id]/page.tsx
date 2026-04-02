import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export default async function ObraDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: obra } = await supabase.from('obras').select('*').eq('id', params.id).single()
  if (!obra) notFound()

  const { data: alocados } = await supabase
    .from('alocacoes')
    .select('*, funcionarios(nome, cargo, matricula, status)')
    .eq('obra_id', params.id)
    .eq('ativo', true)

  const { data: boletins } = await supabase
    .from('boletins_medicao')
    .select('*')
    .eq('obra_id', params.id)
    .order('numero')

  const STATUS_BADGE: Record<string, string> = {
    ativo: 'bg-green-100 text-green-700',
    aberto: 'bg-blue-100 text-blue-700',
    fechado: 'bg-gray-100 text-gray-600',
    enviado: 'bg-amber-100 text-amber-700',
    aprovado: 'bg-green-100 text-green-700',
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/obras" className="text-gray-400 hover:text-gray-600 text-sm">Obras</Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-medium">{obra.nome}</span>
      </div>

      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold font-display text-gray-900">{obra.nome}</h1>
          <p className="text-gray-500 mt-1">{obra.cliente} · {obra.local}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${STATUS_BADGE[obra.status] ?? 'bg-gray-100 text-gray-600'}`}>{obra.status}</span>
          <Link href={`/obras/${obra.id}/editar`} className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">Editar</Link>
        </div>
      </div>

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
          <div className="text-sm font-semibold">{obra.data_inicio ? new Date(obra.data_inicio+'T12:00').toLocaleDateString('pt-BR') : '—'}</div>
          <div className="text-xs text-gray-400">até {obra.data_prev_fim ? new Date(obra.data_prev_fim+'T12:00').toLocaleDateString('pt-BR') : '—'}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Equipe */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Equipe alocada</h2>
            <Link href="/alocacao/nova" className="text-xs text-brand hover:underline">+ Alocar</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {alocados && alocados.length > 0 ? alocados.map((a: any) => (
              <div key={a.id} className="px-4 py-2.5 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{a.funcionarios?.nome}</div>
                  <div className="text-xs text-gray-500">{a.cargo_na_obra} · {a.funcionarios?.matricula}</div>
                </div>
                <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">Ativo</span>
              </div>
            )) : (
              <div className="px-4 py-6 text-center text-gray-400 text-sm">Nenhum funcionário alocado.</div>
            )}
          </div>
        </div>

        {/* Boletins */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Boletins de Medição</h2>
            <Link href="/boletins/nova" className="text-xs text-brand hover:underline">+ Novo BM</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {boletins && boletins.length > 0 ? boletins.map((b: any) => (
              <Link key={b.id} href={`/boletins/${b.id}`} className="px-4 py-2.5 flex items-center justify-between hover:bg-gray-50 block">
                <div>
                  <div className="text-sm font-semibold">BM {String(b.numero).padStart(2,'0')}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(b.data_inicio+'T12:00').toLocaleDateString('pt-BR')} — {new Date(b.data_fim+'T12:00').toLocaleDateString('pt-BR')}
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[b.status] ?? ''}`}>{b.status}</span>
              </Link>
            )) : (
              <div className="px-4 py-6 text-center text-gray-400 text-sm">Nenhum boletim criado.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
