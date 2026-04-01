import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'

const TIPO_LABEL: Record<string, string> = {
  'ASO': 'ASO', 'NR-10': 'NR-10', 'NR-35': 'NR-35', 'NR-33': 'NR-33',
  'NR-12': 'NR-12', 'CIPA': 'CIPA', 'outro': 'Outro',
}
const STATUS_COLOR = (dias: number | null) => {
  if (dias === null) return 'bg-gray-100 text-gray-500'
  if (dias < 0) return 'bg-red-100 text-red-700'
  if (dias <= 30) return 'bg-amber-100 text-amber-700'
  return 'bg-green-100 text-green-700'
}

export default async function DocumentosPage() {
  const supabase = createClient()
  const { data: docs } = await supabase
    .from('documentos')
    .select('*, funcionarios(nome, cargo)')
    .order('vencimento', { ascending: true })

  const hoje = new Date()
  const docsComDias = docs?.map((d: any) => ({
    ...d,
    dias: d.vencimento ? Math.ceil((new Date(d.vencimento+'T12:00').getTime() - hoje.getTime()) / 86400000) : null,
  })) ?? []

  const vencidos = docsComDias.filter(d => d.dias !== null && d.dias < 0)
  const vencendo = docsComDias.filter(d => d.dias !== null && d.dias >= 0 && d.dias <= 30)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold font-display text-brand">Documentos</h1>
          <p className="text-sm text-gray-500 mt-0.5">{docs?.length ?? 0} documentos</p>
        </div>
        <Link href="/documentos/novo" className="px-4 py-2 bg-brand text-white rounded-xl text-sm font-semibold hover:bg-brand-dark">+ Novo documento</Link>
      </div>

      {(vencidos.length > 0 || vencendo.length > 0) && (
        <div className="grid grid-cols-2 gap-4 mb-5">
          {vencidos.length > 0 && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
              <div className="font-semibold text-red-800 text-sm mb-1">🚨 {vencidos.length} documento(s) VENCIDO(S)</div>
              <div className="text-xs text-red-600">{vencidos.map((d: any) => `${d.funcionarios?.nome?.split(' ')[0]} — ${d.tipo}`).join(' · ')}</div>
            </div>
          )}
          {vencendo.length > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="font-semibold text-amber-800 text-sm mb-1">⚠️ {vencendo.length} documento(s) vencendo em 30 dias</div>
              <div className="text-xs text-amber-600">{vencendo.map((d: any) => `${d.funcionarios?.nome?.split(' ')[0]} — ${d.tipo}`).join(' · ')}</div>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {['Funcionário','Tipo','Emissão','Vencimento','Status','Arquivo',''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {docsComDias.length > 0 ? docsComDias.map((d: any) => (
              <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50 group">
                <td className="px-4 py-3 font-semibold">
                  <Link href={`/funcionarios/${d.funcionario_id}`} className="hover:text-brand">{d.funcionarios?.nome}</Link>
                  <div className="text-xs text-gray-400">{d.funcionarios?.cargo}</div>
                </td>
                <td className="px-4 py-3"><span className="text-xs font-bold bg-brand/10 text-brand px-2 py-0.5 rounded">{TIPO_LABEL[d.tipo] ?? d.tipo}</span></td>
                <td className="px-4 py-3 text-gray-500 text-xs">{d.emissao ? new Date(d.emissao+'T12:00').toLocaleDateString('pt-BR') : '—'}</td>
                <td className="px-4 py-3 text-xs font-medium">{d.vencimento ? new Date(d.vencimento+'T12:00').toLocaleDateString('pt-BR') : '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${STATUS_COLOR(d.dias)}`}>
                    {d.dias === null ? 'Sem vencimento' : d.dias < 0 ? `Vencido há ${Math.abs(d.dias)}d` : d.dias === 0 ? 'Vence hoje' : `${d.dias}d`}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {d.arquivo_url ? (
                    <a href={d.arquivo_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-brand hover:underline flex items-center gap-1">📎 {d.arquivo_nome ?? 'Ver'}</a>
                  ) : <span className="text-xs text-gray-300">Sem arquivo</span>}
                </td>
                <td className="px-4 py-3 text-right opacity-0 group-hover:opacity-100">
                  <Link href={`/documentos/novo?funcionario=${d.funcionario_id}&tipo=${d.tipo}`} className="text-xs text-brand hover:underline">Renovar</Link>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Nenhum documento cadastrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
