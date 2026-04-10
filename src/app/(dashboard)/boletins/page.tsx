import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'
import BMStatusButton from './status-button'

const STATUS_BADGE: Record<string, string> = {
  aberto: 'bg-blue-100 text-blue-700',
  fechado: 'bg-gray-100 text-gray-600',
  enviado: 'bg-amber-100 text-amber-700',
  aprovado: 'bg-green-100 text-green-700',
}
const STATUS_LABEL: Record<string, string> = {
  aberto: 'Em aberto', fechado: 'Fechado', enviado: 'Enviado', aprovado: 'Aprovado'
}

function BMCard({ bm }: { bm: any }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center justify-between hover:border-gray-300 hover:shadow-md transition-all group">
      <Link href={`/boletins/${bm.id}`} className="flex items-center gap-4 flex-1 min-w-0">
        <div className="w-12 h-12 bg-brand/10 rounded-xl flex items-center justify-center flex-shrink-0">
          <span className="text-brand font-bold text-sm">BM{String(bm.numero).padStart(2,'0')}</span>
        </div>
        <div>
          <div className="font-semibold text-gray-900 group-hover:text-brand transition-colors">{bm.obras?.nome}</div>
          <div className="text-sm text-gray-500">{bm.obras?.cliente}</div>
          <div className="text-xs text-gray-400 mt-0.5">
            {new Date(bm.data_inicio + 'T12:00:00').toLocaleDateString('pt-BR')} — {new Date(bm.data_fim + 'T12:00:00').toLocaleDateString('pt-BR')}
          </div>
        </div>
      </Link>
      <div className="flex items-center gap-3 flex-shrink-0">
        {bm.nfe_numero ? (
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-green-100 text-green-700">NF Emitida</span>
        ) : bm.status === 'aprovado' && !bm.nfe_numero ? (
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-700">Aguard. NF</span>
        ) : null}
        <BMStatusButton bmId={bm.id} currentStatus={bm.status} />
        <Link href={`/boletins/${bm.id}`}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-gray-400"><path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </Link>
      </div>
    </div>
  )
}

export default async function BoletinsPage() {
  const supabase = createClient()
  const { data: bms } = await supabase
    .from('boletins_medicao')
    .select('*, obras(nome, cliente)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  const emAndamento = (bms ?? []).filter((b: any) => b.status === 'aberto' || b.status === 'fechado')
  const aguardando = (bms ?? []).filter((b: any) => b.status === 'enviado')
  const aprovados = (bms ?? []).filter((b: any) => b.status === 'aprovado')

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold font-display">Boletins de Medição</h1>
          <p className="text-sm text-gray-500 mt-0.5">{bms?.length ?? 0} boletins</p>
        </div>
        <Link href="/boletins/nova" className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark transition-colors">+ Novo BM</Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4 mb-6">
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <div className="text-2xl font-bold font-display text-blue-700">{emAndamento.length}</div>
          <div className="text-xs text-gray-500 uppercase tracking-wide">Em andamento</div>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 relative">
          <div className="text-2xl font-bold font-display text-amber-700">{aguardando.length}</div>
          <div className="text-xs text-gray-500 uppercase tracking-wide">Aguardando aprovação</div>
          {aguardando.length > 0 && <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse" />}
        </div>
        <div className="bg-green-50 border border-green-100 rounded-xl p-4">
          <div className="text-2xl font-bold font-display text-green-700">{aprovados.length}</div>
          <div className="text-xs text-gray-500 uppercase tracking-wide">Aprovados</div>
        </div>
      </div>

      {/* Em andamento */}
      {emAndamento.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500" /> Em andamento ({emAndamento.length})
          </h2>
          <div className="space-y-3">
            {emAndamento.map((bm: any) => <BMCard key={bm.id} bm={bm} />)}
          </div>
        </div>
      )}

      {/* Aguardando */}
      {aguardando.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" /> Aguardando aprovação ({aguardando.length})
          </h2>
          <div className="space-y-3">
            {aguardando.map((bm: any) => {
              const diasEnviado = bm.enviado_em ? Math.ceil((Date.now() - new Date(bm.enviado_em).getTime()) / 86400000) : null
              return (
                <div key={bm.id} className="bg-white rounded-xl border border-amber-200 p-5 flex items-center justify-between hover:shadow-md transition-all group">
                  <Link href={`/boletins/${bm.id}`} className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <span className="text-amber-700 font-bold text-sm">BM{String(bm.numero).padStart(2,'0')}</span>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 group-hover:text-brand transition-colors">{bm.obras?.nome}</div>
                      <div className="text-sm text-gray-500">{bm.obras?.cliente}</div>
                      <div className="text-xs mt-0.5 flex items-center gap-2">
                        <span className="text-gray-400">{new Date(bm.data_inicio + 'T12:00:00').toLocaleDateString('pt-BR')} — {new Date(bm.data_fim + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                        {diasEnviado !== null && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${diasEnviado > 7 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                            Enviado há {diasEnviado}d
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {bm.nfe_numero ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-green-100 text-green-700">NF Emitida</span>
                    ) : bm.status === 'aprovado' && !bm.nfe_numero ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-700">Aguard. NF</span>
                    ) : null}
                    <BMStatusButton bmId={bm.id} currentStatus={bm.status} />
                    <Link href={`/boletins/${bm.id}`}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-gray-400"><path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Aprovados */}
      {aprovados.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" /> Aprovados ({aprovados.length})
          </h2>
          <div className="space-y-3">
            {aprovados.map((bm: any) => <BMCard key={bm.id} bm={bm} />)}
          </div>
        </div>
      )}

      {/* Empty state */}
      {(!bms || bms.length === 0) && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-10 text-center">
          <p className="text-gray-500 text-sm">Nenhum boletim de medição criado ainda.</p>
          <Link href="/boletins/nova" className="mt-4 inline-block px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark">Criar primeiro BM</Link>
        </div>
      )}
    </div>
  )
}
