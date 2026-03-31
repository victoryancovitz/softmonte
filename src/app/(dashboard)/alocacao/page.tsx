import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'

export default async function AlocacaoPage() {
  const supabase = createClient()
  const { data: obras } = await supabase
    .from('obras')
    .select('*, alocacoes(*, funcionarios(nome, cargo, status))')
    .eq('status', 'ativo')
    .order('nome')

  const { data: disponiveis } = await supabase
    .from('funcionarios')
    .select('*')
    .eq('status', 'disponivel')
    .order('nome')

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Alocação por Obra</h1>
          <p className="text-sm text-gray-500 mt-0.5">{obras?.length ?? 0} obras ativas · {disponiveis?.length ?? 0} funcionários disponíveis</p>
        </div>
        <Link href="/alocacao/nova" className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark transition-colors">
          + Nova alocação
        </Link>
      </div>

      <div className="space-y-4">
        {obras && obras.length > 0 ? obras.map((obra: any) => {
          const alocAtivas = obra.alocacoes?.filter((a: any) => a.ativo) ?? []
          return (
            <div key={obra.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold">{obra.nome}</h2>
                  <p className="text-xs text-gray-400 mt-0.5">{obra.cliente} · {obra.local}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-medium">
                    {alocAtivas.length} alocados
                  </span>
                  {obra.data_inicio && <span className="text-xs text-gray-400">Início: {new Date(obra.data_inicio).toLocaleDateString('pt-BR')}</span>}
                  {obra.data_prev_fim && <span className="text-xs text-gray-400">Prev. fim: {new Date(obra.data_prev_fim).toLocaleDateString('pt-BR')}</span>}
                </div>
              </div>
              {alocAtivas.length > 0 ? (
                <div className="p-4 grid grid-cols-3 gap-2">
                  {alocAtivas.map((a: any) => (
                    <div key={a.id} className="flex items-center gap-2.5 border border-gray-100 rounded-lg p-2.5">
                      <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                        {a.funcionarios?.nome?.split(' ').map((n: string) => n[0]).slice(0,2).join('')}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-medium truncate">{a.funcionarios?.nome}</div>
                        <div className="text-[10px] text-gray-400">{a.cargo_na_obra ?? a.funcionarios?.cargo}</div>
                        {a.data_inicio && <div className="text-[10px] text-gray-300">desde {new Date(a.data_inicio).toLocaleDateString('pt-BR')}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-5 py-4 text-sm text-gray-400">Nenhum funcionário alocado nesta obra.</div>
              )}
            </div>
          )
        }) : (
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-8 text-center text-gray-400">
            Nenhuma obra ativa cadastrada ainda.
          </div>
        )}
      </div>

      {/* Disponíveis */}
      {disponiveis && disponiveis.length > 0 && (
        <div className="mt-5 bg-blue-50 border border-blue-100 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-blue-800 mb-3">Funcionários disponíveis ({disponiveis.length})</h2>
          <div className="grid grid-cols-4 gap-2">
            {disponiveis.map((f: any) => (
              <div key={f.id} className="flex items-center gap-2 bg-white border border-blue-100 rounded-lg px-3 py-2">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                  {f.nome?.split(' ').map((n: string) => n[0]).slice(0,2).join('')}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium truncate">{f.nome}</div>
                  <div className="text-[10px] text-gray-400">{f.cargo}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
