'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import PontoCellEditor from '@/components/PontoCellEditor'

function getDaysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate()
}

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
}

export default function PontoPage() {
  const now = new Date()
  const [obras, setObras] = useState<any[]>([])
  const [obraId, setObraId] = useState('')
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [ano, setAno] = useState(now.getFullYear())
  const [funcionarios, setFuncionarios] = useState<any[]>([])
  // funcId -> day -> CellData
  const [grid, setGrid] = useState<Record<string, Record<number, CellData>>>({})
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<{ funcId: string; day: number } | null>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('obras').select('id,nome').eq('status', 'ativo').is('deleted_at', null).order('nome')
      .then(({ data }) => setObras(data ?? []))
  }, [])

  const loadData = useCallback(async () => {
    if (!obraId) {
      setFuncionarios([]); setGrid({}); return
    }
    setLoading(true)

    const totalDays = getDaysInMonth(mes, ano)
    const dateStart = `${ano}-${String(mes).padStart(2, '0')}-01`
    const dateEnd = `${ano}-${String(mes).padStart(2, '0')}-${String(totalDays).padStart(2, '0')}`

    // 1. Funcionários alocados ativos
    const { data: alocacoes } = await supabase
      .from('alocacoes')
      .select('funcionarios(id,nome,nome_guerra,cargo,matricula,id_ponto,deleted_at,admissao)')
      .eq('obra_id', obraId)
      .eq('ativo', true)

    const funcs: any[] = (alocacoes ?? [])
      .map((a: any) => a.funcionarios)
      .filter(Boolean)
    const ids = new Set(funcs.map(f => f.id))

    // 2. Funcionários soft-deleted que poderiam ter trabalhado no período
    //    (admissão antes ou durante o período visível)
    const { data: deleted } = await supabase
      .from('funcionarios')
      .select('id,nome,nome_guerra,cargo,matricula,id_ponto,deleted_at,admissao')
      .not('deleted_at', 'is', null)
      .lte('admissao', dateEnd)
    for (const d of deleted ?? []) {
      // Only include if their employment overlapped with the visible period
      if (d.deleted_at && d.deleted_at.split('T')[0] < dateStart) continue
      if (!ids.has(d.id)) { funcs.push(d); ids.add(d.id) }
    }

    // 3. Qualquer funcionário (ativo ou deletado) que já tem efetivo_diario nesta obra
    const { data: comPonto } = await supabase
      .from('efetivo_diario')
      .select('funcionario_id, funcionarios(id,nome,nome_guerra,cargo,matricula,id_ponto,deleted_at,admissao)')
      .eq('obra_id', obraId)
    for (const r of (comPonto ?? []) as any[]) {
      if (r.funcionarios && !ids.has(r.funcionarios.id)) {
        funcs.push(r.funcionarios); ids.add(r.funcionarios.id)
      }
    }

    funcs.sort((a: any, b: any) => a.nome.localeCompare(b.nome))
    setFuncionarios(funcs)

    if (funcs.length === 0) { setGrid({}); setLoading(false); return }

    const funcIds = funcs.map((f: any) => f.id)

    const [{ data: efetivo }, { data: faltas }] = await Promise.all([
      supabase.from('efetivo_diario')
        .select('id,funcionario_id,data,observacao')
        .eq('obra_id', obraId)
        .gte('data', dateStart).lte('data', dateEnd),
      supabase.from('faltas')
        .select('id,funcionario_id,data,tipo,observacao,arquivo_url,arquivo_nome')
        .in('funcionario_id', funcIds)
        .gte('data', dateStart).lte('data', dateEnd),
    ])

    const g: Record<string, Record<number, CellData>> = {}
    ;(efetivo ?? []).forEach((e: any) => {
      const day = new Date(e.data + 'T12:00:00').getDate()
      if (!g[e.funcionario_id]) g[e.funcionario_id] = {}
      g[e.funcionario_id][day] = {
        ...(g[e.funcionario_id][day] ?? {}),
        efetivo_id: e.id,
        observacao: e.observacao,
      }
    })
    ;(faltas ?? []).forEach((f: any) => {
      const day = new Date(f.data + 'T12:00:00').getDate()
      if (!g[f.funcionario_id]) g[f.funcionario_id] = {}
      g[f.funcionario_id][day] = {
        ...(g[f.funcionario_id][day] ?? {}),
        falta_id: f.id,
        falta_tipo: f.tipo,
        observacao: f.observacao ?? g[f.funcionario_id][day]?.observacao,
        arquivo_url: f.arquivo_url,
        arquivo_nome: f.arquivo_nome,
      }
    })
    setGrid(g)
    setLoading(false)
  }, [obraId, mes, ano])

  useEffect(() => { loadData() }, [loadData])

  const totalDays = getDaysInMonth(mes, ano)
  const days = Array.from({ length: totalDays }, (_, i) => i + 1)
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

  function getCellInfo(funcId: string, day: number): { label: string; cls: string; title: string } {
    if (isWeekend(ano, mes, day)) return { label: '-', cls: 'bg-gray-100 text-gray-400', title: 'Fim de semana' }
    const c = grid[funcId]?.[day]
    if (!c) return { label: '·', cls: 'bg-white text-gray-300 hover:bg-blue-50', title: 'Pendente — clique para editar' }
    if (c.efetivo_id && !c.falta_id) {
      return { label: 'P', cls: 'bg-green-100 text-green-700 hover:bg-green-200', title: 'Presente' + (c.observacao ? ` — ${c.observacao}` : '') }
    }
    if (c.falta_tipo) {
      const t = c.falta_tipo
      const hasDoc = c.arquivo_url ? ' 📎' : ''
      if (t.startsWith('atestado')) return { label: 'A' + (c.arquivo_url ? '*' : ''), cls: 'bg-blue-100 text-blue-700 hover:bg-blue-200', title: 'Atestado' + hasDoc + (c.observacao ? ` — ${c.observacao}` : '') }
      if (t.startsWith('licenca')) return { label: 'L', cls: 'bg-pink-100 text-pink-700 hover:bg-pink-200', title: 'Licença' }
      if (t === 'folga_compensatoria' || t === 'feriado') return { label: 'X', cls: 'bg-gray-100 text-gray-500 hover:bg-gray-200', title: 'Folga / abono' }
      if (t === 'falta_justificada') return { label: 'J', cls: 'bg-amber-100 text-amber-700 hover:bg-amber-200', title: 'Falta justificada' }
      if (t === 'suspensao') return { label: 'S', cls: 'bg-red-100 text-red-700 hover:bg-red-200', title: 'Suspensão' }
      return { label: 'F', cls: 'bg-red-100 text-red-700 hover:bg-red-200', title: 'Falta injustificada' }
    }
    return { label: '·', cls: 'bg-white text-gray-300 hover:bg-blue-50', title: 'Pendente' }
  }

  function buildEditorInitial(funcId: string, day: number) {
    const c = grid[funcId]?.[day]
    if (!c) return { status: null }
    let status: any = null
    if (c.efetivo_id && !c.falta_id) status = 'presente'
    else if (c.falta_tipo) status = c.falta_tipo
    return {
      status,
      efetivo_id: c.efetivo_id,
      falta_id: c.falta_id,
      arquivo_url: c.arquivo_url,
      arquivo_nome: c.arquivo_nome,
      observacao: c.observacao,
    }
  }

  let totalPresentes = 0, totalFaltas = 0, totalAtestados = 0
  funcionarios.forEach(f => {
    days.forEach(d => {
      if (isWeekend(ano, mes, d)) return
      const c = grid[f.id]?.[d]
      if (!c) return
      if (c.efetivo_id && !c.falta_id) totalPresentes++
      else if (c.falta_tipo === 'falta_injustificada') totalFaltas++
      else if (c.falta_tipo?.startsWith('atestado')) totalAtestados++
    })
  })

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto">
      <h1 className="text-xl font-bold font-display text-brand mb-2">Controle de Ponto</h1>
      <p className="text-xs text-gray-500 mb-5">Clique em qualquer dia para editar o status. Funcionários desligados aparecem com badge vermelho e só permitem edição nos dias do vínculo. Toda alteração é auditada.</p>

      {/* Selectors */}
      <div className="flex flex-wrap items-end gap-4 mb-6">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Obra</label>
          <select value={obraId} onChange={e => setObraId(e.target.value)}
            className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand min-w-[240px]">
            <option value="">Selecione uma obra...</option>
            {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Mês</label>
          <select value={mes} onChange={e => setMes(Number(e.target.value))}
            className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
            {meses.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Ano</label>
          <select value={ano} onChange={e => setAno(Number(e.target.value))}
            className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
            {[ano - 1, ano, ano + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {!obraId && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-10 text-center text-gray-400">
          Selecione uma obra para visualizar o controle de ponto.
        </div>
      )}

      {obraId && loading && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-10 text-center text-gray-400">Carregando...</div>
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
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide sticky left-0 bg-gray-50 z-10 min-w-[180px]">Funcionário</th>
                  {days.map(d => (
                    <th key={d} className={`px-1 py-2 text-center font-semibold min-w-[28px] ${isWeekend(ano, mes, d) ? 'text-gray-400 bg-gray-50' : 'text-gray-500'}`}>{d}</th>
                  ))}
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
                          {func.cargo}{func.id_ponto ? ` · ID ${func.id_ponto}` : ''}
                          {desligado && demissaoDate && <span className="ml-1 text-red-500">· até {new Date(demissaoDate+'T12:00').toLocaleDateString('pt-BR')}</span>}
                        </div>
                      </td>
                      {days.map(d => {
                        const cell = getCellInfo(func.id, d)
                        const isWk = isWeekend(ano, mes, d)
                        const dateStr = `${ano}-${String(mes).padStart(2,'0')}-${String(d).padStart(2,'0')}`
                        const beforeAdm = admissaoDate && dateStr < admissaoDate
                        const afterDem = demissaoDate && dateStr > demissaoDate
                        const naoElegivel = beforeAdm || afterDem
                        if (naoElegivel) {
                          // Cell hidden — funcionário não pertencia à empresa nesse dia
                          return (
                            <td key={d} className="p-0 bg-gray-200/50">
                              <div className="w-full h-full px-1 py-1.5"></div>
                            </td>
                          )
                        }
                        return (
                          <td key={d} className="p-0">
                            <button
                              disabled={isWk}
                              onClick={() => setEditing({ funcId: func.id, day: d })}
                              title={cell.title}
                              className={`w-full px-1 py-1.5 text-center font-semibold transition-colors ${cell.cls} ${isWk ? 'cursor-default' : 'cursor-pointer'}`}>
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
            <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-pink-100"></span> L = Licença</span>
            <span className="flex items-center gap-1"><span className="w-4 h-4 rounded border border-gray-200 bg-white"></span> · = Pendente</span>
          </div>
        </>
      )}

      {editing && (() => {
        const func = funcionarios.find(f => f.id === editing.funcId)
        if (!func) return null
        const dateStr = `${ano}-${String(mes).padStart(2,'0')}-${String(editing.day).padStart(2,'0')}`
        return (
          <PontoCellEditor
            funcionario={func}
            obraId={obraId}
            data={dateStr}
            initial={buildEditorInitial(editing.funcId, editing.day)}
            onClose={() => setEditing(null)}
            onSaved={loadData}
          />
        )
      })()}
    </div>
  )
}
