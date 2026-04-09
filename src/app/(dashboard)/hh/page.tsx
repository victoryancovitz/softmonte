import { createClient } from '@/lib/supabase-server'
import { getRole } from '@/lib/get-role'
import Link from 'next/link'
import HHTable from './HHTable'

export default async function HHPage() {
  const supabase = createClient()
  const role = await getRole()
  const hoje = new Date()
  const mesAtual = hoje.getMonth() + 1
  const anoAtual = hoje.getFullYear()

  const { data: lancamentos } = await supabase
    .from('hh_lancamentos')
    .select('*, funcionarios(nome, cargo, matricula, custo_hora), obras(nome)')
    .eq('mes', mesAtual).eq('ano', anoAtual)
    .order('created_at', { ascending: false })

  // Totais do mes atual
  const totalNormais = lancamentos?.reduce((s, l) => s + Number(l.horas_normais ?? 0), 0) ?? 0
  const totalExtras = lancamentos?.reduce((s, l) => s + Number(l.horas_extras ?? 0), 0) ?? 0
  const totalNot = lancamentos?.reduce((s, l) => s + Number(l.horas_noturnas ?? 0), 0) ?? 0
  const totalCusto = lancamentos?.reduce((s, l) => {
    const ch = Number(l.funcionarios?.custo_hora ?? 0)
    return s + (Number(l.horas_normais ?? 0) * ch) + (Number(l.horas_extras ?? 0) * ch * 1.7) + (Number(l.horas_noturnas ?? 0) * ch * 1.4)
  }, 0) ?? 0

  const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold font-display text-brand">Gestao de HH</h1>
          <p className="text-sm text-gray-500 mt-0.5">{MESES[mesAtual-1]}/{anoAtual} · {lancamentos?.length ?? 0} lancamentos</p>
        </div>
        <Link href="/hh/novo" className="px-4 py-2 bg-brand text-white rounded-xl text-sm font-semibold hover:bg-brand-dark">+ Lancamento</Link>
      </div>

      {/* KPIs do mes */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-5">
        {[
          { label: 'Horas normais', value: totalNormais.toFixed(0) + 'h', color: 'text-brand' },
          { label: 'Horas extras', value: totalExtras.toFixed(0) + 'h', color: 'text-amber-600' },
          { label: 'Horas noturnas', value: totalNot.toFixed(0) + 'h', color: 'text-blue-600' },
          { label: 'Custo estimado', value: fmt(totalCusto), color: 'text-green-700' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{k.label}</div>
            <div className={`text-xl font-bold font-display ${k.color}`}>{k.value}</div>
          </div>
        ))}
      </div>

      <HHTable lancamentos={lancamentos ?? []} role={role} />
    </div>
  )
}
