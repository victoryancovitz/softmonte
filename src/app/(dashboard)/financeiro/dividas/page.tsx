import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'
import BackButton from '@/components/BackButton'
import DividasClient from './DividasClient'

export default async function DividasPage() {
  const supabase = createClient()
  const [{ data: dividas }, { data: indicadores }, { data: kpis }, { data: cronograma }, { data: composicao }, { data: contas }, { data: fornecedores }, { data: centros }, { data: credorTipos }] = await Promise.all([
    supabase.from('vw_dividas_listagem').select('*'),
    supabase.from('vw_indicadores_divida').select('*').maybeSingle(),
    supabase.from('vw_dividas_kpis').select('*').maybeSingle(),
    supabase.from('vw_dividas_cronograma_mensal').select('*'),
    supabase.from('vw_dividas_composicao').select('*'),
    supabase.from('contas_correntes').select('id, nome, banco').eq('ativo', true).is('deleted_at', null).order('nome'),
    supabase.from('fornecedores').select('id, nome').eq('ativo', true).is('deleted_at', null).order('nome'),
    supabase.from('centros_custo').select('id, codigo, nome').eq('ativo', true).is('deleted_at', null).order('codigo'),
    supabase.from('credor_tipos').select('valor, label').eq('ativo', true).order('label'),
  ])

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/financeiro" />
        <Link href="/financeiro" className="text-gray-400 hover:text-gray-600">Financeiro</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700">Dívidas e Empréstimos</span>
      </div>
      <h1 className="text-xl font-bold font-display text-brand mb-1">Gestão de Dívidas</h1>
      <p className="text-sm text-gray-500 mb-6">Empréstimos, financiamentos, cronograma de parcelas e indicadores de endividamento.</p>
      <DividasClient dividas={dividas ?? []} indicadores={indicadores} kpis={kpis} cronograma={cronograma ?? []} composicao={composicao ?? []} contas={contas ?? []} fornecedores={fornecedores ?? []} centros={centros ?? []} credorTipos={credorTipos ?? []} />
    </div>
  )
}
