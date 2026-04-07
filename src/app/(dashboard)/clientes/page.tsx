import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'

export default async function ClientesPage() {
  const supabase = createClient()
  const { data: clientes } = await supabase.from('clientes').select('*').is('deleted_at', null).order('nome')
  const rows = clientes ?? []

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold font-display text-brand">Clientes</h1>
          <p className="text-sm text-gray-500 mt-0.5">{rows.length} cadastrado(s)</p>
        </div>
        <Link href="/clientes/novo" className="px-4 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark">+ Novo cliente</Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {['Nome', 'Cidade', 'Email', 'Contatos', 'Status', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? rows.map((c: any) => {
              const contatos = Array.isArray(c.contatos) ? c.contatos : []
              const ativo = c.ativo !== false
              return (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/80 group">
                  <td className="px-4 py-3 font-semibold">
                    <Link href={`/clientes/${c.id}`} className="hover:text-brand transition-colors">{c.nome}</Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.cidade ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{c.email_principal ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {contatos.length > 0 ? `${contatos.length} contato${contatos.length > 1 ? 's' : ''}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center gap-3 justify-end opacity-0 group-hover:opacity-100 sm:opacity-100 transition-opacity">
                      <Link href={`/clientes/${c.id}`} className="text-xs text-brand hover:underline">Ver</Link>
                      <Link href={`/clientes/${c.id}/editar`} className="text-xs text-gray-500 hover:text-gray-800">Editar</Link>
                    </div>
                  </td>
                </tr>
              )
            }) : (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                Nenhum cliente cadastrado.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
