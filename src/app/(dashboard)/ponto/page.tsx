'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import PontoCellEditor from '@/components/PontoCellEditor'
import PontoImportModal from '@/components/PontoImportModal'
import PontoDiaRapidoModal from '@/components/PontoDiaRapidoModal'
import { useToast } from '@/components/Toast'

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
  horas_trabalhadas?: number | null
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
  const [fechamento, setFechamento] = useState<any>(null)
  const [fechando, setFechando] = useState(false)
  const [role, setRole] = useState<string>('')
  const [showHistorico, setShowHistorico] = useState(false)
  const [historico, setHistorico] = useState<any[]>([])
  const [loadingHistorico, setLoadingHistorico] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showDiaRapido, setShowDiaRapido] = useState(false)
  const supabase = createClient()
  const toast = useToast()

  const isAdmin = role === 'admin'
  const isOp = isAdmin || role === 'encarregado' || role === 'engenheiro'
  const pontoFechado = !!fechamento
  const podeEditar = !pontoFechado || isAdmin

  useEffect(() => {
    supabase.from('obras').select('id,nome,modelo_cobranca,escala_entrada,escala_saida_seg_qui,escala_saida_sex,escala_almoco_minutos,escala_tolerancia_min').eq('status', 'ativo').is('deleted_at', null).order('nome')
      .then(({ data }) => setObras(data ?? []))
    // Buscar role do usuário
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('profiles').select('role').eq('id', user.id).single()
          .then(({ data }) => setRole((data as any)?.role ?? ''))
      }
    })
  }, [])

  const loadData = useCallback(async () => {
    if (!obraId) {
      setFuncionarios([]); setGrid({}); setFechamento(null); return
    }
    setLoading(true)

    const totalDays = getDaysInMonth(mes, ano)
    const dateStart = `${ano}-${String(mes).padStart(2, '0')}-01`
    const dateEnd = `${ano}-${String(mes).padStart(2, '0')}-${String(totalDays).padStart(2, '0')}`

    // Verifica se o período está fechado
    const { data: fech } = await supabase
      .from('ponto_fechamentos')
      .select('*')
      .eq('obra_id', obraId).eq('mes', mes).eq('ano', ano)
      .maybeSingle()
    setFechamento(fech)

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
        .select('id,funcionario_id,data,observacao,horas_trabalhadas')
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
        horas_trabalhadas: e.horas_trabalhadas,
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

  async function handleFechar() {
    if (!obraId) return
    if (!confirm(`Fechar o ponto de ${meses[mes - 1]}/${ano}? Após fechado, apenas administradores poderão editar.`)) return
    setFechando(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error('Sessão expirada — faça login novamente'); setFechando(false); return }
    const { data: prof } = await supabase.from('profiles').select('nome').eq('id', user.id).maybeSingle()
    const { error } = await supabase.from('ponto_fechamentos').insert({
      obra_id: obraId, mes, ano,
      fechado_por: user.id,
      fechado_por_nome: (prof as any)?.nome ?? null,
    })
    setFechando(false)
    if (error) { toast.error('Erro ao fechar: ' + error.message); return }
    toast.success('Ponto fechado com sucesso')
    loadData()
  }

  async function handleReabrir() {
    if (!fechamento) return
    if (!confirm(`Reabrir o ponto de ${meses[mes - 1]}/${ano}? Os usuários voltarão a poder editar.`)) return
    setFechando(true)
    const { error } = await supabase.from('ponto_fechamentos').delete().eq('id', fechamento.id)
    setFechando(false)
    if (error) { toast.error('Erro ao reabrir: ' + error.message); return }
    toast.success('Ponto reaberto')
    loadData()
  }

  async function loadHistorico() {
    if (!obraId) return
    setLoadingHistorico(true)
    // Pega últimas alterações no efetivo_diario feitas para esta obra
    const { data } = await supabase.from('audit_log')
      .select('*')
      .eq('tabela', 'efetivo_diario')
      .order('created_at', { ascending: false })
      .limit(100)
    setHistorico(data ?? [])
    setLoadingHistorico(false)
  }

  function toggleHistorico() {
    const next = !showHistorico
    setShowHistorico(next)
    if (next && historico.length === 0) loadHistorico()
  }

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
      horas_trabalhadas: c.horas_trabalhadas,
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
      <div className="flex items-start justify-between mb-2 gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold font-display text-brand">Controle de Ponto</h1>
          <p className="text-xs text-gray-500 mt-1">
            Criação diária, edição mensal, importação e fechamento da folha de ponto de cada obra — tudo nesta tela.
            Clique em qualquer dia do calendário para lançar um funcionário por vez, ou use <strong>⚡ Lançar dia rápido</strong> para marcar vários de uma vez.
            Suporta horas reais trabalhadas para contratos cobrados por hora. Após o fechamento do mês, apenas administradores podem corrigir — toda alteração é auditada.
          </p>
        </div>
        {obraId && isOp && (
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setShowDiaRapido(true)} disabled={pontoFechado && !isAdmin}
              className="px-3 py-2 bg-brand text-white rounded-xl text-xs font-bold hover:bg-brand-dark disabled:opacity-50">
              ⚡ Lançar dia rápido
            </button>
            <button onClick={() => setShowImport(true)} disabled={pontoFechado && !isAdmin}
              className="px-3 py-2 border border-brand text-brand rounded-xl text-xs font-semibold hover:bg-brand/5 disabled:opacity-50">
              📥 Importar folha
            </button>
            {isAdmin && (
              <button onClick={toggleHistorico}
                className="px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold hover:bg-gray-50">
                🔍 Histórico de alterações
              </button>
            )}
            {!pontoFechado ? (
              <button onClick={handleFechar} disabled={fechando}
                className="px-4 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50">
                {fechando ? 'Fechando...' : '🔒 Fechar ponto do mês'}
              </button>
            ) : isAdmin && (
              <button onClick={handleReabrir} disabled={fechando}
                className="px-4 py-2 border border-amber-300 text-amber-700 rounded-xl text-sm font-bold hover:bg-amber-50 disabled:opacity-50">
                {fechando ? 'Reabrindo...' : '🔓 Reabrir ponto'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Banner de fechamento */}
      {obraId && pontoFechado && (
        <div className={`mb-4 p-3 rounded-xl border flex items-center gap-3 ${isAdmin ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
          <div className="text-2xl">🔒</div>
          <div className="flex-1">
            <p className={`text-sm font-bold ${isAdmin ? 'text-amber-800' : 'text-gray-700'}`}>Ponto fechado</p>
            <p className="text-xs text-gray-600 mt-0.5">
              {meses[mes - 1]}/{ano} foi encerrado
              {fechamento.fechado_por_nome && <span> por <strong>{fechamento.fechado_por_nome}</strong></span>}
              {fechamento.fechado_em && <span> em {new Date(fechamento.fechado_em).toLocaleString('pt-BR')}</span>}.
              {isAdmin ? ' Como admin você ainda pode corrigir, mas toda alteração é auditada.' : ' Apenas administradores podem editar — solicite a reabertura se necessário.'}
            </p>
          </div>
        </div>
      )}

      {/* Painel de histórico de alterações */}
      {showHistorico && isAdmin && (
        <div className="mb-4 bg-white border border-gray-200 rounded-xl p-4 max-h-80 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-brand">Últimas alterações no ponto</h3>
            <button onClick={() => setShowHistorico(false)} className="text-xs text-gray-400 hover:text-gray-600">✕ Fechar</button>
          </div>
          {loadingHistorico ? (
            <p className="text-xs text-gray-400">Carregando...</p>
          ) : historico.length === 0 ? (
            <p className="text-xs text-gray-400">Nenhuma alteração registrada.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-2 py-1.5 text-gray-500 font-semibold">Quando</th>
                  <th className="text-left px-2 py-1.5 text-gray-500 font-semibold">Usuário</th>
                  <th className="text-left px-2 py-1.5 text-gray-500 font-semibold">Ação</th>
                  <th className="text-left px-2 py-1.5 text-gray-500 font-semibold">Campos</th>
                </tr>
              </thead>
              <tbody>
                {historico.map(h => {
                  const cor = h.acao === 'INSERT' ? 'bg-green-100 text-green-700' : h.acao === 'DELETE' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                  const label = h.acao === 'INSERT' ? 'criou' : h.acao === 'DELETE' ? 'excluiu' : 'alterou'
                  return (
                    <tr key={h.id} className="border-b border-gray-50">
                      <td className="px-2 py-1.5 text-gray-500 whitespace-nowrap">
                        {new Date(h.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-2 py-1.5 font-medium text-gray-800">{h.usuario_nome ?? '—'}</td>
                      <td className="px-2 py-1.5"><span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${cor}`}>{label}</span></td>
                      <td className="px-2 py-1.5 text-gray-500">{h.campos_alterados?.join(', ') ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

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
                        const bloqueado = !podeEditar
                        return (
                          <td key={d} className="p-0">
                            <button
                              disabled={isWk || bloqueado}
                              onClick={() => setEditing({ funcId: func.id, day: d })}
                              title={bloqueado ? 'Ponto fechado — contate o administrador' : cell.title}
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
            <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-pink-100"></span> L = Licença</span>
            <span className="flex items-center gap-1"><span className="w-4 h-4 rounded border border-gray-200 bg-white"></span> · = Pendente</span>
          </div>
        </>
      )}

      {editing && (() => {
        const func = funcionarios.find(f => f.id === editing.funcId)
        if (!func) return null
        const dateStr = `${ano}-${String(mes).padStart(2,'0')}-${String(editing.day).padStart(2,'0')}`
        const obra = obras.find(o => o.id === obraId)
        return (
          <PontoCellEditor
            funcionario={func}
            obraId={obraId}
            data={dateStr}
            initial={buildEditorInitial(editing.funcId, editing.day)}
            onClose={() => setEditing(null)}
            onSaved={loadData}
            modeloCobranca={obra?.modelo_cobranca}
            escala={{
              escala_entrada: obra?.escala_entrada,
              escala_saida_seg_qui: obra?.escala_saida_seg_qui,
              escala_saida_sex: obra?.escala_saida_sex,
              escala_almoco_minutos: obra?.escala_almoco_minutos,
              escala_tolerancia_min: obra?.escala_tolerancia_min,
            }}
          />
        )
      })()}

      {showImport && obraId && (
        <PontoImportModal
          obraId={obraId}
          obraNome={obras.find(o => o.id === obraId)?.nome ?? ''}
          mes={mes}
          ano={ano}
          onClose={() => setShowImport(false)}
          onImported={loadData}
        />
      )}

      {showDiaRapido && obraId && (
        <PontoDiaRapidoModal
          obraId={obraId}
          obraNome={obras.find(o => o.id === obraId)?.nome ?? ''}
          mes={mes}
          ano={ano}
          onClose={() => setShowDiaRapido(false)}
          onSaved={loadData}
        />
      )}
    </div>
  )
}
