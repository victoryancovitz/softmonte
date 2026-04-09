import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'
import EstoqueTable from './EstoqueTable'

export default async function EstoquePage() {
  const supabase = createClient()
  const { data: itens } = await supabase.from('estoque_itens').select('*').is('deleted_at', null).order('categoria').order('nome')

  const criticos = itens?.filter((i: any) => Number(i.quantidade) <= Number(i.quantidade_minima ?? 0)) ?? []
  const totalItens = itens?.length ?? 0

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold font-display text-brand">Estoque</h1>
          <p className="text-sm text-gray-500 mt-0.5">{totalItens} itens · {criticos.length} abaixo do minimo</p>
        </div>
        <Link href="/estoque/novo" className="px-4 py-2 bg-brand text-white rounded-xl text-sm font-semibold hover:bg-brand-dark">+ Novo item</Link>
      </div>

      {criticos.length > 0 && (
        <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="font-semibold text-amber-800 text-sm mb-1">⚠️ {criticos.length} iten(s) abaixo do estoque minimo</div>
          <div className="text-xs text-amber-700">{criticos.map((i: any) => i.nome).join(' · ')}</div>
        </div>
      )}

      <EstoqueTable itens={itens ?? []} />
    </div>
  )
}
