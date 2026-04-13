import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'
import BackButton from '@/components/BackButton'
import ConsumidosClient from './ConsumidosClient'

export default async function ConsumidosPage() {
  const supabase = createClient()
  const [{ data: reqs }, { data: itens }, { data: obras }, { data: funcionarios }] = await Promise.all([
    supabase.from('estoque_requisicoes').select('*, obras(nome), funcionarios(nome)').is('deleted_at', null).order('created_at', { ascending: false }),
    supabase.from('estoque_itens').select('id, nome, categoria, quantidade, custo_medio_atual').is('deleted_at', null).order('nome'),
    supabase.from('obras').select('id, nome').eq('status', 'ativo').is('deleted_at', null).order('nome'),
    supabase.from('funcionarios').select('id, nome').is('deleted_at', null).order('nome'),
  ])

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/almoxarifado" />
        <Link href="/almoxarifado" className="text-gray-400 hover:text-gray-600">Almoxarifado</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700">Consumidos</span>
      </div>
      <h1 className="text-xl font-bold font-display text-brand mb-1">Requisições de Material</h1>
      <p className="text-sm text-gray-500 mb-6">Controle de saídas do estoque por obra e funcionário.</p>

      <ConsumidosClient requisicoes={reqs ?? []} itens={itens ?? []} obras={obras ?? []} funcionarios={funcionarios ?? []} />
    </div>
  )
}
