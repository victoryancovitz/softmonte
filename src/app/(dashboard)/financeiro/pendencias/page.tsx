import { createClient } from '@/lib/supabase-server'
import { requireRole } from '@/lib/require-role'
import Link from 'next/link'

export default async function PendenciasPage() {
  await requireRole(['admin', 'diretoria', 'financeiro'])
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch pending notifications
  const { data: notifs } = await supabase
    .from('notificacoes')
    .select('*, financeiro_lancamentos:ref_id(id, nome, valor, categoria, data_vencimento, fornecedor, dias_atraso, juros_dia_padrao_pct, multa_padrao_pct, status, valor_previsto, variacao_pct)')
    .eq('destinatario_id', user?.id)
    .in('tipo', ['alerta_vencimento', 'alerta_atraso', 'alerta_variacao'])
    .eq('lida', false)
    .order('created_at', { ascending: false })

  const vencimentos = (notifs ?? []).filter(n => n.tipo === 'alerta_vencimento')
  const atrasos = (notifs ?? []).filter(n => n.tipo === 'alerta_atraso')
  const variacoes = (notifs ?? []).filter(n => n.tipo === 'alerta_variacao')

  const total = vencimentos.length + atrasos.length + variacoes.length

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold font-display text-gray-900 mb-1">Pendências Financeiras</h1>
      <p className="text-sm text-gray-500 mb-6">{total} pendência(s) para sua atenção</p>

      {total === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
          <div className="text-4xl mb-2">✅</div>
          <div className="font-semibold text-green-800">Tudo em dia!</div>
          <div className="text-sm text-green-600 mt-1">Nenhuma pendência financeira no momento.</div>
        </div>
      )}

      {/* Atrasados */}
      {atrasos.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-bold text-red-800 mb-3 flex items-center gap-2">
            💰 Atrasados ({atrasos.length})
          </h2>
          <div className="space-y-2">
            {atrasos.map((n: any) => {
              const lanc = n.financeiro_lancamentos
              if (!lanc) return null
              const juros = Number(lanc.valor) * (Number(lanc.juros_dia_padrao_pct) || 0.033) / 100 * (lanc.dias_atraso || 0)
              const multa = Number(lanc.valor) * (Number(lanc.multa_padrao_pct) || 2) / 100
              return (
                <div key={n.id} className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold text-sm text-gray-900">{lanc.fornecedor || lanc.categoria}</div>
                      <div className="text-xs text-gray-600 mt-0.5">{lanc.nome}</div>
                      <div className="text-xs text-red-700 mt-1 font-medium">
                        Atrasado {lanc.dias_atraso} dia(s) · Juros: R$ {juros.toFixed(2)} + Multa: R$ {multa.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        Novo total: R$ {(Number(lanc.valor) + juros + multa).toFixed(2)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-red-700">R$ {Number(lanc.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                      <div className="text-[10px] text-gray-400">Venceu {lanc.data_vencimento}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Vencimentos próximos */}
      {vencimentos.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-bold text-amber-800 mb-3 flex items-center gap-2">
            🔔 Vencimentos Próximos ({vencimentos.length})
          </h2>
          <div className="space-y-2">
            {vencimentos.map((n: any) => {
              const lanc = n.financeiro_lancamentos
              if (!lanc) return null
              const dias = Math.ceil((new Date(lanc.data_vencimento).getTime() - Date.now()) / 86400000)
              return (
                <div key={n.id} className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold text-sm text-gray-900">{lanc.fornecedor || lanc.categoria}</div>
                      <div className="text-xs text-gray-600 mt-0.5">{lanc.nome}</div>
                      <div className="text-xs text-amber-700 mt-1 font-medium">
                        Vence em {dias} dia(s)
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-amber-700">R$ {Number(lanc.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Variações */}
      {variacoes.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-bold text-purple-800 mb-3 flex items-center gap-2">
            ⚠️ Variações Suspeitas ({variacoes.length})
          </h2>
          <div className="space-y-2">
            {variacoes.map((n: any) => {
              const lanc = n.financeiro_lancamentos
              if (!lanc) return null
              return (
                <div key={n.id} className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                  <div className="font-semibold text-sm text-gray-900">{lanc.nome}</div>
                  <div className="text-xs text-purple-700 mt-1">
                    Variação de {lanc.variacao_pct?.toFixed(1)}% · Previsto: R$ {lanc.valor_previsto?.toFixed(2)} → Real: R$ {Number(lanc.valor).toFixed(2)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
