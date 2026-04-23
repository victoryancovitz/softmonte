'use client'
import { useState, Fragment } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { confirmDialog } from '@/components/ui/ConfirmDialog'
import { gerarTabelaAmortizacao } from '@/lib/dividas'
import EmptyState from '@/components/ui/EmptyState'
import { Landmark, AlertTriangle } from 'lucide-react'
import { fmt } from '@/lib/cores'
import { PASSIVO_TIPO, DIVIDA_TIPO, CREDOR_TIPO, SISTEMA_AMORTIZACAO } from '@/lib/enums/financeiro'
const n = (v: any) => Number(v || 0)

const TIPO_LABEL: Record<string, string> = { ...DIVIDA_TIPO }

const CREDOR_BADGE: Record<string, { icon: string; cls: string }> = {
  banco: { icon: '🏦', cls: 'bg-blue-100 text-blue-700' },
  cartorio: { icon: '📜', cls: 'bg-amber-100 text-amber-700' },
  fornecedor: { icon: '🏢', cls: 'bg-green-100 text-green-700' },
  fisco: { icon: '🏛️', cls: 'bg-violet-100 text-violet-700' },
  socio: { icon: '👤', cls: 'bg-gray-100 text-gray-600' },
  outro: { icon: '📋', cls: 'bg-gray-100 text-gray-600' },
}

