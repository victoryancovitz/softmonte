'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function MobilizacaoCustos({ funcionarioId, admissao, initial, obraId }: {
  funcionarioId: string; admissao: string | null; initial: { aso: number; epi: number; uniforme: number; outros: number }; obraId: string | null
}) {
  const supabase = createClient()
  const toast = useToast()
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  const total = (Number(form.aso) || 0) + (Number(form.epi) || 0) + (Number(form.uniforme) || 0) + (Number(form.outros) || 0)

  async function salvar() {
    setSaving(true)
    const { error } = await supabase.from('funcionarios').update({
      custo_aso_admissional: Number(form.aso) || 0,
      custo_epi: Number(form.epi) || 0,
      custo_uniforme: Number(form.uniforme) || 0,
      custo_outros_admissao: Number(form.outros) || 0,
    }).eq('id', funcionarioId)
    if (error) toast.error('Erro: ' + error.message)
    else toast.success('Custos de mobilização salvos')
    setSaving(false)
  }

  async function registrarLancamento() {
    if (total <= 0) return
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('financeiro_lancamentos').insert({
      obra_id: obraId, funcionario_id: funcionarioId,
      tipo: 'despesa', nome: `Mobilização — funcionário`,
      categoria: 'Custo dos Serviços Prestados', tipo_folha: 'mobilizacao',
      valor: total, status: 'pago', data_competencia: admissao || new Date().toISOString().slice(0, 10),
      data_pagamento: admissao || new Date().toISOString().slice(0, 10),
      origem: 'manual', is_provisao: false, created_by: user?.id ?? null,
    })
    if (error) toast.error('Erro: ' + error.message)
    else toast.success('Lançamento de mobilização registrado no financeiro')
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Custos de Mobilização</h3>
      <p className="text-[10px] text-gray-400 mb-3">Custos únicos de entrada amortizados no cálculo de break-even.</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        {([
          { key: 'aso', label: 'ASO Admissional', ph: '150,00' },
          { key: 'epi', label: 'EPI Completo', ph: '350,00' },
          { key: 'uniforme', label: 'Uniforme', ph: '200,00' },
          { key: 'outros', label: 'Outros', ph: '0,00' },
        ] as const).map(c => (
          <div key={c.key}>
            <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">{c.label}</label>
            <input type="number" step="0.01" placeholder={c.ph}
              value={form[c.key] || ''} onChange={e => setForm(f => ({ ...f, [c.key]: Number(e.target.value) || 0 }))}
              className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm" />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between bg-amber-50 rounded-lg px-3 py-2 mb-3">
        <span className="text-xs font-semibold text-amber-700">Total Mobilização</span>
        <span className="text-sm font-bold text-amber-800">{fmt(total)}</span>
      </div>
      <div className="flex gap-2">
        <button onClick={salvar} disabled={saving}
          className="px-3 py-1.5 bg-brand text-white rounded-lg text-xs font-medium hover:bg-brand-dark disabled:opacity-50">
          {saving ? 'Salvando...' : 'Salvar custos'}
        </button>
        <button onClick={registrarLancamento} disabled={total <= 0}
          className="px-3 py-1.5 border border-gray-200 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 disabled:opacity-40">
          Registrar como lançamento financeiro →
        </button>
      </div>
    </div>
  )
}
