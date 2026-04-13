'use client'
import { useState, Fragment } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { gerarTabelaAmortizacao } from '@/lib/dividas'
import EmptyState from '@/components/ui/EmptyState'
import { Landmark, AlertTriangle } from 'lucide-react'
import { fmt } from '@/lib/cores'
const n = (v: any) => Number(v || 0)

const TIPO_LABEL: Record<string, string> = {
  emprestimo_capital_giro: 'Capital de Giro', financiamento_equipamento: 'Financiamento',
  antecipacao_recebiveis: 'Antecipação', cartao_empresarial: 'Cartão', mutuo_socio: 'Mútuo Sócio',
  leasing: 'Leasing', debenture: 'Debênture', debito_cartorio: 'Cartório',
  fornecedor: 'Fornecedor', imposto_parcelado: 'Imposto Parcelado',
  cheque_especial: 'Cheque Especial', cartao_credito: 'Cartão de Crédito',
  condominio_aluguel: 'Aluguel/Condomínio', outros: 'Outros',
}

const CREDOR_BADGE: Record<string, { icon: string; cls: string }> = {
  banco: { icon: '🏦', cls: 'bg-blue-100 text-blue-700' },
  cartorio: { icon: '📜', cls: 'bg-amber-100 text-amber-700' },
  fornecedor: { icon: '🏢', cls: 'bg-green-100 text-green-700' },
  fisco: { icon: '🏛️', cls: 'bg-violet-100 text-violet-700' },
  socio: { icon: '👤', cls: 'bg-gray-100 text-gray-600' },
  outro: { icon: '📋', cls: 'bg-gray-100 text-gray-600' },
}

