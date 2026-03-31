import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'

export default async function DocumentosPage() {
  const supabase = createClient()
  const { data: docs } = await supabase
    .from('documentos')
    .select('*, funcionarios(nome, cargo)')
    .order('vencimento', { ascending: true })

  function getDiasStatus(vencimento: string) {
    const dias = Math.ceil((new Date(vencimento).getTime() - Date.now()) / 86400000)
    if (dias < 0) return { dias, label: 'Vencido', cls: 'bg-red-100 text-red-700' }
    if (dias <= 7) return { dias, label: 'Urgente', cls: 'bg-red-100 text-red-700' }
    if (dias <= 30) return { dias, label: 'Atenção', cls: 'bg-amber-100 text-amber-700' }
    return { dias, label: 'OK', cls: 'bg-green-100 text-green-700' }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Documentos & Vencimentos</h1>
          <p className="text-sm text-gray-500 mt-0.5">ASOs, NRs e certificações dos funcionários</p>
        </div>
        <Link href="/documentos/novo" className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark transition-colors">
          + Adicionar documento
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Funcionário</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Cargo</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Tipo</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Vencimento</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Dias restantes</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {docs && docs.length > 0 ? docs.map((d: any) => {
              const { dias, label, cls } = getDiasStatus(d.vencimento)
              const isUrgent = dias <= 7
              return (
                <tr key={d.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${isUrgent ? 'bg-red-50/30' : ''}`}>
                  <td className="px-4 py-3 font-medium">{d.funcionarios?.nome ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{d.funcionarios?.cargo ?? '—'}</td>
                  <td className="px-4 py-3"><span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full font-medium">{d.tipo}</span></td>
                  <td className="px-4 py-3 text-gray-600">{new Date(d.vencimento).toLocaleDateString('pt-BR')}</td>
                  <td className={`px-4 py-3 font-medium ${dias <= 0 ? 'text-red-600' : dias <= 7 ? 'text-red-600' : dias <= 30 ? 'text-amber-600' : 'text-gray-600'}`}>
                    {dias < 0 ? `${Math.abs(dias)}d atrás` : `${dias}d`}
                  </td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{label}</span></td>
                  <td className="px-4 py-3"><Link href={`/documentos/${d.id}/renovar`} className="text-xs text-brand hover:underline">Renovar</Link></td>
                </tr>
              )
            }) : (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Nenhum documento cadastrado ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
