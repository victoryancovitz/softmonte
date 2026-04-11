import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'
import BackButton from '@/components/BackButton'
import RentabilidadeClient from './RentabilidadeClient'

export default async function RentabilidadePage() {
  const supabase = createClient()

  const [{ data: breakeven }, { data: ciclo }] = await Promise.all([
    supabase.from('vw_breakeven_funcionario').select('*'),
    supabase.from('vw_ciclo_financeiro').select('*'),
  ])

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/funcionarios" />
        <span className="text-gray-400">RH</span>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700">Rentabilidade</span>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold font-display text-brand mb-1">Rentabilidade por Funcionário</h1>
          <p className="text-sm text-gray-500">Break-even, margem por HH, custo de mobilização e ciclo financeiro.</p>
        </div>
      </div>

      <RentabilidadeClient data={breakeven ?? []} ciclo={(ciclo ?? [])[0] ?? null} />
    </div>
  )
}
