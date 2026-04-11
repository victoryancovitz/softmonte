'use client'
import { useState } from 'react'
import { TrendingUp, Users, ChevronDown, ChevronUp } from 'lucide-react'

const MESES = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const fmt = (v: number | null) => v != null ? Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'
const pct = (v: number, base: number) => base > 0 ? `${(v / base * 100).toFixed(1)}%` : '—'

const statusColor: Record<string, string> = {
  verde: 'bg-green-100 text-green-700', amarelo: 'bg-amber-100 text-amber-700',
  vermelho: 'bg-red-100 text-red-700', ok: 'bg-green-100 text-green-700',
  atencao: 'bg-amber-100 text-amber-700', critico: 'bg-red-100 text-red-700',
}

type Tab = 'margem' | 'dre' | 'oficial' | 'bp' | 'dfc'

export default function DreClient({ dre, dreMes, custos, lancamentos, empresa, contasSaldo }: {
  dre: any[]; dreMes: any[]; custos: any[]; lancamentos: any[]; empresa: any; contasSaldo: any[]
}) {
  const [expandido, setExpandido] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('margem')

  // DRE consolidado por mês (aba "DRE Consolidado")
  const dreByMes: Record<string, { mes: string; receita: number; custoMO: number; outrasDesp: number; provisoes: number }> = {}
  lancamentos.forEach((l: any) => {
    const mes = l.data_competencia?.slice(0, 7) ?? 'sem-data'
    if (!dreByMes[mes]) dreByMes[mes] = { mes, receita: 0, custoMO: 0, outrasDesp: 0, provisoes: 0 }
    const v = Number(l.valor || 0)
    if (l.tipo === 'receita') dreByMes[mes].receita += v
    else if (l.is_provisao) dreByMes[mes].provisoes += v
    else if (l.categoria === 'Folha de Pagamento' || l.origem === 'folha_fechamento') dreByMes[mes].custoMO += v
    else dreByMes[mes].outrasDesp += v
  })
  const dreMeses = Object.values(dreByMes).sort((a, b) => a.mes.localeCompare(b.mes))

  // === DRE OFICIAL: classificar lançamentos ===
  const receitaBruta = lancamentos.filter((l: any) => l.tipo === 'receita' && !l.is_provisao).reduce((s: number, l: any) => s + Number(l.valor), 0)
  const isSimples = empresa?.regime_tributario === 'simples_nacional'

  // Deduções da Receita Bruta
  const issVal = receitaBruta * Number(empresa?.aliquota_iss || 0.02)
  const pisVal = receitaBruta * Number(empresa?.aliquota_pis || 0.0065)
  const cofinsVal = receitaBruta * Number(empresa?.aliquota_cofins || 0.03)
  const simplesVal = isSimples ? receitaBruta * Number(empresa?.aliquota_simples_efetiva || 0.06) : 0
  const deducoes = isSimples ? simplesVal : (issVal + pisVal + cofinsVal)
  const receitaLiquida = receitaBruta - deducoes

  // IRPJ e CSLL (Lucro Presumido — aparecem depois do LAIR)
  const irpjVal = !isSimples ? receitaBruta * Number(empresa?.aliquota_ir || 0.048) : 0
  const csllVal = !isSimples ? receitaBruta * Number(empresa?.aliquota_csll || 0.0288) : 0

  const csp = lancamentos.filter((l: any) => l.tipo === 'despesa' && !l.is_provisao && (l.origem === 'folha_fechamento' || l.categoria?.toLowerCase().includes('folha') || l.categoria?.toLowerCase().includes('salário') || l.categoria?.toLowerCase().includes('encargo') || l.categoria?.toLowerCase().includes('fgts') || l.categoria?.toLowerCase().includes('benefício') || l.categoria?.toLowerCase().includes('rescis'))).reduce((s: number, l: any) => s + Number(l.valor), 0)
  const lucroBruto = receitaLiquida - csp

  const despOp = lancamentos.filter((l: any) => l.tipo === 'despesa' && !l.is_provisao && l.origem !== 'folha_fechamento' && !l.categoria?.toLowerCase().includes('folha') && !l.categoria?.toLowerCase().includes('salário')).reduce((s: number, l: any) => s + Number(l.valor), 0)
  const ebitda = lucroBruto - despOp
  const lair = ebitda // sem resultado financeiro por enquanto
  const lucroLiquido = lair - irpjVal - csllVal

  // === BP: dados ===
  const caixaBancos = (contasSaldo ?? []).reduce((s: number, c: any) => s + Number(c.saldo_atual || c.saldo || 0), 0)
  const contasReceber = lancamentos.filter((l: any) => l.tipo === 'receita' && l.status !== 'pago').reduce((s: number, l: any) => s + Number(l.valor), 0)
  const totalAtivoCirc = caixaBancos + contasReceber
  const fornecedores = lancamentos.filter((l: any) => l.tipo === 'despesa' && l.status !== 'pago' && !l.is_provisao).reduce((s: number, l: any) => s + Number(l.valor), 0)
  const provisoesBP = lancamentos.filter((l: any) => l.is_provisao).reduce((s: number, l: any) => s + Number(l.valor), 0)
  const totalPassivoCirc = fornecedores + provisoesBP
  const capitalSocial = Number(empresa?.capital_social || 100000)
  const lucrosAcum = lancamentos.filter((l: any) => !l.is_provisao).reduce((s: number, l: any) => s + (l.tipo === 'receita' ? Number(l.valor) : -Number(l.valor)), 0)
  const totalPL = capitalSocial + lucrosAcum
  const totalAtivo = totalAtivoCirc
  const totalPassivoPL = totalPassivoCirc + totalPL

  // DRE line helper
  function DreLine({ label, valor, base, bold, indent, negative }: { label: string; valor: number; base: number; bold?: boolean; indent?: boolean; negative?: boolean }) {
    const display = negative && valor > 0 ? -valor : valor
    return (
      <tr className={bold ? 'bg-gray-50 font-bold' : ''}>
        <td className={`px-4 py-2 text-sm ${indent ? 'pl-8' : ''} ${bold ? 'text-gray-900' : 'text-gray-600'}`}>{label}</td>
        <td className={`px-4 py-2 text-sm text-right ${display < 0 ? 'text-red-600' : display > 0 ? 'text-green-700' : 'text-gray-400'}`}>
          {valor === 0 ? '—' : negative ? `(${fmt(Math.abs(valor))})` : fmt(valor)}
        </td>
        <td className="px-4 py-2 text-sm text-right text-gray-400">{valor === 0 ? '—' : pct(Math.abs(valor), base)}</td>
      </tr>
    )
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'margem', label: 'Margem por Contrato' },
    { key: 'dre', label: 'DRE Consolidado' },
    { key: 'oficial', label: 'DRE Oficial' },
    { key: 'bp', label: 'Balanço Patrimonial' },
    { key: 'dfc', label: 'Fluxo de Caixa' },
  ]

  return (
    <>
      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-lg overflow-x-auto">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${tab === t.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══ MARGEM POR CONTRATO ══ */}
      {tab === 'margem' && (
        dre.length > 0 ? (
          <div className="space-y-4">
            {dre.map((obra: any) => {
              const isOpen = expandido === obra.obra_id
              const funcsObra = custos.filter((c: any) => c.obra === obra.obra)
              return (
                <div key={obra.obra_id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <button onClick={() => setExpandido(isOpen ? null : obra.obra_id)}
                    className="w-full px-5 py-4 flex items-center gap-4 hover:bg-gray-50/50 transition-colors text-left">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900">{obra.obra}</span>
                        <span className="text-xs text-gray-400">{obra.cliente}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${statusColor[obra.status_margem] ?? 'bg-gray-100 text-gray-600'}`}>
                          {obra.status_margem?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) ?? '—'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-4 text-xs text-gray-500 mt-1">
                        <span>Receita: <strong className="text-green-700">{fmt(obra.receita_mensal_contrato)}</strong></span>
                        <span>Custo MO: <strong className="text-red-700">{fmt(obra.custo_mo_real_mensal)}</strong></span>
                        <span>Margem: <strong className={Number(obra.margem_pct) >= 0 ? 'text-green-700' : 'text-red-700'}>{Number(obra.margem_pct).toFixed(1)}%</strong></span>
                        <span><Users className="w-3 h-3 inline" /> {obra.funcionarios_alocados}</span>
                      </div>
                    </div>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </button>
                  {isOpen && (
                    <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-3">
                      {(() => {
                        const mesesObra = dreMes.filter((m: any) => m.obra_id === obra.obra_id)
                        if (mesesObra.length === 0) return <p className="text-sm text-gray-400">Sem dados mensais.</p>
                        return (
                          <table className="w-full text-sm">
                            <thead><tr className="border-b border-gray-200">
                              {['Mês', 'Funcs', 'Receita', 'Custo MO', 'Margem', '%'].map(h => <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
                            </tr></thead>
                            <tbody>{mesesObra.map((m: any) => {
                              const rec = Number(m.receita_realizada || m.receita_prevista || 0)
                              const cst = Number(m.custo_mo_real || 0)
                              const mg = rec - cst
                              return (
                                <tr key={`${m.ano}-${m.mes}`} className="border-b border-gray-100">
                                  <td className="px-3 py-2 font-medium">{MESES[m.mes]}/{m.ano}</td>
                                  <td className="px-3 py-2 text-gray-600">{m.funcionarios}</td>
                                  <td className="px-3 py-2 text-green-700 font-semibold">{fmt(rec)}</td>
                                  <td className="px-3 py-2 text-red-700 font-semibold">{fmt(cst)}</td>
                                  <td className={`px-3 py-2 font-bold ${mg >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(mg)}</td>
                                  <td className={`px-3 py-2 font-bold ${rec > 0 && mg / rec >= 0.15 ? 'text-green-700' : 'text-red-700'}`}>{rec > 0 ? (mg / rec * 100).toFixed(1) + '%' : '—'}</td>
                                </tr>
                              )
                            })}</tbody>
                          </table>
                        )
                      })()}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : <div className="bg-white rounded-xl border p-10 text-center text-gray-400"><TrendingUp className="w-10 h-10 mx-auto mb-3 text-gray-300" /><p>Nenhum dado de DRE disponível.</p></div>
      )}

      {/* ══ DRE CONSOLIDADO ══ */}
      {tab === 'dre' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100 bg-gray-50">
              {['Mês', 'Receita', 'Custo MO', 'Outras Desp.', 'Provisões', 'Resultado', 'Margem %'].map(h => (
                <th key={h} className="text-right first:text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr></thead>
            <tbody>{dreMeses.length > 0 ? dreMeses.map(m => {
              const res = m.receita - m.custoMO - m.outrasDesp - m.provisoes
              const mp = m.receita > 0 ? res / m.receita * 100 : 0
              return (
                <tr key={m.mes} className="border-b border-gray-50 hover:bg-gray-50/80">
                  <td className="px-4 py-2.5 font-medium">{m.mes === 'sem-data' ? 'Sem data' : new Date(m.mes + '-01').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}</td>
                  <td className="px-4 py-2.5 text-right text-green-600">{m.receita > 0 ? fmt(m.receita) : '—'}</td>
                  <td className="px-4 py-2.5 text-right text-red-600">{m.custoMO > 0 ? fmt(m.custoMO) : '—'}</td>
                  <td className="px-4 py-2.5 text-right text-orange-600">{m.outrasDesp > 0 ? fmt(m.outrasDesp) : '—'}</td>
                  <td className="px-4 py-2.5 text-right text-purple-600">{m.provisoes > 0 ? fmt(m.provisoes) : '—'}</td>
                  <td className={`px-4 py-2.5 text-right font-bold ${res >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(res)}</td>
                  <td className={`px-4 py-2.5 text-right font-bold ${mp >= 15 ? 'text-green-700' : 'text-red-700'}`}>{mp.toFixed(1)}%</td>
                </tr>
              )
            }) : <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Sem lançamentos.</td></tr>}</tbody>
          </table>
        </div>
      )}

      {/* ══ DRE OFICIAL ══ */}
      {tab === 'oficial' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Descrição</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-36">Valor</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-20">AV%</th>
            </tr></thead>
            <tbody>
              <tr><td colSpan={3} className="px-4 pt-3 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Receita Bruta de Serviços</td></tr>
              <DreLine label="Receita HH — Mão de Obra" valor={receitaBruta} base={receitaBruta} indent />
              <DreLine label="(=) RECEITA BRUTA" valor={receitaBruta} base={receitaBruta} bold />
              <tr><td colSpan={3} className="px-4 pt-3 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Deduções da Receita Bruta</td></tr>
              {isSimples ? (
                <DreLine label={`Simples Nacional (${(Number(empresa?.aliquota_simples_efetiva || 0.06) * 100).toFixed(0)}%)`} valor={simplesVal} base={receitaBruta} indent negative />
              ) : (<>
                <DreLine label={`ISS (${(Number(empresa?.aliquota_iss || 0.02) * 100).toFixed(1)}%)`} valor={issVal} base={receitaBruta} indent negative />
                <DreLine label={`PIS (${(Number(empresa?.aliquota_pis || 0.0065) * 100).toFixed(2)}%)`} valor={pisVal} base={receitaBruta} indent negative />
                <DreLine label={`COFINS (${(Number(empresa?.aliquota_cofins || 0.03) * 100).toFixed(1)}%)`} valor={cofinsVal} base={receitaBruta} indent negative />
              </>)}
              <DreLine label="(=) RECEITA LÍQUIDA" valor={receitaLiquida} base={receitaBruta} bold />
              <tr><td colSpan={3} className="px-4 pt-3 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Custo dos Serviços Prestados (CSP)</td></tr>
              <DreLine label="Salários e Encargos (MO Direta)" valor={csp} base={receitaBruta} indent negative />
              <DreLine label="(=) LUCRO BRUTO" valor={lucroBruto} base={receitaBruta} bold />
              <tr><td colSpan={3} className="px-4 pt-3 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Despesas Operacionais</td></tr>
              <DreLine label="Despesas Administrativas e Comerciais" valor={despOp} base={receitaBruta} indent negative />
              <DreLine label="(=) EBITDA" valor={ebitda} base={receitaBruta} bold />
              <DreLine label="(=) LAIR (Antes do IR)" valor={lair} base={receitaBruta} bold />
              {!isSimples && (<>
                <tr><td colSpan={3} className="px-4 pt-3 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Imposto de Renda e Contribuição Social</td></tr>
                <DreLine label="IRPJ (base presumida 32%)" valor={irpjVal} base={receitaBruta} indent negative />
                <DreLine label="CSLL (base presumida 32%)" valor={csllVal} base={receitaBruta} indent negative />
              </>)}
              <DreLine label="(=) LUCRO LÍQUIDO" valor={lucroLiquido} base={receitaBruta} bold />
            </tbody>
          </table>
          <div className="px-4 py-3 border-t border-gray-100 text-[10px] text-gray-400 italic">
            Este demonstrativo é uma aproximação gerencial. Para fins legais, fiscais e societários, consulte o contador responsável.
          </div>
        </div>
      )}

      {/* ══ BALANÇO PATRIMONIAL ══ */}
      {tab === 'bp' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* ATIVO */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Ativo</h3>
            <div className="space-y-2 text-sm">
              <div className="text-[10px] font-bold text-gray-400 uppercase">Ativo Circulante</div>
              <div className="flex justify-between pl-4"><span className="text-gray-600">Caixa e Bancos</span><span>{fmt(caixaBancos)}</span></div>
              <div className="flex justify-between pl-4"><span className="text-gray-600">Contas a Receber</span><span>{fmt(contasReceber)}</span></div>
              <div className="flex justify-between font-bold border-t pt-2"><span>Total Ativo Circulante</span><span>{fmt(totalAtivoCirc)}</span></div>
              <div className="text-[10px] font-bold text-gray-400 uppercase mt-3">Ativo Não Circulante</div>
              <div className="flex justify-between pl-4"><span className="text-gray-400">Imobilizado</span><span className="text-gray-400">R$ 0,00</span></div>
              <div className="flex justify-between font-bold border-t pt-2 text-brand"><span>TOTAL ATIVO</span><span>{fmt(totalAtivo)}</span></div>
            </div>
          </div>
          {/* PASSIVO + PL */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Passivo + Patrimônio Líquido</h3>
            <div className="space-y-2 text-sm">
              <div className="text-[10px] font-bold text-gray-400 uppercase">Passivo Circulante</div>
              <div className="flex justify-between pl-4"><span className="text-gray-600">Fornecedores e Despesas</span><span className="text-red-600">{fmt(fornecedores)}</span></div>
              <div className="flex justify-between pl-4"><span className="text-gray-600">Provisões</span><span className="text-purple-600">{fmt(provisoesBP)}</span></div>
              <div className="flex justify-between font-bold border-t pt-2"><span>Total Passivo Circulante</span><span className="text-red-600">{fmt(totalPassivoCirc)}</span></div>
              <div className="text-[10px] font-bold text-gray-400 uppercase mt-3">Patrimônio Líquido</div>
              <div className="flex justify-between pl-4"><span className="text-gray-600">Capital Social</span><span>{fmt(capitalSocial)}</span></div>
              <div className="flex justify-between pl-4"><span className="text-gray-600">Lucros Acumulados</span><span className={lucrosAcum >= 0 ? 'text-green-700' : 'text-red-600'}>{fmt(lucrosAcum)}</span></div>
              <div className="flex justify-between font-bold border-t pt-2"><span>Total PL</span><span>{fmt(totalPL)}</span></div>
              <div className="flex justify-between font-bold border-t pt-2 text-brand"><span>TOTAL PASSIVO + PL</span><span>{fmt(totalPassivoPL)}</span></div>
            </div>
            <div className={`mt-3 text-xs font-semibold px-3 py-1.5 rounded ${Math.abs(totalAtivo - totalPassivoPL) < 1 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {Math.abs(totalAtivo - totalPassivoPL) < 1 ? 'Ativo = Passivo + PL ✓' : `Diferença: ${fmt(totalAtivo - totalPassivoPL)}`}
            </div>
          </div>
          <div className="lg:col-span-2 text-[10px] text-gray-400 italic">
            Aproximação gerencial. Para fins legais, consulte o contador responsável. Data de referência: {new Date().toLocaleDateString('pt-BR')}.
          </div>
        </div>
      )}

      {/* ══ DFC — FLUXO DE CAIXA ══ */}
      {tab === 'dfc' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Descrição</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-36">Valor</th>
            </tr></thead>
            <tbody>
              <tr><td colSpan={2} className="px-4 pt-3 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Atividades Operacionais</td></tr>
              <tr><td className="px-4 py-2 pl-8 text-gray-600">Lucro Líquido do Período</td><td className="px-4 py-2 text-right text-green-700 font-semibold">{fmt(lucroLiquido)}</td></tr>
              <tr><td className="px-4 py-2 pl-8 text-gray-600">(+/-) Variação em Contas a Receber</td><td className="px-4 py-2 text-right text-red-600">{contasReceber > 0 ? `(${fmt(contasReceber)})` : '—'}</td></tr>
              <tr><td className="px-4 py-2 pl-8 text-gray-600">(+/-) Variação em Fornecedores</td><td className="px-4 py-2 text-right text-green-700">{fornecedores > 0 ? fmt(fornecedores) : '—'}</td></tr>
              <tr><td className="px-4 py-2 pl-8 text-gray-600">(+/-) Provisões</td><td className="px-4 py-2 text-right">{provisoesBP > 0 ? fmt(provisoesBP) : '—'}</td></tr>
              <tr className="bg-gray-50 font-bold"><td className="px-4 py-2">= Fluxo das Atividades Operacionais</td><td className="px-4 py-2 text-right">{fmt(lucroLiquido - contasReceber + fornecedores + provisoesBP)}</td></tr>
              <tr><td colSpan={2} className="px-4 pt-3 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Atividades de Investimento</td></tr>
              <tr><td className="px-4 py-2 pl-8 text-gray-400">Aquisição de Ativos</td><td className="px-4 py-2 text-right text-gray-400">R$ 0,00</td></tr>
              <tr className="bg-gray-50 font-bold"><td className="px-4 py-2">= Fluxo de Investimento</td><td className="px-4 py-2 text-right">R$ 0,00</td></tr>
              <tr><td colSpan={2} className="px-4 pt-3 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Atividades de Financiamento</td></tr>
              <tr><td className="px-4 py-2 pl-8 text-gray-400">Distribuição de Lucros</td><td className="px-4 py-2 text-right text-gray-400">R$ 0,00</td></tr>
              <tr className="bg-gray-50 font-bold"><td className="px-4 py-2">= Fluxo de Financiamento</td><td className="px-4 py-2 text-right">R$ 0,00</td></tr>
              <tr className="border-t-2 border-brand/20"><td className="px-4 py-3 font-bold text-brand">VARIAÇÃO LÍQUIDA DO CAIXA</td><td className="px-4 py-3 text-right font-bold text-brand">{fmt(lucroLiquido - contasReceber + fornecedores + provisoesBP)}</td></tr>
              <tr><td className="px-4 py-2 text-gray-500">Saldo Inicial de Caixa</td><td className="px-4 py-2 text-right">R$ 0,00</td></tr>
              <tr className="bg-brand/5 font-bold"><td className="px-4 py-3 text-brand">SALDO FINAL DE CAIXA</td><td className="px-4 py-3 text-right text-brand">{fmt(caixaBancos)}</td></tr>
            </tbody>
          </table>
          <div className="px-4 py-3 border-t border-gray-100 text-[10px] text-gray-400 italic">
            DFC pelo método indireto. Aproximação gerencial. Consulte o contador para fins oficiais.
          </div>
        </div>
      )}
    </>
  )
}
