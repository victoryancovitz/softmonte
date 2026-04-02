import { createClient } from '@/lib/supabase-server'
import { getRole } from '@/lib/get-role'
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
  searchParams: { q?: string; status?: string; cargo?: string; view?: string }
}) {
  const supabase = createClient()
  const role = await getRole()
  const q      = searchParams.q?.toLowerCase() ?? ''
  const status = searchParams.status ?? ''
  const cargo  = searchParams.cargo ?? ''
  const view   = searchParams.view ?? 'cards'

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
    return dias <= 30 && dias >= -30
  })

  const { data: cargos } = await supabase.from('funcionarios').select('cargo').order('cargo')
  const cargosUnicos = Array.from(new Set(cargos?.map((c: any) => c.cargo).filter(Boolean)))

  // Build toggle URLs preserving current filters
  const buildViewUrl = (v: string) => {
    const params = new URLSearchParams()
    params.set('view', v)
    if (q) params.set('q', q)
    if (status) params.set('status', status)
    if (cargo) params.set('cargo', cargo)
    return `/funcionarios?${params.toString()}`
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold font-display text-brand">Funcionários</h1>
          <p className="text-sm text-gray-500 mt-0.5">{funcs.length} encontrado(s)</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex border border-gray-200 rounded-lg overflow-hidden">
            <Link
              href={buildViewUrl('cards')}
              className={`px-3 py-1.5 text-xs font-medium ${view === 'cards' ? 'bg-brand text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
            >
              Cards
            </Link>
            <Link
              href={buildViewUrl('table')}
              className={`px-3 py-1.5 text-xs font-medium ${view === 'table' ? 'bg-brand text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
            >
              Tabela
            </Link>
          </div>
          <Link href="/funcionarios/novo" className="px-4 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark">+ Novo</Link>
        </div>
      </div>

      {/* Alert banner */}
      {vencendo.length > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 flex items-center gap-2">
          ⚠️ <span>Contratos vencendo: <strong>{vencendo.map(f => f.nome.split(' ')[0]).join(', ')}</strong></span>
        </div>
      )}

      {/* Filtros */}
      <form method="GET" className="flex gap-3 mb-5">
        <input type="hidden" name="view" value={view} />
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
          <a href={`/funcionarios?view=${view}`} className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50">Limpar</a>
        )}
      </form>

      {/* Content */}
      {funcs.length > 0 ? (
        view === 'cards' ? (
          /* Cards view */
          <div className="grid grid-cols-3 gap-4">
            {funcs.map((f: any) => {
              const p1 = f.prazo1 ? new Date(f.prazo1+'T12:00') : null
              const dias = p1 ? Math.ceil((p1.getTime() - hoje.getTime()) / 86400000) : null
              const vencido = dias !== null && dias < 0
              const alerta = dias !== null && dias <= 30 && dias >= 0
              return (
                <Link key={f.id} href={`/funcionarios/${f.id}`}
                  className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-brand/30 transition-all duration-200 block group">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center text-brand font-bold text-sm font-display">
                      {f.nome?.split(' ').map((n: string) => n[0]).slice(0,2).join('').toUpperCase()}
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${STATUS_COLOR[f.status] ?? 'bg-gray-100'}`}>
                      {f.status === 'disponivel' ? 'Disponível' : f.status}
                    </span>
                  </div>
                  <div className="font-semibold text-sm text-gray-900 group-hover:text-brand transition-colors">{f.nome}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{f.cargo} · {f.matricula}</div>
                  {p1 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className={`text-xs font-medium flex items-center gap-1 ${vencido ? 'text-red-600' : alerta ? 'text-amber-600' : 'text-gray-400'}`}>
                        📅 Prazo: {p1.toLocaleDateString('pt-BR')}
                        {vencido && <span className="ml-1 bg-red-100 text-red-700 px-1.5 rounded text-[10px] font-bold">VENCIDO</span>}
                        {alerta && <span className="ml-1 bg-amber-100 text-amber-700 px-1.5 rounded text-[10px]">{dias}d</span>}
                      </div>
                    </div>
                  )}
                </Link>
              )
            })}
          </div>
        ) : (
          /* Table view */
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
                {funcs.map((f: any) => {
                  const p1 = f.prazo1 ? new Date(f.prazo1+'T12:00') : null
                  const dias = p1 ? Math.ceil((p1.getTime() - hoje.getTime()) / 86400000) : null
                  const vencido = dias !== null && dias < 0
                  const alerta = dias !== null && dias <= 30 && dias >= 0
                  return (
                    <tr key={f.id} className="border-b border-gray-50 hover:bg-gray-50 group">
                      <td className="px-4 py-3 text-gray-400 text-xs font-mono">{f.matricula}</td>
                      <td className="px-4 py-3 font-semibold">
                        <Link href={`/funcionarios/${f.id}`} className="hover:text-brand transition-colors">{f.nome}</Link>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{f.cargo}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{f.vt_estrutura ?? '—'}</td>
                      <td className={`px-4 py-3 text-xs font-medium ${vencido ? 'text-red-600' : alerta ? 'text-amber-600' : 'text-gray-500'}`}>
                        {p1 ? p1.toLocaleDateString('pt-BR') : '—'}
                        {vencido && <span className="ml-1 bg-red-100 text-red-700 px-1.5 rounded text-[10px] font-bold">VENCIDO</span>}
                        {alerta && <span className="ml-1 bg-amber-100 text-amber-700 px-1.5 rounded text-[10px]">{dias}d</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold capitalize ${STATUS_COLOR[f.status] ?? 'bg-gray-100'}`}>{f.status === 'disponivel' ? 'Disponível' : f.status}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-3 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link href={`/funcionarios/${f.id}`} className="text-xs text-brand hover:underline">Ver</Link>
                          <Link href={`/funcionarios/${f.id}/editar`} className="text-xs text-gray-500 hover:text-gray-800">Editar</Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      ) : (
        /* Empty state */
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="mx-auto mb-4 text-gray-300">
            <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="2"/>
            <circle cx="24" cy="20" r="8" stroke="currentColor" strokeWidth="2"/>
            <path d="M8 42c0-8.8 7.2-16 16-16s16 7.2 16 16" stroke="currentColor" strokeWidth="2"/>
          </svg>
          <p className="text-gray-500 text-sm font-medium">{q ? `Nenhum resultado para "${q}"` : 'Nenhum funcionário encontrado.'}</p>
          <Link href="/funcionarios/novo" className="mt-3 inline-block px-4 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark">+ Novo funcionário</Link>
        </div>
      )}
    </div>
  )
}
