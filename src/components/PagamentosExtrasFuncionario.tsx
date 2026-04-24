'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { confirmDialog } from '@/components/ui/ConfirmDialog'
import { Plus, X, Loader2, Trash2, Repeat } from 'lucide-react'

const TIPOS = [
  { v: 'bonus', l: 'Bônus', cor: 'bg-green-100 text-green-700' },
  { v: 'bonus_por_fora', l: 'Bônus por fora', cor: 'bg-amber-100 text-amber-700' },
  { v: 'comissao', l: 'Comissão', cor: 'bg-blue-100 text-blue-700' },
  { v: 'premio_producao', l: 'Prêmio produção', cor: 'bg-violet-100 text-violet-700' },
  { v: 'gratificacao', l: 'Gratificação', cor: 'bg-teal-100 text-teal-700' },
  { v: 'ajuda_custo', l: 'Ajuda de custo', cor: 'bg-sky-100 text-sky-700' },
  { v: 'adiantamento', l: 'Adiantamento', cor: 'bg-gray-100 text-gray-600' },
  { v: 'vale_extra', l: 'Vale extra', cor: 'bg-gray-100 text-gray-600' },
  { v: 'outro', l: 'Outro', cor: 'bg-gray-100 text-gray-600' },
]

const FREQ = [
  { v: 'mensal', l: 'Mensal' },
  { v: 'bimestral', l: 'Bimestral' },
  { v: 'trimestral', l: 'Trimestral' },
  { v: 'semestral', l: 'Semestral' },
  { v: 'anual', l: 'Anual' },
]

