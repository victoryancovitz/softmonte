export const revalidate = 60 // 1 min cache

import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'
import BackButton from '@/components/BackButton'
import RentabilidadeClient from './RentabilidadeClient'

export default async function RentabilidadePage() {
  const supabase = createClient()

  const [{ data: breakeven }, { data: ciclo }, { data: lancReceita }, { data: folhas }] = await Promise.all([
    supabase.from('vw_breakeven_funcionario').select('*'),
    supabase.from('vw_ciclo_financeiro').select('*'),
    supabase.from('financeiro_lancamentos').select('valor, natureza').eq('tipo', 'receita').is('deleted_at', null),
    supabase.from('folha_fechamentos').select('valor_total_bruto, valor_total_encargos, valor_total_beneficios, valor_total_provisoes, valor_total').is('deleted_at', null),
  ])

  const receitaReal = (lancReceita ?? []).filter((l: any) => l.natureza !== 'financiamento').reduce((s: number, l: any) => s + Number(l.valor), 0)
  const custoSemProv = (folhas ?? []).reduce((s: number, f: any) => s + Number(f.valor_total_bruto || 0) + Number(f.valor_total_encargos || 0) + Number(f.valor_total_beneficios || 0), 0)
  const custoComProv = (folhas ?? []).reduce((s: number, f: any) => s + Number(f.valor_total || 0), 0)
  const temFolhas = (folhas ?? []).length > 0
  const margemReal = (temFolhas && receitaReal > 0) ? ((receitaReal - custoSemProv) / receitaReal * 100) : null
  const margemRealProv = (temFolhas && receitaReal > 0) ? ((receitaReal - custoComProv) / receitaReal * 100) : null

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/diretoria" />
        <span className="text-gray-400">Diretoria</span>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700">Rentabilidade</span>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold font-display text-brand mb-1">Rentabilidade por Funcionário</h1>
          <p className="text-sm text-gray-500">Break-even, margem por HH, custo de mobilização e ciclo financeiro.</p>
        </div>
        <Link href="/diretoria/indicadores" className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg text-sm font-semibold hover:bg-brand-dark transition-colors">
          Ver Indicadores
        </Link>
      </div>

      <RentabilidadeClient
        data={breakeven ?? []}
        ciclo={(ciclo ?? [])[0] ?? null}
        receitaReal={receitaReal}
        margemReal={margemReal}
        margemRealProv={margemRealProv}
      />
    </div>
  )
}
