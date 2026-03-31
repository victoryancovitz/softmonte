import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'

const STATUS_BADGE: Record<string, string> = {
  aberto: 'bg-blue-100 text-blue-700',
  fechado: 'bg-gray-100 text-gray-600',
  enviado: 'bg-amber-100 text-amber-700',
  aprovado: 'bg-green-100 text-green-700',
}
const STATUS_LABEL: Record<string, string> = {
  aberto: 'Em aberto', fechado: 'Fechado', enviado: 'Enviado', aprovado: 'Aprovado'
}

export default async function BolentinsPage() {
  const supabase = createClient()
  const { data: bms } = await supabase
    .from('boletins_medicao')
    .select('*, obras(nome, cliente)')
    .order('created_at', { ascending: false })

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Boletins de Medição</h1>
          <p className="text-sm text-gray-500 mt-0.5">{bms?.length ?? 0} boletins cadastrados</p>
        </div>
        <Link href="/boletins/nova" className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark transition-colors">
          + Novo BM
        </Link>
      </div>

      {bms && bms.length > 0 ? (
        <div className="space-y-3">
          {bms.map((bm: any) => (
            <Link key={bm.id} href={`/boletins/${bm.id}`}
              className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between hover:border-gray-300 hover:shadow-sm transition-all group block">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-brand/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-brand font-bold text-sm">BM{String(bm.numero).padStart(2,'0')}</span>
                </div>
                <div>
                  <div className="font-semibold text-gray-900 group-hover:text-brand transition-colors">{bm.obras?.nome}</div>
                  <div className="text-sm text-gray-500">{bm.obras?.cliente}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {new Date(bm.data_inicio + 'T12:00:00').toLocaleDateString('pt-BR')} até {new Date(bm.data_fim + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_BADGE[bm.status]}`}>
                  {STATUS_LABEL[bm.status]}
                </span>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-gray-400">
                  <path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <p className="text-gray-500 text-sm">Nenhum boletim de medição criado ainda.</p>
          <p className="text-gray-400 text-xs mt-1">Crie um novo BM para começar a medir as horas trabalhadas.</p>
          <Link href="/boletins/nova" className="mt-4 inline-block px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark">
            Criar primeiro BM
          </Link>
        </div>
      )}
    </div>
  )
}
