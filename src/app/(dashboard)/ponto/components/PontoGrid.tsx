'use client'

function isWeekend(year: number, month: number, day: number): boolean {
  const d = new Date(year, month - 1, day).getDay()
  return d === 0 || d === 6
}

interface CellData {
  efetivo_id?: string
  falta_id?: string
  falta_tipo?: string
  arquivo_nome?: string | null
  arquivo_url?: string | null
  observacao?: string | null
  horas_trabalhadas?: number | null
}

interface PontoGridProps {
  funcionarios: any[]
  days: number[]
  cellData: Record<string, Record<number, CellData>>
  ano: number
  mes: number
  obraDataInicio: string | null
  obraDataFim: string | null
  onCellClick: (funcId: string, dia: number) => void
  excedentes: Record<number, Record<string, { presentes: number; limite: number; excedente: number }>>
  podeEditar: boolean
}

function getCellInfo(
  funcId: string,
  day: number,
  ano: number,
  mes: number,
  cellData: Record<string, Record<number, CellData>>,
): { label: string; cls: string; title: string } {
  if (isWeekend(ano, mes, day)) return { label: '-', cls: 'bg-gray-100 text-gray-400', title: 'Fim de semana' }
  const c = cellData[funcId]?.[day]
  if (!c) return { label: '\u00b7', cls: 'bg-white text-gray-300 hover:bg-blue-50', title: 'Pendente \u2014 clique para editar' }
  if (c.efetivo_id && !c.falta_id) {
    return { label: 'P', cls: 'bg-green-100 text-green-700 hover:bg-green-200', title: 'Presente' + (c.observacao ? ` \u2014 ${c.observacao}` : '') }
  }
  if (c.falta_tipo) {
    const t = c.falta_tipo
    const hasDoc = c.arquivo_url ? ' \ud83d\udcce' : ''
    if (t.startsWith('atestado')) return { label: 'A' + (c.arquivo_url ? '*' : ''), cls: 'bg-blue-100 text-blue-700 hover:bg-blue-200', title: 'Atestado' + hasDoc + (c.observacao ? ` \u2014 ${c.observacao}` : '') }
    if (t.startsWith('licenca')) return { label: 'L', cls: 'bg-pink-100 text-pink-700 hover:bg-pink-200', title: 'Licen\u00e7a' }
    if (t === 'folga_compensatoria' || t === 'feriado') return { label: 'X', cls: 'bg-gray-100 text-gray-500 hover:bg-gray-200', title: 'Folga / abono' }
    if (t === 'falta_justificada') return { label: 'J', cls: 'bg-amber-100 text-amber-700 hover:bg-amber-200', title: 'Falta justificada' }
    if (t === 'suspensao') return { label: 'S', cls: 'bg-red-100 text-red-700 hover:bg-red-200', title: 'Suspens\u00e3o' }
    return { label: 'F', cls: 'bg-red-100 text-red-700 hover:bg-red-200', title: 'Falta injustificada' }
  }
  return { label: '\u00b7', cls: 'bg-white text-gray-300 hover:bg-blue-50', title: 'Pendente' }
}

