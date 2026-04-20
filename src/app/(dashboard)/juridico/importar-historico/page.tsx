'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { confirmDialog } from '@/components/ui/ConfirmDialog'
import SearchInput from '@/components/SearchInput'
import Link from 'next/link'

/* ── Constants ─────────────────────────────────────────────── */

const LEGAL_TERMS = ['acordo', 'trt', 'reclam', 'process', 'honorari', 'advogad', 'rescisao', 'trabalhista']
const LEGAL_CATEGORIES = ['juridico', 'trabalhista', 'acordo', 'honorarios', 'indenizacao', 'processo']

const TIPOS = [
  { value: 'trabalhista', label: 'Trabalhista' },
  { value: 'civel', label: 'Civel' },
  { value: 'tributario', label: 'Tributario' },
  { value: 'ambiental', label: 'Ambiental' },
  { value: 'administrativo', label: 'Administrativo' },
  { value: 'criminal', label: 'Criminal' },
]

const PROGNOSTICOS = [
  { value: 'provavel', label: 'Provavel' },
  { value: 'possivel', label: 'Possivel' },
  { value: 'remoto', label: 'Remoto' },
]

const CONFIDENCE_CFG: Record<string, { label: string; color: string; order: number }> = {
  alta:  { label: 'Alta',  color: 'bg-green-100 text-green-700 border-green-300', order: 0 },
  media: { label: 'Media', color: 'bg-amber-100 text-amber-700 border-amber-300', order: 1 },
  baixa: { label: 'Baixa', color: 'bg-gray-100 text-gray-600 border-gray-300',   order: 2 },
}

/* ── Helpers ───────────────────────────────────────────────── */

const fmt = (v: number | null | undefined) =>
  v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '--'

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('pt-BR') : '--'

function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

function similarity(a: string, b: string) {
  const na = normalize(a)
  const nb = normalize(b)
  if (na === nb) return 1
  if (na.includes(nb) || nb.includes(na)) return 0.8
  const wordsA = na.split(/\s+/)
  const wordsB = nb.split(/\s+/)
  const common = wordsA.filter(w => wordsB.some(wb => wb.includes(w) || w.includes(wb))).length
  return common / Math.max(wordsA.length, wordsB.length)
}

/* ── Types ─────────────────────────────────────────────────── */

interface Lancamento {
  id: string
  nome: string
  valor: number
  data_vencimento: string | null
  data_pagamento: string | null
  fornecedor_nome: string | null
  categoria: string | null
  parcela_grupo_id: string | null
  centro_custo_id: string | null
}

interface GroupedCandidate {
  key: string
  confidence: 'alta' | 'media' | 'baixa'
  tipo_sugerido: string
  parte_sugerida: string
  valor_total: number
  periodo: string
  lancamentos: Lancamento[]
}

/* ══════════════════════════════════════════════════════════════ */

