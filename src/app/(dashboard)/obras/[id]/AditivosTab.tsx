'use client'
import { useState, useCallback } from 'react'
import { FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { fmt } from '@/lib/cores'

const TIPO_OPTIONS = [
  { value: 'escopo_funcao', label: 'Escopo/Função' },
  { value: 'prazo', label: 'Prazo' },
  { value: 'preco', label: 'Preço' },
  { value: 'reducao', label: 'Redução' },
]

const TIPO_LABEL: Record<string, string> = {
  escopo_funcao: 'Escopo/Função',
  prazo: 'Prazo',
  preco: 'Preço',
  reducao: 'Redução',
}

const STATUS_BADGE: Record<string, string> = {
  pendente: 'bg-amber-100 text-amber-700',
  aprovado: 'bg-green-100 text-green-700',
  executado: 'bg-blue-100 text-blue-700',
  cancelado: 'bg-gray-100 text-gray-500',
}

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  aprovado: 'Aprovado',
  executado: 'Executado',
  cancelado: 'Cancelado',
}

type FormData = {
  tipo: string
  descricao: string
  data_inicio_vigencia: string
  data_fim_vigencia: string
  funcao_nome: string
  quantidade_anterior: number
  quantidade_nova: number
  custo_hora: number
  data_fim_anterior: string
  data_fim_nova: string
  valor_anterior: number
  valor_novo: number
  observacoes: string
}

const emptyForm = (obra: any): FormData => ({
  tipo: 'escopo_funcao',
  descricao: '',
  data_inicio_vigencia: '',
  data_fim_vigencia: '',
  funcao_nome: '',
  quantidade_anterior: 0,
  quantidade_nova: 0,
  custo_hora: 0,
  data_fim_anterior: obra?.data_prev_fim ?? '',
  data_fim_nova: '',
  valor_anterior: 0,
  valor_novo: 0,
  observacoes: '',
})

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  try {
    // Datas ISO (2026-04-16) e timestamps (2026-04-16T14:00:00+00)
    const iso = typeof d === 'string' && d.length === 10 ? d + 'T12:00' : d
    const dt = new Date(iso)
    if (isNaN(dt.getTime())) return '—'
    return dt.toLocaleDateString('pt-BR')
  } catch {
    return '—'
  }
}