export default function PontoGrid({
  funcionarios,
  days,
  cellData,
  ano,
  mes,
  obraDataInicio,
  obraDataFim,
  onCellClick,
  excedentes,
  podeEditar,
}: PontoGridProps) {
  // Compute summary totals
  let totalPresentes = 0, totalFaltas = 0, totalAtestados = 0
  funcionarios.forEach(f => {
    days.forEach(d => {
      if (isWeekend(ano, mes, d)) return
      const c = cellData[f.id]?.[d]
      if (!c) return
      if (c.efetivo_id && !c.falta_id) totalPresentes++
      else if (c.falta_tipo === 'falta_injustificada') totalFaltas++
      else if (c.falta_tipo?.startsWith('atestado')) totalAtestados++
    })
  })

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="text-xs border-collapse min-w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide sticky left-0 bg-gray-50 z-10 min-w-[180px]">Funcion&aacute;rio</th>
              {days.map(d => {
                const dayExcedentes = excedentes[d]
                const temExcesso = dayExcedentes && Object.keys(dayExcedentes).length > 0
                const tooltipExcesso = temExcesso
                  ? Object.entries(dayExcedentes).map(([cargo, v]) => `${cargo}: ${v.presentes}/${v.limite} (${v.excedente} excedente${v.excedente > 1 ? 's' : ''})`).join('\n')
                  : ''
                return (
                  <th key={d} className={`px-1 py-2 text-center font-semibold min-w-[28px] ${isWeekend(ano, mes, d) ? 'text-gray-400 bg-gray-50' : 'text-gray-500'}`}>
                    {d}
                    {temExcesso && (
                      <div title={tooltipExcesso} className="w-4 h-4 bg-red-500 text-white rounded-full text-[8px] font-bold flex items-center justify-center cursor-help mx-auto mt-0.5">!</div>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {funcionarios.map((func: any) => {
              const desligado = func.deleted_at != null
              const demissaoDate = desligado ? new Date(func.deleted_at).toISOString().split('T')[0] : null
              const admissaoDate = func.admissao
              return (
                <tr key={func.id} className={`border-b border-gray-50 hover:bg-gray-50/30 ${desligado ? 'bg-gray-50/40' : ''}`}>
                  <td className="px-3 py-1.5 font-medium text-gray-800 sticky left-0 z-10 border-r border-gray-100 ${desligado ? 'bg-gray-50/60' : 'bg-white'}">
                    <div className="flex items-center gap-1.5">
                      <div className="truncate max-w-[160px]" title={func.nome}>{func.nome_guerra ?? func.nome}</div>
                      {desligado && <span className="text-[8px] bg-red-100 text-red-700 px-1 py-0.5 rounded font-bold">DESL.</span>}
                    </div>
                    <div className="text-[10px] text-gray-400">
                      {func.cargo}{func.id_ponto ? ` \u00b7 ID ${func.id_ponto}` : ''}
                      {desligado && demissaoDate && <span className="ml-1 text-red-500">&middot; at&eacute; {new Date(demissaoDate+'T12:00').toLocaleDateString('pt-BR')}</span>}
                    </div>
                  </td>
                  {days.map(d => {
                    const cell = getCellInfo(func.id, d, ano, mes, cellData)
                    const isWk = isWeekend(ano, mes, d)
                    const dateStr = `${ano}-${String(mes).padStart(2,'0')}-${String(d).padStart(2,'0')}`
                    const beforeAdm = admissaoDate && dateStr < admissaoDate
                    const afterDem = demissaoDate && dateStr > demissaoDate
                    const beforeObra = obraDataInicio && dateStr < obraDataInicio
                    const afterObra = obraDataFim && dateStr > obraDataFim
                    const naoElegivel = beforeAdm || afterDem || beforeObra || afterObra
                    if (naoElegivel) {
                      const motivo = beforeObra ? 'Antes do in\u00edcio da obra' : afterObra ? 'Ap\u00f3s o fim da obra' : beforeAdm ? 'Antes da admiss\u00e3o' : 'Ap\u00f3s desligamento'
                      return (
                        <td key={d} className="p-0 bg-gray-200/50" title={motivo}>
                          <div className="w-full h-full px-1 py-1.5"></div>
                        </td>
                      )
                    }
                    const bloqueado = !podeEditar
                    return (
                      <td key={d} className="p-0">
                        <button
                          disabled={isWk || bloqueado}
                          onClick={() => onCellClick(func.id, d)}
                          title={bloqueado ? 'Ponto fechado \u2014 contate o administrador' : cell.title}
                          className={`w-full px-1 py-1.5 text-center font-semibold transition-colors ${cell.cls} ${(isWk || bloqueado) ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                          {cell.label}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-6">
        <div className="bg-green-50 rounded-2xl border border-green-200 p-4 text-center">
          <p className="text-xs text-green-600 font-semibold uppercase tracking-wide">Total Presentes</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{totalPresentes}</p>
        </div>
        <div className="bg-red-50 rounded-2xl border border-red-200 p-4 text-center">
          <p className="text-xs text-red-600 font-semibold uppercase tracking-wide">Total Faltas</p>
          <p className="text-2xl font-bold text-red-700 mt-1">{totalFaltas}</p>
        </div>
        <div className="bg-blue-50 rounded-2xl border border-blue-200 p-4 text-center">
          <p className="text-xs text-blue-600 font-semibold uppercase tracking-wide">Total Atestados</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">{totalAtestados}</p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-green-100"></span> P = Presente</span>
        <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-red-100"></span> F = Falta</span>
        <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-blue-100"></span> A = Atestado (* = com anexo)</span>
        <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-amber-100"></span> J = Justificada</span>
        <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-gray-100"></span> X = Folga/abono</span>
        <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-pink-100"></span> L = Licen&ccedil;a</span>
        <span className="flex items-center gap-1"><span className="w-4 h-4 rounded border border-gray-200 bg-white"></span> &middot; = Pendente</span>
      </div>
    </>
  )
}