export default function ImportarHistoricoPage() {
  const supabase = createClient()
  const toast = useToast()

  /* ── State: analysis ──────────────────────────────────────── */
  const [analyzing, setAnalyzing] = useState(false)
  const [candidates, setCandidates] = useState<GroupedCandidate[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [busca, setBusca] = useState('')

  /* ── State: modal ─────────────────────────────────────────── */
  const [modalCandidate, setModalCandidate] = useState<GroupedCandidate | null>(null)
  const [modalForm, setModalForm] = useState<any>({})
  const [centrosCusto, setCentrosCusto] = useState<any[]>([])
  const [saving, setSaving] = useState(false)

  /* ── State: history log ───────────────────────────────────── */
  const [logs, setLogs] = useState<any[]>([])
  const [logsLoading, setLogsLoading] = useState(true)

  /* ── Load logs & centros on mount ─────────────────────────── */
  useEffect(() => {
    loadLogs()
    loadCentrosCusto()
  }, [])

  async function loadCentrosCusto() {
    const { data } = await supabase
      .from('centros_custo')
      .select('id, codigo, nome')
      .is('deleted_at', null)
      .order('nome')
    setCentrosCusto(data ?? [])
  }

  async function loadLogs() {
    setLogsLoading(true)
    const { data } = await supabase
      .from('juridico_import_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    setLogs(data ?? [])
    setLogsLoading(false)
  }

  /* ── Analyze ──────────────────────────────────────────────── */

  async function handleAnalyze() {
    setAnalyzing(true)
    setCandidates([])

    // Build OR filter for legal terms on nome column
    const termsFilter = LEGAL_TERMS.map(t => `nome.ilike.%${t}%`).join(',')
    const categoriesFilter = LEGAL_CATEGORIES.map(c => `categoria.eq.${c}`).join(',')

    const { data: lancamentos, error } = await supabase
      .from('financeiro_lancamentos')
      .select('id, nome, valor, data_vencimento, data_pagamento, fornecedor_nome, categoria, parcela_grupo_id, centro_custo_id')
      .is('processo_juridico_id', null)
      .is('deleted_at', null)
      .or(`${termsFilter},${categoriesFilter}`)
      .order('data_vencimento', { ascending: false })
      .limit(2000)

    if (error) {
      toast.error('Erro ao buscar lancamentos: ' + error.message)
      setAnalyzing(false)
      return
    }

    if (!lancamentos || lancamentos.length === 0) {
      toast.warning('Nenhum lançamento candidato encontrado.')
      setAnalyzing(false)
      return
    }

    // Group by parcela_grupo_id or by fornecedor+nome similarity
    const groups = new Map<string, Lancamento[]>()

    // First pass: group by parcela_grupo_id
    const ungrouped: Lancamento[] = []
    for (const l of lancamentos) {
      if (l.parcela_grupo_id) {
        const key = `pg_${l.parcela_grupo_id}`
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key)!.push(l)
      } else {
        ungrouped.push(l)
      }
    }

    // Second pass: group ungrouped by fornecedor+nome similarity
    const used = new Set<number>()
    for (let i = 0; i < ungrouped.length; i++) {
      if (used.has(i)) continue
      const cluster: Lancamento[] = [ungrouped[i]]
      used.add(i)
      for (let j = i + 1; j < ungrouped.length; j++) {
        if (used.has(j)) continue
        const sameFornecedor = ungrouped[i].fornecedor_nome && ungrouped[j].fornecedor_nome &&
          normalize(ungrouped[i].fornecedor_nome!) === normalize(ungrouped[j].fornecedor_nome!)
        const nameSim = similarity(ungrouped[i].nome, ungrouped[j].nome)
        if (sameFornecedor && nameSim > 0.5) {
          cluster.push(ungrouped[j])
          used.add(j)
        } else if (nameSim > 0.7) {
          cluster.push(ungrouped[j])
          used.add(j)
        }
      }
      const key = `sim_${i}`
      groups.set(key, cluster)
    }

    // Score each group
    const result: GroupedCandidate[] = []
    for (const [key, items] of Array.from(groups.entries())) {
      const valorTotal = items.reduce((s: number, l: any) => s + (l.valor || 0), 0)
      const hasParcela = key.startsWith('pg_')
      const hasLegalCategory = items.some((l: any) => l.categoria && LEGAL_CATEGORIES.includes(l.categoria.toLowerCase()))
      const hasTextMatch = items.some((l: any) => LEGAL_TERMS.some(t => normalize(l.nome).includes(t)))

      let confidence: 'alta' | 'media' | 'baixa' = 'baixa'
      if (hasParcela && valorTotal > 10000) confidence = 'alta'
      else if (hasParcela || hasLegalCategory) confidence = 'media'
      else if (hasTextMatch) confidence = 'baixa'

      // Infer tipo from text
      const allText = normalize(items.map((l: any) => l.nome + ' ' + (l.categoria || '')).join(' '))
      let tipo_sugerido = 'trabalhista'
      if (allText.includes('civel') || allText.includes('civil')) tipo_sugerido = 'civel'
      else if (allText.includes('tribut')) tipo_sugerido = 'tributario'
      else if (allText.includes('ambient')) tipo_sugerido = 'ambiental'
      else if (allText.includes('criminal')) tipo_sugerido = 'criminal'

      // Parte sugerida
      const parte_sugerida = items[0].fornecedor_nome || items[0].nome.split('-')[0]?.trim() || 'N/A'

      // Period
      const dates = items.map((l: any) => l.data_vencimento || l.data_pagamento).filter(Boolean).sort()
      const periodo = dates.length >= 2
        ? `${fmtDate(dates[0])} - ${fmtDate(dates[dates.length - 1])}`
        : dates.length === 1
          ? fmtDate(dates[0])
          : '--'

      result.push({ key, confidence, tipo_sugerido, parte_sugerida, valor_total: valorTotal, periodo, lancamentos: items })
    }

    // Sort: alta first, then media, then baixa. Secondary: valor desc
    result.sort((a, b) => {
      const diff = CONFIDENCE_CFG[a.confidence].order - CONFIDENCE_CFG[b.confidence].order
      if (diff !== 0) return diff
      return b.valor_total - a.valor_total
    })

    setCandidates(result)
    setAnalyzing(false)
    toast.success(`${result.length} grupo(s) candidato(s) encontrado(s)`)
  }

  /* ── Filtered candidates ──────────────────────────────────── */
  const filtered = useMemo(() => {
    if (!busca) return candidates
    const q = normalize(busca)
    return candidates.filter(c =>
      normalize(c.parte_sugerida).includes(q) ||
      c.lancamentos.some(l => normalize(l.nome).includes(q))
    )
  }, [candidates, busca])

  /* ── Toggle expand ────────────────────────────────────────── */
  function toggleExpand(key: string) {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }))
  }

  /* ── Discard ──────────────────────────────────────────────── */
  async function handleDiscard(candidate: GroupedCandidate) {
    const ok = await confirmDialog({
      title: 'Descartar grupo?',
      message: `Descartar ${candidate.lancamentos.length} lancamento(s) com valor total ${fmt(candidate.valor_total)}? Eles serao marcados como descartados no log.`,
      variant: 'warning',
      confirmLabel: 'Descartar',
    })
    if (!ok) return

    const { error } = await supabase.from('juridico_import_log').insert({
      decisao: 'descartado',
      lancamento_ids: candidate.lancamentos.map(l => l.id),
      grupo_key: candidate.key,
      valor_total: candidate.valor_total,
      parte_sugerida: candidate.parte_sugerida,
      confidence: candidate.confidence,
    })

    if (error) {
      toast.error('Erro ao registrar descarte: ' + error.message)
      return
    }

    setCandidates(prev => prev.filter(c => c.key !== candidate.key))
    toast.success('Grupo descartado e registrado no historico')
    loadLogs()
  }

  /* ── Open Approve Modal ───────────────────────────────────── */
  function openApproveModal(candidate: GroupedCandidate) {
    setModalCandidate(candidate)
    setModalForm({
      tipo: candidate.tipo_sugerido,
      parte_contraria: candidate.parte_sugerida,
      valor_causa: candidate.valor_total,
      valor_provisionado: '',
      prognostico: '',
      centro_custo_id: candidate.lancamentos[0]?.centro_custo_id || '',
      observacoes: `Importado do historico financeiro - ${candidate.lancamentos.length} lancamento(s)`,
    })
  }

  /* ── Submit Approve ───────────────────────────────────────── */
  async function handleApprove() {
    if (!modalCandidate) return
    if (!modalForm.tipo || !modalForm.parte_contraria) {
      toast.error('Preencha ao menos Tipo e Parte contraria.')
      return
    }

    setSaving(true)

    // 1. Insert process
    const { data: processo, error: errP } = await supabase
      .from('processos_juridicos')
      .insert({
        tipo: modalForm.tipo,
        status: 'em_andamento',
        objeto: `Processo importado do historico financeiro`,
        polo: 'passivo',
        parte_contraria: modalForm.parte_contraria,
        valor_causa: modalForm.valor_causa ? parseFloat(modalForm.valor_causa) : null,
        valor_provisionado: modalForm.valor_provisionado ? parseFloat(modalForm.valor_provisionado) : null,
        prognostico: modalForm.prognostico || null,
        centro_custo_id: modalForm.centro_custo_id || null,
        observacoes: modalForm.observacoes || null,
      })
      .select('id')
      .single()

    if (errP) {
      toast.error('Erro ao criar processo: ' + errP.message)
      setSaving(false)
      return
    }

    // 2. Update lancamentos
    const ids = modalCandidate.lancamentos.map(l => l.id)
    const { error: errU } = await supabase
      .from('financeiro_lancamentos')
      .update({ processo_juridico_id: processo.id })
      .in('id', ids)

    if (errU) {
      toast.error('Processo criado mas erro ao vincular lancamentos: ' + errU.message)
      setSaving(false)
      setModalCandidate(null)
      return
    }

    // 3. Log
    await supabase.from('juridico_import_log').insert({
      decisao: 'aprovado',
      processo_juridico_id: processo.id,
      lancamento_ids: ids,
      grupo_key: modalCandidate.key,
      valor_total: modalCandidate.valor_total,
      parte_sugerida: modalCandidate.parte_sugerida,
      confidence: modalCandidate.confidence,
    })

    setSaving(false)
    setCandidates(prev => prev.filter(c => c.key !== modalCandidate.key))
    setModalCandidate(null)
    toast.success(`Processo criado com sucesso! ${modalCandidate.lancamentos.length} lançamentos vinculados.`
    )
    loadLogs()
  }

  /* ── Render ───────────────────────────────────────────────── */

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold font-display text-brand">Importar Historico de Processos</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Analise lancamentos financeiros que podem estar relacionados a processos juridicos e importe-os criando processos automaticamente.
          </p>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className="px-5 py-2.5 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50 whitespace-nowrap"
        >
          {analyzing ? 'Analisando...' : 'Analisar Historico'}
        </button>
      </div>

      {/* Search (only when we have candidates) */}
      {candidates.length > 0 && (
        <div className="mb-4">
          <SearchInput value={busca} onChange={setBusca} placeholder="Filtrar candidatos..." />
        </div>
      )}

      {/* Analysis results */}
      {analyzing && (
        <div className="text-sm text-gray-400 py-10 text-center">Analisando lancamentos...</div>
      )}

      {!analyzing && candidates.length > 0 && filtered.length === 0 && (
        <div className="text-sm text-gray-400 py-10 text-center">Nenhum candidato corresponde ao filtro.</div>
      )}

      {!analyzing && filtered.length > 0 && (
        <div className="space-y-4 mb-10">
          <p className="text-sm text-gray-500">{filtered.length} grupo(s) encontrado(s)</p>

          {filtered.map(c => {
            const conf = CONFIDENCE_CFG[c.confidence]
            const isExpanded = expanded[c.key]

            return (
              <div key={c.key} className="bg-white border rounded-xl overflow-hidden">
                {/* Card header */}
                <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${conf.color}`}>
                      {conf.label}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                      {c.tipo_sugerido}
                    </span>
                    <span className="text-sm font-medium text-gray-800 truncate">{c.parte_sugerida}</span>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-600 flex-shrink-0">
                    <div className="text-right">
                      <p className="font-bold text-gray-800">{fmt(c.valor_total)}</p>
                      <p className="text-xs text-gray-400">{c.lancamentos.length} lanc. | {c.periodo}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openApproveModal(c)}
                        className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700"
                      >
                        Aprovar
                      </button>
                      <button
                        onClick={() => handleDiscard(c)}
                        className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50"
                      >
                        Descartar
                      </button>
                      <button
                        onClick={() => toggleExpand(c.key)}
                        className="px-2 py-1.5 border border-gray-300 text-gray-500 rounded-lg text-xs hover:bg-gray-50"
                      >
                        {isExpanded ? 'Recolher' : 'Expandir'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Collapsible lancamentos */}
                {isExpanded && (
                  <div className="border-t">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
                        <tr>
                          <th className="px-4 py-2">Nome</th>
                          <th className="px-4 py-2">Fornecedor</th>
                          <th className="px-4 py-2">Categoria</th>
                          <th className="px-4 py-2 text-right">Valor</th>
                          <th className="px-4 py-2">Vencimento</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {c.lancamentos.map(l => (
                          <tr key={l.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-gray-700">{l.nome}</td>
                            <td className="px-4 py-2 text-gray-500">{l.fornecedor_nome || '--'}</td>
                            <td className="px-4 py-2 text-gray-500">{l.categoria || '--'}</td>
                            <td className="px-4 py-2 text-right font-medium">{fmt(l.valor)}</td>
                            <td className="px-4 py-2 text-gray-500">{fmtDate(l.data_vencimento)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal: Approve ──────────────────────────────────── */}
      {modalCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-lg font-bold text-brand mb-1">Criar Processo</h2>
              <p className="text-sm text-gray-500 mb-5">
                {modalCandidate.lancamentos.length} lancamento(s) serao vinculados a este processo.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
                  <select
                    value={modalForm.tipo}
                    onChange={e => setModalForm((p: any) => ({ ...p, tipo: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Selecione...</option>
                    {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Parte contraria *</label>
                  <input
                    type="text"
                    value={modalForm.parte_contraria}
                    onChange={e => setModalForm((p: any) => ({ ...p, parte_contraria: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Valor causa (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={modalForm.valor_causa}
                      onChange={e => setModalForm((p: any) => ({ ...p, valor_causa: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Valor provisionado (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={modalForm.valor_provisionado}
                      onChange={e => setModalForm((p: any) => ({ ...p, valor_provisionado: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prognostico</label>
                  <select
                    value={modalForm.prognostico}
                    onChange={e => setModalForm((p: any) => ({ ...p, prognostico: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Selecione...</option>
                    {PROGNOSTICOS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Centro de custo</label>
                  <select
                    value={modalForm.centro_custo_id}
                    onChange={e => setModalForm((p: any) => ({ ...p, centro_custo_id: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Nenhum</option>
                    {centrosCusto.map(cc => (
                      <option key={cc.id} value={cc.id}>{cc.codigo} - {cc.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Observacoes</label>
                  <textarea
                    value={modalForm.observacoes}
                    onChange={e => setModalForm((p: any) => ({ ...p, observacoes: e.target.value }))}
                    rows={3}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setModalCandidate(null)}
                  className="px-4 py-2 border rounded-xl text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleApprove}
                  disabled={saving}
                  className="px-5 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : 'Criar processo e vincular'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── History Log ─────────────────────────────────────── */}
      <div className="mt-10">
        <h2 className="text-lg font-bold text-gray-800 mb-3">Historico de importacoes</h2>

        {logsLoading ? (
          <div className="text-sm text-gray-400 py-6 text-center">Carregando...</div>
        ) : logs.length === 0 ? (
          <div className="text-sm text-gray-400 py-6 text-center">Nenhum registro de importacao ainda.</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Decisao</th>
                  <th className="px-4 py-3">Parte sugerida</th>
                  <th className="px-4 py-3">Confianca</th>
                  <th className="px-4 py-3 text-right">Valor total</th>
                  <th className="px-4 py-3">Lanc.</th>
                  <th className="px-4 py-3">Processo</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 text-xs">{fmtDate(log.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        log.decisao === 'aprovado'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {log.decisao === 'aprovado' ? 'Aprovado' : 'Descartado'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{log.parte_sugerida || '--'}</td>
                    <td className="px-4 py-3">
                      {log.confidence && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CONFIDENCE_CFG[log.confidence]?.color || 'bg-gray-100 text-gray-600'}`}>
                          {CONFIDENCE_CFG[log.confidence]?.label || log.confidence}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">{fmt(log.valor_total)}</td>
                    <td className="px-4 py-3 text-gray-500">{log.lancamento_ids?.length ?? '--'}</td>
                    <td className="px-4 py-3">
                      {log.processo_juridico_id ? (
                        <Link href={`/juridico/processos/${log.processo_juridico_id}`} className="text-brand hover:underline text-xs">
                          Ver processo
                        </Link>
                      ) : (
                        <span className="text-gray-400 text-xs">--</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
