'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import BackButton from '@/components/BackButton'
import { useToast } from '@/components/Toast'
import { Check, Link2, X } from 'lucide-react'

export default function OfxConciliarPage() {
  const { id } = useParams<{ id: string }>()
  const [trans, setTrans] = useState<any[]>([])
  const [lancamentos, setLancamentos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const toast = useToast()

  useEffect(() => {
    (async () => {
      const [{ data: t }, { data: l }] = await Promise.all([
        supabase.from('ofx_transacoes').select('*').eq('import_id', id).order('data'),
        supabase.from('financeiro_lancamentos').select('id,nome,valor,data_vencimento,data_pagamento,data_competencia,tipo,status').eq('status','em_aberto').is('deleted_at', null),
      ])
      setTrans(t || []); setLancamentos(l || []); setLoading(false)
    })()
  }, [id])

  async function conciliar(transId: string, lancId: string) {
    const { data: { user } } = await supabase.auth.getUser()
    const t = trans.find(x => x.id === transId)
    const l = lancamentos.find(x => x.id === lancId)
    if (!t || !l) return
    await supabase.from('ofx_transacoes').update({
      lancamento_id: lancId, status: 'conciliada', conciliado_em: new Date().toISOString(), conciliado_por: user?.id
    }).eq('id', transId)
    await supabase.from('financeiro_lancamentos').update({
      status: 'pago', data_pagamento: t.data, updated_by: user?.id
    }).eq('id', lancId)
    setTrans(prev => prev.map(x => x.id === transId ? { ...x, lancamento_id: lancId, status: 'conciliada' } : x))
    setLancamentos(prev => prev.filter(x => x.id !== lancId))
    toast.success('Conciliado')
  }

  async function ignorar(transId: string) {
    await supabase.from('ofx_transacoes').update({ status: 'ignorada' }).eq('id', transId)
    setTrans(prev => prev.map(x => x.id === transId ? { ...x, status: 'ignorada' } : x))
  }

  // Sugerir match por valor+data próxima
  function sugestoes(t: any) {
    const alvoValor = Math.abs(Number(t.valor))
    const alvoTipo = Number(t.valor) >= 0 ? 'receita' : 'despesa'
    return lancamentos
      .filter(l => l.tipo === alvoTipo && Math.abs(Number(l.valor) - alvoValor) < 0.01)
      .slice(0, 3)
  }

  const fmt = (v: any) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  if (loading) return <div className="p-6 text-gray-400 text-sm">Carregando...</div>

  const pendentes = trans.filter(t => t.status === 'pendente')
  const conciliadas = trans.filter(t => t.status === 'conciliada')
  const ignoradas = trans.filter(t => t.status === 'ignorada')

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/financeiro/ofx" />
        <Link href="/financeiro/ofx" className="text-gray-400 hover:text-gray-600">OFX</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700">Conciliação</span>
      </div>

      <h1 className="text-xl font-bold font-display text-brand mb-1">Conciliar transações</h1>
      <p className="text-sm text-gray-500 mb-6">
        {pendentes.length} pendentes · {conciliadas.length} conciliadas · {ignoradas.length} ignoradas
      </p>

      <div className="space-y-3">
        {pendentes.map(t => {
          const sugs = sugestoes(t)
          return (
            <div key={t.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{new Date(t.data + 'T12:00').toLocaleDateString('pt-BR')}</span>
                    <span className={`text-xs font-bold ${Number(t.valor) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {Number(t.valor) >= 0 ? '+' : ''}{fmt(Number(t.valor))}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mt-0.5">{t.descricao}</p>
                </div>
                <button onClick={() => ignorar(t.id)} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                  <X className="w-3 h-3" /> Ignorar
                </button>
              </div>
              {sugs.length > 0 ? (
                <div className="mt-3 space-y-1.5">
                  <div className="text-[10px] font-semibold text-gray-400 uppercase">Sugestões automáticas</div>
                  {sugs.map(l => (
                    <div key={l.id} className="flex items-center justify-between p-2 bg-green-50 border border-green-100 rounded-lg">
                      <div className="text-xs">
                        <div className="font-semibold text-gray-800">{l.nome}</div>
                        <div className="text-gray-500">Vencia {l.data_vencimento ? new Date(l.data_vencimento + 'T12:00').toLocaleDateString('pt-BR') : '—'} · {fmt(Number(l.valor))}</div>
                      </div>
                      <button onClick={() => conciliar(t.id, l.id)} className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 flex items-center gap-1">
                        <Link2 className="w-3 h-3" /> Conciliar
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] text-gray-400 italic">Nenhuma correspondência automática — ajuste manual.</div>
              )}
            </div>
          )
        })}
        {pendentes.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-10 text-center">
            <Check className="w-10 h-10 text-green-400 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Tudo conciliado!</p>
          </div>
        )}
      </div>
    </div>
  )
}
