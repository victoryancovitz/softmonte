import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'

const CAT_COLOR: Record<string, string> = {
  EPI: 'bg-blue-100 text-blue-700',
  Material: 'bg-green-100 text-green-700',
  Ferramenta: 'bg-amber-100 text-amber-700',
  Consumivel: 'bg-purple-100 text-purple-700',
}

export default async function EstoquePage() {
  const supabase = createClient()
  const { data: itens } = await supabase.from('estoque_itens').select('*').order('categoria').order('nome')

  const criticos = itens?.filter((i: any) => Number(i.quantidade) <= Number(i.quantidade_minima ?? 0)) ?? []
  const totalItens = itens?.length ?? 0

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold font-display text-brand">Estoque</h1>
          <p className="text-sm text-gray-500 mt-0.5">{totalItens} itens · {criticos.length} abaixo do mínimo</p>
        </div>
        <Link href="/estoque/novo" className="px-4 py-2 bg-brand text-white rounded-xl text-sm font-semibold hover:bg-brand-dark">+ Novo item</Link>
      </div>

      {criticos.length > 0 && (
        <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="font-semibold text-amber-800 text-sm mb-1">⚠️ {criticos.length} iten(s) abaixo do estoque mínimo</div>
          <div className="text-xs text-amber-700">{criticos.map((i: any) => i.nome).join(' · ')}</div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {['Código','Nome','Categoria','Depósito','Qtd. Atual','Qtd. Mínima','Status',''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {itens && itens.length > 0 ? itens.map((i: any) => {
              const critico = Number(i.quantidade) <= Number(i.quantidade_minima ?? 0)
              return (
                <tr key={i.id} className={`border-b border-gray-50 hover:bg-gray-50/80 group ${critico ? 'bg-amber-50/30' : ''}`}>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">{i.codigo}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">{i.nome}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CAT_COLOR[i.categoria] ?? 'bg-gray-100 text-gray-600'}`}>{i.categoria}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{i.deposito ?? '—'}</td>
                  <td className={`px-4 py-3 font-bold text-lg font-display ${critico ? 'text-red-600' : 'text-brand'}`}>
                    {Number(i.quantidade).toFixed(0)} <span className="text-xs font-normal text-gray-400">{i.unidade}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-sm">{i.quantidade_minima ?? 0} {i.unidade}</td>
                  <td className="px-4 py-3">
                    {critico
                      ? <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">Crítico</span>
                      : <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">OK</span>}
                  </td>
                  <td className="px-4 py-3 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link href={`/estoque/${i.id}`} className="text-xs text-brand hover:underline">Movimentar</Link>
                  </td>
                </tr>
              )
            }) : (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">Nenhum item no estoque.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
