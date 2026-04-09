import { createClient } from '@/lib/supabase-server'
import { getRole } from '@/lib/get-role'
import Link from 'next/link'
import AlocacaoView from './AlocacaoView'

export default async function AlocacaoPage() {
  const supabase = createClient()
  const { data: alocacoes } = await supabase
    .from('alocacoes')
    .select('*, funcionarios(nome, cargo, matricula), obras(nome, cliente)')
    .order('created_at', { ascending: false })

  const role = await getRole()
  const ativas = alocacoes?.filter((a: any) => a.ativo) ?? []
  const encerradas = alocacoes?.filter((a: any) => !a.ativo) ?? []

  // Sync: ensure all actively allocated workers have status 'alocado'
  const funcIdsAlocados = ativas.map((a: any) => a.funcionario_id).filter(Boolean)
  if (funcIdsAlocados.length > 0) {
    await supabase.from('funcionarios').update({ status: 'alocado' }).in('id', funcIdsAlocados).neq('status', 'alocado')
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold font-display text-brand">Alocação</h1>
          <p className="text-sm text-gray-500 mt-0.5">{ativas.length} alocações ativas</p>
        </div>
        <Link href="/alocacao/nova" className="px-4 py-2 bg-brand text-white rounded-xl text-sm font-semibold hover:bg-brand-dark">+ Nova alocação</Link>
      </div>

      <AlocacaoView ativas={ativas} encerradas={encerradas} role={role} />
    </div>
  )
}
