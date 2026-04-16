'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

interface LoteBarProps {
  selected: Set<string>
  lancamentos: any[]
  contas: any[]
  onClear: () => void
  onPaid: () => void
  onDeleted: () => void
}

export default function LoteBar({ selected, lancamentos, contas, onClear, onPaid, onDeleted }: LoteBarProps) {
  const supabase = createClient()
  const toast = useToast()

  const [modalLote, setModalLote] = useState(false)
  const [dataLote, setDataLote] = useState(new Date().toISOString().slice(0, 10))
  const [contaLote, setContaLote] = useState('')
  const [pagandoLote, setPagandoLote] = useState(false)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)
  const [excluindoLote, setExcluindoLote] = useState(false)

  async function confirmarPagamentoLote() {
    if (!dataLote || selected.size === 0) return
    setPagandoLote(true)
    try {
      const upd: Record<string, unknown> = { status: 'pago', data_pagamento: dataLote }
      if (contaLote) upd.conta_id = contaLote
      const { error } = await supabase.from('financeiro_lancamentos').update(upd).in('id', Array.from(selected)).eq('status', 'em_aberto')
      if (error) throw error
      const n = selected.size
      toast.success(`${n} lancamento${n > 1 ? 's' : ''} confirmado${n > 1 ? 's' : ''}`)
      setModalLote(false)
      onPaid()
    } catch (err: any) {
      toast.error('Erro ao processar: ' + (err.message || 'Tente novamente'))
    } finally {
      setPagandoLote(false)
    }
  }

  async function confirmarExclusaoLote() {
    if (selected.size === 0) return
    setExcluindoLote(true)
    try {
      const { error } = await supabase.from('financeiro_lancamentos').update({ deleted_at: new Date().toISOString() }).in('id', Array.from(selected))
      if (error) throw error
      const n = selected.size
      toast.success(`${n} lancamento${n > 1 ? 's' : ''} excluido${n > 1 ? 's' : ''}`)
      setConfirmandoExclusao(false)
      onDeleted()
    } catch (err: any) {
      toast.error('Erro ao excluir: ' + (err.message || 'Tente novamente'))
    } finally {
      setExcluindoLote(false)
    }
  }

  if (selected.size === 0) return null

  const sel = lancamentos.filter(l => selected.has(l.id))
  const temR = sel.some(l => l.tipo === 'receita')
  const temD = sel.some(l => l.tipo === 'despesa')

  return (
    <>
      {/* Floating batch selection bar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-5 py-3 bg-[#0f1e2e] rounded-xl shadow-2xl border border-brand/30">
        <div className="text-white text-sm">
          <span className="font-bold text-brand">{selected.size}</span>{' '}lancamento{selected.size > 1 ? 's' : ''}
          <span className="ml-2 text-gray-400">= {fmt(sel.reduce((s, l) => s + Number(l.valor), 0))}</span>
        </div>
        <div className="w-px h-6 bg-white/20" />
        <button onClick={onClear} className="text-gray-400 hover:text-white text-sm transition-colors">Limpar</button>
        {(() => {
          const label = temR && temD ? 'Confirmar liquidacao' : temR ? `Confirmar recebimento (${selected.size})` : `Confirmar pagamento (${selected.size})`
          const cls = temR && !temD ? 'bg-green-600 hover:bg-green-700' : 'bg-brand hover:bg-brand-dark'
          return <button onClick={() => { setDataLote(new Date().toISOString().slice(0, 10)); setContaLote(''); setModalLote(true) }} className={`${cls} text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors`}>{label}</button>
        })()}
        <div className="w-px h-6 bg-white/20" />
        <button onClick={() => setConfirmandoExclusao(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-red-400 hover:text-white hover:bg-red-600/80 transition-colors border border-red-500/30 hover:border-red-500">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10"/></svg>
          Excluir ({selected.size})
        </button>
      </div>

      {/* Batch payment modal */}
      {modalLote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              {temR && temD ? 'Liquidar lancamentos' : temR ? 'Confirmar recebimentos' : 'Confirmar pagamentos'}
            </h3>
            <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm space-y-1">
              {(() => {
                const despesas = sel.filter(l => l.tipo === 'despesa')
                const receitas = sel.filter(l => l.tipo === 'receita')
                const sumD = despesas.reduce((s, l) => s + Number(l.valor), 0)
                const sumR = receitas.reduce((s, l) => s + Number(l.valor), 0)
                return <>
                  {despesas.length > 0 && <div className="flex justify-between"><span className="text-gray-500">{despesas.length} despesa{despesas.length > 1 ? 's' : ''}</span><span className="font-semibold text-red-600">-{fmt(sumD)}</span></div>}
                  {receitas.length > 0 && <div className="flex justify-between"><span className="text-gray-500">{receitas.length} receita{receitas.length > 1 ? 's' : ''}</span><span className="font-semibold text-green-600">+{fmt(sumR)}</span></div>}
                  <div className="border-t pt-1 flex justify-between font-bold"><span>Total</span><span>{fmt(sumD + sumR)}</span></div>
                </>
              })()}
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Data de pagamento / recebimento</label>
              <input type="date" value={dataLote} onChange={e => setDataLote(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-1">Conta bancaria <span className="text-gray-400 font-normal">(opcional)</span></label>
              <select value={contaLote} onChange={e => setContaLote(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand">
                <option value="">— Manter conta atual —</option>
                {contas.map(c => <option key={c.id} value={c.id}>{c.is_padrao ? '★ ' : ''}{c.banco ? `${c.banco} — ` : ''}{c.nome}</option>)}
              </select>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalLote(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancelar</button>
              <button onClick={confirmarPagamentoLote} disabled={pagandoLote} className="flex-1 px-4 py-2 bg-brand text-white rounded-lg text-sm font-semibold hover:bg-brand-dark disabled:opacity-50">{pagandoLote ? 'Processando...' : `Confirmar (${selected.size})`}</button>
            </div>
          </div>
        </div>
      )}

      {/* Batch delete modal */}
      {confirmandoExclusao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <h3 className="text-center text-lg font-bold text-gray-900 mb-1">Excluir {selected.size} lancamento{selected.size > 1 ? 's' : ''}?</h3>
            <p className="text-center text-sm text-gray-500 mb-2">Esta ação não pode ser desfeita.</p>
            {(() => {
              const despesas = sel.filter(l => l.tipo === 'despesa')
              const receitas = sel.filter(l => l.tipo === 'receita')
              const pagos = sel.filter(l => l.status === 'pago')
              return (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-5 text-sm space-y-1">
                  {despesas.length > 0 && <div className="flex justify-between text-gray-700"><span>{despesas.length} despesa{despesas.length > 1 ? 's' : ''}</span><span className="font-medium text-red-700">{fmt(despesas.reduce((s, l) => s + Number(l.valor), 0))}</span></div>}
                  {receitas.length > 0 && <div className="flex justify-between text-gray-700"><span>{receitas.length} receita{receitas.length > 1 ? 's' : ''}</span><span className="font-medium text-green-700">{fmt(receitas.reduce((s, l) => s + Number(l.valor), 0))}</span></div>}
                  {pagos.length > 0 && <p className="text-xs text-red-600 font-medium pt-1 border-t border-red-200 mt-1">⚠️ {pagos.length} ja pago{pagos.length > 1 ? 's' : ''} — excluir afetara o resultado financeiro</p>}
                </div>
              )
            })()}
            <div className="flex gap-3">
              <button onClick={() => setConfirmandoExclusao(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancelar</button>
              <button onClick={confirmarExclusaoLote} disabled={excluindoLote} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50">{excluindoLote ? 'Excluindo...' : `Excluir (${selected.size})`}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
