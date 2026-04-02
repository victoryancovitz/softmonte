import { createClient } from '@/lib/supabase-server'
import { getRole } from '@/lib/get-role'
import Link from 'next/link'
import { EncerrarAlocacaoBtn } from '@/components/DeleteActions'

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

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto mb-5">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Alocações ativas ({ativas.length})</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              {['Funcionário','Cargo','Obra','Cliente','Desde',''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ativas.length > 0 ? ativas.map((a: any) => (
              <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50/80 group">
                <td className="px-4 py-3 font-semibold text-gray-900">
                  <Link href={`/funcionarios/${a.funcionario_id}`} className="hover:text-brand">{a.funcionarios?.nome}</Link>
                </td>
                <td className="px-4 py-3 text-gray-600">{a.cargo_na_obra}</td>
                <td className="px-4 py-3 font-medium">
                  <Link href={`/obras/${a.obra_id}`} className="hover:text-brand">{a.obras?.nome}</Link>
                </td>
                <td className="px-4 py-3 text-gray-500">{a.obras?.cliente}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{a.data_inicio ? new Date(a.data_inicio+'T12:00').toLocaleDateString('pt-BR') : '—'}</td>
                <td className="px-4 py-3 text-right">
                  <span className="inline-flex items-center gap-2">
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Ativa</span>
                    <EncerrarAlocacaoBtn alocacaoId={a.id} funcId={a.funcionario_id} role={role} />
                  </span>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Nenhuma alocação ativa.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {encerradas.length > 0 && (
        <details className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <summary className="px-5 py-3 bg-gray-50 border-b border-gray-100 cursor-pointer text-sm font-semibold text-gray-500">
            Alocações encerradas ({encerradas.length})
          </summary>
          <table className="w-full text-sm">
            <tbody>
              {encerradas.map((a: any) => (
                <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50/80">
                  <td className="px-4 py-2.5 text-gray-400 font-medium">{a.funcionarios?.nome}</td>
                  <td className="px-4 py-2.5 text-gray-400">{a.obras?.nome}</td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">{a.data_fim ? new Date(a.data_fim+'T12:00').toLocaleDateString('pt-BR') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  )
}
