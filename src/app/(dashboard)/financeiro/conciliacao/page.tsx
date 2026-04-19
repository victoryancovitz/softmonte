'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import SearchInput from '@/components/SearchInput'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function ConciliacaoPage() {
  const supabase = createClient()
  const toast = useToast()
  const [lancamentos, setLancamentos] = useState<any[]>([])
  const [contas, setContas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [contaDestino, setContaDestino] = useState('')
  const [busca, setBusca] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadData()
    supabase.from('contas_correntes').select('id, nome, banco').eq('ativo', true).is('deleted_at', null).order('nome').then(({ data }) => setContas(data ?? []))
  }, [])

  async function loadData() {
    setLoading(true)
    const { data } = await supabase
      .from('financeiro_lancamentos')
      .select('id, nome, categoria, valor, tipo, data_competencia, data_vencimento, status, conta_id, contas_correntes(nome, banco), obras(nome), fornecedor')
      .is('deleted_at', null)
      .order('data_vencimento', { ascending: false })
      .limit(500)
    setLancamentos(data ?? [])
    setLoading(false)
  }

  const filtrados = lancamentos.filter(l => {
    if (busca) {
      const b = busca.toLowerCase()
      if (!l.nome?.toLowerCase().includes(b) && !l.categoria?.toLowerCase().includes(b) && !l.fornecedor?.toLowerCase().includes(b)) return false
    }
    return true
  })

  const toggleSelect = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () => setSelected(prev => prev.size === filtrados.length ? new Set() : new Set(filtrados.map(l => l.id)))

  async function moverParaConta() {
    if (!contaDestino) return toast.error('Selecione a conta destino')
    if (selected.size === 0) return toast.error('Selecione lançamentos')
    setSaving(true)
    const ids = Array.from(selected)
    // Atualizar em lotes de 50
    for (let i = 0; i < ids.length; i += 50) {
      const batch = ids.slice(i, i + 50)
      const { error } = await supabase.from('financeiro_lancamentos').update({ conta_id: contaDestino }).in('id', batch)
      if (error) { toast.error('Erro: ' + error.message); setSaving(false); return }
    }
    toast.success(`${ids.length} lançamento(s) movidos para a conta selecionada`)
    setSelected(new Set())
    setSaving(false)
    loadData()
  }

  const semConta = filtrados.filter(l => !l.conta_id).length
  const comConta = filtrados.filter(l => l.conta_id).length

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <h1 className="text-xl font-semibold font-display">Conciliação Bancária</h1>
      <p className="text-sm text-gray-500 mt-0.5 mb-4">Vincule lançamentos às contas bancárias corretas. {semConta > 0 && <span className="text-amber-600 font-medium">{semConta} sem conta vinculada.</span>}</p>

      {/* Barra de ação */}
      <div className="flex flex-wrap items-center gap-3 mb-4 bg-white border border-gray-200 rounded-xl p-3">
        <SearchInput value={busca} onChange={setBusca} placeholder="Buscar por nome, categoria ou fornecedor..." />
        <div className="flex items-center gap-2 ml-auto">
          <select value={contaDestino} onChange={e => setContaDestino(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white min-w-[200px]">
            <option value="">Mover para conta...</option>
            {contas.map(c => <option key={c.id} value={c.id}>{c.nome} ({c.banco})</option>)}
          </select>
          <button onClick={moverParaConta} disabled={saving || selected.size === 0 || !contaDestino}
            className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark disabled:opacity-50">
            {saving ? 'Movendo...' : `Mover ${selected.size} selecionado(s)`}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white border rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-gray-900">{filtrados.length}</div>
          <div className="text-xs text-gray-500">Total exibidos</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-green-700">{comConta}</div>
          <div className="text-xs text-green-600">Com conta vinculada</div>
        </div>
        <div className={`${semConta > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'} border rounded-xl p-3 text-center`}>
          <div className={`text-2xl font-bold ${semConta > 0 ? 'text-amber-700' : 'text-green-700'}`}>{semConta}</div>
          <div className={`text-xs ${semConta > 0 ? 'text-amber-600' : 'text-green-600'}`}>Sem conta</div>
        </div>
      </div>

      {/* Tabela */}
      {loading ? (
        <div className="text-center py-10 text-gray-400">Carregando...</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-3 py-2 text-left">
                  <input type="checkbox" checked={selected.size === filtrados.length && filtrados.length > 0} onChange={toggleAll} className="rounded" />
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Descrição</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Categoria</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Valor</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Status</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Conta Atual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtrados.slice(0, 200).map(l => (
                <tr key={l.id} className={`hover:bg-gray-50 ${!l.conta_id ? 'bg-amber-50/50' : ''}`}>
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={selected.has(l.id)} onChange={() => toggleSelect(l.id)} className="rounded" />
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-900 truncate max-w-[300px]">{l.nome}</div>
                    <div className="text-[10px] text-gray-400">{l.obras?.nome || '—'} · {l.data_competencia}</div>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">{l.categoria || '—'}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${l.tipo === 'receita' ? 'text-green-700' : 'text-gray-900'}`}>
                    {l.tipo === 'receita' ? '+' : ''}{fmt(Number(l.valor))}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${l.status === 'pago' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {l.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">
                    {l.contas_correntes?.nome || <span className="text-amber-600 font-medium">Sem conta</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtrados.length > 200 && (
            <div className="text-center py-3 text-xs text-gray-400 border-t">
              Mostrando 200 de {filtrados.length}. Use a busca para filtrar.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
