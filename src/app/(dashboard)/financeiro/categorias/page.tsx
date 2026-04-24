import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'
import BackButton from '@/components/BackButton'
import CategoriasClient from './CategoriasClient'

export default async function CategoriasPage() {
  const supabase = createClient()

  const { data: lancamentos } = await supabase
    .from('financeiro_lancamentos')
    .select('id, descricao, valor, tipo, categoria, data_competencia, fornecedor')
    .is('deleted_at', null)
    .not('categoria', 'is', null)
    .order('data_competencia', { ascending: false })
    .limit(5000)

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/financeiro" />
        <Link href="/financeiro" className="text-gray-400 hover:text-gray-600">Financeiro</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700">Despesas por Categoria</span>
      </div>

      <div className="mb-6">
        <h1 className="text-xl font-bold font-display text-brand mb-1">Despesas por Categoria</h1>
        <p className="text-sm text-gray-500">Analise a distribuicao de lancamentos por categoria.</p>
      </div>

      <CategoriasClient lancamentos={lancamentos ?? []} />
    </div>
  )
}
