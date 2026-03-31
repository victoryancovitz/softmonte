import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'

const STATUS_BADGE: Record<string, string> = {
  alocado: 'bg-green-100 text-green-700',
  disponivel: 'bg-blue-100 text-blue-700',
  afastado: 'bg-red-100 text-red-700',
}
const STATUS_LABEL: Record<string, string> = {
  alocado: 'Alocado', disponivel: 'Disponível', afastado: 'Afastado',
}

export default async function FuncionariosPage() {
  const supabase = createClient()
  const { data: funcionarios } = await supabase
    .from('funcionarios')
    .select('*, alocacoes(obra_id, ativo, obras(nome))')
    .order('nome')

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Funcionários</h1>
          <p className="text-sm text-gray-500 mt-0.5">{funcionarios?.length ?? 0} cadastrados</p>
        </div>
        <Link href="/funcionarios/novo" className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark transition-colors">
          + Novo funcionário
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Nome</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Cargo</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Matrícula</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Turno</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Obra atual</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Custo/h</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
            </tr>
          </thead>
          <tbody>
            {funcionarios && funcionarios.length > 0 ? funcionarios.map((f: any) => {
              const alocAtiva = f.alocacoes?.find((a: any) => a.ativo)
              return (
                <tr key={f.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium">{f.nome}</td>
                  <td className="px-4 py-3 text-gray-600">{f.cargo}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs font-mono">{f.matricula}</td>
                  <td className="px-4 py-3 capitalize text-gray-600">{f.turno}</td>
                  <td className="px-4 py-3 text-gray-600">{alocAtiva?.obras?.nome ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-gray-600">{f.custo_hora ? `R$ ${Number(f.custo_hora).toFixed(2)}` : <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[f.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABEL[f.status] ?? f.status}
                    </span>
                  </td>
                </tr>
              )
            }) : (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Nenhum funcionário cadastrado ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