function safeNum(v: any): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export default function AditivosTab({ obra, aditivos: rawAditivos, composicao: rawComposicao }: { obra: any; aditivos: any[]; composicao: any[] }) {
  const supabase = createClient()
  const toast = useToast()
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [approving, setApproving] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm(obra))

  const refresh = () => {
    if (typeof window !== 'undefined') window.location.reload()
  }

  const aditivos = Array.isArray(rawAditivos) ? rawAditivos : []
  const composicao = Array.isArray(rawComposicao) ? rawComposicao : []
  const obraSafe = obra ?? {}

  const aprovados = aditivos.filter((a: any) => a?.status === 'aprovado' || a?.status === 'executado')
  const funcoesAdicionadas = aprovados.filter((a: any) => a?.tipo === 'escopo_funcao').length
  const valorContratualMes = composicao.reduce(
    (s: number, c: any) => s + safeNum(c?.quantidade_contratada) * safeNum(c?.horas_mes || 220) * safeNum(c?.custo_hora_contratado),
    0,
  )

  const openModal = useCallback(() => {
    setForm(emptyForm(obraSafe))
    setShowModal(true)
  }, [obraSafe])

  const handleFuncaoChange = useCallback((funcaoNome: string) => {
    const match = composicao.find((c: any) => c?.funcao_nome === funcaoNome)
    setForm(prev => ({
      ...prev,
      funcao_nome: funcaoNome,
      quantidade_anterior: safeNum(match?.quantidade_contratada),
      custo_hora: match ? safeNum(match.custo_hora_contratado) : prev.custo_hora,
    }))
  }, [composicao])

  const handleSave = useCallback(async () => {
    if (!form.descricao.trim()) {
      toast.warning('Preencha a descrição do aditivo.')
      return
    }
    if (!obraSafe?.id) {
      toast.error('Obra inválida — recarregue a página.')
      return
    }
    setSaving(true)
    try {
      const nextNumero = aditivos.length + 1
      const row: any = {
        obra_id: obraSafe.id,
        numero: nextNumero,
        tipo: form.tipo,
        descricao: form.descricao,
        observacoes: form.observacoes || null,
        status: 'pendente',
      }

      if (form.tipo === 'escopo_funcao') {
        if (!form.funcao_nome.trim()) {
          toast.warning('Selecione ou digite a função.')
          setSaving(false)
          return
        }
        row.funcao_nome = form.funcao_nome
        row.quantidade_anterior = form.quantidade_anterior
        row.quantidade_nova = form.quantidade_nova
        row.valor_anterior = form.custo_hora
        row.valor_novo = form.custo_hora
        row.impacto_valor = (form.quantidade_nova - form.quantidade_anterior) * Number(form.custo_hora) * 220
      }

      if (form.tipo === 'prazo') {
        row.data_fim_anterior = form.data_fim_anterior || null
        row.data_fim_nova = form.data_fim_nova || null
        if (row.data_fim_anterior && row.data_fim_nova) {
          row.extensao_dias = Math.round((new Date(row.data_fim_nova).getTime() - new Date(row.data_fim_anterior).getTime()) / 86400000)
        }
      }

      if (form.tipo === 'preco' || form.tipo === 'reducao') {
        row.valor_anterior = form.valor_anterior
        row.valor_novo = form.valor_novo
        row.impacto_valor = form.valor_novo - form.valor_anterior
        if (form.funcao_nome) row.funcao_nome = form.funcao_nome
      }

      const { error } = await supabase.from('aditivos').insert(row)
      if (error) throw error
      toast.success('Aditivo criado com sucesso', `Aditivo #${nextNumero} salvo como pendente`)
      setShowModal(false)
      refresh()
    } catch (err: any) {
      toast.error('Erro ao salvar aditivo', err.message)
    } finally {
      setSaving(false)
    }
  }, [form, aditivos, obraSafe, composicao, supabase, toast])

  const handleAprovar = useCallback(async (aditivo: any) => {
    setApproving(aditivo.id)
    try {
      // Update aditivo status
      const { error: errUpdate } = await supabase.from('aditivos').update({
        status: 'aprovado',
        aprovado_em: new Date().toISOString(),
        aprovado_por: 'admin',
      }).eq('id', aditivo.id)
      if (errUpdate) throw errUpdate

      // Side effects by type
      if (aditivo?.tipo === 'escopo_funcao' && aditivo?.funcao_nome && obraSafe?.id) {
        const { error: errComp } = await supabase.from('contrato_composicao').insert({
          obra_id: obraSafe.id,
          funcao_nome: aditivo.funcao_nome,
          quantidade_contratada: aditivo.quantidade_nova ?? 1,
          horas_mes: 220,
          custo_hora_contratado: aditivo.valor_novo ?? aditivo.valor_anterior ?? 0,
          origem: 'aditivo',
          aditivo_id: aditivo.id,
          data_inicio: aditivo.data_solicitacao,
        })
        if (errComp) throw errComp
      }

      if (aditivo?.tipo === 'prazo' && aditivo?.data_fim_nova && obraSafe?.id) {
        const { error: errObra } = await supabase.from('obras').update({
          data_prev_fim: aditivo.data_fim_nova,
        }).eq('id', obraSafe.id)
        if (errObra) throw errObra
      }

      toast.success('Aditivo aprovado', `Aditivo #${aditivo.numero} aprovado com sucesso`)
      refresh()
    } catch (err: any) {
      toast.error('Erro ao aprovar aditivo', err.message)
    } finally {
      setApproving(null)
    }
  }, [supabase, obraSafe, toast])

  return (
    <div>
      {/* Impact summary */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-5 flex flex-wrap items-center gap-4 text-sm">
        <div>
          <span className="text-gray-500">Aditivos aprovados:</span>
          <span className="ml-1 font-bold text-brand">{aprovados.length}</span>
        </div>
        <span className="text-gray-200">|</span>
        <div>
          <span className="text-gray-500">Funções adicionadas:</span>
          <span className="ml-1 font-bold text-brand">+{funcoesAdicionadas}</span>
        </div>
        <span className="text-gray-200">|</span>
        <div>
          <span className="text-gray-500">Valor contratual:</span>
          <span className="ml-1 font-bold text-brand">{fmt(valorContratualMes)}/mês</span>
        </div>
      </div>

      {/* Header + Button */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-700">{aditivos.length} aditivo{aditivos.length !== 1 ? 's' : ''}</h2>
        <button onClick={openModal} className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand/90 transition-colors">
          + Novo Aditivo
        </button>
      </div>

      {/* List */}
      {aditivos.length > 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100">
          {aditivos.map((a: any) => {
            const tipo = a?.tipo ?? ''
            const status = a?.status ?? ''
            const qtdAnt = a?.quantidade_anterior
            const qtdNov = a?.quantidade_nova
            const valAnt = a?.valor_anterior
            const valNov = a?.valor_novo
            const impacto = safeNum(a?.impacto_valor)
            return (
              <div key={a?.id ?? Math.random()} className="px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold">#{a?.numero ?? '—'}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${STATUS_BADGE[status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {STATUS_LABEL[status] ?? status ?? '—'}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 font-semibold">
                      {TIPO_LABEL[tipo] ?? tipo ?? '—'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mt-1">{a?.descricao ?? '—'}</p>
                  <div className="text-xs text-gray-400 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                    {a?.funcao_nome && <span>Função: <strong className="text-gray-600">{a.funcao_nome}</strong></span>}
                    {qtdAnt != null && qtdNov != null && (
                      <span>Qty: {safeNum(qtdAnt)} → <strong className="text-gray-600">{safeNum(qtdNov)}</strong></span>
                    )}
                    {tipo === 'prazo' && a?.data_fim_anterior && (
                      <span>Prazo: {fmtDate(a.data_fim_anterior)} → <strong className="text-gray-600">{fmtDate(a?.data_fim_nova)}</strong></span>
                    )}
                    {(tipo === 'preco' || tipo === 'reducao') && valAnt != null && (
                      <span>Valor: {fmt(safeNum(valAnt))} → <strong className="text-gray-600">{fmt(safeNum(valNov))}</strong></span>
                    )}
                    {impacto !== 0 && (
                      <span className={impacto > 0 ? 'text-green-600' : 'text-red-600'}>
                        Impacto: {impacto > 0 ? '+' : ''}{fmt(impacto)}
                      </span>
                    )}
                    {a?.data_solicitacao && <span>Solicitado: {fmtDate(a.data_solicitacao)}</span>}
                    {a?.aprovado_em && <span>Aprovado: {fmtDate(a.aprovado_em)}{a?.aprovado_por ? ` por ${a.aprovado_por}` : ''}</span>}
                  </div>
                </div>
                {status === 'pendente' && a?.id && (
                  <button
                    onClick={() => handleAprovar(a)}
                    disabled={approving === a.id}
                    className="px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 shrink-0"
                  >
                    {approving === a.id ? 'Aprovando...' : 'Aprovar'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-12 text-center">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-700">Nenhum aditivo registrado</p>
          <p className="text-xs text-gray-500 mt-1">Registre extensões de prazo ou alterações de equipe.</p>
          <button onClick={openModal} className="mt-4 px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand/90 transition-colors">
            + Novo Aditivo
          </button>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold">Novo Aditivo</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {/* Tipo */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo</label>
                <select value={form.tipo} onChange={e => setForm(prev => ({ ...prev, tipo: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none">
                  {TIPO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              {/* Numero */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Número</label>
                <input type="text" readOnly value={`#${aditivos.length + 1}`}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500" />
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Descrição *</label>
                <textarea value={form.descricao} onChange={e => setForm(prev => ({ ...prev, descricao: e.target.value }))}
                  rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none resize-none" />
              </div>

              {/* Data início vigência */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Início vigência</label>
                  <input type="date" value={form.data_inicio_vigencia} onChange={e => setForm(prev => ({ ...prev, data_inicio_vigencia: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Fim vigência (opc.)</label>
                  <input type="date" value={form.data_fim_vigencia} onChange={e => setForm(prev => ({ ...prev, data_fim_vigencia: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none" />
                </div>
              </div>

              {/* Escopo/Função fields */}
              {form.tipo === 'escopo_funcao' && (
                <div className="space-y-3 p-3 bg-violet-50 rounded-xl border border-violet-100">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Função</label>
                    <div className="relative">
                      <input
                        list="funcoes-list"
                        value={form.funcao_nome}
                        onChange={e => handleFuncaoChange(e.target.value)}
                        placeholder="Selecione ou digite..."
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
                      />
                      <datalist id="funcoes-list">
                        {composicao.map((c: any) => <option key={c.id} value={c.funcao_nome} />)}
                      </datalist>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Qty anterior</label>
                      <input type="number" readOnly value={form.quantidade_anterior}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Qty nova</label>
                      <input type="number" min={0} value={form.quantidade_nova} onChange={e => setForm(prev => ({ ...prev, quantidade_nova: Number(e.target.value) }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Custo/Hora</label>
                      <input type="number" step="0.01" min={0} value={form.custo_hora} onChange={e => setForm(prev => ({ ...prev, custo_hora: Number(e.target.value) }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none" />
                    </div>
                  </div>
                </div>
              )}

              {/* Prazo fields */}
              {form.tipo === 'prazo' && (
                <div className="space-y-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Data fim anterior</label>
                    <input type="date" readOnly value={form.data_fim_anterior}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Data fim nova</label>
                    <input type="date" value={form.data_fim_nova} onChange={e => setForm(prev => ({ ...prev, data_fim_nova: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none" />
                  </div>
                </div>
              )}

              {/* Preço / Redução fields */}
              {(form.tipo === 'preco' || form.tipo === 'reducao') && (
                <div className={`space-y-3 p-3 rounded-xl border ${form.tipo === 'preco' ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Função (opcional)</label>
                    <input
                      list="funcoes-list-2"
                      value={form.funcao_nome}
                      onChange={e => setForm(prev => ({ ...prev, funcao_nome: e.target.value }))}
                      placeholder="Selecione ou digite..."
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
                    />
                    <datalist id="funcoes-list-2">
                      {composicao.map((c: any) => <option key={c.id} value={c.funcao_nome} />)}
                    </datalist>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Valor anterior (R$)</label>
                      <input type="number" step="0.01" min={0} value={form.valor_anterior} onChange={e => setForm(prev => ({ ...prev, valor_anterior: Number(e.target.value) }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Valor novo (R$)</label>
                      <input type="number" step="0.01" min={0} value={form.valor_novo} onChange={e => setForm(prev => ({ ...prev, valor_novo: Number(e.target.value) }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none" />
                    </div>
                  </div>
                </div>
              )}

              {/* Observações */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Observações</label>
                <textarea value={form.observacoes} onChange={e => setForm(prev => ({ ...prev, observacoes: e.target.value }))}
                  rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none resize-none"
                  placeholder="Opcional..." />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium">Cancelar</button>
              <button onClick={handleSave} disabled={saving}
                className="px-5 py-2 bg-brand text-white text-sm font-semibold rounded-lg hover:bg-brand/90 transition-colors disabled:opacity-50">
                {saving ? 'Salvando...' : 'Salvar Aditivo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
