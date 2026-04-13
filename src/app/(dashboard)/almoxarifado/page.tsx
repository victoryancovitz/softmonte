import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'
import EmptyState from '@/components/ui/EmptyState'
import { Package } from 'lucide-react'
import AlmoxarifadoClient from './AlmoxarifadoClient'

export default async function AlmoxarifadoPage() {
  const supabase = createClient()
  const [{ data: itens }, { data: fornecedores }] = await Promise.all([
    supabase.from('vw_estoque_posicao').select('*').order('nome'),
    supabase.from('fornecedores').select('id, nome').is('deleted_at', null).order('nome'),
  ])
  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold font-display text-brand">Almoxarifado</h1>
          <p className="text-sm text-gray-500">{(itens ?? []).length} itens cadastrados</p>
        </div>
      </div>
      <AlmoxarifadoClient itens={itens ?? []} fornecedores={fornecedores ?? []} />
    </div>
  )
}
