import { createClient } from '@/lib/supabase-server'
import BackButton from '@/components/BackButton'

const LABELS: Record<string, string> = {
  funcoes_duplicadas: 'Funcoes duplicadas',
  categorias_duplicadas: 'Categorias duplicadas',
  parcelas_orfas: 'Parcelas orfas',
  lancamentos_sem_categoria: 'Lancamentos sem categoria',
  alocacoes_func_deletado: 'Alocacoes com funcionario deletado',
  lancamentos_deletados_acumulados: 'Lancamentos na lixeira',
}

function statusStyle(severidade: string) {
  switch (severidade) {
    case 'ok':
      return { bg: 'bg-green-50 border-green-200', icon: '\u2705', text: 'text-green-700' }
    case 'erro':
      return { bg: 'bg-red-50 border-red-200', icon: '\u274C', text: 'text-red-700' }
    case 'aviso':
      return { bg: 'bg-amber-50 border-amber-200', icon: '\u26A0\uFE0F', text: 'text-amber-700' }
    default:
      return { bg: 'bg-gray-50 border-gray-200', icon: '?', text: 'text-gray-700' }
  }
}

export default async function IntegridadePage() {
  const supabase = createClient()

  const { data: checks } = await supabase
    .from('vw_integridade')
    .select('*')

  const rows = checks ?? []
  const totalOk = rows.filter((r: any) => r.severidade === 'ok').length
  const total = rows.length
  const pct = total > 0 ? Math.round((totalOk / total) * 100) : 0

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/admin" />
        <span className="font-medium text-gray-700">Integridade da Plataforma</span>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Integridade da Plataforma</h1>

      {/* Summary */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            {totalOk} de {total} checks OK
          </span>
          <span className="text-sm font-medium text-gray-500">{pct}%</span>
        </div>
        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.map((row: any) => {
          const s = statusStyle(row.severidade)
          const label = LABELS[row.check_name] ?? row.check_name
          return (
            <div
              key={row.check_name}
              className={`rounded-lg border p-4 ${s.bg}`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl leading-none">{s.icon}</span>
                <div className="min-w-0">
                  <p className={`text-sm font-semibold ${s.text}`}>{label}</p>
                  <p className={`text-2xl font-bold mt-1 ${s.text}`}>{row.contagem}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {rows.length === 0 && (
        <p className="text-center text-gray-400 mt-8">Nenhum check encontrado na view vw_integridade.</p>
      )}
    </div>
  )
}
