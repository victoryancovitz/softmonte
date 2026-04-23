'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { confirmDialog } from '@/components/ui/ConfirmDialog'
import { fmt } from '@/lib/cores'
import { useRouter } from 'next/navigation'

const n = (v: any) => Number(v || 0)

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  ativa: { label: 'Ativa', cls: 'bg-blue-100 text-blue-700' },
  quitada: { label: 'Quitada', cls: 'bg-green-100 text-green-700' },
  renegociada: { label: 'Renegociada', cls: 'bg-amber-100 text-amber-700' },
  cancelada: { label: 'Cancelada', cls: 'bg-gray-100 text-gray-500' },
}

const PARCELA_BADGE: Record<string, { label: string; cls: string }> = {
  paga: { label: 'Paga', cls: 'bg-green-100 text-green-700' },
  aberta: { label: 'Aberta', cls: 'bg-blue-100 text-blue-700' },
  atrasada: { label: 'Atrasada', cls: 'bg-red-100 text-red-700' },
  pendente: { label: 'Pendente', cls: 'bg-gray-100 text-gray-500' },
  cancelada: { label: 'Cancelada', cls: 'bg-gray-100 text-gray-400' },
}

interface Props {
  passivo: any
  parcelas: any[]
  contas: any[]
  centros: any[]
}