export default function PagamentosExtrasFuncionario({ funcionarioId }: { funcionarioId: string }) {
  const [pagamentos, setPagamentos] = useState<any[]>([])
  const [resumo, setResumo] = useState<any>(null)
  const [obras, setObras] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>({
    tipo: 'bonus',
    obra_id: '',
    competencia: new Date().toISOString().slice(0, 7) + '-01',
    data_pagamento: new Date().toISOString().slice(0, 10),
    valor: '',
    descricao: '',
    status: 'pago',
    recorrente: false,
    recorrencia_frequencia: 'mensal',
    recorrencia_fim: '',
  })
  const supabase = createClient()
  const toast = useToast()

  async function load() {
    const [{ data: pag }, { data: res }, { data: obs }] = await Promise.all([
      supabase.from('pagamentos_extras')
        .select('*, obras(nome)')
        .eq('funcionario_id', funcionarioId)
        .is('deleted_at', null)
        .order('competencia', { ascending: false }),
      supabase.from('vw_pagamentos_extras_func_12m').select('*').eq('funcionario_id', funcionarioId).maybeSingle(),
      supabase.from('obras').select('id,nome').eq('status','ativo').is('deleted_at', null).order('nome'),
    ])
    setPagamentos(pag || [])
    setResumo(res)
    setObras(obs || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [funcionarioId])

  const fmt = (v: any) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  async function handleSave() {
    const valor = parseFloat(form.valor)
    if (!isFinite(valor) || valor <= 0) { toast.error('Valor inválido'); return }
    if (!form.competencia) { toast.error('Competência é obrigatória'); return }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const payload: any = {
        funcionario_id: funcionarioId,
        obra_id: form.obra_id || null,
        tipo: form.tipo,
        descricao: form.descricao || null,
        competencia: form.competencia,
        data_pagamento: form.status === 'pago' ? form.data_pagamento : null,
        valor,
        status: form.status,
        recorrente: form.recorrente,
        recorrencia_frequencia: form.recorrente ? form.recorrencia_frequencia : null,
        recorrencia_fim: form.recorrente && form.recorrencia_fim ? form.recorrencia_fim : null,
        created_by: user?.id ?? null,
      }
      const { data: inserted, error } = await supabase.from('pagamentos_extras').insert(payload).select().single()
      if (error) throw error

      // Se pago, gera lançamento no financeiro
      if (form.status === 'pago' && inserted) {
        const tipoLabel = TIPOS.find(t => t.v === form.tipo)?.l || form.tipo
        const { data: lanc } = await supabase.from('financeiro_lancamentos').insert({
          obra_id: form.obra_id || null,
          tipo: 'despesa',
          nome: `${tipoLabel} — ${form.descricao || 'pagamento extra'}`,
          categoria: 'Pagamento Extra',
          valor,
          status: 'em_aberto',
          data_competencia: form.competencia,
          data_vencimento: form.data_pagamento,
          origem: 'pagamento_extra',
          observacao: `Pagamento extra ref ${inserted.id}`,
          created_by: user?.id ?? null,
        }).select().single()
        if (lanc) {
          await supabase.from('pagamentos_extras').update({ financeiro_lancamento_id: lanc.id }).eq('id', inserted.id)
        }
      }

      toast.success('Pagamento registrado')
      setShowForm(false)
      setForm({ ...form, valor: '', descricao: '' })
      load()
    } catch (e: any) {
      toast.error('Erro: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!await confirmDialog({ title: 'Cancelar pagamento?', message: 'Se havia lançamento no financeiro, ele também será removido.', variant: 'danger', confirmLabel: 'Cancelar pagamento' })) return
    const { data: { user } } = await supabase.auth.getUser()
    const pag = pagamentos.find(p => p.id === id)
    if (pag?.financeiro_lancamento_id) {
      await supabase.rpc('excluir_lancamento', { p_lancamento_id: pag.financeiro_lancamento_id, p_motivo: 'Cancelamento de pagamento extra' })
    }
    await supabase.from('pagamentos_extras').update({ deleted_at: new Date().toISOString(), deleted_by: user?.id ?? null }).eq('id', id)
    toast.success('Pagamento cancelado')
    load()
  }

  if (loading) return <div className="text-xs text-gray-400 py-3">Carregando pagamentos extras...</div>

  return (
    <div>
      {/* Cards resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="text-[10px] text-gray-400 font-semibold uppercase">Total 12m</div>
          <div className="text-sm font-bold text-gray-900">{fmt(resumo?.total_12m)}</div>
          <div className="text-[10px] text-gray-400">{resumo?.qtd_12m ?? 0} pagamentos</div>
        </div>
        <div className="p-3 bg-green-50 rounded-lg">
          <div className="text-[10px] text-green-600 font-semibold uppercase">Base legal 12m</div>
          <div className="text-sm font-bold text-green-700">{fmt(resumo?.total_base_legal_12m)}</div>
          <div className="text-[10px] text-green-600">Integra rescisão</div>
        </div>
        <div className="p-3 bg-blue-50 rounded-lg">
          <div className="text-[10px] text-blue-600 font-semibold uppercase">Média mensal base legal</div>
          <div className="text-sm font-bold text-blue-700">{fmt(resumo?.media_mensal_base_legal)}</div>
          <div className="text-[10px] text-blue-600">Soma ao salário na rescisão</div>
        </div>
        <div className="p-3 bg-amber-50 rounded-lg">
          <div className="text-[10px] text-amber-600 font-semibold uppercase">Por fora 12m</div>
          <div className="text-sm font-bold text-amber-700">{fmt(resumo?.total_por_fora_12m)}</div>
          <div className="text-[10px] text-amber-600">Fora da base legal</div>
        </div>
      </div>

      {/* Botão novo */}
      <div className="flex justify-between items-center mb-3">
        <p className="text-[11px] text-gray-400">
          {pagamentos.length === 0 ? 'Nenhum pagamento extra registrado' : `${pagamentos.length} registro(s)`}
        </p>
        <button onClick={() => setShowForm(true)}
          className="text-xs px-3 py-1.5 bg-brand text-white rounded-lg font-semibold hover:bg-brand-dark flex items-center gap-1">
          <Plus className="w-3 h-3" /> Registrar pagamento
        </button>
      </div>

      {/* Form inline */}
      {showForm && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-blue-800">Novo pagamento extra</h4>
            <button onClick={() => setShowForm(false)} className="text-blue-400 hover:text-blue-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] font-semibold text-gray-600 mb-1">Tipo</label>
              <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}
                className="w-full px-2 py-1.5 border border-blue-200 rounded-md text-xs bg-white">
                {TIPOS.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-600 mb-1">Obra (opcional)</label>
              <select value={form.obra_id} onChange={e => setForm({ ...form, obra_id: e.target.value })}
                className="w-full px-2 py-1.5 border border-blue-200 rounded-md text-xs bg-white">
                <option value="">— Rateio corporativo —</option>
                {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-600 mb-1">Valor</label>
              <input type="number" step="0.01" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })}
                className="w-full px-2 py-1.5 border border-blue-200 rounded-md text-xs bg-white" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-600 mb-1">Competência</label>
              <input type="month" value={form.competencia.slice(0, 7)}
                onChange={e => setForm({ ...form, competencia: e.target.value + '-01' })}
                className="w-full px-2 py-1.5 border border-blue-200 rounded-md text-xs bg-white" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-600 mb-1">Data pagamento</label>
              <input type="date" value={form.data_pagamento} onChange={e => setForm({ ...form, data_pagamento: e.target.value })}
                className="w-full px-2 py-1.5 border border-blue-200 rounded-md text-xs bg-white" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-600 mb-1">Status</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                className="w-full px-2 py-1.5 border border-blue-200 rounded-md text-xs bg-white">
                <option value="pago">Pago</option>
                <option value="previsto">Previsto</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-600 mb-1">Descrição</label>
            <input type="text" value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })}
              placeholder="Ex: Meta de produção atingida em março"
              className="w-full px-2 py-1.5 border border-blue-200 rounded-md text-xs bg-white" />
          </div>
          <div className="pt-2 border-t border-blue-200">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.recorrente}
                onChange={e => setForm({ ...form, recorrente: e.target.checked })}
                className="rounded border-blue-300 text-brand w-4 h-4" />
              <Repeat className="w-3 h-3 text-blue-600" />
              <span className="text-xs font-semibold text-blue-800">Recorrente</span>
            </label>
            {form.recorrente && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-600 mb-1">Frequência</label>
                  <select value={form.recorrencia_frequencia}
                    onChange={e => setForm({ ...form, recorrencia_frequencia: e.target.value })}
                    className="w-full px-2 py-1.5 border border-blue-200 rounded-md text-xs bg-white">
                    {FREQ.map(f => <option key={f.v} value={f.v}>{f.l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-600 mb-1">Até (opcional)</label>
                  <input type="date" value={form.recorrencia_fim}
                    onChange={e => setForm({ ...form, recorrencia_fim: e.target.value })}
                    className="w-full px-2 py-1.5 border border-blue-200 rounded-md text-xs bg-white" />
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <button onClick={handleSave} disabled={saving}
              className="px-3 py-1.5 bg-brand text-white rounded-md text-xs font-bold hover:bg-brand-dark disabled:opacity-50 flex items-center gap-1">
              {saving && <Loader2 className="w-3 h-3 animate-spin" />}
              Registrar
            </button>
          </div>
        </div>
      )}

      {/* Histórico */}
      {pagamentos.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Comp.', 'Tipo', 'Descrição', 'Obra', 'Valor', 'Status', ''].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagamentos.map(p => {
                const tipoInfo = TIPOS.find(t => t.v === p.tipo)
                return (
                  <tr key={p.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                    <td className="px-3 py-2 font-medium">{new Date(p.competencia + 'T12:00').toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' })}</td>
                    <td className="px-3 py-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${tipoInfo?.cor ?? 'bg-gray-100 text-gray-600'}`}>
                        {tipoInfo?.l ?? p.tipo}
                      </span>
                      {p.recorrente && <Repeat className="inline w-3 h-3 ml-1 text-blue-500" />}
                    </td>
                    <td className="px-3 py-2 text-gray-600 truncate max-w-[180px]">{p.descricao || '—'}</td>
                    <td className="px-3 py-2 text-gray-500 text-[11px]">{p.obras?.nome || '—'}</td>
                    <td className="px-3 py-2 font-bold text-gray-900">{fmt(p.valor)}</td>
                    <td className="px-3 py-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                        p.status === 'pago' ? 'bg-green-100 text-green-700' :
                        p.status === 'previsto' ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>{p.status}</span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => handleDelete(p.id)} className="text-red-500 hover:text-red-700" title="Cancelar">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