export default function DividasClient({ dividas, indicadores, contas, fornecedores, centros }: { dividas: any[]; indicadores: any; contas: any[]; fornecedores?: any[]; centros?: any[] }) {
  const supabase = createClient()
  const toast = useToast()
  const [showNova, setShowNova] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filtroCredor, setFiltroCredor] = useState('')
  const [expandId, setExpandId] = useState<string | null>(null)
  const [showPagar, setShowPagar] = useState<any>(null) // parcela selecionada
  const [showReneg, setShowReneg] = useState<any>(null) // dívida para renegociar
  const [confirmandoExclusao, setConfirmandoExclusao] = useState<any>(null)
  const [showEditar, setShowEditar] = useState<any>(null)
  const [editForm, setEditForm] = useState({ descricao: '', banco_credor: '', numero_contrato: '', finalidade: '', observacao: '', saldo_devedor_atual: '' })
  const [parcelas, setParcelas] = useState<any[]>([])
  const [renegs, setRenegs] = useState<any[]>([])
  const [pagForm, setPagForm] = useState({ data_pagamento: new Date().toISOString().slice(0, 10), conta_id: '', valor_juros_real: '' as string, valor_mora_real: '' as string, valor_multa_real: '' as string })
  const [form, setForm] = useState({
    descricao: '', tipo: 'financiamento' as string, tipo_divida: 'refinanciamento' as string,
    credor_tipo: 'banco' as string, fornecedor_id: '' as string,
    banco_credor: '', numero_contrato: '',
    valor_parcela: '', n_parcelas: '36', n_parcelas_pagas: '0',
    modo_data: 'nova' as 'nova' | 'andamento', // nova = todas em aberto, andamento = já pagou algumas
    data_primeiro_venc: '', data_proxima_aberto: '', // data_proxima_aberto = modo andamento
    taxa_juros_am: '', sistema: 'price' as 'price' | 'sac' | 'bullet',
    conta_debito_id: '', conta_credito_id: '',
    centro_custo_id: '',
    finalidade: '', garantia: '', observacao: '',
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

  // Valores derivados
  const valorParcela = Number(form.valor_parcela) || 0
  const nTotal = Number(form.n_parcelas) || 0
  const nPagas = form.modo_data === 'nova' ? 0 : (Number(form.n_parcelas_pagas) || 0)
  const nRestantes = Math.max(0, nTotal - nPagas)
  const valorTotal = valorParcela * nTotal
  const saldoDevedor = valorParcela * nRestantes

  // Calcular data_primeiro_venc real (retroativo se modo andamento)
  const dataPrimeiroVencCalc = (() => {
    if (form.modo_data === 'nova') return form.data_primeiro_venc
    if (!form.data_proxima_aberto || nPagas <= 0) return form.data_proxima_aberto
    const d = new Date(form.data_proxima_aberto + 'T12:00')
    d.setMonth(d.getMonth() - nPagas)
    return d.toISOString().slice(0, 10)
  })()

  // Preview amortização (usado quando tem juros, senão parcelas simples)
  const temJuros = Number(form.taxa_juros_am) > 0
  const dataParaPreview = dataPrimeiroVencCalc || form.data_primeiro_venc || form.data_proxima_aberto
  const previewParcelas = temJuros && form.valor_parcela && form.n_parcelas && dataParaPreview
    ? gerarTabelaAmortizacao({
        valor: saldoDevedor > 0 ? saldoDevedor : valorTotal,
        taxaMensal: Number(form.taxa_juros_am) / 100,
        nParcelas: nRestantes > 0 ? nRestantes : nTotal,
        dataInicio: dataParaPreview,
        sistema: form.sistema,
      })
    : []
  const totalJurosPreview = previewParcelas.reduce((s, p) => s + p.valor_juros, 0)

  // Sanitizar numero_contrato
  function sanitizarContrato(v: string): string {
    return v.replace(/^n[°º.]\s*/i, '').replace(/\s+/g, '').trim()
  }

  async function salvarDivida() {
    // Validação
    const erros: string[] = []
    if (!form.descricao.trim()) erros.push('Descrição obrigatória')
    if (!form.fornecedor_id) erros.push('Selecione um credor')
    if (!valorParcela || valorParcela <= 0) erros.push('Valor da parcela > 0')
    if (!nTotal || nTotal < 1) erros.push('Total de parcelas ≥ 1')
    if (form.modo_data === 'andamento' && nPagas <= 0) erros.push('Informe quantas parcelas já foram pagas')
    if (nPagas >= nTotal) erros.push('Parcelas pagas deve ser menor que o total')
    if (form.modo_data === 'nova' && !form.data_primeiro_venc) erros.push('Data do primeiro vencimento obrigatória')
    if (form.modo_data === 'andamento' && !form.data_proxima_aberto) erros.push('Data da próxima parcela obrigatória')
    if (!dataPrimeiroVencCalc) erros.push('Não foi possível calcular a data do primeiro vencimento')
    if (!form.conta_debito_id) erros.push('Selecione a conta de débito (de onde sai o dinheiro)')
    if (erros.length > 0) { toast.error(erros.join('. ')); return }

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const taxaAm = Number(form.taxa_juros_am || 0) / 100
    const taxaAa = taxaAm > 0 ? Math.pow(1 + taxaAm, 12) - 1 : 0
    const dataVencFinal = dataPrimeiroVencCalc!
    const diaVenc = new Date(dataVencFinal + 'T12:00').getDate()

    // Calcular último vencimento
    const dtPrimeiro = new Date(dataVencFinal + 'T12:00')
    const dtUltimo = new Date(dtPrimeiro)
    dtUltimo.setMonth(dtUltimo.getMonth() + nTotal - 1)
    const dataUltimoVenc = dtUltimo.toISOString().slice(0, 10)

    // Fornecedor nome para campo banco_credor
    const fornNome = form.banco_credor || (fornecedores ?? []).find((f: any) => f.id === form.fornecedor_id)?.nome || ''
    const contratoSanitizado = sanitizarContrato(form.numero_contrato)

    // 1. INSERT master (trigger cria dívida-espelho automaticamente)
    const { data: passivo, error: err1 } = await supabase.from('passivos_nao_circulantes').insert({
      descricao: form.descricao.trim(),
      tipo: form.tipo || 'financiamento',
      tipo_divida: form.tipo_divida,
      credor_tipo: form.credor_tipo,
      fornecedor_id: form.fornecedor_id || null,
      banco_credor: fornNome,
      numero_contrato: contratoSanitizado || null,
      sistema: form.sistema,
      status: 'ativa',
      valor_principal: valorTotal,
      valor_total: valorTotal,
      valor_parcela: valorParcela,
      saldo_devedor: saldoDevedor,
      saldo_devedor_atual: saldoDevedor,
      n_parcelas_total: nTotal,
      n_parcelas_pagas: nPagas,
      taxa_juros_am: taxaAm > 0 ? taxaAm : null,
      taxa_juros_aa: taxaAa > 0 ? taxaAa : null,
      dia_vencimento: diaVenc,
      data_primeiro_venc: dataVencFinal,
      data_ultimo_venc: dataUltimoVenc,
      data_inicio: dataVencFinal,
      data_vencimento: dataUltimoVenc,
      data_contratacao: new Date().toISOString().slice(0, 10),
      conta_credito_id: form.conta_credito_id || null,
      centro_custo_id: form.centro_custo_id || null,
      finalidade: form.finalidade || null,
      garantia: form.garantia || null,
      observacao: form.observacao || null,
      negociado: form.negociado,
      desconto_obtido_valor: form.desconto_obtido_valor ? Number(form.desconto_obtido_valor) : null,
      condicoes_especiais: form.condicoes_especiais || null,
      responsavel_negociacao: form.responsavel_negociacao || null,
      created_by: user?.id,
    }).select().single()
    if (err1 || !passivo) { toast.error('Erro: ' + (err1?.message || 'desconhecido')); setSaving(false); return }

    // 2. Chamar RPC para gerar parcelas (a trigger já criou a dívida-espelho)
    const { data: res, error: errParc } = await supabase.rpc('gerar_divida_parcelas', { p_passivo_id: passivo.id })
    if (errParc) {
      toast.warning(`Passivo salvo mas parcelas não foram geradas: ${errParc.message}`)
      setSaving(false); setShowNova(false); return
    }

    const parcelasCriadas = res?.parcelas_criadas ?? nTotal
    const parcelasPagas = res?.n_pagas ?? nPagas

    // 3. Gerar lançamentos automaticamente para as parcelas em aberto
    const { data: resLanc } = await supabase.rpc('materializar_lancamentos_divida', {
      p_passivo_id: passivo.id,
      p_conta_pagadora_id: form.conta_debito_id || null,
      p_centro_custo_id: form.centro_custo_id || null,
      p_forma_pagamento: null,
      p_origem: 'divida_parcela',
    })
    const lancCriados = resLanc?.lancamentos_criados ?? 0

    toast.success(`Dívida cadastrada. ${parcelasCriadas} parcelas (${parcelasPagas} pagas). ${lancCriados} lançamentos gerados.`)
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
    if (!await confirmDialog({ title: 'Reverter pagamento?', message: `Reverter pagamento da parcela ${p.numero}? Isso desfaz os lançamentos e marca como não paga.`, variant: 'warning', confirmLabel: 'Reverter' })) return
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

  async function excluirDivida(d: any) {
    setSaving(true)
    const agora = new Date().toISOString()
    // 1. Soft-delete da dívida (sem deleted_by — campo não existe)
    const { error: e1 } = await supabase.from('passivos_nao_circulantes').update({ deleted_at: agora, status: 'cancelada' }).eq('id', d.id)
    if (e1) { toast.error('Erro ao excluir: ' + e1.message); setSaving(false); return }
    // 2. Cancelar parcelas em aberto/atrasadas
    await supabase.from('divida_parcelas').update({ status: 'cancelada' }).eq('divida_id', d.id).in('status', ['aberta', 'atrasada', 'pendente'])
    // 3. Soft-delete apenas lançamentos em_aberto vinculados às parcelas
    const { data: parcsComLanc } = await supabase.from('divida_parcelas').select('lancamento_id').eq('divida_id', d.id).not('lancamento_id', 'is', null)
    const lancIds = (parcsComLanc ?? []).map((p: any) => p.lancamento_id).filter(Boolean)
    if (lancIds.length > 0) {
      await supabase.from('financeiro_lancamentos').update({ deleted_at: agora }).in('id', lancIds).eq('status', 'em_aberto')
    }
    toast.success(`Dívida "${d.descricao}" excluída.`)
    setConfirmandoExclusao(null); setSaving(false)
    window.location.reload()
  }

  function abrirEditar(d: any) {
    setEditForm({ descricao: d.descricao || '', banco_credor: d.banco_credor || d.credor_display || '', numero_contrato: d.numero_contrato || '', finalidade: d.finalidade || '', observacao: d.observacao || '', saldo_devedor_atual: String(d.saldo_devedor_atual || '') })
    setShowEditar(d)
  }

  async function salvarEdicao() {
    if (!showEditar) return
    setSaving(true)
    const { error } = await supabase.from('passivos_nao_circulantes').update({
      descricao: editForm.descricao.trim(), banco_credor: editForm.banco_credor.trim() || null,
      numero_contrato: editForm.numero_contrato.trim() || null, finalidade: editForm.finalidade.trim() || null,
      observacao: editForm.observacao.trim() || null,
      saldo_devedor_atual: parseFloat(editForm.saldo_devedor_atual) || showEditar.saldo_devedor_atual,
      saldo_devedor: parseFloat(editForm.saldo_devedor_atual) || showEditar.saldo_devedor_atual,
    }).eq('id', showEditar.id)
    if (error) { toast.error('Erro: ' + error.message); setSaving(false); return }
    toast.success('Dívida atualizada.')
    setShowEditar(null); setSaving(false)
    window.location.reload()
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

          {/* SEÇÃO 1: Identificação */}
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Identificação</p>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
            <div><label className="block text-xs font-semibold text-gray-500 mb-1">Nº do processo / contrato</label>
              <input value={form.numero_contrato} onChange={e => setForm(f => ({ ...f, numero_contrato: e.target.value }))}
                onBlur={e => setForm(f => ({ ...f, numero_contrato: sanitizarContrato(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="1112184-33.2024.8.26.0100" />
              <div className="text-[10px] text-gray-400 mt-0.5">Apenas números e pontos.</div></div>
            <div className="col-span-2"><label className="block text-xs font-semibold text-gray-500 mb-1">Descrição curta (como aparece na listagem) *</label>
              <input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Refinanciamento Daycoval, Acordo Adtech, Parcelamento INSS..." /></div>
            <div><label className="block text-xs font-semibold text-gray-500 mb-1">Credor *</label>
              <select value={form.fornecedor_id} onChange={e => {
                const forn = (fornecedores ?? []).find((f: any) => f.id === e.target.value)
                setForm(f => ({ ...f, fornecedor_id: e.target.value, banco_credor: forn?.nome || f.banco_credor }))
              }} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                <option value="">Selecione o credor...</option>
                {(fornecedores ?? []).map((f: any) => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select></div>
            <div><label className="block text-xs font-semibold text-gray-500 mb-1">Tipo de credor</label>
              <select value={form.credor_tipo} onChange={e => setForm(f => ({ ...f, credor_tipo: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                {Object.entries(CREDOR_TIPO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></div>
          </div>

          {/* SEÇÃO 2: Classificação */}
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Classificação</p>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
            <div><label className="block text-xs font-semibold text-gray-500 mb-1">Tipo *</label>
              <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                {Object.entries(PASSIVO_TIPO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></div>
            <div><label className="block text-xs font-semibold text-gray-500 mb-1">Subtipo / Natureza *</label>
              <select value={form.tipo_divida} onChange={e => setForm(f => ({ ...f, tipo_divida: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                {Object.entries(DIVIDA_TIPO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></div>
            <div><label className="block text-xs font-semibold text-gray-500 mb-1">Sistema de amortização</label>
              <select value={form.sistema} onChange={e => setForm(f => ({ ...f, sistema: e.target.value as any }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                {Object.entries(SISTEMA_AMORTIZACAO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></div>
          </div>

          {/* SEÇÃO 3: Valores e parcelamento */}
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Valores e Parcelamento</p>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
            <div><label className="block text-xs font-semibold text-gray-500 mb-1">Valor da parcela mensal *</label>
              <input type="number" step="0.01" value={form.valor_parcela} onChange={e => setForm(f => ({ ...f, valor_parcela: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="8807,97" /></div>
            <div><label className="block text-xs font-semibold text-gray-500 mb-1">Total de parcelas do plano *</label>
              <input type="number" value={form.n_parcelas} onChange={e => setForm(f => ({ ...f, n_parcelas: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="36" />
              <div className="text-[10px] text-gray-400 mt-0.5">Total no plano inteiro, mesmo se já pagou algumas.</div></div>
            {form.modo_data === 'andamento' && (
              <div><label className="block text-xs font-semibold text-gray-500 mb-1">Parcelas já pagas *</label>
                <input type="number" value={form.n_parcelas_pagas} onChange={e => setForm(f => ({ ...f, n_parcelas_pagas: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="10" />
                <div className="text-[10px] text-gray-400 mt-0.5">Quantas já foram pagas ANTES de cadastrar aqui.</div></div>
            )}
          </div>
          {/* Preview valores */}
          {valorParcela > 0 && nTotal > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-5 grid grid-cols-3 gap-3 text-center">
              <div><div className="text-[10px] text-blue-600 font-bold uppercase">Valor total do plano</div><div className="text-sm font-bold text-blue-800">{fmt(valorTotal)}</div></div>
              <div><div className="text-[10px] text-blue-600 font-bold uppercase">Saldo devedor</div><div className="text-sm font-bold text-blue-800">{fmt(saldoDevedor)}</div></div>
              <div><div className="text-[10px] text-blue-600 font-bold uppercase">Parcelas restantes</div><div className="text-sm font-bold text-blue-800">{nRestantes}</div></div>
            </div>
          )}

          {/* SEÇÃO 4: Datas e pagamento */}
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Datas e Pagamento</p>

          {/* Radio: dívida nova vs em andamento */}
          <div className="flex gap-4 mb-3">
            <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer ${form.modo_data === 'nova' ? 'border-brand bg-brand/5 text-brand font-semibold' : 'border-gray-200 text-gray-500'}`}>
              <input type="radio" checked={form.modo_data === 'nova'} onChange={() => setForm(f => ({ ...f, modo_data: 'nova', n_parcelas_pagas: '0' }))} className="accent-brand" />
              Dívida nova (vou pagar todas)
            </label>
            <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer ${form.modo_data === 'andamento' ? 'border-brand bg-brand/5 text-brand font-semibold' : 'border-gray-200 text-gray-500'}`}>
              <input type="radio" checked={form.modo_data === 'andamento'} onChange={() => setForm(f => ({ ...f, modo_data: 'andamento' }))} className="accent-brand" />
              Dívida em andamento (já paguei algumas)
            </label>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
            {form.modo_data === 'nova' ? (
              <div><label className="block text-xs font-semibold text-gray-500 mb-1">Vencimento da 1ª parcela *</label>
                <input type="date" value={form.data_primeiro_venc} onChange={e => setForm(f => ({ ...f, data_primeiro_venc: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                <div className="text-[10px] text-gray-400 mt-0.5">Quando vence a parcela 1/{nTotal}.</div></div>
            ) : (
              <div><label className="block text-xs font-semibold text-gray-500 mb-1">Próxima parcela vence em *</label>
                <input type="date" value={form.data_proxima_aberto} onChange={e => setForm(f => ({ ...f, data_proxima_aberto: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                <div className="text-[10px] text-gray-400 mt-0.5">Data da primeira parcela que você <strong>ainda vai pagar</strong>.</div></div>
            )}
            <div><label className="block text-xs font-semibold text-gray-500 mb-1">Conta de onde será PAGO *</label>
              <select value={form.conta_debito_id} onChange={e => setForm(f => ({ ...f, conta_debito_id: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                <option value="">Selecione a conta...</option>{contas.map(c => <option key={c.id} value={c.id}>{c.banco ? `${c.banco} — ` : ''}{c.nome}</option>)}</select>
              <div className="text-[10px] text-gray-400 mt-0.5">De qual conta sai o dinheiro.</div></div>
            <div><label className="block text-xs font-semibold text-gray-500 mb-1">Centro de custo</label>
              <select value={form.centro_custo_id} onChange={e => setForm(f => ({ ...f, centro_custo_id: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                <option value="">Selecione...</option>{(centros ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.codigo} — {c.nome}</option>)}</select></div>
          </div>

          {/* Preview cronograma */}
          {dataPrimeiroVencCalc && nTotal > 0 && (
            <div className="bg-gray-50 rounded-lg p-3 mb-5 text-xs space-y-1">
              {nPagas > 0 && (
                <>
                  <div className="text-gray-400">Parcela 1 (paga): <strong>{new Date(dataPrimeiroVencCalc + 'T12:00').toLocaleDateString('pt-BR')}</strong></div>
                  <div className="text-gray-400">Parcela {nPagas} (paga): <strong>{(() => { const d = new Date(dataPrimeiroVencCalc + 'T12:00'); d.setMonth(d.getMonth() + nPagas - 1); return d.toLocaleDateString('pt-BR') })()}</strong></div>
                </>
              )}
              <div className="text-brand font-semibold">
                ➜ Próxima em aberto (parcela {nPagas + 1}): <strong>{(() => { const d = new Date(dataPrimeiroVencCalc + 'T12:00'); d.setMonth(d.getMonth() + nPagas); return d.toLocaleDateString('pt-BR') })()}</strong>
              </div>
              <div className="text-gray-400">Última parcela ({nTotal}): <strong>{(() => { const d = new Date(dataPrimeiroVencCalc + 'T12:00'); d.setMonth(d.getMonth() + nTotal - 1); return d.toLocaleDateString('pt-BR') })()}</strong></div>
            </div>
          )}

          {/* SEÇÃO 5: Taxas (accordion) */}
          <details className="mb-4">
            <summary className="text-[10px] font-bold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600">Taxas e Detalhes (opcional)</summary>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
              <div><label className="block text-xs font-semibold text-gray-500 mb-1">Taxa Juros (% a.m.)</label>
                <input type="number" step="0.01" value={form.taxa_juros_am} onChange={e => setForm(f => ({ ...f, taxa_juros_am: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="1.80" />
                {form.taxa_juros_am && <div className="text-[10px] text-gray-400 mt-0.5">{((Math.pow(1 + Number(form.taxa_juros_am) / 100, 12) - 1) * 100).toFixed(2)}% a.a.</div>}</div>
              <div><label className="block text-xs font-semibold text-gray-500 mb-1">Conta onde entrou o empréstimo</label>
                <select value={form.conta_credito_id} onChange={e => setForm(f => ({ ...f, conta_credito_id: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                  <option value="">Nenhuma</option>{contas.map(c => <option key={c.id} value={c.id}>{c.banco ? `${c.banco} — ` : ''}{c.nome}</option>)}</select>
                <div className="text-[10px] text-gray-400 mt-0.5">Só preencher se gerou entrada de caixa.</div></div>
              <div><label className="block text-xs font-semibold text-gray-500 mb-1">Observação</label>
                <textarea value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none" /></div>
            </div>
          </details>

          {/* Preview tabela amortização (só se tem juros) */}
          {previewParcelas.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <div className="text-xs font-bold text-gray-500 mb-2">Tabela de amortização: {previewParcelas.length} parcelas · Juros total: {fmt(totalJurosPreview)}</div>
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
                      <button onClick={e => { e.stopPropagation(); abrirEditar(d) }}
                        className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200">✏️ Editar</button>
                      <button onClick={e => { e.stopPropagation(); setShowReneg({ ...d, _reneg_novo_saldo: '', _reneg_parcelas: '', _reneg_taxa: '', _reneg_motivo: '', _reneg_responsavel: '', _reneg_protocolo: '', _reneg_condicoes: '' }) }}
                        className="px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-medium">🔄 Renegociar</button>
                      <button onClick={e => { e.stopPropagation(); setConfirmandoExclusao(d) }}
                        className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-medium hover:bg-red-100 ml-auto">🗑 Excluir</button>
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
      {/* Modal Excluir Dívida */}
      {confirmandoExclusao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <div className="text-center mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3"><span className="text-2xl">⚠️</span></div>
              <h3 className="text-base font-bold text-gray-900">Excluir dívida?</h3>
              <p className="text-sm text-gray-500 mt-2"><strong>{confirmandoExclusao.descricao}</strong></p>
              <p className="text-xs text-gray-400 mt-1">Saldo devedor: {fmt(confirmandoExclusao.saldo_devedor_atual)}</p>
            </div>
            {(() => {
              const pagas = parcelas.filter(p => p.status === 'paga').length
              const abertas = parcelas.filter(p => p.status === 'aberta' || p.status === 'atrasada' || p.status === 'pendente').length
              return (
                <div className="space-y-1.5 mb-4">
                  {pagas > 0 && <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs">🔒 {pagas} parcela(s) já paga(s) — mantidas no histórico financeiro</div>}
                  {abertas > 0 && <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs">❌ {abertas} parcela(s) em aberto — serão canceladas</div>}
                  {pagas === 0 && abertas === 0 && <div className="text-xs text-gray-400">Sem parcelas carregadas — expanda a dívida antes de excluir para ver o impacto.</div>}
                </div>
              )
            })()}
            <div className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3 mb-5">Esta ação não pode ser desfeita. A dívida será removida do painel.</div>
            <div className="flex gap-3">
              <button onClick={() => excluirDivida(confirmandoExclusao)} disabled={saving} className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 disabled:opacity-50">{saving ? 'Excluindo...' : 'Sim, excluir'}</button>
              <button onClick={() => setConfirmandoExclusao(null)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Dívida */}
      {showEditar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
            <h3 className="text-base font-bold text-brand mb-5">✏️ Editar dívida</h3>
            <div className="space-y-3">
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">Descrição *</label><input value={editForm.descricao} onChange={e => setEditForm(f => ({ ...f, descricao: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand focus:outline-none" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold text-gray-600 mb-1">Banco/Credor</label><input value={editForm.banco_credor} onChange={e => setEditForm(f => ({ ...f, banco_credor: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" /></div>
                <div><label className="block text-xs font-semibold text-gray-600 mb-1">Nº do Contrato</label><input value={editForm.numero_contrato} onChange={e => setEditForm(f => ({ ...f, numero_contrato: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" /></div>
              </div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">Saldo Devedor Atual (R$)</label><input type="number" step="0.01" value={editForm.saldo_devedor_atual} onChange={e => setEditForm(f => ({ ...f, saldo_devedor_atual: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" /><p className="text-[10px] text-gray-400 mt-1">Use para corrigir o saldo após atualização do credor</p></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">Finalidade</label><input value={editForm.finalidade} onChange={e => setEditForm(f => ({ ...f, finalidade: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" /></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">Observação</label><textarea rows={3} value={editForm.observacao} onChange={e => setEditForm(f => ({ ...f, observacao: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none" /></div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={salvarEdicao} disabled={saving || !editForm.descricao.trim()} className="flex-1 py-2.5 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar alterações'}</button>
              <button onClick={() => setShowEditar(null)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
