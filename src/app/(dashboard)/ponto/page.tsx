'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'

function getDaysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate()
}

function isWeekend(year: number, month: number, day: number): boolean {
  const d = new Date(year, month - 1, day).getDay()
  return d === 0 || d === 6
}

export default function PontoPage() {
  const now = new Date()
  const [obras, setObras] = useState<any[]>([])
  const [obraId, setObraId] = useState('')
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [ano, setAno] = useState(now.getFullYear())
  const [funcionarios, setFuncionarios] = useState<any[]>([])
  const [presencas, setPresencas] = useState<Record<string, Set<number>>>({})
  const [faltasMap, setFaltasMap] = useState<Record<string, Record<number, string>>>({})
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('obras').select('id,nome').eq('status', 'ativo').order('nome')
      .then(({ data }) => setObras(data ?? []))
  }, [])

  const loadData = useCallback(async () => {
    if (!obraId) {
      setFuncionarios([])
      setPresencas({})
      setFaltasMap({})
      return
    }
    setLoading(true)

    const totalDays = getDaysInMonth(mes, ano)
    const dateStart = `${ano}-${String(mes).padStart(2, '0')}-01`
    const dateEnd = `${ano}-${String(mes).padStart(2, '0')}-${String(totalDays).padStart(2, '0')}`

    // Load alocacoes for this obra to get funcionarios
    const { data: alocacoes } = await supabase
      .from('alocacoes')
      .select('funcionarios(id,nome,cargo,matricula)')
      .eq('obra_id', obraId)
      .eq('ativo', true)

    const funcs = (alocacoes ?? [])
      .map((a: any) => a.funcionarios)
      .filter(Boolean)
      .sort((a: any, b: any) => a.nome.localeCompare(b.nome))

    setFuncionarios(funcs)

    if (funcs.length === 0) {
      setPresencas({})
      setFaltasMap({})
      setLoading(false)
      return
    }

    const funcIds = funcs.map((f: any) => f.id)

    // Load efetivo_diario for obra + date range
    const { data: efetivo } = await supabase
      .from('efetivo_diario')
      .select('funcionario_id,data')
      .eq('obra_id', obraId)
      .gte('data', dateStart)
      .lte('data', dateEnd)

    // Load faltas for those funcionarios + date range
    const { data: faltas } = await supabase
      .from('faltas')
      .select('funcionario_id,data,tipo')
      .in('funcionario_id', funcIds)
      .gte('data', dateStart)
      .lte('data', dateEnd)

    // Build presencas map: funcId -> Set of day numbers
    const pMap: Record<string, Set<number>> = {}
    ;(efetivo ?? []).forEach((e: any) => {
      const day = new Date(e.data + 'T12:00:00').getDate()
      if (!pMap[e.funcionario_id]) pMap[e.funcionario_id] = new Set()
      pMap[e.funcionario_id].add(day)
    })
    setPresencas(pMap)

    // Build faltas map: funcId -> { day: tipo }
    const fMap: Record<string, Record<number, string>> = {}
    ;(faltas ?? []).forEach((f: any) => {
      const day = new Date(f.data + 'T12:00:00').getDate()
      if (!fMap[f.funcionario_id]) fMap[f.funcionario_id] = {}
      fMap[f.funcionario_id][day] = f.tipo
    })
    setFaltasMap(fMap)
    setLoading(false)
  }, [obraId, mes, ano])

  useEffect(() => { loadData() }, [loadData])

  const totalDays = getDaysInMonth(mes, ano)
  const days = Array.from({ length: totalDays }, (_, i) => i + 1)

  // Summary counters
  let totalPresentes = 0
  let totalFaltas = 0
  let totalAtestados = 0

  const meses = [
    'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ]

  function getCellInfo(funcId: string, day: number): { label: string; cls: string } {
    if (isWeekend(ano, mes, day)) return { label: '-', cls: 'bg-gray-100 text-gray-400' }

    const faltaTipo = faltasMap[funcId]?.[day]
    if (faltaTipo) {
      if (faltaTipo.startsWith('atestado')) return { label: 'A', cls: 'bg-blue-100 text-blue-700' }
      if (faltaTipo.startsWith('licenca')) return { label: 'L', cls: 'bg-green-100 text-green-700' }
      if (faltaTipo === 'folga_compensatoria' || faltaTipo === 'feriado') return { label: '-', cls: 'bg-gray-100 text-gray-400' }
      if (faltaTipo === 'suspensao') return { label: 'S', cls: 'bg-red-100 text-red-700' }
      return { label: 'F', cls: 'bg-red-100 text-red-700' }
    }

    if (presencas[funcId]?.has(day)) return { label: 'P', cls: 'bg-green-100 text-green-700' }

    return { label: '', cls: 'bg-white' }
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <h1 className="text-xl font-bold font-display text-brand mb-5">Controle de Ponto</h1>

      {/* Selectors */}
      <div className="flex flex-wrap items-end gap-4 mb-6">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Obra</label>
          <select value={obraId} onChange={e => setObraId(e.target.value)}
            className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand min-w-[240px]">
            <option value="">Selecione uma obra...</option>
            {obras.map(o => (
              <option key={o.id} value={o.id}>{o.nome}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Mês</label>
          <select value={mes} onChange={e => setMes(Number(e.target.value))}
            className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
            {meses.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Ano</label>
          <select value={ano} onChange={e => setAno(Number(e.target.value))}
            className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
            {[ano - 1, ano, ano + 1].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {!obraId && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-10 text-center text-gray-400">
          Selecione uma obra para visualizar o controle de ponto.
        </div>
      )}

      {obraId && loading && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-10 text-center text-gray-400">
          Carregando...
        </div>
      )}

      {obraId && !loading && funcionarios.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-10 text-center text-gray-400">
          Nenhum funcionário alocado nesta obra.
        </div>
      )}

      {obraId && !loading && funcionarios.length > 0 && (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
            <table className="text-xs border-collapse min-w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide sticky left-0 bg-gray-50 z-10 min-w-[180px]">
                    Funcionário
                  </th>
                  {days.map(d => (
                    <th key={d} className={`px-1 py-2 text-center font-semibold min-w-[28px] ${isWeekend(ano, mes, d) ? 'text-gray-400 bg-gray-50' : 'text-gray-500'}`}>
                      {d}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-center font-semibold text-gray-500 uppercase tracking-wide min-w-[50px]">Total</th>
                </tr>
              </thead>
              <tbody>
                {funcionarios.map((func: any) => {
                  let funcPresentes = 0
                  let funcFaltas = 0
                  let funcAtestados = 0

                  return (
                    <tr key={func.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-3 py-1.5 font-medium text-gray-800 sticky left-0 bg-white z-10 border-r border-gray-100">
                        <div className="truncate max-w-[170px]" title={func.nome}>{func.nome}</div>
                        <div className="text-[10px] text-gray-400">{func.cargo}</div>
                      </td>
                      {days.map(d => {
                        const cell = getCellInfo(func.id, d)
                        // Count
                        if (!isWeekend(ano, mes, d)) {
                          if (cell.label === 'P') funcPresentes++
                          if (cell.label === 'F') funcFaltas++
                          if (cell.label === 'A') funcAtestados++
                        }
                        return (
                          <td key={d} className={`px-1 py-1.5 text-center font-semibold ${cell.cls}`}>
                            {cell.label}
                          </td>
                        )
                      })}
                      {/* Accumulate totals after rendering all days */}
                      <td className="px-3 py-1.5 text-center font-bold text-gray-700">
                        {(() => {
                          totalPresentes += funcPresentes
                          totalFaltas += funcFaltas
                          totalAtestados += funcAtestados
                          return funcPresentes
                        })()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 mt-6">
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
          <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-green-100 inline-block"></span> P = Presente</span>
            <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-red-100 inline-block"></span> F = Falta</span>
            <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-blue-100 inline-block"></span> A = Atestado</span>
            <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-gray-100 inline-block"></span> - = Fim de semana</span>
          </div>
        </>
      )}
    </div>
  )
}
