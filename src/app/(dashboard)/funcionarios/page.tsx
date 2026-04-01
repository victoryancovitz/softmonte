import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'

const STATUS_COLOR: Record<string, string> = {
  disponivel: 'bg-green-100 text-green-700',
  alocado: 'bg-blue-100 text-blue-700',
  afastado: 'bg-yellow-100 text-yellow-700',
  inativo: 'bg-gray-100 text-gray-500',
}

export default async function FuncionariosPage() {
  const supabase = createClient()
  const { data: funcs } = await supabase.from('funcionarios').select('*').order('nome')

  const vencendo = funcs?.filter((f: any) => {
    const prazo = f.prazo1
    if (!prazo) return false
    const dias = Math.ceil((new Date(prazo).getTime() - Date.now()) / 86400000)
    return dias <= 30 && dias >= 0
  }) ?? []

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Funcionários</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {funcs?.length ?? 0} cadastrados
            {vencendo.length > 0 && <span className="ml-2 text-amber-600 font-medium">· {vencendo.length} contrato(s) vencendo</span>}
          </p>
        </div>
        <Link href="/funcionarios/novo" className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark">+ Novo funcionário</Link>
      </div>

      {vencendo.length > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 flex items-center gap-2">
          <span>⚠️</span>
          <span>Contratos vencendo em 30 dias: <strong>{vencendo.map((f: any) => f.nome.split(' ')[0]).join(', ')}</strong></span>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {['Mat.','Nome','Cargo','VT','Prazo 1','Status',''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {funcs && funcs.length > 0 ? funcs.map((f: any) => {
              const p1 = f.prazo1 ? new Date(f.prazo1 + 'T12:00') : null
              const diasP1 = p1 ? Math.ceil((p1.getTime() - Date.now()) / 86400000) : null
              const alerta = diasP1 !== null && diasP1 <= 30 && diasP1 >= 0
              return (
                <tr key={f.id} className="border-b border-gray-50 hover:bg-gray-50 group">
                  <td className="px-4 py-3 text-gray-400 text-xs font-mono">{f.matricula}</td>
                  <td className="px-4 py-3 font-semibold">
                    <Link href={`/funcionarios/${f.id}`} className="hover:text-brand transition-colors">{f.nome}</Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{f.cargo}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{f.vt_estrutura ?? '—'}</td>
                  <td className={`px-4 py-3 text-xs font-medium ${alerta ? 'text-amber-600' : 'text-gray-500'}`}>
                    {p1 ? p1.toLocaleDateString('pt-BR') : '—'}
                    {alerta && <span className="ml-1 bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[10px]">{diasP1}d</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLOR[f.status] ?? 'bg-gray-100'}`}>{f.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center gap-3 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link href={`/funcionarios/${f.id}`} className="text-xs text-brand hover:underline">Ver</Link>
                      <Link href={`/funcionarios/${f.id}/editar`} className="text-xs text-gray-500 hover:text-gray-800">Editar</Link>
                    </div>
                  </td>
                </tr>
              )
            }) : (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Nenhum funcionário cadastrado ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
