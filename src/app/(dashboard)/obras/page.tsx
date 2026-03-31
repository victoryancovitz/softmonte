import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'

export default async function ObrasPage() {
  const supabase = createClient()
  const { data: obras } = await supabase.from('obras').select('*').order('created_at', { ascending: false })

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Obras</h1>
          <p className="text-sm text-gray-500 mt-0.5">{obras?.length ?? 0} obras cadastradas</p>
        </div>
        <Link href="/obras/nova" className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark transition-colors">+ Nova obra</Link>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Nome</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Cliente</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Local</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Inicio</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Prev. Fim</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
            </tr>
          </thead>
          <tbody>
            {obras && obras.length > 0 ? obras.map((o: any) => (
              <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{o.nome}</td>
                <td className="px-4 py-3 text-gray-600">{o.cliente ?? '-'}</td>
                <td className="px-4 py-3 text-gray-600">{o.local ?? '-'}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{o.data_inicio ? new Date(o.data_inicio).toLocaleDateString('pt-BR') : '-'}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{o.data_prev_fim ? new Date(o.data_prev_fim).toLocaleDateString('pt-BR') : '-'}</td>
                <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${o.status === 'ativo' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{o.status ?? 'ativo'}</span></td>
              </tr>
            )) : (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Nenhuma obra cadastrada ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