export default function DividaDetalheClient({ passivo, parcelas: initialParcelas, contas, centros }: Props) {
  const supabase = createClient()
  const toast = useToast()
  const router = useRouter()
  const [parcelas, setParcelas] = useState(initialParcelas)
  const [saving, setSaving] = useState(false)

  // Modals
  const [showMaterializar, setShowMaterializar] = useState(false)
  const [matForm, setMatForm] = useState({ conta_id: '', centro_custo_id: '' })
  const [showPagar, setShowPagar] = useState<any>(null)
  const [pagForm, setPagForm] = useState({ data_pagamento: new Date().toISOString().slice(0, 10), conta_id: '', valor_juros_real: '', valor_mora_real: '', valor_multa_real: '' })
  const [showAmort, setShowAmort] = useState(false)
  const [amortForm, setAmortForm] = useState({ modo: 'quitacao_total' as string, valor: '', desconto: '', conta_id: '', responsavel: '', protocolo: '' })
  const [amortPreview, setAmortPreview] = useState<any>(null)

  // KPIs
  const valorTotal = n(passivo.valor_total) || n(passivo.valor_principal)
  const saldoDevedor = n(passivo.saldo_devedor_atual)
  const valorParcela = n(passivo.valor_parcela)
  const totalParcelas = parcelas.filter(p => p.status !== 'cancelada').length
  const parcelasPagas = parcelas.filter(p => p.status === 'paga').length
  const progressoPct = totalParcelas > 0 ? Math.round((parcelasPagas / totalParcelas) * 100) : 0
  const parcelasAbertas = parcelas.filter(p => ['aberta', 'atrasada', 'pendente'].includes(p.status))
  const temParcelasSemLancamento = parcelasAbertas.some(p => !p.hasLancamento)

  const statusInfo = STATUS_BADGE[passivo.status] || STATUS_BADGE.ativa

  async function reloadParcelas() {
    const { data } = await supabase.from('divida_parcelas').select('*').eq('divida_id', passivo.id).order('numero')
    setParcelas(data ?? [])
    router.refresh()
  }

  async function materializarLancamentos() {
    if (!matForm.conta_id) { toast.error('Selecione a conta pagadora.'); return }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const abertas = parcelasAbertas.filter(p => !p.hasLancamento)
    let criados = 0

    for (const p of abertas) {
      const valorLanc = n(p.valor_amortizacao) + n(p.valor_juros) + n(p.valor_outros)
      if (valorLanc <= 0) continue
      const { error } = await supabase.from('financeiro_lancamentos').insert({
        tipo: 'despesa',
        nome: `Parcela ${p.numero} — ${passivo.descricao}`,
        categoria: 'Amortizacao de Emprestimos',
        valor: valorLanc,
        status: 'em_aberto',
        data_competencia: p.data_vencimento,
        data_vencimento: p.data_vencimento,
        conta_id: matForm.conta_id,
        centro_custo_id: matForm.centro_custo_id || null,
        origem: 'manual',
        is_provisao: true,
        natureza: 'financiamento',
        divida_parcela_id: p.id,
        created_by: user?.id,
      })
      if (!error) criados++
    }

    if (criados > 0) {
      toast.success(`${criados} lancamento(s) gerado(s) com sucesso.`)
    } else {
      toast.warning('Nenhum lancamento foi gerado.')
    }
    setShowMaterializar(false)
    setSaving(false)
    await reloadParcelas()
  }

  async function registrarPagamento() {
    if (!showPagar) return
    if (!pagForm.data_pagamento) { toast.error('Informe a data de pagamento.'); return }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const p = showPagar
    const jurosReal = pagForm.valor_juros_real !== '' ? Number(pagForm.valor_juros_real) : n(p.valor_juros)
    const moraReal = pagForm.valor_mora_real !== '' ? Number(pagForm.valor_mora_real) : n(p.juros_mora)
    const multaReal = pagForm.valor_multa_real !== '' ? Number(pagForm.valor_multa_real) : n(p.multa)
    const totalPago = n(p.valor_amortizacao) + jurosReal + moraReal + multaReal

    // Create lancamento for amortizacao
    let lancAmortId: string | null = null
    if (n(p.valor_amortizacao) > 0) {
      const { data: la } = await supabase.from('financeiro_lancamentos').insert({
        tipo: 'despesa',
        nome: `Amortizacao parcela ${p.numero} — ${passivo.descricao}`,
        categoria: 'Amortizacao de Emprestimos',
        valor: n(p.valor_amortizacao),
        status: 'pago',
        data_competencia: pagForm.data_pagamento,
        data_pagamento: pagForm.data_pagamento,
        conta_id: pagForm.conta_id || null,
        origem: 'manual',
        is_provisao: false,
        natureza: 'financiamento',
        created_by: user?.id,
      }).select('id').single()
      lancAmortId = la?.id ?? null
    }

    // Create lancamento for juros if applicable
    if (jurosReal + moraReal + multaReal > 0) {
      await supabase.from('financeiro_lancamentos').insert({
        tipo: 'despesa',
        nome: `Juros parcela ${p.numero} — ${passivo.descricao}`,
        categoria: 'Despesas Financeiras',
        valor: jurosReal + moraReal + multaReal,
        status: 'pago',
        data_competencia: pagForm.data_pagamento,
        data_pagamento: pagForm.data_pagamento,
        conta_id: pagForm.conta_id || null,
        origem: 'manual',
        is_provisao: false,
        natureza: 'financiamento',
        created_by: user?.id,
      })
    }

    // Update parcela
    await supabase.from('divida_parcelas').update({
      status: 'paga',
      data_pagamento: pagForm.data_pagamento,
      valor_pago: totalPago,
      valor_juros: jurosReal,
      juros_mora: moraReal,
      multa: multaReal,
      lancamento_id: lancAmortId,
    }).eq('id', p.id)

    // Update passivo saldo
    await supabase.from('passivos_nao_circulantes').update({
      saldo_devedor_atual: Math.max(0, saldoDevedor - n(p.valor_amortizacao)),
      n_parcelas_pagas: parcelasPagas + 1,
    }).eq('id', passivo.id)

    toast.success(`Parcela ${p.numero} paga — ${fmt(totalPago)}`)
    setShowPagar(null)
    setSaving(false)
    await reloadParcelas()
  }

  return (
    <>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold font-display text-brand">{passivo.descricao}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-500">
            {passivo.banco_credor && <span>Credor: <strong>{passivo.banco_credor}</strong></span>}
            {passivo.numero_contrato && <span>| Contrato: <strong>{passivo.numero_contrato}</strong></span>}
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusInfo.cls}`}>{statusInfo.label}</span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-[10px] font-bold text-gray-400 uppercase">Valor Total</div>
          <div className="text-xl font-bold text-gray-900">{fmt(valorTotal)}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-[10px] font-bold text-gray-400 uppercase">Saldo Devedor</div>
          <div className={`text-xl font-bold ${saldoDevedor > 0 ? 'text-red-700' : 'text-green-700'}`}>{fmt(saldoDevedor)}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-[10px] font-bold text-gray-400 uppercase">Valor Parcela</div>
          <div className="text-lg font-bold text-gray-900">{fmt(valorParcela)}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-[10px] font-bold text-gray-400 uppercase">Progresso</div>
          <div className="text-lg font-bold text-brand">{parcelasPagas}/{totalParcelas} parcelas</div>
          <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
            <div className="bg-brand h-2 rounded-full transition-all" style={{ width: `${progressoPct}%` }} />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mb-6">
        {temParcelasSemLancamento && passivo.status === 'ativa' && (
          <button
            onClick={() => setShowMaterializar(true)}
            className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark"
          >
            Gerar lancamentos
          </button>
        )}
        {passivo.status === 'ativa' && parcelasAbertas.length > 0 && (
          <button
            onClick={() => { setShowAmort(true); setAmortPreview(null); setAmortForm(f => ({ ...f, valor: String(saldoDevedor) })) }}
            className="px-4 py-2 border border-amber-300 text-amber-700 bg-amber-50 rounded-lg text-sm font-medium hover:bg-amber-100"
          >
            Pagamento antecipado
          </button>
        )}
      </div>

      {/* Materializar modal */}
      {showMaterializar && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
            <h3 className="text-sm font-bold text-brand mb-4">Gerar Lancamentos Financeiros</h3>
            <p className="text-xs text-gray-500 mb-4">
              Serao criados lancamentos em_aberto para {parcelasAbertas.filter(p => !p.hasLancamento).length} parcela(s) sem lancamento.
            </p>
            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Conta pagadora *</label>
                <select value={matForm.conta_id} onChange={e => setMatForm(f => ({ ...f, conta_id: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                  <option value="">Selecione...</option>
                  {contas.map(c => <option key={c.id} value={c.id}>{c.banco ? `${c.banco} — ` : ''}{c.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Centro de custo</label>
                <select value={matForm.centro_custo_id} onChange={e => setMatForm(f => ({ ...f, centro_custo_id: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                  <option value="">Nenhum</option>
                  {centros.map((c: any) => <option key={c.id} value={c.id}>{c.codigo} — {c.nome}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowMaterializar(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
              <button onClick={materializarLancamentos} disabled={saving} className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark disabled:opacity-50">
                {saving ? 'Gerando...' : 'Gerar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal amortização antecipada */}
      {showAmort && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-sm font-bold text-brand mb-1">Pagamento Antecipado / Amortização</h3>
            <p className="text-xs text-gray-500 mb-4">Saldo devedor: <strong>{fmt(saldoDevedor)}</strong> · {parcelasAbertas.length} parcelas em aberto</p>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">O que você quer fazer?</label>
                <select value={amortForm.modo} onChange={e => { setAmortForm(f => ({ ...f, modo: e.target.value, valor: e.target.value === 'quitacao_total' ? String(saldoDevedor) : '' })); setAmortPreview(null) }} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                  <option value="quitacao_total">Quitar a dívida TOTAL agora</option>
                  <option value="reduzir_prazo">Amortizar parcial (reduzir prazo)</option>
                  <option value="reduzir_parcela">Amortizar parcial (reduzir valor da parcela)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Valor a pagar hoje (R$) *</label>
                <input type="number" step="0.01" value={amortForm.valor} onChange={e => { setAmortForm(f => ({ ...f, valor: e.target.value })); setAmortPreview(null) }} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>

              {amortForm.modo === 'quitacao_total' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Desconto negociado (R$)</label>
                  <input type="number" step="0.01" value={amortForm.desconto} onChange={e => setAmortForm(f => ({ ...f, desconto: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="0" />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Conta de débito *</label>
                <select value={amortForm.conta_id} onChange={e => setAmortForm(f => ({ ...f, conta_id: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                  <option value="">Selecione...</option>
                  {contas.map(c => <option key={c.id} value={c.id}>{c.banco ? `${c.banco} — ` : ''}{c.nome}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold text-gray-500 mb-1">Responsável</label>
                  <input value={amortForm.responsavel} onChange={e => setAmortForm(f => ({ ...f, responsavel: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
                <div><label className="block text-xs font-semibold text-gray-500 mb-1">Nº Protocolo</label>
                  <input value={amortForm.protocolo} onChange={e => setAmortForm(f => ({ ...f, protocolo: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
              </div>
            </div>

            {/* Simular */}
            <button onClick={async () => {
              if (!amortForm.valor || Number(amortForm.valor) <= 0) { toast.error('Informe o valor'); return }
              const { data, error } = await supabase.rpc('calcular_amortizacao_antecipada', {
                p_passivo_id: passivo.id,
                p_valor_pagamento: Number(amortForm.valor),
                p_modo: amortForm.modo,
              })
              if (error) { toast.error(error.message); return }
              setAmortPreview(data)
            }} className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 mb-3">
              Simular
            </button>

            {/* Preview */}
            {amortPreview?.ok && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-xs space-y-1">
                <div className="flex justify-between"><span className="text-gray-500">Saldo atual:</span><strong>{fmt(n(amortPreview.saldo_atual))}</strong></div>
                <div className="flex justify-between"><span className="text-gray-500">Valor do pagamento:</span><strong>{fmt(n(amortPreview.valor_pagamento))}</strong></div>
                {n(amortForm.desconto) > 0 && <div className="flex justify-between"><span className="text-gray-500">Desconto negociado:</span><strong className="text-green-600">-{fmt(n(amortForm.desconto))}</strong></div>}
                <div className="flex justify-between border-t border-blue-200 pt-1"><span className="text-gray-500">Novo saldo:</span><strong className="text-brand">{fmt(n(amortPreview.novo_saldo))}</strong></div>
                {amortPreview.modo !== 'quitacao_total' && (
                  <>
                    <div className="flex justify-between"><span className="text-gray-500">Novas parcelas:</span><strong>{amortPreview.novo_n_parcelas}</strong></div>
                    <div className="flex justify-between"><span className="text-gray-500">Novo valor parcela:</span><strong>{fmt(n(amortPreview.novo_valor_parcela))}</strong></div>
                  </>
                )}
                {n(amortPreview.economia_juros_estimada) > 0 && (
                  <div className="flex justify-between"><span className="text-gray-500">Economia estimada em juros:</span><strong className="text-green-600">{fmt(n(amortPreview.economia_juros_estimada))}</strong></div>
                )}
                {!amortPreview.tem_taxa && (
                  <div className="text-amber-600 mt-1">Sem taxa de juros cadastrada — desconto de juros não calculado.</div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAmort(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
              <button disabled={saving || !amortPreview?.ok || !amortForm.conta_id} onClick={async () => {
                const ok = await confirmDialog({
                  title: amortForm.modo === 'quitacao_total' ? 'Confirmar quitação total?' : 'Confirmar amortização?',
                  message: amortForm.modo === 'quitacao_total'
                    ? `Pagar ${fmt(n(amortForm.valor))} e quitar todas as ${parcelasAbertas.length} parcelas em aberto?`
                    : `Amortizar ${fmt(n(amortForm.valor))} e recalcular ${amortPreview.novo_n_parcelas} parcelas?`,
                  variant: 'warning',
                  confirmLabel: 'Confirmar pagamento',
                })
                if (!ok) return
                setSaving(true)
                const { data, error } = await supabase.rpc('efetivar_amortizacao_antecipada', {
                  p_passivo_id: passivo.id,
                  p_valor_pagamento: Number(amortForm.valor),
                  p_modo: amortForm.modo,
                  p_conta_debito_id: amortForm.conta_id,
                  p_desconto_obtido: Number(amortForm.desconto || 0),
                  p_responsavel: amortForm.responsavel || null,
                  p_numero_protocolo: amortForm.protocolo || null,
                })
                setSaving(false)
                if (error) { toast.error('Erro: ' + error.message); return }
                toast.success(amortForm.modo === 'quitacao_total' ? 'Dívida quitada!' : `Amortização registrada. Novo saldo: ${fmt(n(data?.novo_saldo))}`)
                setShowAmort(false)
                reloadParcelas()
              }} className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50">
                {saving ? 'Processando...' : 'Confirmar pagamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pagar parcela modal */}
      {showPagar && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
            <h3 className="text-sm font-bold text-brand mb-4">Registrar Pagamento — Parcela {showPagar.numero}</h3>
            <div className="bg-gray-50 rounded-lg p-3 mb-4 text-xs text-gray-600 space-y-1">
              <div>Amortizacao: <strong>{fmt(showPagar.valor_amortizacao)}</strong></div>
              <div>Juros previstos: <strong>{fmt(showPagar.valor_juros)}</strong></div>
              <div>Vencimento: <strong>{showPagar.data_vencimento ? new Date(showPagar.data_vencimento + 'T12:00').toLocaleDateString('pt-BR') : '—'}</strong></div>
            </div>
            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Data do pagamento *</label>
                <input type="date" value={pagForm.data_pagamento} onChange={e => setPagForm(f => ({ ...f, data_pagamento: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Conta</label>
                <select value={pagForm.conta_id} onChange={e => setPagForm(f => ({ ...f, conta_id: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                  <option value="">Selecione...</option>
                  {contas.map(c => <option key={c.id} value={c.id}>{c.banco ? `${c.banco} — ` : ''}{c.nome}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Juros real</label>
                  <input type="number" step="0.01" placeholder={String(n(showPagar.valor_juros))} value={pagForm.valor_juros_real} onChange={e => setPagForm(f => ({ ...f, valor_juros_real: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Mora</label>
                  <input type="number" step="0.01" placeholder="0" value={pagForm.valor_mora_real} onChange={e => setPagForm(f => ({ ...f, valor_mora_real: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Multa</label>
                  <input type="number" step="0.01" placeholder="0" value={pagForm.valor_multa_real} onChange={e => setPagForm(f => ({ ...f, valor_multa_real: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowPagar(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
              <button onClick={registrarPagamento} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                {saving ? 'Salvando...' : 'Confirmar Pagamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Parcelas table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-700">Parcelas ({totalParcelas})</h2>
        </div>
        {parcelas.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">Nenhuma parcela encontrada.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase">
                  <th className="px-4 py-2 text-left">N</th>
                  <th className="px-4 py-2 text-left">Vencimento</th>
                  <th className="px-4 py-2 text-right">Amortizacao</th>
                  <th className="px-4 py-2 text-right">Juros</th>
                  <th className="px-4 py-2 text-right">Total</th>
                  <th className="px-4 py-2 text-center">Status</th>
                  <th className="px-4 py-2 text-right">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {parcelas.filter(p => p.status !== 'cancelada').map((p: any) => {
                  const total = n(p.valor_amortizacao) + n(p.valor_juros) + n(p.valor_outros)
                  const badge = PARCELA_BADGE[p.status] || PARCELA_BADGE.aberta
                  const isOpen = ['aberta', 'atrasada', 'pendente'].includes(p.status)
                  return (
                    <tr key={p.id} className="border-t border-gray-50 hover:bg-gray-50/50">
                      <td className="px-4 py-2.5 font-medium text-gray-700">{p.numero}</td>
                      <td className="px-4 py-2.5 text-gray-600">
                        {p.data_vencimento ? new Date(p.data_vencimento + 'T12:00').toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{fmt(p.valor_amortizacao)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-500">{fmt(p.valor_juros)}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-gray-900">{fmt(total)}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${badge.cls}`}>{badge.label}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {isOpen && (
                          <button
                            onClick={() => {
                              setShowPagar(p)
                              setPagForm({ data_pagamento: new Date().toISOString().slice(0, 10), conta_id: '', valor_juros_real: '', valor_mora_real: '', valor_multa_real: '' })
                            }}
                            className="text-xs text-green-700 hover:text-green-900 font-medium"
                          >
                            Registrar pagamento
                          </button>
                        )}
                        {p.status === 'paga' && p.data_pagamento && (
                          <span className="text-[10px] text-gray-400">
                            Pago em {new Date(p.data_pagamento + 'T12:00').toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
