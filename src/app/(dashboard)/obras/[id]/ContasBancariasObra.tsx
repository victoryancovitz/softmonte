'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

const BANCOS: Record<string, { cor: string; sigla: string }> = {
  'BTG': { cor: '#003399', sigla: 'BTG' }, 'Santander': { cor: '#EC0000', sigla: 'SAN' },
  'Bradesco': { cor: '#CC0000', sigla: 'BDB' }, 'Itaú': { cor: '#EC7000', sigla: 'ITÁ' },
  'Caixa': { cor: '#006699', sigla: 'CEF' }, 'Nubank': { cor: '#820AD1', sigla: 'NUB' },
  'Inter': { cor: '#FF7A00', sigla: 'INT' },
}

function BancoIcon({ banco }: { banco: string | null }) {
  const match = banco ? Object.entries(BANCOS).find(([k]) => banco.toLowerCase().includes(k.toLowerCase())) : null
  const cor = match ? match[1].cor : '#9ca3af'
  const sigla = match ? match[1].sigla : (banco?.slice(0, 2).toUpperCase() || '??')
  return <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-[8px] font-bold mr-1.5" style={{ backgroundColor: cor }}>{sigla}</span>
}

export default function ContasBancariasObra({ obraId, contaRecebimentoId, contaPagamentoId, contas }: {
  obraId: string; contaRecebimentoId: string | null; contaPagamentoId: string | null; contas: any[]
}) {
  const supabase = createClient()
  const toast = useToast()
  const [recId, setRecId] = useState(contaRecebimentoId ?? '')
  const [pagId, setPagId] = useState(contaPagamentoId ?? '')
  const [saving, setSaving] = useState(false)

  async function salvar() {
    setSaving(true)
    const { error } = await supabase.from('obras').update({
      conta_recebimento_id: recId || null,
      conta_pagamento_id: pagId || null,
    }).eq('id', obraId)
    if (error) toast.error('Erro: ' + error.message)
    else toast.success('Contas atualizadas')
    setSaving(false)
  }

  return (
    <div className="mt-5 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <h2 className="text-sm font-semibold mb-4">Contas Bancárias do Contrato</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Conta de Recebimento</label>
          <p className="text-[10px] text-gray-400 mb-1.5">Para onde chegam os pagamentos do cliente (BMs)</p>
          <select value={recId} onChange={e => setRecId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand">
            <option value="">— Sem conta definida —</option>
            {contas.map((c: any) => <option key={c.id} value={c.id}>{c.banco ? `${c.banco} — ` : ''}{c.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Conta de Pagamento</label>
          <p className="text-[10px] text-gray-400 mb-1.5">De onde saem fornecedores, salários e despesas</p>
          <select value={pagId} onChange={e => setPagId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand">
            <option value="">— Sem conta definida —</option>
            {contas.map((c: any) => <option key={c.id} value={c.id}>{c.banco ? `${c.banco} — ` : ''}{c.nome}</option>)}
          </select>
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <button onClick={salvar} disabled={saving}
          className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark disabled:opacity-50">
          {saving ? 'Salvando...' : 'Salvar contas'}
        </button>
      </div>
    </div>
  )
}
