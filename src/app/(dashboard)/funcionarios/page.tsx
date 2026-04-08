import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'
import FuncionariosView from '@/components/FuncionariosView'

export default async function FuncionariosPage() {
  const supabase = createClient()

  const { data: all } = await supabase
    .from('funcionarios')
    .select('*')
    .order('nome')

  const funcs = all ?? []

  const hoje = new Date()
  const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`
  const vencendo = funcs.filter(f => {
    if (!f.prazo1) return false
    const dias = Math.ceil((new Date(f.prazo1+'T12:00').getTime() - hoje.getTime()) / 86400000)
    return dias <= 30 && dias >= -30
  })

  const cargosUnicos = Array.from(new Set(funcs.map(f => f.cargo).filter(Boolean))).sort()

  const { data: prazosLegais } = await supabase.from('vw_prazos_legais').select('funcionario_id,alerta_tipo').limit(1000)
  const alertaMap: Record<string, string> = {}
  ;(prazosLegais ?? []).forEach((p: any) => { if (p.alerta_tipo && p.alerta_tipo !== 'ok') alertaMap[p.funcionario_id] = p.alerta_tipo })

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold font-display text-brand">Funcionários</h1>
          <p className="text-sm text-gray-500 mt-0.5">{funcs.length} funcionário(s)</p>
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

      <FuncionariosView funcs={funcs} hoje={hojeStr} alertas={alertaMap} cargosUnicos={cargosUnicos} />
    </div>
  )
}
