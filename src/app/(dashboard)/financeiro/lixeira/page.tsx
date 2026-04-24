import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'
import BackButton from '@/components/BackButton'
import LixeiraClient from './LixeiraClient'

export default async function LixeiraPage() {
  const supabase = createClient()

  const { data: lancamentos } = await supabase
    .from('financeiro_lancamentos')
    .select('id, nome, valor, tipo, deleted_at, deleted_reason')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
    .limit(100)

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/financeiro" />
        <Link href="/financeiro" className="text-gray-400 hover:text-gray-600">Financeiro</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700">Lixeira</span>
      </div>
      <LixeiraClient lancamentos={lancamentos ?? []} />
    </div>
  )
}