export default function DividasClient({ dividas, indicadores, contas }: { dividas: any[]; indicadores: any; contas: any[] }) {
  const supabase = createClient()
  const toast = useToast()
  const [showNova, setShowNova] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filtroCredor, setFiltroCredor] = useState('')
  const [expandId, setExpandId] = useState<string | null>(null)
  const [showPagar, setShowPagar] = useState<any>(null) // parcela selecionada
  const [showReneg, setShowReneg] = useState<any>(null) // dívida para renegociar
  const [parcelas, setParcelas] = useState<any[]>([])
  const [renegs, setRenegs] = useState<any[]>([])
  const [pagForm, setPagForm] = useState({ data_pagamento: new Date().toISOString().slice(0, 10), conta_id: '', valor_juros_real: '' as string, valor_mora_real: '' as string, valor_multa_real: '' as string })
  const [form, setForm] = useState({
    descricao: '', tipo_divida: 'emprestimo_capital_giro', credor_tipo: 'banco',
    banco_credor: '', numero_contrato: '',
    valor_principal: '', taxa_juros_am: '', sistema: 'price' as 'price' | 'sac' | 'bullet',
    n_parcelas: '12', data_primeiro_venc: '', dia_vencimento: '', finalidade: '', garantia: '',
    conta_credito_id: '', valor_desembolsado: '',
    // Cartório
    cartorio_nome: '', numero_protesto: '', data_protesto: '', credor_original: '',
    valor_emolumentos: '', valor_acrescimos: '',
    // Negociação
    negociado: false, desconto_obtido_valor: '', condicoes_especiais: '', responsavel_negociacao: '',
  })
  const dividasFiltradas = filtroCredor ? dividas.filter(d => d.credor_tipo === filtroCredor) : dividas

  const totalBruta = dividas.reduce((s, d) => s + n(d.saldo_devedor_atual), 0)
  const totalAtrasadas = dividas.reduce((s, d) => s + n(d.parcelas_atrasadas), 0)
  const proxVenc = dividas.filter(d => d.prox_vencimento).sort((a, b) => a.prox_vencimento.localeCompare(b.prox_vencimento))[0]

  // Preview amortização
  const previewParcelas = form.valor_principal && form.taxa_juros_am && form.n_parcelas && form.data_primeiro_venc
    ? gerarTabelaAmortizacao({
        valor: Number(form.valor_principal), taxaMensal: Number(form.taxa_juros_am) / 100,
        nParcelas: Number(form.n_parcelas), dataInicio: form.data_primeiro_venc,
        sistema: form.sistema, diaVencimento: form.dia_vencimento ? Number(form.dia_vencimento) : undefined,
      })
    : []
  const totalJurosPreview = previewParcelas.reduce((s, p) => s + p.valor_juros, 0)

  async function salvarDivida() {
    if (!form.descricao || !form.valor_principal || !form.taxa_juros_am || !form.data_primeiro_venc) {
      toast.error('Preencha os campos obrigatórios'); return
    }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const taxaAm = Number(form.taxa_juros_am) / 100
    const taxaAa = Math.pow(1 + taxaAm, 12) - 1

    // Inserir dívida
    const { data: divida, error: err1 } = await supabase.from('passivos_nao_circulantes').insert({
      descricao: form.descricao, tipo_divida: form.tipo_divida, credor_tipo: form.credor_tipo,
      banco_credor: form.banco_credor, numero_contrato: form.numero_contrato, sistema: form.sistema, status: 'ativa',
      cartorio_nome: form.cartorio_nome || null, numero_protesto: form.numero_protesto || null,
      data_protesto: form.data_protesto || null, credor_original: form.credor_original || null,
      valor_emolumentos: form.valor_emolumentos ? Number(form.valor_emolumentos) : null,
      valor_acrescimos: form.valor_acrescimos ? Number(form.valor_acrescimos) : null,
      negociado: form.negociado, desconto_obtido_valor: form.desconto_obtido_valor ? Number(form.desconto_obtido_valor) : null,
      condicoes_especiais: form.condicoes_especiais || null, responsavel_negociacao: form.responsavel_negociacao || null,
      valor_principal: Number(form.valor_principal), valor_total: Number(form.valor_principal),
      saldo_devedor: Number(form.valor_principal), saldo_devedor_atual: Number(form.valor_principal),
      valor_desembolsado: Number(form.valor_desembolsado || form.valor_principal),
      taxa_juros_am: taxaAm, taxa_juros_aa: taxaAa,
      n_parcelas_total: Number(form.n_parcelas), valor_parcela: previewParcelas[0]?.valor_total || 0,
      dia_vencimento: form.dia_vencimento ? Number(form.dia_vencimento) : null,
      data_contratacao: new Date().toISOString().slice(0, 10),
      data_primeiro_venc: form.data_primeiro_venc,
      data_ultimo_venc: previewParcelas[previewParcelas.length - 1]?.data_vencimento,
      data_inicio: form.data_primeiro_venc, data_vencimento: previewParcelas[previewParcelas.length - 1]?.data_vencimento,
      conta_credito_id: form.conta_credito_id || null,
      finalidade: form.finalidade, garantia: form.garantia,
      created_by: user?.id,
    }).select().single()
    if (err1 || !divida) { toast.error('Erro: ' + (err1?.message || 'desconhecido')); setSaving(false); return }

    // Inserir parcelas
    const rows = previewParcelas.map(p => ({
      divida_id: divida.id, numero: p.numero, data_vencimento: p.data_vencimento,
      valor_amortizacao: p.valor_amortizacao, valor_juros: p.valor_juros,
      saldo_antes: p.saldo_antes, saldo_depois: p.saldo_depois, status: 'aberta',
    }))
    const { error: err2 } = await supabase.from('divida_parcelas').insert(rows)
    if (err2) { toast.error('Erro parcelas: ' + err2.message); setSaving(false); return }

    // Lançamento financeiro de entrada
    await supabase.from('financeiro_lancamentos').insert({
      tipo: 'receita', nome: `Empréstimo — ${form.descricao}`,
      categoria: 'Empréstimos e Financiamentos', origem: 'manual',
      valor: Number(form.valor_desembolsado || form.valor_principal),
      status: 'pago', data_competencia: new Date().toISOString().slice(0, 10),
      data_pagamento: new Date().toISOString().slice(0, 10),
      conta_id: form.conta_credito_id || null, is_provisao: false, created_by: user?.id,
    })

    toast.success(`Dívida cadastrada. ${previewParcelas.length} parcelas geradas.`)
    setShowNova(false); setSaving(false)
  }

  async function toggleExpand(dividaId: string) {
    if (expandId === dividaId) { setExpandId(null); return }
    setExpandId(dividaId)
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from('divida_parcelas').select('*').eq('divida_id', dividaId).order('numero'),
      supabase.from('divida_renegociacoes').select('*').eq('divida_id', dividaId).order('numero_renegociacao'),
    ])
    setParcelas(p ?? [])
    setRenegs(r ?? [])
  }

  async function pagarParcela() {
    if (!showPagar) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const p = showPagar
    const jurosReal = pagForm.valor_juros_real !== '' ? Number(pagForm.valor_juros_real) : n(p.valor_juros)
    const moraReal = pagForm.valor_mora_real !== '' ? Number(pagForm.valor_mora_real) : n(p.juros_mora)
    const multaReal = pagForm.valor_multa_real !== '' ? Number(pagForm.valor_multa_real) : n(p.multa)
    const totalPago = n(p.valor_amortizacao) + jurosReal + moraReal + multaReal

    // Lançamento juros (despesa DRE)
    let lancJurosId: string | null = null
    if (jurosReal > 0) {
      const { data: lj } = await supabase.from('financeiro_lancamentos').insert({
        tipo: 'despesa', nome: `Juros parcela ${p.numero} — dívida`, categoria: 'Despesas Financeiras',
        valor: jurosReal + moraReal + multaReal, status: 'pago', data_competencia: pagForm.data_pagamento,
        data_pagamento: pagForm.data_pagamento, conta_id: pagForm.conta_id || null,
        origem: 'manual', is_provisao: false, natureza: 'financiamento', created_by: user?.id,
      }).select('id').single()
      lancJurosId = lj?.id ?? null
    }
    // Lançamento amortização (reduz passivo)
    let lancAmortId: string | null = null
    if (n(p.valor_amortizacao) > 0) {
      const { data: la } = await supabase.from('financeiro_lancamentos').insert({
        tipo: 'despesa', nome: `Amortização parcela ${p.numero} — dívida`, categoria: 'Amortização de Empréstimos',
        valor: n(p.valor_amortizacao), status: 'pago', data_competencia: pagForm.data_pagamento,
        data_pagamento: pagForm.data_pagamento, conta_id: pagForm.conta_id || null,
        origem: 'manual', is_provisao: false, natureza: 'financiamento', created_by: user?.id,
      }).select('id').single()
      lancAmortId = la?.id ?? null
    }
    // Atualizar parcela com valores reais
    await supabase.from('divida_parcelas').update({
      status: 'paga', data_pagamento: pagForm.data_pagamento, valor_pago: totalPago,
      valor_juros: jurosReal, juros_mora: moraReal, multa: multaReal,
      lancamento_id: lancAmortId,
    }).eq('id', p.id)
    // Atualizar dívida
    await supabase.from('passivos_nao_circulantes').update({
      saldo_devedor_atual: Math.max(0, n(p.saldo_antes) - n(p.valor_amortizacao)),
      n_parcelas_pagas: (showPagar._divida_pagas || 0) + 1,
    }).eq('id', p.divida_id)
    toast.success(`Parcela ${p.numero} paga — ${fmt(totalPago)}`)
    setShowPagar(null); setSaving(false)
    if (expandId) { toggleExpand(expandId); setTimeout(() => toggleExpand(p.divida_id), 100) }
  }

  async function estornarParcela(p: any) {
    if (!confirm(`Reverter pagamento da parcela ${p.numero}?\nIsso desfaz os lançamentos e marca como não paga.`)) return
    setSaving(true)
    const hoje = new Date().toISOString().slice(0, 10)
    await supabase.from('divida_parcelas').update({
      status: p.data_vencimento < hoje ? 'atrasada' : 'aberta',
      data_pagamento: null, valor_pago: null,
    }).eq('id', p.id)
    if (p.lancamento_id) {
      await supabase.from('financeiro_lancamentos').update({ deleted_at: new Date().toISOString() }).eq('id', p.lancamento_id)
    }
    // Soft-delete lançamentos de juros da mesma parcela
    await supabase.from('financeiro_lancamentos').update({ deleted_at: new Date().toISOString() })
      .eq('natureza', 'financiamento').eq('data_pagamento', p.data_pagamento).ilike('nome', `%parcela ${p.numero}%`)
    // Recalcular saldo
    const divida = dividas.find(d => d.id === p.divida_id)
    if (divida) {
      await supabase.from('passivos_nao_circulantes').update({
        saldo_devedor_atual: n(divida.saldo_devedor_atual) + n(p.valor_amortizacao),
        n_parcelas_pagas: Math.max(0, (divida.n_parcelas_pagas || 0) - 1),
      }).eq('id', p.divida_id)
    }
    toast.success(`Pagamento da parcela ${p.numero} revertido.`)
    setSaving(false)
    if (expandId) { toggleExpand(expandId); setTimeout(() => toggleExpand(p.divida_id), 100) }
  }

  async function confirmarRenegociacao() {
    if (!showReneg) return
    setSaving(true)
    const d = showReneg
    const { data: { user } } = await supabase.auth.getUser()
    const countReneg = (d.total_renegociacoes || 0) + 1
    // Snapshot
    await supabase.from('divida_renegociacoes').insert({
      divida_id: d.id, numero_renegociacao: countReneg,
      motivo: 'novos_termos_credor', motivo_descricao: d._reneg_motivo || '',
      valor_anterior: n(d.valor_principal), saldo_anterior: n(d.saldo_devedor_atual),
      n_parcelas_anterior: d.n_parcelas_total, taxa_anterior_am: n(d.taxa_juros_am),
      valor_novo: n(d._reneg_novo_saldo), saldo_novo: n(d._reneg_novo_saldo),
      n_parcelas_novo: Number(d._reneg_parcelas || d.n_parcelas_total),
      taxa_nova_am: n(d._reneg_taxa || d.taxa_juros_am),
      desconto_obtido: Math.max(0, n(d.saldo_devedor_atual) - n(d._reneg_novo_saldo)),
      data_acordo: new Date().toISOString().slice(0, 10),
      responsavel_acordo: d._reneg_responsavel || null,
      numero_protocolo: d._reneg_protocolo || null,
      status: 'ativa', created_by: user?.id,
    })
    // Deletar parcelas abertas antigas
    await supabase.from('divida_parcelas').delete().eq('divida_id', d.id).eq('status', 'aberta')
    // Gerar novas parcelas
    if (n(d._reneg_novo_saldo) > 0 && Number(d._reneg_parcelas) > 0) {
      const novas = gerarTabelaAmortizacao({
        valor: n(d._reneg_novo_saldo), taxaMensal: n(d._reneg_taxa || d.taxa_juros_am),
        nParcelas: Number(d._reneg_parcelas), dataInicio: new Date().toISOString().slice(0, 10),
        sistema: (d.sistema || 'price') as any,
      })
      await supabase.from('divida_parcelas').insert(novas.map(p => ({
        divida_id: d.id, numero: p.numero + (d.n_parcelas_pagas || 0),
        data_vencimento: p.data_vencimento, valor_amortizacao: p.valor_amortizacao,
        valor_juros: p.valor_juros, saldo_antes: p.saldo_antes, saldo_depois: p.saldo_depois, status: 'aberta',
      })))
    }
    // Atualizar dívida
    await supabase.from('passivos_nao_circulantes').update({
      saldo_devedor_atual: n(d._reneg_novo_saldo),
      n_parcelas_total: (d.n_parcelas_pagas || 0) + Number(d._reneg_parcelas || 0),
      negociado: true, data_negociacao: new Date().toISOString().slice(0, 10),
      desconto_obtido_valor: Math.max(0, n(d.saldo_devedor_atual) - n(d._reneg_novo_saldo)),
      desconto_obtido_pct: n(d.saldo_devedor_atual) > 0 ? Math.round((1 - n(d._reneg_novo_saldo) / n(d.saldo_devedor_atual)) * 100) : 0,
      condicoes_especiais: d._reneg_condicoes || null,
      responsavel_negociacao: d._reneg_responsavel || null,
    }).eq('id', d.id)
    toast.success(`Renegociação #${countReneg} registrada. ${d._reneg_parcelas || 0} novas parcelas geradas.`)
    setShowReneg(null); setSaving(false)
  }

  return (
    <>
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-[10px] font-bold text-gray-400 uppercase">Dívida Bruta</div>
          <div className={`text-xl font-bold ${totalBruta > 0 ? 'text-red-700' : 'text-green-700'}`}>{fmt(totalBruta)}</div>
          <div className="text-[10px] text-gray-400">{dividas.length} contrato(s)</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-[10px] font-bold text-gray-400 uppercase">Dívida Líquida</div>
          <div className={`text-xl font-bold ${n(indicadores?.divida_liquida) > 0 ? 'text-red-700' : 'text-green-700'}`}>{fmt(indicadores?.divida_liquida)}</div>
          <div className="text-[10px] text-gray-400">Bruta − Caixa ({fmt(indicadores?.caixa_disponivel)})</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-[10px] font-bold text-gray-400 uppercase">Próxima Parcela</div>
          <div className="text-sm font-bold text-gray-900">{proxVenc ? `${fmt(proxVenc.prox_valor_parcela)} em ${new Date(proxVenc.prox_vencimento + 'T12:00').toLocaleDateString('pt-BR')}` : '—'}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-[10px] font-bold text-gray-400 uppercase">Parcelas em Atraso</div>
          <div className={`text-xl font-bold ${totalAtrasadas > 0 ? 'text-red-700' : 'text-green-700'}`}>{totalAtrasadas}</div>
        </div>
      </div>

      {/* Indicadores */}
      {indicadores && (
        <div className="flex flex-wrap gap-2 mb-6">
          <span className="text-[10px] px-3 py-1 rounded-full bg-gray-100 text-gray-600" title="Dívida Líquida / EBITDA anualizado">
            Alavancagem: {indicadores.alavancagem_ebitda != null ? `${indicadores.alavancagem_ebitda}×` : '—'}
          </span>
          <span className="text-[10px] px-3 py-1 rounded-full bg-gray-100 text-gray-600" title="EBITDA / Despesas Financeiras">
            Cobertura Juros: {indicadores.cobertura_juros != null ? `${indicadores.cobertura_juros}×` : '—'}
          </span>
          <span className="text-[10px] px-3 py-1 rounded-full bg-gray-100 text-gray-600" title="Dívida / (Dívida + PL)">
            Endividamento: {n(indicadores.endividamento_geral_pct).toFixed(1)}%
          </span>
        </div>
      )}

      {/* Filtros + botão */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg overflow-x-auto">
          {[
            { key: '', label: 'Todos' },
            { key: 'banco', label: '🏦 Bancos' },
            { key: 'cartorio', label: '📜 Cartórios' },
            { key: 'fornecedor', label: '🏢 Fornecedores' },
            { key: 'fisco', label: '🏛️ Fisco' },
          ].map(f => (
            <button key={f.key} onClick={() => setFiltroCredor(f.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${filtroCredor === f.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              {f.label}
            </button>
          ))}
        </div>
        <button onClick={() => setShowNova(true)} className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark">+ Nova Dívida</button>
      </div>

      {/* Modal nova dívida */}
      {showNova && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
          <h3 className="text-sm font-bold text-brand mb-4">Cadastrar Nova Dívida</h3>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            <div className="col-span-2"><label className="block text-xs font-semibold text-gray-500 mb-1">Descrição *</label>
              <input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Ex: Capital de giro — BV Financeira" /></div>
            <div><label className="block text-xs font-semibold text-gray-500 mb-1">Credor</label>
              <select value={form.credor_tipo} onChange={e => setForm(f => ({ ...f, credor_tipo: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                <option value="banco">🏦 Banco</option><option value="cartorio">📜 Cartório</option><option value="fornecedor">🏢 Fornecedor</option><option value="fisco">🏛️ Fisco/Imposto</option><option value="socio">👤 Sócio</option><option value="outro">Outro</option>
              </select></div>
            <div><label className="block text-xs font-semibold text-gray-500 mb-1">Tipo</label>
              <select value={form.tipo_divida} onChange={e => setForm(f => ({ ...f, tipo_divida: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                {Object.entries(TIPO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div><label className="block text-xs font-semibold text-gray-500 mb-1">Banco/Credor</label>
              <input value={form.banco_credor} onChange={e => setForm(f => ({ ...f, banco_credor: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
            <div><label className="block text-xs font-semibold text-gray-500 mb-1">Valor Principal *</label>
              <input type="number" step="0.01" value={form.valor_principal} onChange={e => setForm(f => ({ ...f, valor_principal: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
            <div><label className="block text-xs font-semibold text-gray-500 mb-1">Taxa Juros (% a.m.) *</label>
              <input type="number" step="0.01" value={form.taxa_juros_am} onChange={e => setForm(f => ({ ...f, taxa_juros_am: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="1.80" />
              {form.taxa_juros_am && <div className="text-[10px] text-gray-400 mt-0.5">{((Math.pow(1 + Number(form.taxa_juros_am) / 100, 12) - 1) * 100).toFixed(2)}% a.a.</div>}</div>
            <div><label className="block text-xs font-semibold text-gray-500 mb-1">Sistema</label>
              <select value={form.sistema} onChange={e => setForm(f => ({ ...f, sistema: e.target.value as any }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                <option value="price">PRICE (parcela fixa)</option><option value="sac">SAC (amortização constante)</option><option value="bullet">Bullet (juros + principal no fim)</option></select></div>
            <div><label className="block text-xs font-semibold text-gray-500 mb-1">Nº Parcelas</label>
              <input type="number" value={form.n_parcelas} onChange={e => setForm(f => ({ ...f, n_parcelas: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
            <div><label className="block text-xs font-semibold text-gray-500 mb-1">1º Vencimento *</label>
              <input type="date" value={form.data_primeiro_venc} onChange={e => setForm(f => ({ ...f, data_primeiro_venc: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
            <div><label className="block text-xs font-semibold text-gray-500 mb-1">Conta de Crédito</label>
              <select value={form.conta_credito_id} onChange={e => setForm(f => ({ ...f, conta_credito_id: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                <option value="">Selecionar...</option>{contas.map(c => <option key={c.id} value={c.id}>{c.banco ? `${c.banco} — ` : ''}{c.nome}</option>)}</select></div>
          </div>

          {/* Preview */}
          {previewParcelas.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <div className="text-xs font-bold text-gray-500 mb-2">Preview: {previewParcelas.length} parcelas · Juros total: {fmt(totalJurosPreview)} · Custo total: {fmt(Number(form.valor_principal) + totalJurosPreview)}</div>
              <table className="w-full text-xs">
                <thead><tr className="text-gray-400"><th className="text-left">Nº</th><th className="text-right">Amort.</th><th className="text-right">Juros</th><th className="text-right">Parcela</th><th className="text-right">Saldo</th></tr></thead>
                <tbody>
                  {previewParcelas.slice(0, 3).map(p => (
                    <tr key={p.numero}><td>{p.numero}</td><td className="text-right">{fmt(p.valor_amortizacao)}</td><td className="text-right text-red-600">{fmt(p.valor_juros)}</td><td className="text-right font-semibold">{fmt(p.valor_total)}</td><td className="text-right text-gray-400">{fmt(p.saldo_depois)}</td></tr>
                  ))}
                  {previewParcelas.length > 6 && <tr><td colSpan={5} className="text-center text-gray-400 py-1">...</td></tr>}
                  {previewParcelas.length > 3 && previewParcelas.slice(-2).map(p => (
                    <tr key={p.numero}><td>{p.numero}</td><td className="text-right">{fmt(p.valor_amortizacao)}</td><td className="text-right text-red-600">{fmt(p.valor_juros)}</td><td className="text-right font-semibold">{fmt(p.valor_total)}</td><td className="text-right text-gray-400">{fmt(p.saldo_depois)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => setShowNova(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm">Cancelar</button>
            <button onClick={salvarDivida} disabled={saving} className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium disabled:opacity-50">{saving ? 'Salvando...' : 'Cadastrar Dívida'}</button>
          </div>
        </div>
      )}

      {/* Lista de dívidas */}
      {dividasFiltradas.length === 0 ? (
        <EmptyState titulo={filtroCredor ? 'Nenhuma dívida deste tipo' : 'Nenhuma dívida cadastrada'} descricao="Cadastre empréstimos, protestos e débitos com fornecedores." icone={<Landmark className="w-10 h-10" />} />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 border-b border-gray-100">
              {['Credor', 'Tipo', 'Sistema', 'Saldo Devedor', 'Taxa', 'Próx. Parcela', 'Parcelas', 'Neg.', 'Status'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {dividasFiltradas.map(d => {
                const cb = CREDOR_BADGE[d.credor_tipo] || CREDOR_BADGE.outro
                const isOpen = expandId === d.id
                return (
                <Fragment key={d.id}>
                <tr onClick={() => toggleExpand(d.id)} className={`border-b border-gray-50 cursor-pointer transition-colors ${isOpen ? 'bg-brand/5' : 'hover:bg-gray-50'}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${cb.cls}`}>{cb.icon}</span>
                      <div><div className="font-medium">{d.credor_display || d.descricao}</div><div className="text-[10px] text-gray-400">{d.descricao}</div></div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">{TIPO_LABEL[d.tipo_divida] || d.tipo_divida || '—'}</td>
                  <td className="px-4 py-3 text-xs uppercase">{d.sistema || '—'}</td>
                  <td className="px-4 py-3 font-semibold text-red-700">{fmt(d.saldo_devedor_atual)}</td>
                  <td className="px-4 py-3 text-xs">{d.taxa_juros_am ? `${(n(d.taxa_juros_am) * 100).toFixed(2)}% a.m.` : d.taxa_juros_aa ? `${(n(d.taxa_juros_aa) * 100).toFixed(2)}% a.a.` : '—'}</td>
                  <td className="px-4 py-3 text-xs">{d.prox_vencimento ? `${fmt(d.prox_valor_parcela)} em ${new Date(d.prox_vencimento + 'T12:00').toLocaleDateString('pt-BR')}` : '—'}</td>
                  <td className="px-4 py-3 text-xs">{d.n_parcelas_pagas || 0}/{d.n_parcelas_total || '—'} {n(d.parcelas_atrasadas) > 0 && <span className="text-red-600 font-bold">({d.parcelas_atrasadas} atrasada)</span>}</td>
                  <td className="px-4 py-3 text-center">{d.negociado ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-bold" title={d.condicoes_especiais || ''}>🤝 {d.desconto_obtido_pct ? `-${d.desconto_obtido_pct}%` : 'Sim'}</span> : <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3"><span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${d.status === 'ativa' ? 'bg-blue-100 text-blue-700' : d.status === 'quitada' ? 'bg-green-100 text-green-700' : d.status === 'em_atraso' ? 'bg-red-100 text-red-700' : d.status === 'renegociada' ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-500'}`}>{d.status}{Number(d.total_renegociacoes) > 0 ? ` (${d.total_renegociacoes}×)` : ''}</span></td>
                </tr>
                {/* Expand */}
                {isOpen && (
                  <tr><td colSpan={9} className="bg-gray-50/80 border-b border-gray-200 px-4 py-4">
                    <div className="flex gap-2 mb-4">
                      <button onClick={e => { e.stopPropagation(); const prox = parcelas.find(p => p.status === 'atrasada') || parcelas.find(p => p.status === 'aberta'); if (prox) { setShowPagar({ ...prox, _divida_pagas: d.n_parcelas_pagas }); setPagForm(f => ({ ...f, data_pagamento: new Date().toISOString().slice(0, 10), valor_juros_real: '', valor_mora_real: '', valor_multa_real: '' })) } else toast.error('Sem parcelas abertas') }}
                        className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium">💰 Registrar Pagamento</button>
                      <button onClick={e => { e.stopPropagation(); setShowReneg({ ...d, _reneg_novo_saldo: '', _reneg_parcelas: '', _reneg_taxa: '', _reneg_motivo: '', _reneg_responsavel: '', _reneg_protocolo: '', _reneg_condicoes: '' }) }}
                        className="px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-medium">🔄 Renegociar</button>
                    </div>
                    {/* Cronograma */}
                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Cronograma de Parcelas</h4>
                    {parcelas.length > 0 ? (
                      <table className="w-full text-xs mb-4">
                        <thead><tr className="text-gray-400"><th className="text-left pb-1">Nº</th><th className="text-left pb-1">Vencimento</th><th className="text-right pb-1">Amort.</th><th className="text-right pb-1">Juros</th><th className="text-right pb-1">Total</th><th className="text-right pb-1">Saldo</th><th className="text-left pb-1">Status</th></tr></thead>
                        <tbody>{parcelas.slice(0, 12).map(p => (
                          <tr key={p.id} className={`border-t border-gray-100 ${p.status === 'paga' ? 'bg-green-50/50' : p.status === 'aberta' && p.data_vencimento < new Date().toISOString().slice(0, 10) ? 'bg-red-50/50' : ''}`}>
                            <td className="py-1">{p.numero}</td>
                            <td className="py-1">{new Date(p.data_vencimento + 'T12:00').toLocaleDateString('pt-BR')}</td>
                            <td className="py-1 text-right">{fmt(p.valor_amortizacao)}</td>
                            <td className="py-1 text-right text-red-600">{fmt(p.valor_juros)}</td>
                            <td className="py-1 text-right font-semibold">{fmt(n(p.valor_amortizacao) + n(p.valor_juros))}</td>
                            <td className="py-1 text-right text-gray-400">{fmt(p.saldo_depois)}</td>
                            <td className="py-1">
                              <span className={`text-[9px] px-1.5 py-0.5 rounded ${p.status === 'paga' ? 'bg-green-100 text-green-700' : p.data_vencimento < new Date().toISOString().slice(0, 10) ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>{p.status === 'paga' ? '✅ Pago' : p.data_vencimento < new Date().toISOString().slice(0, 10) ? '⚠️ Atrasado' : 'Aberta'}</span>
                              {p.status === 'paga' && <button onClick={() => estornarParcela(p)} className="text-[10px] text-gray-400 hover:text-red-500 underline ml-2" title="Reverter pagamento">↩ Estornar</button>}
                            </td>
                          </tr>
                        ))}{parcelas.length > 12 && <tr><td colSpan={7} className="text-center text-gray-400 py-1">+ {parcelas.length - 12} parcelas...</td></tr>}</tbody>
                      </table>
                    ) : <p className="text-xs text-gray-400 mb-4">Sem parcelas cadastradas.</p>}
                    {/* Histórico renegociações */}
                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Histórico de Renegociações</h4>
                    {renegs.length > 0 ? (
                      <div className="space-y-2">
                        {renegs.map(r => (
                          <div key={r.id} className="bg-white rounded-lg border border-gray-100 p-3 text-xs">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-violet-700">#{r.numero_renegociacao}ª Renegociação — {r.data_acordo ? new Date(r.data_acordo + 'T12:00').toLocaleDateString('pt-BR') : '—'}</span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded ${r.status === 'ativa' ? 'bg-blue-100 text-blue-700' : r.status === 'cumprida' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{r.status}</span>
                            </div>
                            <div className="text-gray-500">Motivo: {r.motivo_descricao || r.motivo}</div>
                            <div className="flex gap-4 mt-1">
                              <span>Antes: {fmt(r.saldo_anterior)} em {r.n_parcelas_anterior}×</span>
                              <span className="text-green-700 font-semibold">Depois: {fmt(r.saldo_novo)} em {r.n_parcelas_novo}×</span>
                              {n(r.desconto_obtido) > 0 && <span className="text-green-600">Desconto: {fmt(r.desconto_obtido)}</span>}
                            </div>
                            {r.responsavel_acordo && <div className="text-gray-400 mt-0.5">Responsável: {r.responsavel_acordo} · Proto: {r.numero_protocolo || '—'}</div>}
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-xs text-gray-400">Nenhuma renegociação registrada.</p>}
                  </td></tr>
                )}
                </Fragment>
              )})}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Pagar Parcela */}
      {showPagar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowPagar(null)}>
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-brand mb-4">Registrar Pagamento — Parcela {showPagar.numero}</h3>
            <div className="space-y-3 text-sm mb-4">
              {/* Seletor de parcela */}
              <div><label className="block text-xs font-semibold text-gray-500 mb-1">Parcela a pagar *</label>
                <select value={showPagar?.id || ''} onChange={e => { const p = parcelas.find((x: any) => x.id === e.target.value); if (p) setShowPagar({ ...p, _divida_pagas: showPagar._divida_pagas }) }} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white">
                  {parcelas.filter((p: any) => p.status !== 'paga').sort((a: any, b: any) => a.numero - b.numero).map((p: any) => (
                    <option key={p.id} value={p.id}>Parcela {p.numero} — {new Date(p.data_vencimento + 'T12:00').toLocaleDateString('pt-BR')} — {fmt(n(p.valor_amortizacao) + n(p.valor_juros))}{p.status === 'atrasada' || (p.data_vencimento < new Date().toISOString().slice(0, 10) && p.status !== 'paga') ? ' ⚠️ ATRASADA' : ''}</option>
                  ))}
                </select>
                {showPagar.data_vencimento < new Date().toISOString().slice(0, 10) && showPagar.status !== 'paga' && <p className="text-xs text-amber-600 mt-1">⚠️ Parcela em atraso — confirme valores com o credor.</p>}
              </div>
              {/* Valores editáveis */}
              <div className="grid grid-cols-3 gap-2">
                <div><label className="block text-xs font-semibold text-gray-500 mb-1">Juros CDI (R$)</label><input type="number" step="0.01" value={pagForm.valor_juros_real !== '' ? pagForm.valor_juros_real : n(showPagar.valor_juros)} onChange={e => setPagForm(f => ({ ...f, valor_juros_real: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /><p className="text-[10px] text-gray-400 mt-0.5">CDI real do período</p></div>
                <div><label className="block text-xs font-semibold text-gray-500 mb-1">Mora (R$)</label><input type="number" step="0.01" value={pagForm.valor_mora_real !== '' ? pagForm.valor_mora_real : n(showPagar.juros_mora)} onChange={e => setPagForm(f => ({ ...f, valor_mora_real: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
                <div><label className="block text-xs font-semibold text-gray-500 mb-1">Multa (R$)</label><input type="number" step="0.01" value={pagForm.valor_multa_real !== '' ? pagForm.valor_multa_real : n(showPagar.multa)} onChange={e => setPagForm(f => ({ ...f, valor_multa_real: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
              </div>
              {/* Total dinâmico */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex justify-between text-sm"><span className="text-gray-600">Amortização</span><span>{fmt(showPagar.valor_amortizacao)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-600">Juros CDI</span><span className="text-red-600">{fmt(pagForm.valor_juros_real !== '' ? Number(pagForm.valor_juros_real) : n(showPagar.valor_juros))}</span></div>
                {(pagForm.valor_mora_real !== '' ? Number(pagForm.valor_mora_real) : n(showPagar.juros_mora)) > 0 && <div className="flex justify-between text-sm"><span className="text-gray-600">Mora</span><span>{fmt(pagForm.valor_mora_real !== '' ? Number(pagForm.valor_mora_real) : n(showPagar.juros_mora))}</span></div>}
                {(pagForm.valor_multa_real !== '' ? Number(pagForm.valor_multa_real) : n(showPagar.multa)) > 0 && <div className="flex justify-between text-sm"><span className="text-gray-600">Multa</span><span>{fmt(pagForm.valor_multa_real !== '' ? Number(pagForm.valor_multa_real) : n(showPagar.multa))}</span></div>}
                <div className="flex justify-between font-bold text-sm border-t pt-2 mt-2"><span>Total a pagar</span><span className="text-brand">{fmt(n(showPagar.valor_amortizacao) + (pagForm.valor_juros_real !== '' ? Number(pagForm.valor_juros_real) : n(showPagar.valor_juros)) + (pagForm.valor_mora_real !== '' ? Number(pagForm.valor_mora_real) : n(showPagar.juros_mora)) + (pagForm.valor_multa_real !== '' ? Number(pagForm.valor_multa_real) : n(showPagar.multa)))}</span></div>
              </div>
              <div><label className="block text-xs font-semibold text-gray-500 mb-1">Data pagamento</label><input type="date" value={pagForm.data_pagamento} onChange={e => setPagForm(f => ({ ...f, data_pagamento: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
              <div><label className="block text-xs font-semibold text-gray-500 mb-1">Conta</label><select value={pagForm.conta_id} onChange={e => setPagForm(f => ({ ...f, conta_id: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"><option value="">Selecionar...</option>{contas.map((c: any) => <option key={c.id} value={c.id}>{c.banco ? `${c.banco} — ` : ''}{c.nome}</option>)}</select></div>
              <div className="text-[10px] text-amber-600 bg-amber-50 p-2 rounded">Gera 2 lançamentos: juros (despesa DRE) + amortização (reduz passivo).</div>
            </div>
            <div className="flex gap-2"><button onClick={() => setShowPagar(null)} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm">Cancelar</button><button onClick={pagarParcela} disabled={saving} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">{saving ? 'Salvando...' : 'Confirmar Pagamento'}</button></div>
          </div>
        </div>
      )}

      {/* Modal Renegociar */}
      {showReneg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowReneg(null)}>
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-brand mb-1">Renegociar Dívida</h3>
            <p className="text-xs text-gray-400 mb-4">{showReneg.descricao} · Saldo: {fmt(showReneg.saldo_devedor_atual)}</p>
            <div className="bg-gray-50 rounded-lg p-3 mb-4 text-xs">
              <div className="font-bold text-gray-500 mb-1">Termos Anteriores</div>
              <div>Saldo: {fmt(showReneg.saldo_devedor_atual)} · Parcelas restantes: {showReneg.n_parcelas_abertas} · Taxa: {showReneg.taxa_juros_am ? `${(n(showReneg.taxa_juros_am)*100).toFixed(2)}% a.m.` : '—'}</div>
            </div>
            <div className="space-y-3 mb-4">
              <div><label className="block text-xs font-semibold text-gray-500 mb-1">Motivo</label><input value={showReneg._reneg_motivo || ''} onChange={e => setShowReneg((s: any) => ({ ...s, _reneg_motivo: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Ex: Dificuldade financeira" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold text-gray-500 mb-1">Novo saldo (R$)</label><input type="number" step="0.01" value={showReneg._reneg_novo_saldo || ''} onChange={e => setShowReneg((s: any) => ({ ...s, _reneg_novo_saldo: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
                <div><label className="block text-xs font-semibold text-gray-500 mb-1">Novas parcelas</label><input type="number" value={showReneg._reneg_parcelas || ''} onChange={e => setShowReneg((s: any) => ({ ...s, _reneg_parcelas: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold text-gray-500 mb-1">Nova taxa (% a.m.)</label><input type="number" step="0.01" value={showReneg._reneg_taxa || ''} onChange={e => setShowReneg((s: any) => ({ ...s, _reneg_taxa: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder={showReneg.taxa_juros_am ? `${(n(showReneg.taxa_juros_am)*100).toFixed(2)}` : ''} /></div>
                <div><label className="block text-xs font-semibold text-gray-500 mb-1">Responsável no credor</label><input value={showReneg._reneg_responsavel || ''} onChange={e => setShowReneg((s: any) => ({ ...s, _reneg_responsavel: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
              </div>
              <div><label className="block text-xs font-semibold text-gray-500 mb-1">Condições especiais</label><textarea value={showReneg._reneg_condicoes || ''} onChange={e => setShowReneg((s: any) => ({ ...s, _reneg_condicoes: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" rows={2} placeholder="Ex: Multa reduzida de 10% para 2%..." /></div>
              {showReneg._reneg_novo_saldo && n(showReneg._reneg_novo_saldo) < n(showReneg.saldo_devedor_atual) && (
                <div className="bg-green-50 rounded-lg p-2 text-xs text-green-700">
                  Desconto: {fmt(n(showReneg.saldo_devedor_atual) - n(showReneg._reneg_novo_saldo))} ({Math.round((1 - n(showReneg._reneg_novo_saldo) / n(showReneg.saldo_devedor_atual)) * 100)}%)
                </div>
              )}
            </div>
            <div className="flex gap-2"><button onClick={() => setShowReneg(null)} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm">Cancelar</button><button onClick={confirmarRenegociacao} disabled={saving || !showReneg._reneg_novo_saldo} className="flex-1 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">{saving ? 'Salvando...' : 'Confirmar Renegociação'}</button></div>
          </div>
        </div>
      )}

      {/* Info */}
      <details className="mt-6 text-[9px] text-gray-400">
        <summary className="cursor-pointer font-semibold">Como interpretar</summary>
        <div className="mt-2 space-y-1">
          <p><strong>PRICE vs SAC:</strong> PRICE = parcelas fixas. SAC = parcelas decrescentes (menos juros total).</p>
          <p><strong>Amortização vs Juros:</strong> Juros são despesa no DRE. Amortização é pagamento de passivo (não aparece no DRE).</p>
          <p><strong>Cobertura de Juros {'>'} 3×:</strong> O resultado cobre 3× as despesas financeiras — saudável.</p>
        </div>
      </details>
    </>
  )
}
