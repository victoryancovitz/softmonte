'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import ConfirmButton from '@/components/ConfirmButton'
import BackButton from '@/components/BackButton'

export default function MovimentarEstoquePage({ params }: { params: { id: string } }) {
  const searchParams = useSearchParams()
  const [item, setItem] = useState<any>(null)
  const [form, setForm] = useState({ tipo: searchParams.get('tipo') || 'saida', quantidade: '', motivo: '', observacao: '' })
  const [obras, setObras] = useState<any[]>([])
  const [obraId, setObraId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    ;(async () => {
      try {
        const [{ data: itemData, error: itemErr }, { data: obrasData, error: obrasErr }] = await Promise.all([
          supabase.from('estoque_itens').select('*').eq('id', params.id).is('deleted_at', null).single(),
          supabase.from('obras').select('id,nome').eq('status','ativo').is('deleted_at', null).order('nome'),
        ])
        if (itemErr) throw itemErr
        if (obrasErr) throw obrasErr
        setItem(itemData)
        setObras(obrasData ?? [])
      } catch (e: any) {
        setError('Erro ao carregar: ' + (e?.message || 'desconhecido'))
      }
    })()
  }, [params.id])

  function set(field: string, value: string) { setForm(f => ({ ...f, [field]: value })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const qtd = parseFloat(form.quantidade)
    if (!qtd || qtd <= 0) { setError('Quantidade inválida'); return }
    if (form.tipo === 'saida' && qtd > item.quantidade) { setError('Quantidade maior que o estoque atual'); return }
    setLoading(true)
    setError('')

    const novaQtd = form.tipo === 'entrada' ? item.quantidade + qtd : item.quantidade - qtd

    const [{ error: movErr }] = await Promise.all([
      supabase.from('estoque_movimentacoes').insert({
        item_id: params.id, tipo: form.tipo,
        quantidade: qtd, obra_id: obraId || null,
        motivo: form.motivo || null, observacao: form.observacao || null,
      }),
    ])
    if (movErr) { setError(movErr.message); setLoading(false); return }
    const { error: updErr } = await supabase.from('estoque_itens').update({ quantidade: novaQtd }).eq('id', params.id)
    if (updErr) { setError('Movimentação registrada mas falha ao atualizar saldo: ' + updErr.message); setLoading(false); return }
    setSuccess(true)
    setTimeout(() => router.push('/estoque'), 1500)
  }

  if (!item) return <div className="p-6 text-gray-400 text-sm">Carregando...</div>

  return (
    <div className="p-4 sm:p-6 max-w-xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/estoque" />
        <Link href="/estoque" className="text-gray-400 hover:text-gray-600">Almoxarifado</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium">{item.nome}</span>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-lg font-bold font-display text-brand">{item.nome}</h1>
            <div className="text-sm text-gray-500 mt-0.5">Saldo atual: <strong className="text-brand text-lg">{item.quantidade} {item.unidade}</strong></div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">{item.categoria}</span>
            {item.quantidade > 0 && (
              <ConfirmButton label={`Zerar (${item.quantidade} ${item.unidade})`}
                className="text-xs text-red-500 hover:text-red-700 font-medium"
                onConfirm={async () => {
                  await supabase.from('estoque_movimentacoes').insert({
                    item_id: params.id, tipo: 'saida', quantidade: item.quantidade,
                    motivo: 'Zeragem de estoque',
                  })
                  await supabase.from('estoque_itens').update({ quantidade: 0 }).eq('id', params.id)
                  setItem((prev: any) => ({ ...prev, quantidade: 0 }))
                  setSuccess(true)
                }} />
            )}
          </div>
        </div>

        {success && <div className="mb-4 p-3 bg-green-50 text-green-700 text-sm rounded-xl border border-green-200">✓ Movimentação registrada!</div>}
        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tipo de movimentação</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(['entrada','saida'] as const).map(t => (
                <button key={t} type="button" onClick={() => set('tipo', t)}
                  className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${form.tipo === t ? (t === 'entrada' ? 'border-green-500 bg-green-50 text-green-700' : 'border-red-500 bg-red-50 text-red-700') : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                  {t === 'entrada' ? '↑ Entrada' : '↓ Saída'}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Quantidade *</label>
              <input type="number" required step="0.01" min="0.01" value={form.quantidade} onChange={e => set('quantidade', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand"/>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Obra (opcional)</label>
              <select value={obraId} onChange={e => setObraId(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
                <option value="">Nenhuma</option>
                {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Motivo</label>
            <input type="text" value={form.motivo} onChange={e => set('motivo', e.target.value)}
              placeholder="Ex: Entrega para equipe, Devolução..."
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand"/>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading || success}
              className={`px-6 py-2.5 text-white rounded-xl text-sm font-bold disabled:opacity-50 ${form.tipo === 'entrada' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
              {loading ? 'Registrando...' : `Registrar ${form.tipo}`}
            </button>
            <Link href="/estoque" className="px-6 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</Link>
          </div>
        </form>
      </div>
    </div>
  )
}
