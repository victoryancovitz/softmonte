'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

interface Props {
  obraId: string
  mes: number
  ano: number
  onCellClick: (funcId: string, data: string) => void
}

interface Funcionario {
  id: string
  nome: string
  nome_guerra: string | null
  cargo: string | null
}

interface RegistroDia {
  id: string
  funcionario_id: string
  data: string
  entrada: string | null
  saida: string | null
  horas_trabalhadas: number | null
  tipo_dia: string | null
  origem: string | null
  editado_em: string | null
}

interface Inconsistencia {
  funcId: string
  funcNome: string
  dia: number
  tipo: string
  detalhe: string
}

function getDaysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate()
}

function isWeekend(year: number, month: number, day: number): boolean {
  const d = new Date(year, month - 1, day).getDay()
  return d === 0 || d === 6
}

function getDayOfWeek(year: number, month: number, day: number): string {
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
}

export default function PontoMesGrid({ obraId, mes, ano, onCellClick }: Props) {
  const supabase = createClient()
  const toast = useToast()

  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [registros, setRegistros] = useState<Record<string, Record<number, RegistroDia>>>({})
  const [marcacoesCount, setMarcacoesCount] = useState<Record<string, Record<number, number>>>({})
  const [fechamento, setFechamento] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [fechando, setFechando] = useState(false)
  const [inconsistencias, setInconsistencias] = useState<Inconsistencia[]>([])
  const [showInconsistencias, setShowInconsistencias] = useState(false)

  const totalDays = getDaysInMonth(mes, ano)
  const days = Array.from({ length: totalDays }, (_, i) => i + 1)
  const mesFechado = !!fechamento

  const loadData = useCallback(async () => {
    if (!obraId) return
    setLoading(true)

    const dateStart = `${ano}-${String(mes).padStart(2, '0')}-01`
    const dateEnd = `${ano}-${String(mes).padStart(2, '0')}-${String(totalDays).padStart(2, '0')}`

    // Parallel fetches
    const [fechRes, alocRes, regRes, marcRes] = await Promise.all([
      supabase.from('ponto_fechamentos').select('*').eq('obra_id', obraId).eq('mes', mes).eq('ano', ano).maybeSingle(),
      supabase.from('alocacoes')
        .select('funcionarios(id,nome,nome_guerra,cargo)')
        .eq('obra_id', obraId).eq('ativo', true),
      supabase.from('ponto_registros').select('*')
        .eq('obra_id', obraId)
        .gte('data', dateStart).lte('data', dateEnd),
      supabase.from('ponto_marcacoes').select('funcionario_id,data,id')
        .gte('data', dateStart).lte('data', dateEnd)
        .is('excluido_em', null),
    ])

    setFechamento(fechRes.data)

    const funcs: Funcionario[] = (alocRes.data ?? [])
      .map((a: any) => a.funcionarios)
      .filter(Boolean)
      .sort((a: any, b: any) => a.nome.localeCompare(b.nome))
    setFuncionarios(funcs)

    // Build registros map: funcId -> day -> RegistroDia
    const regMap: Record<string, Record<number, RegistroDia>> = {}
    for (const r of (regRes.data ?? []) as any[]) {
      const day = new Date(r.data + 'T12:00:00').getDate()
      if (!regMap[r.funcionario_id]) regMap[r.funcionario_id] = {}
      regMap[r.funcionario_id][day] = r
    }
    setRegistros(regMap)

    // Build marcacoes count map: funcId -> day -> count
    const marcMap: Record<string, Record<number, number>> = {}
    for (const m of (marcRes.data ?? []) as any[]) {
      const day = new Date(m.data + 'T12:00:00').getDate()
      if (!marcMap[m.funcionario_id]) marcMap[m.funcionario_id] = {}
      marcMap[m.funcionario_id][day] = (marcMap[m.funcionario_id][day] ?? 0) + 1
    }
    setMarcacoesCount(marcMap)

    // Compute inconsistencies
    const issues: Inconsistencia[] = []
    for (const func of funcs) {
      for (const day of days) {
        if (isWeekend(ano, mes, day)) continue
        const reg = regMap[func.id]?.[day]
        const marcCount = marcMap[func.id]?.[day] ?? 0

        // Odd batidas
        if (marcCount > 0 && marcCount % 2 !== 0) {
          issues.push({ funcId: func.id, funcNome: func.nome_guerra ?? func.nome, dia: day, tipo: 'batida_impar', detalhe: `${marcCount} batidas (impar)` })
        }
        // >10h worked
        if (reg?.horas_trabalhadas && reg.horas_trabalhadas > 10) {
          issues.push({ funcId: func.id, funcNome: func.nome_guerra ?? func.nome, dia: day, tipo: 'excesso_horas', detalhe: `${reg.horas_trabalhadas}h trabalhadas` })
        }
        // No batidas on weekday with no registro
        if (marcCount === 0 && !reg) {
          issues.push({ funcId: func.id, funcNome: func.nome_guerra ?? func.nome, dia: day, tipo: 'sem_batida', detalhe: 'Sem batidas em dia util' })
        }
      }
    }
    setInconsistencias(issues)
    setLoading(false)
  }, [obraId, mes, ano, totalDays])

  useEffect(() => { loadData() }, [loadData])

  async function handleFecharMes() {
    if (!confirm(`Fechar o ponto de ${mes}/${ano}? Apenas administradores poderao editar apos o fechamento.`)) return
    setFechando(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error('Sessao expirada'); setFechando(false); return }
    const { data: prof } = await supabase.from('profiles').select('nome').eq('user_id', user.id).maybeSingle()
    const { error } = await supabase.from('ponto_fechamentos').insert({
      obra_id: obraId, mes, ano,
      fechado_por: user.id,
      fechado_por_nome: (prof as any)?.nome ?? null,
    })
    setFechando(false)
    if (error) { toast.error('Erro ao fechar: ' + error.message); return }
    toast.success('Ponto do mes fechado')
    loadData()
  }

  async function handleReabrirMes() {
    if (!fechamento) return
    if (!confirm(`Reabrir o ponto de ${mes}/${ano}?`)) return
    setFechando(true)
    const { error: err1 } = await supabase.from('ponto_fechamentos').delete().eq('id', fechamento.id)
    // Also update folha_fechamentos if exists
    await supabase.from('folha_fechamentos').update({ reaberto: true, reaberto_em: new Date().toISOString() })
      .eq('obra_id', obraId).eq('mes', mes).eq('ano', ano)
    setFechando(false)
    if (err1) { toast.error('Erro ao reabrir: ' + err1.message); return }
    toast.success('Ponto reaberto')
    loadData()
  }

  function getCellColor(funcId: string, day: number): string {
    if (isWeekend(ano, mes, day)) return 'bg-gray-100 text-gray-400'
    const reg = registros[funcId]?.[day]
    if (!reg) return 'bg-white text-gray-300 hover:bg-blue-50'
    const tipo = reg.tipo_dia ?? 'normal'
    if (tipo === 'falta') return 'bg-red-100 text-red-700 hover:bg-red-200'
    if (tipo === 'feriado' || tipo === 'folga') return 'bg-gray-100 text-gray-500'
    if (tipo === 'atestado' || tipo === 'ferias') return 'bg-blue-100 text-blue-700'
    // Normal day — check if extras
    if (reg.horas_trabalhadas && reg.horas_trabalhadas > 8.8) return 'bg-amber-100 text-amber-700 hover:bg-amber-200'
    return 'bg-green-100 text-green-700 hover:bg-green-200'
  }

  function getCellLabel(funcId: string, day: number): string {
    if (isWeekend(ano, mes, day)) return '-'
    const reg = registros[funcId]?.[day]
    if (!reg) return '\u00b7'
    const tipo = reg.tipo_dia ?? 'normal'
    if (tipo === 'falta') return 'F'
    if (tipo === 'feriado') return 'Fe'
    if (tipo === 'folga') return 'X'
    if (tipo === 'atestado') return 'A'
    if (tipo === 'ferias') return 'Fr'
    if (reg.horas_trabalhadas) return String(Math.round(reg.horas_trabalhadas * 10) / 10)
    return 'P'
  }

  function isEdited(funcId: string, day: number): boolean {
    const reg = registros[funcId]?.[day]
    return !!reg?.editado_em
  }

  if (loading) {
    return <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-10 text-center text-gray-400">Carregando grade...</div>
  }

  if (funcionarios.length === 0) {
    return <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-10 text-center text-gray-400">Nenhum funcionario alocado nesta obra.</div>
  }

  const meses = ['Janeiro','Fevereiro','Marco','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-bold text-gray-700">{meses[mes - 1]} {ano}</h3>
          {mesFechado ? (
            <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full font-bold">🔒 Fechado</span>
          ) : (
            <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full font-bold">🟢 Aberto</span>
          )}
        </div>
        <div className="flex gap-2">
          {!mesFechado ? (
            <button onClick={handleFecharMes} disabled={fechando}
              className="px-3 py-1.5 bg-brand text-white rounded-xl text-xs font-bold hover:bg-brand-dark disabled:opacity-50">
              {fechando ? 'Fechando...' : '🔒 Fechar mes'}
            </button>
          ) : (
            <button onClick={handleReabrirMes} disabled={fechando}
              className="px-3 py-1.5 border border-amber-300 text-amber-700 rounded-xl text-xs font-bold hover:bg-amber-50 disabled:opacity-50">
              {fechando ? 'Reabrindo...' : '🔓 Reabrir mes'}
            </button>
          )}
        </div>
      </div>

      {/* Inconsistency alerts */}
      {inconsistencias.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <button onClick={() => setShowInconsistencias(!showInconsistencias)}
            className="flex items-center justify-between w-full text-left">
            <span className="text-xs font-bold text-amber-800">
              ⚠️ {inconsistencias.length} inconsistencia{inconsistencias.length > 1 ? 's' : ''} encontrada{inconsistencias.length > 1 ? 's' : ''}
            </span>
            <span className="text-xs text-amber-600">{showInconsistencias ? '▲ Ocultar' : '▼ Ver detalhes'}</span>
          </button>
          {showInconsistencias && (
            <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
              {inconsistencias.slice(0, 50).map((inc, i) => (
                <div key={i} className="text-[10px] text-amber-700 flex gap-2 items-center">
                  <span className="font-semibold min-w-[100px] truncate">{inc.funcNome}</span>
                  <span className="text-amber-500">Dia {inc.dia}</span>
                  <span>{inc.detalhe}</span>
                  <button onClick={() => {
                    const dateStr = `${ano}-${String(mes).padStart(2, '0')}-${String(inc.dia).padStart(2, '0')}`
                    onCellClick(inc.funcId, dateStr)
                  }} className="text-brand font-bold hover:underline ml-auto">Editar</button>
                </div>
              ))}
              {inconsistencias.length > 50 && (
                <p className="text-[10px] text-amber-500">...e mais {inconsistencias.length - 50}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Grid */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left px-3 py-2 text-gray-600 font-semibold sticky left-0 bg-gray-50 z-10 min-w-[180px] border-r border-gray-200">Funcionario</th>
              {days.map(d => {
                const weekend = isWeekend(ano, mes, d)
                const dow = getDayOfWeek(ano, mes, d)
                return (
                  <th key={d} className={`px-1 py-2 text-center font-semibold min-w-[32px] ${weekend ? 'bg-gray-100 text-gray-400' : 'text-gray-600'}`}>
                    <div className="leading-tight">{d}</div>
                    <div className="text-[9px] font-normal">{dow}</div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {funcionarios.map(func => (
              <tr key={func.id} className="border-t border-gray-50 hover:bg-gray-50/50">
                <td className="px-3 py-1.5 font-medium text-gray-800 sticky left-0 bg-white z-10 border-r border-gray-200 truncate max-w-[180px]" title={func.nome}>
                  {func.nome_guerra ?? func.nome}
                  {func.cargo && <span className="text-gray-400 font-normal ml-1 text-[10px]">{func.cargo}</span>}
                </td>
                {days.map(d => {
                  const dateStr = `${ano}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                  const color = getCellColor(func.id, d)
                  const label = getCellLabel(func.id, d)
                  const edited = isEdited(func.id, d)
                  const weekend = isWeekend(ano, mes, d)
                  return (
                    <td key={d}
                      onClick={() => !weekend && onCellClick(func.id, dateStr)}
                      className={`px-1 py-1.5 text-center cursor-pointer transition-colors ${color} ${weekend ? 'cursor-default' : ''}`}
                      title={weekend ? 'Fim de semana' : undefined}>
                      <span className="text-[10px] font-semibold">{label}</span>
                      {edited && <span className="text-[8px] ml-0.5" title="Editado">✏️</span>}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-[10px] text-gray-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 border border-green-300 inline-block" /> Normal</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-300 inline-block" /> Horas extras</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border border-red-300 inline-block" /> Falta</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-100 border border-gray-300 inline-block" /> Fim de semana/Feriado</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-100 border border-blue-300 inline-block" /> Atestado/Ferias</span>
        <span>✏️ = Editado manualmente</span>
      </div>
    </div>
  )
}
