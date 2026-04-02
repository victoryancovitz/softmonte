import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'

const TIPO_BADGE: Record<string, { label: string; cls: string }> = {
  falta_injustificada:  { label: 'FALTA', cls: 'bg-red-100 text-red-700' },
  falta_justificada:    { label: 'JUSTIFICADA', cls: 'bg-orange-100 text-orange-700' },
  atestado_medico:      { label: 'ATESTADO', cls: 'bg-blue-100 text-blue-700' },
  atestado_acidente:    { label: 'ACIDENTE', cls: 'bg-blue-100 text-blue-700' },
  licenca_maternidade:  { label: 'LIC. MATERNIDADE', cls: 'bg-green-100 text-green-700' },
  licenca_paternidade:  { label: 'LIC. PATERNIDADE', cls: 'bg-green-100 text-green-700' },
  folga_compensatoria:  { label: 'FOLGA', cls: 'bg-gray-100 text-gray-600' },
  feriado:              { label: 'FERIADO', cls: 'bg-gray-100 text-gray-600' },
  suspensao:            { label: 'SUSPENSÃO', cls: 'bg-red-100 text-red-700' },
  outro:                { label: 'OUTRO', cls: 'bg-gray-100 text-gray-600' },
}

export default async function FaltasPage() {
  const supabase = createClient()

  const { data: faltas } = await supabase
    .from('faltas')
    .select('*, funcionarios(nome, cargo, matricula), obras(nome)')
    .order('data', { ascending: false })

  const rows = faltas ?? []

  // KPIs: current month
  const now = new Date()
  const mesAtual = now.getMonth()
  const anoAtual = now.getFullYear()

  const doMes = rows.filter(f => {
    const d = new Date(f.data + 'T12:00:00')
    return d.getMonth() === mesAtual && d.getFullYear() === anoAtual
  })

  const faltasInjustificadasMes = doMes.filter(f => f.tipo === 'falta_injustificada').length
  const atestadosMes = doMes.filter(f => f.tipo === 'atestado_medico').length

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold font-display text-brand">Faltas &amp; Atestados</h1>
          <p className="text-sm text-gray-500 mt-0.5">{rows.length} registro(s) total</p>
        </div>
        <Link href="/faltas/nova" className="px-4 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark">
          + Registrar
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Faltas Injustificadas (mês)</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{faltasInjustificadasMes}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Atestados (mês)</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{atestadosMes}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Total no mês</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{doMes.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Total geral</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{rows.length}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {['Funcionário', 'Obra', 'Data', 'Tipo', 'Observação', 'Arquivo'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? rows.map((f: any) => {
              const badge = TIPO_BADGE[f.tipo] ?? { label: f.tipo, cls: 'bg-gray-100 text-gray-600' }
              const dataFormatada = f.data
                ? new Date(f.data + 'T12:00:00').toLocaleDateString('pt-BR')
                : '—'
              return (
                <tr key={f.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{f.funcionarios?.nome ?? '—'}</div>
                    <div className="text-xs text-gray-400">{f.funcionarios?.cargo} · {f.funcionarios?.matricula}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{f.obras?.nome ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{dataFormatada}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${badge.cls}`}>{badge.label}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px] truncate">{f.observacao ?? '—'}</td>
                  <td className="px-4 py-3">
                    {f.arquivo_url ? (
                      <a href={f.arquivo_url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand hover:underline">
                        Ver arquivo
                      </a>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              )
            }) : (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                  Nenhuma falta ou atestado registrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
