'use client'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
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

type Obra = {
  id: string
  nome: string
}

/** Atribuicao de obra por (funcionario, data) vinda de efetivo_diario */
type Atribuicao = {
  funcionario_id: string
  data: string
  obra_id: string
}

// Cores para chips de obra (cicla por indice)
const OBRA_COLORS = [
  { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200' },
  { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-200' },
  { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
  { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-200' },
  { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-200' },
  { bg: 'bg-lime-100', text: 'text-lime-700', border: 'border-lime-200' },
  { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200' },
  { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200' },
]

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
  const [obras, setObras] = useState<Obra[]>([])
  // funcId -> data -> obra_id
  const [atribuicoes, setAtribuicoes] = useState<Map<string, Map<string, string>>>(new Map())
  // Celula com dropdown aberto: "funcId|day"
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const supabase = createClient()
  const toast = useToast()
  const dropdownRef = useRef<HTMLDivElement>(null)

  const totalDays = getDaysInMonth(mes, ano)
  const days = useMemo(() => Array.from({ length: totalDays }, (_, i) => i + 1), [totalDays])
  const dateStart = `${ano}-${String(mes).padStart(2, '0')}-01`
  const dateEnd = `${ano}-${String(mes).padStart(2, '0')}-${String(totalDays).padStart(2, '0')}`

  // Mapa de obra_id -> indice de cor
  const obraColorMap = useMemo(() => {
    const map = new Map<string, number>()
    obras.forEach((o, i) => map.set(o.id, i % OBRA_COLORS.length))
    return map
  }, [obras])

  // Fechar dropdown com Escape ou clique fora
  useEffect(() => {
    if (!dropdownOpen) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setDropdownOpen(null)
    }
    function handleClick(e: MouseEvent) {
      // Delay check: se o target está dentro do dropdown, ignora
      if (dropdownRef.current?.contains(e.target as Node)) return
      setDropdownOpen(null)
    }
    // Usar 'click' (não 'mousedown') pra não conflitar com o botão que abre
    document.addEventListener('click', handleClick, true)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('click', handleClick, true)
      document.removeEventListener('keydown', handleKey)
    }
  }, [dropdownOpen])

  useEffect(() => {
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes, ano])

  // Carregar obras ativas uma vez
  useEffect(() => {
    supabase
      .from('obras')
      .select('id, nome')
      .eq('status', 'ativo')
      .is('deleted_at', null)
      .order('nome')
      .then(({ data }) => setObras((data ?? []) as Obra[]))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Fetch paginado pra contornar limite de 1000 linhas do Supabase */
  async function fetchAll<T>(table: string, select: string, filters: Record<string, any>, order?: string[]): Promise<T[]> {
    const PAGE = 1000
    let offset = 0
    let all: T[] = []
    while (true) {
      let q = supabase.from(table).select(select).gte('data', dateStart).lte('data', dateEnd).range(offset, offset + PAGE - 1)
      for (const [k, v] of Object.entries(filters)) {
        if (v === null) q = q.is(k, null)
        else q = q.eq(k, v)
      }
      if (order) for (const o of order) q = q.order(o)
      const { data, error } = await q
      if (error || !data || data.length === 0) break
      all = all.concat(data as T[])
      if (data.length < PAGE) break
      offset += PAGE
    }
    return all
  }

  async function loadData() {
    setLoading(true)

    // 1. Buscar marcacoes (paginado)
    const marcs = await fetchAll<MarcacaoBruta>(
      'ponto_marcacoes',
      'funcionario_id, data, hora, sequencia',
      {},
      ['funcionario_id', 'data', 'sequencia']
    )

    // 2. Buscar status dos dias (paginado)
    const sts = await fetchAll<DiaStatus>(
      'ponto_dia_status',
      'funcionario_id, data, status',
      {}
    )

    // 3. Coletar todos os func_ids unicos (de marcacoes + status)
    const funcIdsSet = new Set<string>()
    marcs.forEach(m => funcIdsSet.add(m.funcionario_id))
    sts.forEach(s => funcIdsSet.add(s.funcionario_id))
    const funcIds = Array.from(funcIdsSet)

    // 4. Buscar dados dos funcionarios
    let funcs: Funcionario[] = []
    if (funcIds.length > 0) {
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

    // 5. Carregar atribuicoes existentes de efetivo_diario para o periodo
    const atribMap = new Map<string, Map<string, string>>()
    if (funcIds.length > 0) {
      // Paginado por chunks de funcIds
      const CHUNK = 50
      for (let i = 0; i < funcIds.length; i += CHUNK) {
        const chunk = funcIds.slice(i, i + CHUNK)
        let offset = 0
        while (true) {
          const { data: efData } = await supabase
            .from('efetivo_diario')
            .select('funcionario_id, data, obra_id')
            .in('funcionario_id', chunk)
            .gte('data', dateStart)
            .lte('data', dateEnd)
            .not('obra_id', 'is', null)
            .range(offset, offset + 999)
          if (!efData || efData.length === 0) break
          for (const row of efData as Atribuicao[]) {
            if (!atribMap.has(row.funcionario_id)) atribMap.set(row.funcionario_id, new Map())
            atribMap.get(row.funcionario_id)!.set(row.data, row.obra_id)
          }
          if (efData.length < 1000) break
          offset += 1000
        }
      }
    }

    funcs.sort((a, b) => a.nome.localeCompare(b.nome))
    setFuncionarios(funcs)
    setMarcacoes(marcs)
    setStatusDias(sts)
    setAtribuicoes(atribMap)
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

  /**
   * Resolve a obra atribuida para (funcId, dateStr).
   * Se nao tem atribuicao explicita, herda do dia anterior mais recente.
   */
  const getObraAtribuida = useCallback((funcId: string, dateStr: string): string | null => {
    const funcAtrib = atribuicoes.get(funcId)
    if (!funcAtrib) return null

    // Atribuicao explicita neste dia
    if (funcAtrib.has(dateStr)) return funcAtrib.get(dateStr)!

    // Heranca: busca o dia anterior mais recente que tenha atribuicao
    // (dentro do mes visivel + pode ter atribuicao de meses anteriores carregada)
    let bestDate: string | null = null
    Array.from(funcAtrib.keys()).forEach(d => {
      if (d < dateStr && (!bestDate || d > bestDate)) {
        bestDate = d
      }
    })
    return bestDate ? funcAtrib.get(bestDate)! : null
  }, [atribuicoes])

  /** Atribuir obra a um funcionario em um dia (upsert em efetivo_diario) */
  async function atribuirObra(funcId: string, day: number, obraId: string | null) {
    const dateStr = `${ano}-${String(mes).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    setSaving(true)

    if (obraId) {
      // Upsert: grava efetivo_diario com a obra escolhida
      const { error } = await supabase
        .from('efetivo_diario')
        .upsert({
          funcionario_id: funcId,
          obra_id: obraId,
          data: dateStr,
          origem_registro: 'atribuicao_manual',
        }, {
          onConflict: 'obra_id,funcionario_id,data',
        })

      if (error) {
        // Se o conflito e por um registro com outra obra, atualizar o existente
        // Tenta primeiro deletar registros antigos deste func+data e inserir novo
        const { error: delError } = await supabase
          .from('efetivo_diario')
          .delete()
          .eq('funcionario_id', funcId)
          .eq('data', dateStr)

        if (!delError) {
          const { error: insError } = await supabase
            .from('efetivo_diario')
            .insert({
              funcionario_id: funcId,
              obra_id: obraId,
              data: dateStr,
              origem_registro: 'atribuicao_manual',
            })

          if (insError) {
            toast.error('Erro ao atribuir obra: ' + insError.message)
            setSaving(false)
            setDropdownOpen(null)
            return
          }
        } else {
          toast.error('Erro ao atribuir obra: ' + delError.message)
          setSaving(false)
          setDropdownOpen(null)
          return
        }
      }

      // Atualizar estado local
      setAtribuicoes(prev => {
        const next = new Map(prev)
        if (!next.has(funcId)) next.set(funcId, new Map())
        next.get(funcId)!.set(dateStr, obraId)
        return next
      })
    } else {
      // "Sem obra" — remover atribuicao
      const { error } = await supabase
        .from('efetivo_diario')
        .delete()
        .eq('funcionario_id', funcId)
        .eq('data', dateStr)

      if (error) {
        toast.error('Erro ao remover atribuicao: ' + error.message)
        setSaving(false)
        setDropdownOpen(null)
        return
      }

      setAtribuicoes(prev => {
        const next = new Map(prev)
        const funcMap = next.get(funcId)
        if (funcMap) {
          funcMap.delete(dateStr)
          if (funcMap.size === 0) next.delete(funcId)
        }
        return next
      })
    }

    setSaving(false)
    setDropdownOpen(null)
    const obraNome = obraId ? obras.find(o => o.id === obraId)?.nome ?? 'Obra' : 'Sem obra'
    toast.success(`${obraNome} atribuida ao dia ${day}/${mes}`)
  }

  /** Monta conteudo da celula para um funcionario+dia */
  function getCellContent(funcId: string, day: number): { display: string; cls: string; title: string } {
    const dateStr = `${ano}-${String(mes).padStart(2, '0')}-${String(day).padStart(2, '0')}`

    if (isWeekend(ano, mes, day)) {
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

  /** Renderiza chip de obra para uma celula */
  function renderObraChip(funcId: string, day: number) {
    const dateStr = `${ano}-${String(mes).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const obraId = getObraAtribuida(funcId, dateStr)
    const cellKey = `${funcId}|${day}`
    const isOpen = dropdownOpen === cellKey
    const isExplicit = atribuicoes.get(funcId)?.has(dateStr) ?? false

    if (!obraId) {
      return (
        <button
          onClick={(e) => { e.stopPropagation(); setDropdownOpen(isOpen ? null : cellKey) }}
          className="mt-0.5 text-[8px] px-1 py-0.5 rounded border border-dashed border-gray-300 text-gray-400 hover:border-brand hover:text-brand transition-colors"
          title="Clique para atribuir obra"
        >
          + obra
        </button>
      )
    }

    const obra = obras.find(o => o.id === obraId)
    const colorIdx = obraColorMap.get(obraId) ?? 0
    const color = OBRA_COLORS[colorIdx]
    const nomeAbrev = obra ? (obra.nome.length > 8 ? obra.nome.slice(0, 7) + '..' : obra.nome) : '??'

    return (
      <button
        onClick={(e) => { e.stopPropagation(); setDropdownOpen(isOpen ? null : cellKey) }}
        className={`mt-0.5 text-[8px] px-1 py-0.5 rounded border ${color.bg} ${color.text} ${color.border} ${!isExplicit ? 'opacity-60 border-dashed' : ''} hover:opacity-100 transition-opacity`}
        title={`${obra?.nome ?? 'Obra desconhecida'}${!isExplicit ? ' (herdado)' : ''} — clique para alterar`}
      >
        {nomeAbrev}
      </button>
    )
  }

  /** Renderiza dropdown de selecao de obra */
  function renderObraDropdown(funcId: string, day: number) {
    const cellKey = `${funcId}|${day}`
    if (dropdownOpen !== cellKey) return null
    const dateStr = `${ano}-${String(mes).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const currentObraId = getObraAtribuida(funcId, dateStr)

    return (
      <div
        ref={dropdownRef}
        className="absolute z-[100] mt-1 left-1/2 -translate-x-1/2 bg-white border border-gray-200 rounded-lg shadow-2xl py-1 min-w-[180px] max-h-[200px] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => atribuirObra(funcId, day, null)}
          disabled={saving}
          className={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-gray-50 ${!currentObraId ? 'font-bold text-brand' : 'text-gray-600'}`}
        >
          Sem obra
        </button>
        {obras.length === 0 && (
          <div className="px-3 py-2 text-[10px] text-gray-400 italic">
            Nenhuma obra ativa. Crie uma obra primeiro.
          </div>
        )}
        {obras.map(o => {
          const colorIdx = obraColorMap.get(o.id) ?? 0
          const color = OBRA_COLORS[colorIdx]
          const isSelected = o.id === currentObraId
          return (
            <button
              key={o.id}
              onClick={() => atribuirObra(funcId, day, o.id)}
              disabled={saving}
              className={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-gray-50 flex items-center gap-2 ${isSelected ? 'font-bold' : ''}`}
            >
              <span className={`w-2 h-2 rounded-full ${color.bg} border ${color.border}`}></span>
              <span className={isSelected ? 'text-brand' : 'text-gray-700'}>{o.nome}</span>
              {isSelected && <span className="text-brand text-[9px] ml-auto">atual</span>}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
      <h2 className="text-sm font-bold text-brand mb-1">Marcacoes Brutas do Ponto</h2>
      <p className="text-xs text-gray-500 mb-4">
        Todas as batidas importadas da Secullum, por funcionario e dia. Independente de obra.
        <span className="ml-1 text-brand font-medium">Clique em &quot;+ obra&quot; para atribuir a obra do dia.</span>
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
                  <th key={d} className={`px-0.5 py-1.5 text-center font-semibold min-w-[80px] ${isWeekend(ano, mes, d) ? 'text-gray-400 bg-gray-50' : 'text-gray-500'}`}>
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
                    const cellKey = `${func.id}|${d}`
                    const isWk = isWeekend(ano, mes, d)
                    const hasBatidas = (() => {
                      const dateStr = `${ano}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                      const b = marcMap.get(func.id)?.get(dateStr)
                      return b && b.length > 0
                    })()
                    return (
                      <td key={d} className={`px-0.5 py-1 text-center whitespace-nowrap ${cell.cls} relative`} title={cell.title}>
                        <div className="flex flex-col items-center">
                          <span>{cell.display}</span>
                          {/* Chip de obra — so mostra se tem batidas ou status nao-vazio */}
                          {(hasBatidas || (!isWk && cell.display !== '')) && (
                            <div className="relative">
                              {renderObraChip(func.id, d)}
                              {renderObraDropdown(func.id, d)}
                            </div>
                          )}
                        </div>
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
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-100 border border-indigo-200"></span> Obra atribuida</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-100 border border-dashed border-indigo-200 opacity-60"></span> Obra herdada</span>
        </div>
      )}
    </div>
  )
}
