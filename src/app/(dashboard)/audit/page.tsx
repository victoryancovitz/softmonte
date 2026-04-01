import { createClient } from '@/lib/supabase-server'

const ACAO_COLOR: Record<string, string> = {
  INSERT: 'bg-green-100 text-green-700',
  UPDATE: 'bg-blue-100 text-blue-700',
  DELETE: 'bg-red-100 text-red-700',
}

const TABELA_LABEL: Record<string, string> = {
  funcionarios: 'Funcionários',
  obras: 'Obras',
  financeiro_lancamentos: 'Financeiro',
  hh_lancamentos: 'HH',
  efetivo_diario: 'Efetivo',
  boletins_medicao: 'Boletins',
}

export default async function AuditPage() {
  const supabase = createClient()
  const { data: logs } = await supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Trilha de Auditoria</h1>
        <p className="text-sm text-gray-500 mt-0.5">Registro completo de todas as alterações no sistema</p>
      </div>

      {logs && logs.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Data/Hora','Usuário','Role','Tabela','Ação','Campos alterados'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((log: any) => (
                <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{log.usuario_nome ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{log.usuario_role ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium text-gray-700">{TABELA_LABEL[log.tabela] ?? log.tabela}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${ACAO_COLOR[log.acao] ?? 'bg-gray-100'}`}>
                      {log.acao}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {log.campos_alterados?.length > 0 ? (
                      <span className="text-gray-600">{log.campos_alterados.join(', ')}</span>
                    ) : log.acao === 'INSERT' ? (
                      <span className="text-green-600">Novo registro criado</span>
                    ) : log.acao === 'DELETE' ? (
                      <span className="text-red-600">Registro removido</span>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-gray-500 text-sm font-medium">Nenhuma ação registrada ainda</p>
          <p className="text-gray-400 text-xs mt-1">As ações aparecerão aqui conforme os usuários interagem com o sistema</p>
        </div>
      )}
    </div>
  )
}
