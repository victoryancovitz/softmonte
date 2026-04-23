import { createClient } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import BackButton from '@/components/BackButton'
import DividaDetalheClient from './DividaDetalheClient'

export default async function DividaDetalhePage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { id } = params

  const [{ data: passivo }, { data: parcelas }, { data: contas }, { data: centros }] = await Promise.all([
    supabase.from('passivos_nao_circulantes').select('*').eq('id', id).is('deleted_at', null).single(),
    supabase.from('divida_parcelas').select('*').eq('divida_id', id).order('numero'),
    supabase.from('contas_correntes').select('id, nome, banco').eq('ativo', true).is('deleted_at', null).order('nome'),
    supabase.from('centros_custo').select('id, codigo, nome').eq('ativo', true).is('deleted_at', null).order('codigo'),
  ])

  if (!passivo) notFound()

  // Check which parcelas already have lancamentos
  const parcelaIds = (parcelas ?? []).map((p: any) => p.id)
  let lancamentos: any[] = []
  if (parcelaIds.length > 0) {
    const { data } = await supabase
      .from('financeiro_lancamentos')
      .select('id, divida_parcela_id')
      .in('divida_parcela_id', parcelaIds)
      .is('deleted_at', null)
    lancamentos = data ?? []
  }

  // Also check via lancamento_id on parcelas
  const lancamentoIds = (parcelas ?? []).map((p: any) => p.lancamento_id).filter(Boolean)
  let lancamentosByParcelaRef: any[] = []
  if (lancamentoIds.length > 0) {
    const { data } = await supabase
      .from('financeiro_lancamentos')
      .select('id')
      .in('id', lancamentoIds)
      .is('deleted_at', null)
    lancamentosByParcelaRef = data ?? []
  }

  const lancParcelaIdSet = new Set([
    ...lancamentos.map((l: any) => l.divida_parcela_id),
  ])
  const lancRefIdSet = new Set(lancamentosByParcelaRef.map((l: any) => l.id))

  // Mark parcelas with hasLancamento flag
  const parcelasEnriched = (parcelas ?? []).map((p: any) => ({
    ...p,
    hasLancamento: lancParcelaIdSet.has(p.id) || lancRefIdSet.has(p.lancamento_id),
  }))

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/financeiro/dividas" />
        <Link href="/financeiro" className="text-gray-400 hover:text-gray-600">Financeiro</Link>
        <span className="text-gray-300">/</span>
        <Link href="/financeiro/dividas" className="text-gray-400 hover:text-gray-600">Dividas</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700 truncate max-w-[200px]">{passivo.descricao}</span>
      </div>

      <DividaDetalheClient
        passivo={passivo}
        parcelas={parcelasEnriched}
        contas={contas ?? []}
        centros={centros ?? []}
      />
    </div>
  )
}
