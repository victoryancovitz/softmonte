import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'

export default async function EstoquePage() {
  const supabase = createClient()
  const { data: itens } = await supabase
    .from('estoque_itens')
    .select('*')
    .order('nome')

  function getStatus(item: any) {
    if (item.quantidade <= 0) return { label: 'Esgotado', cls: 'bg-red-100 text-red-700' }
    if (item.quantidade <= item.quantidade_minima) return { label: 'Crítico', cls: 'bg-red-100 text-red-700' }
    if (item.quantidade <= item.quantidade_minima * 1.5) return { label: 'Baixo', cls: 'bg-amber-100 text-amber-700' }
    return { label: 'OK', cls: 'bg-green-100 text-green-700' }
  }

  const criticos = itens?.filter(i => i.quantidade <= i.quantidade_minima).length ?? 0

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Controle de Estoque</h1>
          <p className="text-sm text-gray-500 mt-0.5">{itens?.length ?? 0} itens cadastrados · {criticos > 0 && <span className="text-red-600 font-medium">{criticos} abaixo do mínimo</span>}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/estoque/requisicoes" className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
            Requisições
          </Link>
          <Link href="/estoque/novo" className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark transition-colors">
            + Novo item
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Código</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Item</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Categoria</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Depósito</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Qtd. atual</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Mínimo</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Un.</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {itens && itens.length > 0 ? itens.map((item: any) => {
              const status = getStatus(item)
              const isCrit = item.quantidade <= item.quantidade_minima
              return (
                <tr key={item.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${isCrit ? 'bg-red-50/30' : ''}`}>
                  <td className="px-4 py-3 text-xs font-mono text-gray-400">{item.codigo}</td>
                  <td className="px-4 py-3 font-medium">{item.nome}</td>
                  <td className="px-4 py-3"><span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{item.categoria}</span></td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{item.deposito}</td>
                  <td className={`px-4 py-3 text-right font-medium ${isCrit ? 'text-red-600' : 'text-gray-900'}`}>{item.quantidade}</td>
                  <td className="px-4 py-3 text-right text-gray-400">{item.quantidade_minima}</td>
                  <td className="px-4 py-3 text-gray-500">{item.unidade}</td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.cls}`}>{status.label}</span></td>
                  <td className="px-4 py-3">
                    <Link href={`/estoque/${item.id}/movimentar`} className="text-xs text-brand hover:underline">Movimentar</Link>
                  </td>
                </tr>
              )
            }) : (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Nenhum item cadastrado ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
