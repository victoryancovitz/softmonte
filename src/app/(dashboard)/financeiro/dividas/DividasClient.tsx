'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { gerarTabelaAmortizacao } from '@/lib/dividas'
import EmptyState from '@/components/ui/EmptyState'
import { Landmark, AlertTriangle } from 'lucide-react'

const fmt = (v: any) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const n = (v: any) => Number(v || 0)

const TIPO_LABEL: Record<string, string> = {
  emprestimo_capital_giro: 'Capital de Giro', financiamento_equipamento: 'Financiamento',
  antecipacao_recebiveis: 'Antecipação', cartao_empresarial: 'Cartão', mutuo_socio: 'Mútuo Sócio',
  leasing: 'Leasing', debenture: 'Debênture', outros: 'Outros',
}

export default function DividasClient({ dividas, indicadores, contas }: { dividas: any[]; indicadores: any; contas: any[] }) {
  const supabase = createClient()
  const toast = useToast()
  const [showNova, setShowNova] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    descricao: '', tipo_divida: 'emprestimo_capital_giro', banco_credor: '', numero_contrato: '',
    valor_principal: '', taxa_juros_am: '', sistema: 'price' as 'price' | 'sac' | 'bullet',
    n_parcelas: '12', data_primeiro_venc: '', dia_vencimento: '', finalidade: '', garantia: '',
    conta_credito_id: '', valor_desembolsado: '',
  })

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
      descricao: form.descricao, tipo_divida: form.tipo_divida, banco_credor: form.banco_credor,
      numero_contrato: form.numero_contrato, sistema: form.sistema, status: 'ativa',
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

      {/* Botão nova dívida */}
      <div className="flex justify-end mb-4">
        <button onClick={() => setShowNova(true)} className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark">+ Nova Dívida</button>
      </div>

      {/* Modal nova dívida */}
      {showNova && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
          <h3 className="text-sm font-bold text-brand mb-4">Cadastrar Nova Dívida</h3>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            <div className="col-span-2"><label className="block text-xs font-semibold text-gray-500 mb-1">Descrição *</label>
              <input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Ex: Capital de giro — BV Financeira" /></div>
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
      {dividas.length === 0 ? (
        <EmptyState titulo="Nenhuma dívida cadastrada" descricao="Cadastre empréstimos e financiamentos para controlar parcelas e juros." icone={<Landmark className="w-10 h-10" />} />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 border-b border-gray-100">
              {['Credor', 'Tipo', 'Sistema', 'Saldo Devedor', 'Taxa', 'Próx. Parcela', 'Parcelas', 'Status'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {dividas.map(d => (
                <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3"><div className="font-medium">{d.banco_credor || d.descricao}</div><div className="text-[10px] text-gray-400">{d.descricao}</div></td>
                  <td className="px-4 py-3 text-xs">{TIPO_LABEL[d.tipo_divida] || d.tipo_divida || '—'}</td>
                  <td className="px-4 py-3 text-xs uppercase">{d.sistema || '—'}</td>
                  <td className="px-4 py-3 font-semibold text-red-700">{fmt(d.saldo_devedor_atual)}</td>
                  <td className="px-4 py-3 text-xs">{d.taxa_juros_am ? `${(n(d.taxa_juros_am) * 100).toFixed(2)}% a.m.` : d.taxa_juros_aa ? `${(n(d.taxa_juros_aa) * 100).toFixed(2)}% a.a.` : '—'}</td>
                  <td className="px-4 py-3 text-xs">{d.prox_vencimento ? `${fmt(d.prox_valor_parcela)} em ${new Date(d.prox_vencimento + 'T12:00').toLocaleDateString('pt-BR')}` : '—'}</td>
                  <td className="px-4 py-3 text-xs">{d.n_parcelas_pagas || 0}/{d.n_parcelas_total || '—'} {n(d.parcelas_atrasadas) > 0 && <span className="text-red-600 font-bold">({d.parcelas_atrasadas} atrasada)</span>}</td>
                  <td className="px-4 py-3"><span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${d.status === 'ativa' ? 'bg-blue-100 text-blue-700' : d.status === 'quitada' ? 'bg-green-100 text-green-700' : d.status === 'em_atraso' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>{d.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
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
