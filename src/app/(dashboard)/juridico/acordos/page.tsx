import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'

const fmt = (v: number | null | undefined) =>
  v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ --'

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('pt-BR') : '--'

const STATUS_BADGE: Record<string, string> = {
  ativo: 'bg-green-100 text-green-700',
  concluido: 'bg-blue-100 text-blue-700',
  inadimplente: 'bg-red-100 text-red-700',
  cancelado: 'bg-zinc-100 text-zinc-600',
}

export default async function AcordosPage() {
  const supabase = createClient()

  const { data } = await supabase
    .from('processo_acordos')
    .select('*, processos_juridicos(numero_cnj, parte_contraria, tipo, status)')
    .order('created_at', { ascending: false })

  const acordos = data ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Acordos</h1>
          <p className="text-sm text-gray-500">{acordos.length} acordo(s) registrado(s)</p>
        </div>
      </div>

      {acordos.length === 0 ? (
        <div className="bg-white border rounded-xl p-10 text-center text-gray-400">
          <p className="text-sm">Nenhum acordo registrado.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Processo (CNJ)</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Parte Contraria</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Valor Total</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Parcelas</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Primeira Parcela</th>
              </tr>
            </thead>
            <tbody>
              {acordos.map((a: any) => (
                <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50/80">
                  <td className="px-4 py-2.5 font-mono text-xs">
                    {a.processo_id ? (
                      <Link href={`/juridico/processos/${a.processo_id}`} className="text-blue-600 hover:underline">
                        {a.processos_juridicos?.numero_cnj || '--'}
                      </Link>
                    ) : '--'}
                  </td>
                  <td className="px-4 py-2.5 text-gray-700">
                    {a.processos_juridicos?.parte_contraria || '--'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium text-gray-900">
                    {fmt(a.valor_total)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-600">
                    {a.parcelas ?? '--'}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${STATUS_BADGE[a.status] || 'bg-gray-100 text-gray-600'}`}>
                      {a.status || '--'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">
                    {fmtDate(a.data_primeira_parcela)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
