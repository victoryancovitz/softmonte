import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'

const STATUS_COLOR: Record<string, string> = {
  ativo: 'bg-green-100 text-green-700',
  pausado: 'bg-yellow-100 text-yellow-700',
  concluido: 'bg-gray-100 text-gray-600',
  cancelado: 'bg-red-100 text-red-600',
}

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
            <tr className="border-b border-gray-100 bg-gray-50">
              {['Nome','Cliente','Local','Início','Prev. Fim','Status',''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {obras && obras.length > 0 ? obras.map((o: any) => (
              <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50 group">
                <td className="px-4 py-3 font-semibold">
                  <Link href={`/obras/${o.id}`} className="hover:text-brand">{o.nome}</Link>
                </td>
                <td className="px-4 py-3 text-gray-600">{o.cliente ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500">{o.local ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{o.data_inicio ? new Date(o.data_inicio+'T12:00').toLocaleDateString('pt-BR') : '—'}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{o.data_prev_fim ? new Date(o.data_prev_fim+'T12:00').toLocaleDateString('pt-BR') : '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLOR[o.status] ?? 'bg-gray-100 text-gray-600'}`}>{o.status ?? 'ativo'}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center gap-3 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link href={`/obras/${o.id}`} className="text-xs text-brand hover:underline">Ver</Link>
                    <Link href={`/obras/${o.id}/editar`} className="text-xs text-gray-500 hover:text-gray-800">Editar</Link>
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Nenhuma obra cadastrada.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
