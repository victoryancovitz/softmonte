'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import EmptyState from '@/components/ui/EmptyState'
import { Package } from 'lucide-react'
import { fmt } from '@/lib/cores'

export default function AlmoxarifadoClient({ itens, fornecedores }: { itens: any[]; fornecedores: any[] }) {
  const supabase = createClient()
  const toast = useToast()
  const [showEntrada, setShowEntrada] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ item_id: '', quantidade: '', custo_unitario: '', nota_fiscal: '', fornecedor_id: '', numero_lote: '', data_validade: '' })

  const totalValor = itens.reduce((s, i) => s + Number(i.valor_estoque || 0), 0)
  const abaixoMin = itens.filter(i => i.abaixo_minimo).length

  async function salvarEntrada() {
    if (!form.item_id || !form.quantidade || !form.custo_unitario) { toast.error('Preencha item, quantidade e custo'); return }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const qtd = Number(form.quantidade), custo = Number(form.custo_unitario)
    // Criar lote
    await supabase.from('estoque_lotes').insert({
      item_id: form.item_id, quantidade_entrada: qtd, quantidade_disponivel: qtd,
      custo_unitario: custo, nota_fiscal: form.nota_fiscal || null,
      numero_lote: form.numero_lote || null, data_validade: form.data_validade || null,
      created_by: user?.id,
    })
    // Atualizar estoque
    const item = itens.find(i => i.id === form.item_id)
    const novaQtd = Number(item?.quantidade || 0) + qtd
    const novoCusto = novaQtd > 0 ? ((Number(item?.quantidade || 0) * Number(item?.custo_medio_atual || 0)) + (qtd * custo)) / novaQtd : custo
    await supabase.from('estoque_itens').update({ quantidade: novaQtd, custo_medio_atual: Math.round(novoCusto * 10000) / 10000 }).eq('id', form.item_id)
    // Lançamento financeiro
    await supabase.from('financeiro_lancamentos').insert({
      tipo: 'despesa', nome: `Entrada estoque — ${item?.nome || 'Item'}`, categoria: 'Custo dos Serviços Prestados',
      valor: Math.round(qtd * custo * 100) / 100, status: 'pago',
      data_competencia: new Date().toISOString().slice(0, 10), data_pagamento: new Date().toISOString().slice(0, 10),
      origem: 'manual', is_provisao: false, created_by: user?.id,
    })
    toast.success(`Entrada registrada: ${qtd} unidades a ${fmt(custo)} cada. Lançamento financeiro criado.`)
    setShowEntrada(false); setSaving(false)
  }

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 p-4"><div className="text-[10px] font-bold text-gray-400 uppercase">Valor em Estoque</div><div className="text-xl font-bold text-gray-900">{fmt(totalValor)}</div></div>
        <div className="bg-white rounded-xl border border-gray-100 p-4"><div className="text-[10px] font-bold text-gray-400 uppercase">Abaixo do Mínimo</div><div className={`text-xl font-bold ${abaixoMin > 0 ? 'text-red-700' : 'text-green-700'}`}>{abaixoMin}</div></div>
        <div className="bg-white rounded-xl border border-gray-100 p-4"><div className="text-[10px] font-bold text-gray-400 uppercase">Total de Itens</div><div className="text-xl font-bold text-gray-900">{itens.length}</div></div>
        <div className="bg-white rounded-xl border border-gray-100 p-4"><div className="text-[10px] font-bold text-gray-400 uppercase">Lotes Ativos</div><div className="text-xl font-bold text-gray-900">{itens.reduce((s, i) => s + Number(i.lotes_ativos || 0), 0)}</div></div>
      </div>

      <div className="flex justify-end mb-4">
        <button onClick={() => setShowEntrada(true)} className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark">+ Entrada de Material</button>
      </div>

      {/* Modal Entrada */}
      {showEntrada && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
          <h3 className="text-sm font-bold text-brand mb-4">Entrada de Material (Novo Lote FIFO)</h3>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            <div><label className="block text-xs font-semibold text-gray-500 mb-1">Item *</label>
              <select value={form.item_id} onChange={e => setForm(f => ({ ...f, item_id: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                <option value="">Selecionar...</option>{itens.map(i => <option key={i.id} value={i.id}>{i.nome} ({i.categoria})</option>)}</select></div>
            <div><label className="block text-xs font-semibold text-gray-500 mb-1">Quantidade *</label>
              <input type="number" step="0.001" value={form.quantidade} onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
            <div><label className="block text-xs font-semibold text-gray-500 mb-1">Custo unitário (R$) *</label>
              <input type="number" step="0.01" value={form.custo_unitario} onChange={e => setForm(f => ({ ...f, custo_unitario: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
            <div><label className="block text-xs font-semibold text-gray-500 mb-1">Nota Fiscal</label>
              <input value={form.nota_fiscal} onChange={e => setForm(f => ({ ...f, nota_fiscal: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
            <div><label className="block text-xs font-semibold text-gray-500 mb-1">Nº do Lote</label>
              <input value={form.numero_lote} onChange={e => setForm(f => ({ ...f, numero_lote: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
            <div><label className="block text-xs font-semibold text-gray-500 mb-1">Validade</label>
              <input type="date" value={form.data_validade} onChange={e => setForm(f => ({ ...f, data_validade: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
          </div>
          {form.quantidade && form.custo_unitario && <div className="bg-green-50 rounded-lg p-2 mb-3 text-xs text-green-700">Total da entrada: {fmt(Number(form.quantidade) * Number(form.custo_unitario))}</div>}
          <div className="flex gap-2">
            <button onClick={() => setShowEntrada(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm">Cancelar</button>
            <button onClick={salvarEntrada} disabled={saving} className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium disabled:opacity-50">{saving ? 'Salvando...' : 'Registrar Entrada'}</button>
          </div>
        </div>
      )}

      {/* Tabela */}
      {itens.length === 0 ? (
        <EmptyState titulo="Almoxarifado vazio" descricao="Cadastre itens e registre entradas de material." icone={<Package className="w-10 h-10" />} />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm"><thead><tr className="bg-gray-50 border-b border-gray-100">
            {['Nome', 'Categoria', 'Qtd', 'Mín', 'Custo Médio', 'Valor Total', 'Lotes', 'Status'].map(h => (
              <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
            ))}</tr></thead><tbody>
            {itens.map(i => (
              <tr key={i.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{i.nome}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{i.categoria || '—'}</td>
                <td className="px-4 py-3">{Number(i.quantidade || 0)}</td>
                <td className="px-4 py-3 text-gray-400">{Number(i.quantidade_minima || 0)}</td>
                <td className="px-4 py-3 text-xs">{fmt(i.custo_medio_atual)}</td>
                <td className="px-4 py-3 font-semibold">{fmt(i.valor_estoque)}</td>
                <td className="px-4 py-3 text-center">{i.lotes_ativos || 0}</td>
                <td className="px-4 py-3">{i.abaixo_minimo ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold">Abaixo</span> : <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-bold">Normal</span>}</td>
              </tr>
            ))}</tbody></table>
        </div>
      )}
    </>
  )
}
