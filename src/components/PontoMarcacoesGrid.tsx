'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import SearchInput from '@/components/SearchInput'

function getDaysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate()
}

function isWeekend(year: number, month: number, day: number): boolean {
  const d = new Date(year, month - 1, day).getDay()
  return d === 0 || d === 6
}

/** Formata "07:30:00" -> "07:30" */
function fmtHora(h: string): string {
  return h.slice(0, 5)
}

type Funcionario = {
  id: string
  nome: string
  cargo: string | null
}

type MarcacaoBruta = {
  funcionario_id: string
  data: string
  hora: string
  sequencia: number
}

type DiaStatus = {
  funcionario_id: string
  data: string
  status: string
}

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  afastamento: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'AFAST' },
  ferias: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'FERIAS' },
  folga: { bg: 'bg-gray-200', text: 'text-gray-600', label: 'FOLGA' },
  compensado: { bg: 'bg-gray-200', text: 'text-gray-600', label: 'COMP' },
  pendente: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'PEND' },
  sem_marcacao: { bg: 'bg-red-100', text: 'text-red-600', label: 'FALTA' },
}

const MESES = ['Janeiro','Fevereiro','Marco','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

export default function PontoMarcacoesGrid() {
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [ano, setAno] = useState(now.getFullYear())
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(false)

  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [marcacoes, setMarcacoes] = useState<MarcacaoBruta[]>([])
  const [statusDias, setStatusDias] = useState<DiaStatus[]>([])

  const supabase = createClient()

  const totalDays = getDaysInMonth(mes, ano)
  const days = useMemo(() => Array.from({ length: totalDays }, (_, i) => i + 1), [totalDays])
  const dateStart = `${ano}-${String(mes).padStart(2, '0')}-01`
  const dateEnd = `${ano}-${String(mes).padStart(2, '0')}-${String(totalDays).padStart(2, '0')}`

  useEffect(() => {
    loadData()
  }, [mes, ano])

  async function loadData() {
    setLoading(true)

    // 1. Buscar funcionarios que possuem marcacoes nesse periodo
    const { data: marcData } = await supabase
      .from('ponto_marcacoes')
      .select('funcionario_id, data, hora, sequencia')
      .gte('data', dateStart)
      .lte('data', dateEnd)
      .order('funcionario_id')
      .order('data')
      .order('sequencia')

    const marcs = (marcData ?? []) as MarcacaoBruta[]

    // 2. Buscar status dos dias
    const { data: statusData } = await supabase
      .from('ponto_dia_status')
      .select('funcionario_id, data, status')
      .gte('data', dateStart)
      .lte('data', dateEnd)

    const sts = (statusData ?? []) as DiaStatus[]

    // 3. Coletar todos os func_ids unicos (de marcacoes + status)
    const funcIdsSet = new Set<string>()
    marcs.forEach(m => funcIdsSet.add(m.funcionario_id))
    sts.forEach(s => funcIdsSet.add(s.funcionario_id))
    const funcIds = Array.from(funcIdsSet)

    // 4. Buscar dados dos funcionarios
    let funcs: Funcionario[] = []
    if (funcIds.length > 0) {
      // Supabase .in() tem limite de ~100 params; paginar se necessario
      const CHUNK = 100
      for (let i = 0; i < funcIds.length; i += CHUNK) {
        const chunk = funcIds.slice(i, i + CHUNK)
        const { data: fData } = await supabase
          .from('funcionarios')
          .select('id, nome, cargo')
          .in('id', chunk)
          .is('deleted_at', null)
          .order('nome')
        funcs = funcs.concat((fData ?? []) as Funcionario[])
      }
    }

    funcs.sort((a, b) => a.nome.localeCompare(b.nome))
    setFuncionarios(funcs)
    setMarcacoes(marcs)
    setStatusDias(sts)
    setLoading(false)
  }

  // Indexar marcacoes: funcId -> data -> batidas[]
  const marcMap = useMemo(() => {
    const map = new Map<string, Map<string, string[]>>()
    for (const m of marcacoes) {
      if (!map.has(m.funcionario_id)) map.set(m.funcionario_id, new Map())
      const dayMap = map.get(m.funcionario_id)!
      if (!dayMap.has(m.data)) dayMap.set(m.data, [])
      dayMap.get(m.data)!.push(m.hora)
    }
    return map
  }, [marcacoes])

  // Indexar status: funcId -> data -> status
  const statusMap = useMemo(() => {
    const map = new Map<string, Map<string, string>>()
    for (const s of statusDias) {
      if (!map.has(s.funcionario_id)) map.set(s.funcionario_id, new Map())
      map.get(s.funcionario_id)!.set(s.data, s.status)
    }
    return map
  }, [statusDias])

  // Filtrar funcionarios por busca
  const filtered = useMemo(() => {
    if (!busca.trim()) return funcionarios
    const q = busca.toLowerCase()
    return funcionarios.filter(f =>
      f.nome.toLowerCase().includes(q) ||
      (f.cargo && f.cargo.toLowerCase().includes(q))
    )
  }, [funcionarios, busca])

  /** Monta conteudo da celula para um funcionario+dia */
  function getCellContent(funcId: string, day: number): { display: string; cls: string; title: string } {
    const dateStr = `${ano}-${String(mes).padStart(2, '0')}-${String(day).padStart(2, '0')}`

    if (isWeekend(ano, mes, day)) {
      // Ainda assim, mostra batidas se houver (trabalho em fim de semana)
      const batidas = marcMap.get(funcId)?.get(dateStr)
      if (batidas && batidas.length > 0) {
        const compact = formatBatidas(batidas)
        return { display: compact, cls: 'bg-amber-50 text-amber-800', title: `FDS com batidas: ${compact}` }
      }
      return { display: '', cls: 'bg-gray-100 text-gray-300', title: 'Fim de semana' }
    }

    const batidas = marcMap.get(funcId)?.get(dateStr)
    const status = statusMap.get(funcId)?.get(dateStr)

    if (batidas && batidas.length > 0) {
      const compact = formatBatidas(batidas)
      return { display: compact, cls: 'bg-green-50 text-green-800', title: compact }
    }

    if (status) {
      const st = STATUS_COLORS[status]
      if (st) return { display: st.label, cls: `${st.bg} ${st.text}`, title: status }
      if (status === 'presente') return { display: 'P', cls: 'bg-green-100 text-green-700', title: 'Presente (sem batidas detalhadas)' }
      return { display: status.slice(0, 5).toUpperCase(), cls: 'bg-gray-100 text-gray-600', title: status }
    }

    return { display: '', cls: 'bg-white text-gray-200', title: 'Sem dados' }
  }

  /** Formata batidas em pares: "07:30-12:00 13:00-17:30" */
  function formatBatidas(batidas: string[]): string {
    const sorted = [...batidas].sort()
    const parts: string[] = []
    for (let i = 0; i < sorted.length; i += 2) {
      const entrada = fmtHora(sorted[i])
      const saida = i + 1 < sorted.length ? fmtHora(sorted[i + 1]) : '??'
      parts.push(`${entrada}-${saida}`)
    }
    return parts.join(' ')
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
      <h2 className="text-sm font-bold text-brand mb-1">Marcacoes Brutas do Ponto</h2>
      <p className="text-xs text-gray-500 mb-4">
        Todas as batidas importadas da Secullum, por funcionario e dia. Independente de obra.
      </p>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="flex-1 min-w-[200px] max-w-[320px]">
          <SearchInput value={busca} onChange={setBusca} placeholder="Buscar por nome ou cargo..." />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-gray-600 mb-1">Mes</label>
          <select value={mes} onChange={e => setMes(Number(e.target.value))}
            className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
            {MESES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-gray-600 mb-1">Ano</label>
          <select value={ano} onChange={e => setAno(Number(e.target.value))}
            className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
            {[ano - 1, ano, ano + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="text-xs text-gray-400">
          {loading ? 'Carregando...' : `${filtered.length} funcionario(s)`}
        </div>
      </div>

      {loading && (
        <div className="text-center text-sm text-gray-400 py-8">Carregando marcacoes...</div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center text-sm text-gray-400 py-8">
          {funcionarios.length === 0
            ? 'Nenhuma marcacao importada neste periodo. Importe o ponto via Secullum primeiro.'
            : 'Nenhum funcionario corresponde a busca.'}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="overflow-x-auto">
          <table className="text-[10px] border-collapse min-w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-2 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide sticky left-0 bg-gray-50 z-10 min-w-[180px]">
                  Funcionario
                </th>
                {days.map(d => (
                  <th key={d} className={`px-0.5 py-1.5 text-center font-semibold min-w-[70px] ${isWeekend(ano, mes, d) ? 'text-gray-400 bg-gray-50' : 'text-gray-500'}`}>
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(func => (
                <tr key={func.id} className="border-b border-gray-50 hover:bg-gray-50/30">
                  <td className="px-2 py-1 font-medium text-gray-800 sticky left-0 z-10 bg-white border-r border-gray-100">
                    <div className="truncate max-w-[170px]" title={func.nome}>{func.nome}</div>
                    {func.cargo && <div className="text-[9px] text-gray-400 truncate max-w-[170px]">{func.cargo}</div>}
                  </td>
                  {days.map(d => {
                    const cell = getCellContent(func.id, d)
                    return (
                      <td key={d} className={`px-0.5 py-1 text-center whitespace-nowrap ${cell.cls}`} title={cell.title}>
                        {cell.display}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Legenda */}
      {!loading && filtered.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-[10px] text-gray-500">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-50 border border-green-200"></span> Batidas</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-100 border border-blue-200"></span> Afastamento</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-purple-100 border border-purple-200"></span> Ferias</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border border-red-200"></span> Falta</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-50 border border-amber-200"></span> FDS c/ batida</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-100 border border-gray-200"></span> FDS / Sem dados</span>
        </div>
      )}
    </div>
  )
}
