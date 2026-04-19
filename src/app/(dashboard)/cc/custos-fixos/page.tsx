'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import BackButton from '@/components/BackButton'
import { useToast } from '@/components/Toast'
import SearchInput from '@/components/SearchInput'
import EmptyState from '@/components/ui/EmptyState'
import { ChevronDown, ChevronRight, DollarSign, Pencil, Plus, Trash2, X } from 'lucide-react'
import QuickCreateSelect from '@/components/ui/QuickCreateSelect'
import { fmt } from '@/lib/cores'

/* ═══ Types ═══ */

interface CustoFixo {
  id: string
  centro_custo_id: string
  nome: string
  descricao: string | null
  valor: number
  dia_vencimento: number
  gerar_lancamento: boolean
  data_inicio: string | null
  data_fim: string | null
  ativo: boolean
  cc_nome?: string
  cc_codigo?: string
}

interface CC {
  id: string
  codigo: string
  nome: string
}

/* ═══ Component ═══ */

export default function CustosFixosPage() {
  const supabase = createClient()
  const toast = useToast()

  const [custos, setCustos] = useState<CustoFixo[]>([])
  const [ccList, setCcList] = useState<CC[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [gerarModal, setGerarModal] = useState(false)
  const [gerarMes, setGerarMes] = useState(String(new Date().getMonth() + 1))
  const [gerarAno, setGerarAno] = useState(String(new Date().getFullYear()))
  const [gerando, setGerando] = useState(false)

  // Form
  const [ccId, setCcId] = useState('')
  const [nome, setNome] = useState('')
  const [valor, setValor] = useState('')
  const [diaVencimento, setDiaVencimento] = useState('')
  const [gerarLancamento, setGerarLancamento] = useState(false)
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')

  async function load() {
    setLoading(true)
    const [{ data: cf }, { data: ccs }] = await Promise.all([
      supabase
        .from('cc_custos_fixos')
        .select('*, centros_custo!inner(codigo, nome)')
        .eq('ativo', true)
        .order('nome'),
      supabase
        .from('centros_custo')
        .select('id, codigo, nome')
        .is('deleted_at', null)
        .eq('ativo', true)
        .order('codigo'),
    ])

    const mapped: CustoFixo[] = (cf ?? []).map((r: any) => ({
      ...r,
      cc_nome: r.centros_custo?.nome,
      cc_codigo: r.centros_custo?.codigo,
    }))
    setCustos(mapped)
    setCcList(ccs ?? [])

    // Expandir todos os grupos por padrão
    const ids = new Set(mapped.map((c: CustoFixo) => c.centro_custo_id))
    setExpanded(ids)
    setLoading(false)
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Agrupar por CC
  const grouped = useMemo(() => {
    const q = busca.toLowerCase()
    const filtered = custos.filter(c => {
      if (!busca) return true
      return c.nome.toLowerCase().includes(q) || (c.cc_nome ?? '').toLowerCase().includes(q)
    })
    const map = new Map<string, { cc: { id: string; nome: string; codigo: string }; items: CustoFixo[] }>()
    filtered.forEach(c => {
      if (!map.has(c.centro_custo_id)) {
        map.set(c.centro_custo_id, {
          cc: { id: c.centro_custo_id, nome: c.cc_nome ?? '', codigo: c.cc_codigo ?? '' },
          items: [],
        })
      }
      map.get(c.centro_custo_id)!.items.push(c)
    })
    return Array.from(map.values())
  }, [custos, busca])

  const totalMes = custos.reduce((s, c) => s + (c.valor ?? 0), 0)

  function resetForm() {
    setCcId('')
    setNome('')
    setValor('')
    setDiaVencimento('')
    setGerarLancamento(false)
    setDataInicio('')
    setDataFim('')
    setEditId(null)
  }

  function openCreate() {
    resetForm()
    setModalOpen(true)
  }

  function openEdit(c: CustoFixo) {
    setEditId(c.id)
    setCcId(c.centro_custo_id)
    setNome(c.nome)
    setValor(c.valor.toString())
    setDiaVencimento(c.dia_vencimento.toString())
    setGerarLancamento(c.gerar_lancamento)
    setDataInicio(c.data_inicio ?? '')
    setDataFim(c.data_fim ?? '')
    setModalOpen(true)
  }

  async function handleSave() {
    if (!ccId || !nome.trim() || !valor || !diaVencimento || !dataInicio) {
      toast.warning('Preencha todos os campos obrigatórios.')
      return
    }
    const dia = parseInt(diaVencimento)
    if (dia < 1 || dia > 31) {
      toast.warning('Dia de vencimento deve ser entre 1 e 31.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        centro_custo_id: ccId,
        nome: nome.trim(),
        valor: parseFloat(valor),
        dia_vencimento: dia,
        gerar_lancamento: gerarLancamento,
        data_inicio: dataInicio,
        data_fim: dataFim || null,
        ativo: true,
      }
      if (editId) {
        const { error } = await supabase.from('cc_custos_fixos').update(payload).eq('id', editId)
        if (error) throw error
        toast.success('Custo fixo atualizado.')
      } else {
        const { error } = await supabase.from('cc_custos_fixos').insert(payload)
        if (error) throw error
        toast.success('Custo fixo criado com sucesso.')
      }
      setModalOpen(false)
      resetForm()
      load()
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao salvar custo fixo.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Deseja realmente excluir este custo fixo?')) return
    try {
      const { error } = await supabase.from('cc_custos_fixos').update({ ativo: false }).eq('id', id)
      if (error) throw error
      toast.success('Custo fixo excluído.')
      load()
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao excluir.')
    }
  }

  async function gerarLancamentos() {
    setGerando(true)
    try {
      const resp = await fetch('/api/cc/gerar-lancamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mes: Number(gerarMes), ano: Number(gerarAno) }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Erro ao gerar lancamentos')
      toast.success(`${data.gerados} lancamento(s) gerado(s). ${data.ja_existiam} já existiam.`)
      setGerarModal(false)
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao gerar lancamentos')
    } finally {
      setGerando(false)
    }
  }

  function toggleGroup(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <BackButton fallback="/cc" />
          <div>
            <h1 className="text-xl font-bold font-display text-brand">Custos Fixos</h1>
            <p className="text-sm text-gray-500">
              Total: <span className="font-semibold text-gray-700">{fmt(totalMes)}/mês</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setGerarModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 border border-amber-300 bg-amber-50 text-amber-700 rounded-xl text-sm font-semibold hover:bg-amber-100"
          >
            Gerar Lancamentos do Mes
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand text-white rounded-xl text-sm font-semibold hover:bg-brand-dark"
          >
            <Plus className="w-4 h-4" /> Novo Custo Fixo
          </button>
        </div>
      </div>

      {/* Busca */}
      <div className="mb-4 max-w-sm">
        <SearchInput value={busca} onChange={setBusca} placeholder="Buscar por nome ou centro de custo..." />
      </div>

      {/* Lista */}
      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">Carregando...</p>
      ) : grouped.length === 0 ? (
        <EmptyState
          titulo="Nenhum custo fixo cadastrado"
          descricao="Cadastre custos fixos vinculados aos centros de custo."
          icone={<DollarSign className="w-12 h-12" />}
        />
      ) : (
        <div className="space-y-3">
          {grouped.map(g => {
            const isOpen = expanded.has(g.cc.id)
            const total = g.items.reduce((s, c) => s + c.valor, 0)
            return (
              <div key={g.cc.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                {/* Accordion header */}
                <button
                  onClick={() => toggleGroup(g.cc.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                >
                  {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                  <span className="text-xs font-mono text-gray-400">{g.cc.codigo}</span>
                  <span className="text-sm font-bold text-gray-800 flex-1 truncate">{g.cc.nome}</span>
                  <span className="text-xs font-semibold text-violet-600">{fmt(total)}/mês</span>
                  <span className="text-[10px] text-gray-400">{g.items.length} custo{g.items.length > 1 ? 's' : ''}</span>
                </button>

                {/* Items */}
                {isOpen && (
                  <div className="border-t border-gray-50 divide-y divide-gray-50">
                    {g.items.map(c => (
                      <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 pl-11 hover:bg-gray-50/50">
                        <span className="text-sm text-gray-700 flex-1 truncate">{c.nome}</span>
                        <span className="text-sm font-semibold text-gray-800 tabular-nums">{fmt(c.valor)}</span>
                        <span className="text-xs text-gray-400 min-w-[40px]">dia {c.dia_vencimento}</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEdit(c)}
                            className="p-1 rounded text-gray-400 hover:text-brand hover:bg-brand/5"
                            title="Editar"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(c.id)}
                            className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-800">
                {editId ? 'Editar Custo Fixo' : 'Novo Custo Fixo'}
              </h2>
              <button onClick={() => { setModalOpen(false); resetForm() }} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Centro de Custo */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Centro de Custo *</label>
                <QuickCreateSelect
                  type="centro_custo"
                  value={ccId}
                  onChange={(id) => setCcId(id)}
                  options={ccList.map(c => ({
                    id: c.id,
                    label: `${c.codigo} — ${c.nome}`,
                  }))}
                  placeholder="Selecione..."
                  onCreated={(id, label) => {
                    setCcList(prev => [...prev, { id, codigo: '', nome: label }])
                  }}
                />
              </div>

              {/* Nome */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nome *</label>
                <input
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder="Ex: Aluguel do escritório"
                />
              </div>

              {/* Valor */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Valor (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={valor}
                  onChange={e => setValor(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder="0,00"
                />
              </div>

              {/* Dia vencimento */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Dia de vencimento (1-31) *</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={diaVencimento}
                  onChange={e => setDiaVencimento(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>

              {/* Gerar lançamento */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setGerarLancamento(!gerarLancamento)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${gerarLancamento ? 'bg-brand' : 'bg-gray-200'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${gerarLancamento ? 'translate-x-5' : ''}`} />
                </button>
                <label className="text-sm text-gray-700">Gerar lançamento automático</label>
              </div>

              {/* Data início */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Data de início *</label>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={e => setDataInicio(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>

              {/* Data fim */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Data de fim (opcional)</label>
                <input
                  type="date"
                  value={dataFim}
                  onChange={e => setDataFim(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 p-5 border-t border-gray-100">
              <button
                onClick={() => { setModalOpen(false); resetForm() }}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 bg-brand text-white rounded-xl text-sm font-semibold hover:bg-brand-dark disabled:opacity-50"
              >
                {saving ? 'Salvando...' : editId ? 'Salvar Alterações' : 'Criar Custo Fixo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Gerar Lancamentos */}
      {gerarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-800">Gerar Lancamentos</h2>
              <button onClick={() => setGerarModal(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-600">Gerar lancamentos financeiros a partir dos custos fixos com &quot;gerar lancamento automatico&quot; ativado.</p>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Mes</label>
                  <select value={gerarMes} onChange={e => setGerarMes(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm">
                    {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{String(i + 1).padStart(2, '0')}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Ano</label>
                  <select value={gerarAno} onChange={e => setGerarAno(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm">
                    {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-gray-100">
              <button onClick={() => setGerarModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Cancelar</button>
              <button onClick={gerarLancamentos} disabled={gerando} className="px-5 py-2 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 disabled:opacity-50">
                {gerando ? 'Gerando...' : 'Gerar Lancamentos'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
