'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import BackButton from '@/components/BackButton'
import { useToast } from '@/components/Toast'
import EmptyState from '@/components/ui/EmptyState'
import { Package, CheckCircle2, X } from 'lucide-react'

interface Requisicao {
  id: string
  numero: number | null
  obra_id: string | null
  itens: any[]
  status: string
  observacao: string | null
  created_at: string
  obras?: { nome: string } | null
}

export default function PedidosPage() {
  const supabase = createClient()
  const toast = useToast()
  const [pedidos, setPedidos] = useState<Requisicao[]>([])
  const [loading, setLoading] = useState(true)
  const [recebendo, setRecebendo] = useState<string | null>(null)
  const [qtdRecebida, setQtdRecebida] = useState<Record<number, number>>({})
  const [obsReceb, setObsReceb] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data } = await supabase
      .from('requisicoes')
      .select('*, obras(nome)')
      .order('created_at', { ascending: false })
    setPedidos(data ?? [])
    setLoading(false)
  }

  function openRecebimento(pedido: Requisicao) {
    const itens = Array.isArray(pedido.itens) ? pedido.itens : []
    const init: Record<number, number> = {}
    itens.forEach((it: any, i: number) => { init[i] = it.quantidade ?? 1 })
    setQtdRecebida(init)
    setObsReceb('')
    setRecebendo(pedido.id)
  }

  async function confirmarRecebimento(pedido: Requisicao) {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Sessão expirada — faça login novamente')
      const itens = Array.isArray(pedido.itens) ? pedido.itens : []

      for (let i = 0; i < itens.length; i++) {
        const qtd = qtdRecebida[i] ?? itens[i].quantidade ?? 1
        if (qtd <= 0) continue

        // Busca item de estoque por nome exato (case-insensitive) — evita match ambíguo
        const descItem = (itens[i].descricao ?? '').trim()
        let estoqueItemId: string | null = null
        if (descItem) {
          const { data: estoqueItem, error: estErr } = await supabase
            .from('estoque_itens')
            .select('id')
            .ilike('nome', descItem)
            .is('deleted_at', null)
            .limit(1)
            .maybeSingle()
          if (estErr) throw new Error('Erro buscando item de estoque: ' + estErr.message)
          estoqueItemId = estoqueItem?.id ?? null
        }

        const { error: movErr } = await supabase.from('estoque_movimentacoes').insert({
          item_id: estoqueItemId,
          tipo: 'entrada',
          quantidade: qtd,
          obra_id: pedido.obra_id,
          motivo: `Recebimento pedido #${pedido.numero ?? pedido.id.slice(0, 8)}`,
          observacao: `${descItem}${obsReceb ? ' — ' + obsReceb : ''}`,
          created_by: user.id,
        })
        if (movErr) throw new Error('Erro registrando movimentação: ' + movErr.message)

        // Atualiza saldo se o item foi identificado
        if (estoqueItemId) {
          const { data: current, error: curErr } = await supabase
            .from('estoque_itens').select('quantidade').eq('id', estoqueItemId).single()
          if (curErr) throw new Error('Erro lendo saldo atual: ' + curErr.message)
          if (current) {
            const { error: updErr } = await supabase.from('estoque_itens').update({
              quantidade: (current.quantidade ?? 0) + qtd,
            }).eq('id', estoqueItemId)
            if (updErr) throw new Error('Erro atualizando saldo: ' + updErr.message)
          }
        }
      }

      const { error: statusErr } = await supabase.from('requisicoes').update({ status: 'recebido' }).eq('id', pedido.id)
      if (statusErr) throw new Error('Erro marcando pedido como recebido: ' + statusErr.message)

      toast.success('Recebimento registrado!', 'Estoque atualizado')
      setRecebendo(null)
      loadData()
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao confirmar recebimento')
    } finally {
      setSaving(false)
    }
  }

  const aprovados = pedidos.filter(p => p.status === 'aprovado')
  const recebidos = pedidos.filter(p => p.status === 'recebido')

  if (loading) return <div className="p-6 text-center text-gray-400">Carregando...</div>

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <BackButton fallback="/compras/cotacoes" />
        <div>
          <h1 className="text-xl font-bold font-display text-brand">Pedidos de Compra</h1>
          <p className="text-sm text-gray-500 mt-0.5">{aprovados.length} pendente(s) de recebimento</p>
        </div>
      </div>

      {aprovados.length === 0 && recebidos.length === 0 ? (
        <EmptyState
          titulo="Nenhum pedido de compra"
          descricao="Pedidos sao gerados a partir de cotacoes aprovadas."
          icone={<Package className="w-12 h-12" />}
          acao={{ label: 'Ir para Cotacoes', href: '/compras/cotacoes' }}
        />
      ) : (
        <>
          {/* Pending */}
          {aprovados.length > 0 && (
            <div className="mb-8">
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Aguardando Recebimento</h2>
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      {['#', 'Obra', 'Itens', 'Data', 'Acoes'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {aprovados.map(p => {
                      const itens = Array.isArray(p.itens) ? p.itens : []
                      return (
                        <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/80">
                          <td className="px-4 py-3 font-mono text-xs text-gray-500">#{p.numero ?? p.id.slice(0, 8)}</td>
                          <td className="px-4 py-3 font-medium">{p.obras?.nome ?? '—'}</td>
                          <td className="px-4 py-3 text-gray-600 text-xs">
                            {itens.slice(0, 2).map((it: any) => it.descricao).join(', ')}
                            {itens.length > 2 && ` +${itens.length - 2}`}
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{new Date(p.created_at).toLocaleDateString('pt-BR')}</td>
                          <td className="px-4 py-3">
                            <button onClick={() => openRecebimento(p)}
                              className="inline-flex items-center gap-1 text-xs text-brand font-semibold hover:underline">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Registrar Recebimento
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Received */}
          {recebidos.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Recebidos</h2>
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      {['#', 'Obra', 'Itens', 'Data', 'Status'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recebidos.map(p => {
                      const itens = Array.isArray(p.itens) ? p.itens : []
                      return (
                        <tr key={p.id} className="border-b border-gray-50">
                          <td className="px-4 py-3 font-mono text-xs text-gray-400">#{p.numero ?? p.id.slice(0, 8)}</td>
                          <td className="px-4 py-3 text-gray-600">{p.obras?.nome ?? '—'}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{itens.length} item(ns)</td>
                          <td className="px-4 py-3 text-gray-400 text-xs">{new Date(p.created_at).toLocaleDateString('pt-BR')}</td>
                          <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Recebido</span></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Recebimento Modal */}
      {recebendo && (() => {
        const pedido = pedidos.find(p => p.id === recebendo)
        if (!pedido) return null
        const itens = Array.isArray(pedido.itens) ? pedido.itens : []
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setRecebendo(null)}>
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold font-display text-brand">Registrar Recebimento</h2>
                <button onClick={() => setRecebendo(null)}><X className="w-4 h-4 text-gray-400" /></button>
              </div>
              <p className="text-xs text-gray-500 mb-4">Pedido #{pedido.numero ?? pedido.id.slice(0, 8)} — {pedido.obras?.nome}</p>
              <div className="space-y-2 mb-4">
                {itens.map((it: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <span className="text-sm text-gray-700">{it.descricao}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">Qtd:</span>
                      <input type="number" min={0} value={qtdRecebida[i] ?? it.quantidade ?? 1}
                        onChange={e => setQtdRecebida(q => ({ ...q, [i]: Number(e.target.value) }))}
                        className="w-16 px-2 py-1 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand/30" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Observacao</label>
                <input type="text" value={obsReceb} onChange={e => setObsReceb(e.target.value)} placeholder="Opcional"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => confirmarRecebimento(pedido)} disabled={saving}
                  className="px-5 py-2 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 disabled:opacity-50">
                  {saving ? 'Salvando...' : 'Confirmar Recebimento'}
                </button>
                <button onClick={() => setRecebendo(null)}
                  className="px-5 py-2 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
