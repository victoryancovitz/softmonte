'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import BackButton from '@/components/BackButton'

const CATEGORIAS_RECEITA = ['Receita HH Homem-Hora', 'Receita Material', 'Receita Equipamento', 'Outras receitas']
const CATEGORIAS_DESPESA = ['Salário Base', 'FGTS', 'Vale-Transporte', 'Treinamentos Obrigatórios', 'Rescisões Extraordinárias', 'Acordos Trabalhistas', 'Desmobilização', 'Férias Provisionadas', '13º Salário Provisionado', 'EPI', 'Ferramentas', 'Transporte', 'Outras despesas']

export default function NovoLancamentoPage() {
  const [obras, setObras] = useState<any[]>([])
  const [contas, setContas] = useState<any[]>([])
  const [form, setForm] = useState({
    obra_id: '', tipo: 'despesa', nome: '', categoria: '', valor: '',
    status: 'em_aberto', data_competencia: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })(),
    data_vencimento: '', data_pagamento: '', cliente: '', fornecedor: '',
    conta_id: '', is_provisao: false, observacao: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    ;(async () => {
      try {
        const [{ data: obrasData, error: obrasErr }, { data: contasData, error: contasErr }] = await Promise.all([
          supabase.from('obras').select('id,nome,cliente').eq('status','ativo').is('deleted_at', null).order('nome'),
          supabase.from('contas_correntes').select('id,nome,banco').eq('ativo', true).is('deleted_at', null).order('nome'),
        ])
        if (obrasErr) throw obrasErr
        if (contasErr) throw contasErr
        setObras(obrasData ?? [])
        setContas(contasData ?? [])
      } catch (e: any) {
        setError('Erro ao carregar listas: ' + (e?.message || 'desconhecido'))
      }
    })()
  }, [])

  function set(field: string, value: any) { setForm(f => ({ ...f, [field]: value })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const valorNum = parseFloat(form.valor)
    if (!isFinite(valorNum) || valorNum <= 0) { setError('Informe um valor maior que zero.'); return }

    // Categorias que exigem obra vinculada
    const CATEGORIAS_EXIGEM_OBRA = ['Salário Base','FGTS','Vale-Transporte','Receita HH Homem-Hora','Receita Material','Receita Equipamento']
    if (CATEGORIAS_EXIGEM_OBRA.includes(form.categoria) && !form.obra_id) {
      setError(`A categoria "${form.categoria}" precisa estar vinculada a uma obra.`)
      return
    }

    // Revalida status da obra
    if (form.obra_id) {
      const { data: obra } = await supabase.from('obras').select('status, deleted_at').eq('id', form.obra_id).maybeSingle()
      if (!obra || (obra as any).deleted_at) { setError('Obra não encontrada.'); return }
      if ((obra as any).status === 'cancelado') { setError('Obra cancelada não aceita novos lançamentos.'); return }
    }

    setLoading(true)
    const { error } = await supabase.from('financeiro_lancamentos').insert({
      obra_id: form.obra_id || null,
      tipo: form.tipo,
      nome: form.nome,
      categoria: form.categoria || null,
      valor: parseFloat(form.valor),
      status: form.status,
      data_competencia: form.data_competencia,
      data_vencimento: form.data_vencimento || null,
      data_pagamento: form.status === 'pago' && form.data_pagamento ? form.data_pagamento : null,
      cliente: form.cliente || null,
      fornecedor: form.fornecedor || null,
      conta_id: form.conta_id || null,
      is_provisao: form.is_provisao,
      observacao: form.observacao || null,
      origem: 'manual',
    })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/financeiro')
  }

  const cats = form.tipo === 'receita' ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <BackButton fallback="/financeiro" />
        <Link href="/financeiro" className="text-gray-400 hover:text-gray-600 text-sm">Financeiro</Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-medium">Novo lançamento</span>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h1 className="text-lg font-semibold font-display mb-6">Novo lançamento financeiro</h1>
        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tipo */}
          <div className="flex gap-3">
            {(['receita', 'despesa'] as const).map(t => (
              <button key={t} type="button" onClick={() => set('tipo', t)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium border-2 transition-all ${
                  form.tipo === t
                    ? t === 'receita' ? 'border-green-500 bg-green-50 text-green-700' : 'border-red-500 bg-red-50 text-red-700'
                    : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}>
                {t === 'receita' ? '↑ Receita' : '↓ Despesa'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Obra</label>
              <select name="obra_id" value={form.obra_id} onChange={e => set('obra_id', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
                <option value="">Nenhuma (geral)</option>
                {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
              <select name="categoria" value={form.categoria} onChange={e => set('categoria', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
                <option value="">Selecione...</option>
                {cats.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição *</label>
            <input type="text" name="nome" required value={form.nome} onChange={e => set('nome', e.target.value)}
              placeholder="Ex: Folha de pagamento março" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$) *</label>
              <input type="number" name="valor" required min="0.01" step="0.01" value={form.valor} onChange={e => set('valor', e.target.value)}
                placeholder="0,00" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select name="status" value={form.status} onChange={e => set('status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
                <option value="em_aberto">Em aberto</option>
                <option value="pago">Pago / Recebido</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data de competência *</label>
              <input type="date" name="data_competencia" required value={form.data_competencia} onChange={e => set('data_competencia', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vencimento</label>
              <input type="date" name="data_vencimento" value={form.data_vencimento} onChange={e => set('data_vencimento', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
          </div>

          {form.status === 'pago' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data de pagamento</label>
              <input type="date" name="data_pagamento" value={form.data_pagamento} onChange={e => set('data_pagamento', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{form.tipo === 'receita' ? 'Cliente' : 'Fornecedor'}</label>
              <input type="text" name={form.tipo === 'receita' ? 'cliente' : 'fornecedor'} value={form.tipo === 'receita' ? form.cliente : form.fornecedor}
                onChange={e => set(form.tipo === 'receita' ? 'cliente' : 'fornecedor', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Conta corrente</label>
              <select name="conta_id" value={form.conta_id} onChange={e => set('conta_id', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
                <option value="">— Selecione —</option>
                {contas.map(c => <option key={c.id} value={c.id}>{c.nome}{c.banco ? ` · ${c.banco}` : ''}</option>)}
              </select>
              {contas.length === 0 && (
                <p className="text-[10px] text-gray-400 mt-1">
                  Nenhuma conta cadastrada. <Link href="/financeiro/contas" className="text-brand hover:underline">Cadastre aqui</Link>.
                </p>
              )}
            </div>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input type="checkbox" name="is_provisao" checked={form.is_provisao} onChange={e => set('is_provisao', e.target.checked)}
              className="rounded border-gray-300 text-brand" />
            <span className="text-sm text-gray-700">É uma provisão futura</span>
            <span className="text-xs text-gray-400">(ex: salário previsto, desmobilização)</span>
          </label>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observação</label>
            <textarea name="observacao" value={form.observacao} onChange={e => set('observacao', e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading}
              className="px-6 py-2.5 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark disabled:opacity-50">
              {loading ? 'Salvando...' : 'Salvar lançamento'}
            </button>
            <Link href="/financeiro" className="px-6 py-2.5 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
