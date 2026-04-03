import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'
import FuncionariosView from '@/components/FuncionariosView'

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
  const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`
  const vencendo = funcs.filter(f => {
    if (!f.prazo1) return false
    const dias = Math.ceil((new Date(f.prazo1+'T12:00').getTime() - hoje.getTime()) / 86400000)
    return dias <= 30 && dias >= -30
  })

  const [{ data: cargos }, { data: prazosLegais }] = await Promise.all([
    supabase.from('funcionarios').select('cargo').order('cargo'),
    supabase.from('vw_prazos_legais').select('funcionario_id,alerta_tipo'),
  ])
  const cargosUnicos = Array.from(new Set(cargos?.map((c: any) => c.cargo).filter(Boolean)))
  const alertaMap: Record<string, string> = {}
  ;(prazosLegais ?? []).forEach((p: any) => { if (p.alerta_tipo && p.alerta_tipo !== 'ok') alertaMap[p.funcionario_id] = p.alerta_tipo })

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold font-display text-brand">Funcionários</h1>
          <p className="text-sm text-gray-500 mt-0.5">{funcs.length} encontrado(s)</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/funcionarios/novo" className="px-4 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark">+ Novo</Link>
        </div>
      </div>

      {vencendo.length > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 flex items-center gap-2">
          <span>Contratos vencendo: <strong>{vencendo.map(f => f.nome.split(' ')[0]).join(', ')}</strong></span>
        </div>
      )}

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

      <FuncionariosView funcs={funcs} hoje={hojeStr} alertas={alertaMap} />
    </div>
  )
}
