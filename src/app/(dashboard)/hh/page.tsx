import { createClient } from '@/lib/supabase-server'
import { getRole } from '@/lib/get-role'
import Link from 'next/link'
import { ExcluirHHBtn } from '@/components/DeleteActions'

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

  const { data: todosMeses } = await supabase
    .from('hh_lancamentos')
    .select('mes, ano, horas_normais, horas_extras, horas_noturnas')
    .order('ano', { ascending: false }).order('mes', { ascending: false })

  // Totais do mês atual
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
          <h1 className="text-xl font-bold font-display text-brand">Gestão de HH</h1>
          <p className="text-sm text-gray-500 mt-0.5">{MESES[mesAtual-1]}/{anoAtual} · {lancamentos?.length ?? 0} lançamentos</p>
        </div>
        <Link href="/hh/novo" className="px-4 py-2 bg-brand text-white rounded-xl text-sm font-semibold hover:bg-brand-dark">+ Lançamento</Link>
      </div>

      {/* KPIs do mês */}
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

      {/* Tabela de lançamentos */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {['Funcionário','Obra','H.Normais','H.Extras','H.Noturnas','Total','Custo estimado',''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lancamentos && lancamentos.length > 0 ? lancamentos.map((l: any) => {
              const ch = Number(l.funcionarios?.custo_hora ?? 0)
              const custo = Number(l.horas_normais ?? 0) * ch + Number(l.horas_extras ?? 0) * ch * 1.7 + Number(l.horas_noturnas ?? 0) * ch * 1.4
              const total = Number(l.horas_normais ?? 0) + Number(l.horas_extras ?? 0) + Number(l.horas_noturnas ?? 0)
              return (
                <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50/80">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-900">{l.funcionarios?.nome}</div>
                    <div className="text-xs text-gray-400">{l.funcionarios?.cargo}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{l.obras?.nome}</td>
                  <td className="px-4 py-3 text-center font-mono text-sm">{Number(l.horas_normais ?? 0).toFixed(0)}</td>
                  <td className="px-4 py-3 text-center font-mono text-sm text-amber-600">{Number(l.horas_extras ?? 0).toFixed(0)}</td>
                  <td className="px-4 py-3 text-center font-mono text-sm text-blue-600">{Number(l.horas_noturnas ?? 0).toFixed(0)}</td>
                  <td className="px-4 py-3 text-center font-bold text-brand">{total.toFixed(0)}h</td>
                  <td className="px-4 py-3 text-green-700 font-semibold text-xs">{fmt(custo)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="inline-flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${l.auditoria_status === 'aprovado' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {l.auditoria_status ?? 'pendente'}
                      </span>
                      <ExcluirHHBtn hhId={l.id} nome={l.funcionarios?.nome} role={role} />
                    </span>
                  </td>
                </tr>
              )
            }) : (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">Nenhum lançamento este mês.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
