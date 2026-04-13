import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'
import BackButton from '@/components/BackButton'
import EmptyState from '@/components/ui/EmptyState'
import { ClipboardList } from 'lucide-react'

const fmt = (v: any) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default async function ConsumidosPage() {
  const supabase = createClient()
  const { data: reqs } = await supabase.from('estoque_requisicoes').select('*, obras(nome), funcionarios(nome)').is('deleted_at', null).order('created_at', { ascending: false })

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/almoxarifado" />
        <Link href="/almoxarifado" className="text-gray-400 hover:text-gray-600">Almoxarifado</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700">Consumidos</span>
      </div>
      <h1 className="text-xl font-bold font-display text-brand mb-1">Requisições de Material</h1>
      <p className="text-sm text-gray-500 mb-6">Controle de saídas do estoque por obra e funcionário.</p>

      {(reqs ?? []).length === 0 ? (
        <EmptyState titulo="Nenhuma requisição" descricao="Registre saídas de material do almoxarifado vinculadas às obras." icone={<ClipboardList className="w-10 h-10" />} />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 border-b border-gray-100">
              {['Nº', 'Data', 'Solicitante', 'Obra', 'Custo Total', 'Status'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {(reqs ?? []).map((r: any) => (
                <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{r.numero}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{r.data_requisicao ? new Date(r.data_requisicao + 'T12:00').toLocaleDateString('pt-BR') : '—'}</td>
                  <td className="px-4 py-3">{r.funcionarios?.nome || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{r.obras?.nome || '—'}</td>
                  <td className="px-4 py-3 font-semibold">{fmt(r.custo_total)}</td>
                  <td className="px-4 py-3"><span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${r.status === 'entregue' ? 'bg-green-100 text-green-700' : r.status === 'aprovada' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
