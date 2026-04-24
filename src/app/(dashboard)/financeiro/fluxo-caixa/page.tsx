import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'
import BackButton from '@/components/BackButton'
import { fmt } from '@/lib/cores'
import FluxoCaixaClient from './FluxoCaixaClient'

export default async function FluxoCaixaPage() {
  const supabase = createClient()

  const [{ data: fluxo }, { data: contas }] = await Promise.all([
    supabase.from('vw_fluxo_mensal').select('*').order('mes').limit(24),
    supabase.from('vw_contas_saldo').select('*'),
  ])

  const rows = (fluxo ?? []).map((r: any) => ({
    mes: r.mes,
    receita_paga: Number(r.receita_paga || 0),
    receita_em_aberto: Number(r.receita_em_aberto || 0),
    despesa_paga: Number(r.despesa_paga || 0),
    despesa_em_aberto: Number(r.despesa_em_aberto || 0),
    provisao: Number(r.provisao || 0),
    resultado_caixa: Number(r.resultado_caixa || 0),
    resultado_previsto: Number(r.resultado_previsto || 0),
    qtd: Number(r.qtd || 0),
  }))

  const saldoConsolidado = (contas ?? []).reduce((s: number, c: any) => s + Number(c.saldo || 0), 0)

  // Current month row
  const hoje = new Date().toISOString().slice(0, 7) // "2026-04"
  const mesAtual = rows.find(r => r.mes === hoje)
  const resultadoCaixaMes = mesAtual?.resultado_caixa ?? 0

  // Next month for 30-day forecast
  const nextMonth = new Date()
  nextMonth.setMonth(nextMonth.getMonth() + 1)
  const mesProximo = nextMonth.toISOString().slice(0, 7)
  const proxRow = rows.find(r => r.mes === mesProximo)
  const previsao30d = proxRow?.resultado_previsto ?? mesAtual?.resultado_previsto ?? 0

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/financeiro" />
        <Link href="/financeiro" className="text-gray-400 hover:text-gray-600">Financeiro</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700">Fluxo de Caixa</span>
      </div>

      <div className="mb-6">
        <h1 className="text-xl font-bold font-display text-brand mb-1">Fluxo de Caixa</h1>
        <p className="text-sm text-gray-500">Receitas, despesas e resultado mensal consolidado.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-gray-100 border-l-4 border-l-blue-500 p-4">
          <div className="text-[11px] font-semibold text-gray-400 uppercase">Saldo Consolidado</div>
          <div className={`text-lg font-bold font-display ${saldoConsolidado >= 0 ? 'text-gray-900' : 'text-red-700'}`}>
            {fmt(saldoConsolidado)}
          </div>
        </div>
        <div className={`bg-white rounded-xl border border-gray-100 border-l-4 ${resultadoCaixaMes >= 0 ? 'border-l-green-500' : 'border-l-red-500'} p-4`}>
          <div className="text-[11px] font-semibold text-gray-400 uppercase">Resultado Caixa (mes atual)</div>
          <div className={`text-lg font-bold font-display ${resultadoCaixaMes >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {fmt(resultadoCaixaMes)}
          </div>
        </div>
        <div className={`bg-white rounded-xl border border-gray-100 border-l-4 ${previsao30d >= 0 ? 'border-l-amber-500' : 'border-l-red-500'} p-4`}>
          <div className="text-[11px] font-semibold text-gray-400 uppercase">Previsao 30 dias</div>
          <div className={`text-lg font-bold font-display ${previsao30d >= 0 ? 'text-amber-700' : 'text-red-700'}`}>
            {fmt(previsao30d)}
          </div>
        </div>
      </div>

      <FluxoCaixaClient rows={rows} />
    </div>
  )
}
