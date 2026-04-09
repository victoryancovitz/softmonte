import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'
import FaltasTable from './FaltasTable'

export default async function FaltasPage() {
  const supabase = createClient()

  const { data: faltas } = await supabase
    .from('faltas')
    .select('*, funcionarios(nome, cargo, matricula), obras(nome)')
    .order('data', { ascending: false })

  const rows = (faltas ?? []).map((f: any) => ({
    ...f,
    funcionario_nome: f.funcionarios?.nome ?? '',
    obra_nome: f.obras?.nome ?? '',
  }))

  // KPIs: current month
  const now = new Date()
  const mesAtual = now.getMonth()
  const anoAtual = now.getFullYear()

  const doMes = rows.filter((f: any) => {
    const d = new Date(f.data + 'T12:00:00')
    return d.getMonth() === mesAtual && d.getFullYear() === anoAtual
  })

  const faltasInjustificadasMes = doMes.filter((f: any) => f.tipo === 'falta_injustificada').length
  const atestadosMes = doMes.filter((f: any) => f.tipo === 'atestado_medico').length

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold font-display text-brand">Faltas &amp; Atestados</h1>
          <p className="text-sm text-gray-500 mt-0.5">{rows.length} registro(s) total</p>
        </div>
        <div className="flex gap-2">
          <Link href="/relatorios/absenteismo" className="px-4 py-2 border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50">
            Ver indice de absenteismo →
          </Link>
          <Link href="/faltas/nova" className="px-4 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark">
            + Registrar
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Faltas Injustificadas (mes)</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{faltasInjustificadasMes}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Atestados (mes)</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{atestadosMes}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Total no mes</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{doMes.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Total geral</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{rows.length}</p>
        </div>
      </div>

      <FaltasTable rows={rows} />
    </div>
  )
}
