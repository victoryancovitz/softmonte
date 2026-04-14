import { FileText } from 'lucide-react'

const MESES_HOLERITE = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

interface TabHoleritesProps {
  funcionarioId: string
  holerites: any[]
  holeriteAssinados: number
  ultimoHolerite: any
  sigMap: Map<string, any>
  envMap: Map<string, any>
  fmtR: (v: number) => string
}

export default function TabHolerites({
  funcionarioId, holerites, holeriteAssinados, ultimoHolerite,
  sigMap, envMap, fmtR,
}: TabHoleritesProps) {
  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-[10px] font-bold text-gray-400 uppercase">Total holerites</div>
          <div className="text-xl font-bold text-gray-900">{holerites.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-[10px] font-bold text-gray-400 uppercase">Assinados</div>
          <div className="text-xl font-bold text-green-700">{holeriteAssinados}</div>
          {holerites.length > 0 && <div className="text-[10px] text-gray-400">{Math.round(holeriteAssinados / holerites.length * 100)}%</div>}
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-[10px] font-bold text-gray-400 uppercase">Último líquido</div>
          <div className="text-xl font-bold text-green-700">{ultimoHolerite ? fmtR(Number(ultimoHolerite.valor_liquido)) : '—'}</div>
        </div>
      </div>

      {/* Lista completa */}
      {holerites.length > 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100 bg-gray-50">
              {['Período', 'Obra', 'Dias', 'Bruto', 'Descontos', 'Líquido', 'Status', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {holerites.map((h: any) => {
                const totalDesc = Number(h.desconto_inss || 0) + Number(h.desconto_irrf || 0) + Number(h.outros_descontos || 0)
                const assinado = sigMap.has(h.id)
                const enviado = envMap.has(h.id)
                return (
                  <tr key={h.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{MESES_HOLERITE[h.folha_fechamentos?.mes]}/{h.folha_fechamentos?.ano}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{h.folha_fechamentos?.obras?.nome || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{Number(h.dias_trabalhados)}{Number(h.dias_descontados) > 0 ? <span className="text-red-500 text-xs"> (-{Number(h.dias_descontados).toFixed(1)})</span> : ''}</td>
                    <td className="px-4 py-3">{fmtR(Number(h.valor_bruto || h.salario_base || 0))}</td>
                    <td className="px-4 py-3 text-red-600 text-xs">{totalDesc > 0 ? fmtR(totalDesc) : '—'}</td>
                    <td className="px-4 py-3 font-bold text-green-700">{fmtR(Number(h.valor_liquido))}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {assinado ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-bold">Assinado</span>
                        ) : (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-bold">Pendente</span>
                        )}
                        {enviado && <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold">Enviado</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <a href={`/rh/folha/${h.folha_id}/holerite/${funcionarioId}`} target="_blank" className="text-brand hover:underline text-xs font-semibold">Ver →</a>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 p-10 text-center">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Nenhum holerite disponível para este funcionário.</p>
        </div>
      )}
    </div>
  )
}
