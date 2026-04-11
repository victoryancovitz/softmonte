import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'
import BackButton from '@/components/BackButton'
import SocietarioClient from './SocietarioClient'

export default async function SocietarioPage() {
  const supabase = createClient()
  const [{ data: socios }, { data: movs }, { data: ind }, { data: cfg }, { data: contas }] = await Promise.all([
    supabase.from('socios').select('*').eq('ativo', true).order('nome'),
    supabase.from('movimentacoes_societarias').select('*, socios(nome)').is('deleted_at', null).order('created_at', { ascending: false }).limit(50),
    supabase.from('vw_indicadores_empresa').select('lucro_liquido_caixa, capital_social, distribuicoes').maybeSingle(),
    supabase.from('empresa_config').select('capital_social').maybeSingle(),
    supabase.from('contas_correntes').select('id, nome, banco').eq('ativo', true).is('deleted_at', null).order('nome'),
  ])

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/financeiro" />
        <Link href="/financeiro" className="text-gray-400 hover:text-gray-600">Financeiro</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700">Societário</span>
      </div>
      <h1 className="text-xl font-bold font-display text-brand mb-1">Gestão Societária</h1>
      <p className="text-sm text-gray-500 mb-6">Aportes de capital, distribuição de dividendos e pró-labore.</p>
      <SocietarioClient socios={socios ?? []} movimentacoes={movs ?? []} indicadores={ind} config={cfg} contas={contas ?? []} />
    </div>
  )
}
