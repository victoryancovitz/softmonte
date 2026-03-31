import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

export default async function HHPage() {
  const supabase = createClient()
  const now = new Date()
  const mes = now.getMonth() + 1
  const ano = now.getFullYear()

  const { data: lancamentos } = await supabase
    .from('hh_lancamentos')
    .select('*, funcionarios(nome, cargo), obras(nome)')
    .eq('mes', mes)
    .eq('ano', ano)
    .order('created_at', { ascending: false })

  const totalNormais = lancamentos?.reduce((s, l) => s + (l.horas_normais ?? 0), 0) ?? 0
  const totalExtras = lancamentos?.reduce((s, l) => s + (l.horas_extras ?? 0), 0) ?? 0
  const totalNot = lancamentos?.reduce((s, l) => s + (l.horas_noturnas ?? 0), 0) ?? 0

  const AUDIT_BADGE: Record<string, string> = {
    pendente: 'bg-amber-100 text-amber-700',
    aprovado: 'bg-green-100 text-green-700',
    divergencia: 'bg-red-100 text-red-700',
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Gestão de HH</h1>
          <p className="text-sm text-gray-500 mt-0.5">{MESES[mes-1]} {ano}</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
            Importar ponto
          </button>
          <button className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
            Exportar auditoria
          </button>
          <Link href="/hh/novo" className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark transition-colors">
            + Lançar HH
          </Link>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total geral', value: `${totalNormais + totalExtras + totalNot}h` },
          { label: 'Horas normais', value: `${totalNormais}h` },
          { label: 'Horas extras', value: `${totalExtras}h`, color: 'text-amber-600' },
          { label: 'Horas noturnas', value: `${totalNot}h`, color: 'text-blue-600' },
        ].map(k => (
          <div key={k.label} className="bg-gray-100 rounded-xl p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{k.label}</div>
            <div className={`text-2xl font-semibold ${k.color ?? 'text-gray-900'}`}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Funcionário</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Cargo</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Obra</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Normais</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Extras</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Noturnas</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Total</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Ponto</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Auditoria</th>
            </tr>
          </thead>
          <tbody>
            {lancamentos && lancamentos.length > 0 ? lancamentos.map((l: any) => (
              <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium">{l.funcionarios?.nome ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{l.funcionarios?.cargo ?? '—'}</td>
                <td className="px-4 py-3 text-gray-600">{l.obras?.nome ?? '—'}</td>
                <td className="px-4 py-3 text-right">{l.horas_normais}h</td>
                <td className={`px-4 py-3 text-right font-medium ${l.horas_extras > 0 ? 'text-amber-600' : 'text-gray-300'}`}>{l.horas_extras}h</td>
                <td className={`px-4 py-3 text-right font-medium ${l.horas_noturnas > 0 ? 'text-blue-600' : 'text-gray-300'}`}>{l.horas_noturnas}h</td>
                <td className="px-4 py-3 text-right font-semibold">{l.horas_normais + l.horas_extras + l.horas_noturnas}h</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${l.importado_ponto ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {l.importado_ponto ? 'Importado' : 'Manual'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${AUDIT_BADGE[l.auditoria_status] ?? 'bg-gray-100 text-gray-500'}`}>
                    {l.auditoria_status}
                  </span>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Nenhum lançamento de HH para {MESES[mes-1]} {ano}.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
