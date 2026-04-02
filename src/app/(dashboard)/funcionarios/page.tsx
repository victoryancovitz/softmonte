import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'

const STATUS_COLOR: Record<string, string> = {
  disponivel: 'bg-green-100 text-green-700',
  alocado:    'bg-blue-100 text-blue-700',
  afastado:   'bg-yellow-100 text-yellow-700',
  inativo:    'bg-gray-100 text-gray-500',
}

export default async function FuncionariosPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; cargo?: string }
}) {
  const supabase = createClient()
  const q      = searchParams.q?.toLowerCase() ?? ''
  const status = searchParams.status ?? ''
  const cargo  = searchParams.cargo ?? ''

  let query = supabase.from('funcionarios').select('*').order('nome')
  if (status) query = query.eq('status', status)
  if (cargo)  query = query.ilike('cargo', `%${cargo}%`)

  const { data: all } = await query

  const funcs = q
    ? (all ?? []).filter(f =>
        f.nome?.toLowerCase().includes(q) ||
        f.matricula?.toLowerCase().includes(q) ||
        f.cargo?.toLowerCase().includes(q)
      )
    : (all ?? [])

  const hoje = new Date()
  const vencendo = funcs.filter(f => {
    if (!f.prazo1) return false
    const dias = Math.ceil((new Date(f.prazo1+'T12:00').getTime() - hoje.getTime()) / 86400000)
    return dias <= 30 && dias >= 0
  })

  const { data: cargos } = await supabase.from('funcionarios').select('cargo').order('cargo')
  const cargosUnicos = [...new Set(cargos?.map((c: any) => c.cargo).filter(Boolean))]

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold font-display text-brand">Funcionários</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {funcs.length} encontrado(s)
            {vencendo.length > 0 && <span className="ml-2 text-amber-600 font-medium">· {vencendo.length} contrato(s) vencendo</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/cadastros/funcoes" className="text-xs text-brand hover:underline">Gerenciar funções →</Link>
          <Link href="/funcionarios/novo" className="px-4 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark">+ Novo</Link>
        </div>
      </div>

      {vencendo.length > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 flex items-center gap-2">
          ⚠️ <span>Contratos vencendo: <strong>{vencendo.map(f => f.nome.split(' ')[0]).join(', ')}</strong></span>
        </div>
      )}

      {/* Filtros */}
      <form method="GET" className="flex gap-3 mb-5">
        <input name="q" defaultValue={q} placeholder="Buscar por nome, matrícula ou cargo..."
          className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-white"/>
        <select name="status" defaultValue={status}
          className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
          <option value="">Todos os status</option>
          <option value="disponivel">Disponível</option>
          <option value="alocado">Alocado</option>
          <option value="afastado">Afastado</option>
          <option value="inativo">Inativo</option>
        </select>
        <select name="cargo" defaultValue={cargo}
          className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
          <option value="">Todos os cargos</option>
          {cargosUnicos.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button type="submit" className="px-4 py-2.5 bg-brand text-white rounded-xl text-sm font-semibold hover:bg-brand-dark">Buscar</button>
        {(q || status || cargo) && (
          <a href="/funcionarios" className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50">Limpar</a>
        )}
      </form>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {['Mat.','Nome','Cargo','VT','Prazo 1','Status',''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {funcs.length > 0 ? funcs.map((f: any) => {
              const p1 = f.prazo1 ? new Date(f.prazo1+'T12:00') : null
              const dias = p1 ? Math.ceil((p1.getTime() - hoje.getTime()) / 86400000) : null
              const alerta = dias !== null && dias <= 30 && dias >= 0
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
                    {alerta && <span className="ml-1 bg-amber-100 text-amber-700 px-1.5 rounded text-[10px]">{dias}d</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${STATUS_COLOR[f.status] ?? 'bg-gray-100'}`}>{f.status}</span>
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
              <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                {q ? `Nenhum resultado para "${q}"` : 'Nenhum funcionário encontrado.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
