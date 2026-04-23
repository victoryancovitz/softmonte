'use client'
import { useState, useMemo } from 'react'
import { TrendingUp, Users, ChevronDown, ChevronUp, Settings } from 'lucide-react'
import Link from 'next/link'

const MESES = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const fmt = (v: number | null) => v != null ? Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'
const pct = (v: number, base: number) => base > 0 ? `${(v / base * 100).toFixed(1)}%` : '—'

const statusColor: Record<string, string> = {
  verde: 'bg-green-100 text-green-700', amarelo: 'bg-amber-100 text-amber-700',
  vermelho: 'bg-red-100 text-red-700', ok: 'bg-green-100 text-green-700',
  atencao: 'bg-amber-100 text-amber-700', critico: 'bg-red-100 text-red-700',
}

type Tab = 'margem' | 'dre' | 'por_obra' | 'obra_rateio' | 'sga' | 'consolidada' | 'oficial' | 'bp' | 'dfc' | 'por_cc'
type Granularidade = 'mensal' | 'trimestral' | 'semestral' | 'anual' | 'acumulado'

export default function DreClient({ dre, dreMes, custos, lancamentos, empresa, contasSaldo, ccsAdm, obrasAtivas, rateioConfig, distribuicoes }: {
  dre: any[]; dreMes: any[]; custos: any[]; lancamentos: any[]; empresa: any; contasSaldo: any[]
  ccsAdm?: any[]; obrasAtivas?: any[]; rateioConfig?: any; distribuicoes?: any[]
}) {
  const [expandido, setExpandido] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('margem')
  const [granularidade, setGranularidade] = useState<Granularidade>('mensal')
  const [filtroObra, setFiltroObra] = useState<string>('todas')
  const [anoFiltro, setAnoFiltro] = useState<number>(2026)
  const [showAcumulado, setShowAcumulado] = useState(false)

  // Unique obras from lancamentos
  const obrasUnicas = useMemo(() => {
    const map = new Map<string, string>()
    lancamentos.forEach((l: any) => {
      if (l.obra_id && l.obra_nome) map.set(l.obra_id, l.obra_nome)
      else if (l.obra_id && l.obra) map.set(l.obra_id, l.obra)
    })
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [lancamentos])

  // Available years from lancamentos
  const anosDisponiveis = useMemo(() => {
    const years = new Set<number>()
    lancamentos.forEach((l: any) => {
      const d = l.data_competencia?.slice(0, 4)
      if (d) years.add(Number(d))
    })
    const sorted = Array.from(years).sort()
    return sorted.length > 0 ? sorted : [2026]
  }, [lancamentos])

  // DRE consolidado com filtros e granularidade
  const dreMesesFiltered = useMemo(() => {
    // Filter by year and obra
    let filtered = lancamentos.filter((l: any) => {
      const year = l.data_competencia?.slice(0, 4)
      if (!year || Number(year) !== anoFiltro) return false
      if (filtroObra !== 'todas' && l.obra_id !== filtroObra) return false
      return true
    })

    type DreRow = { key: string; label: string; receita: number; custoMO: number; outrasDesp: number; despFin: number; provisoes: number }
    const grouped: Record<string, DreRow> = {}

    const getGroupKey = (l: any): { key: string; label: string } => {
      const dc = l.data_competencia ?? ''
      const year = dc.slice(0, 4)
      const month = Number(dc.slice(5, 7))
      const yy = year.slice(2)

      switch (granularidade) {
        case 'mensal': {
          const mesKey = dc.slice(0, 7) || 'sem-data'
          const label = mesKey === 'sem-data' ? 'Sem data' : `${MESES[month]}/${yy}`
          return { key: mesKey, label }
        }
        case 'trimestral': {
          const q = Math.ceil(month / 3)
          return { key: `${year}-Q${q}`, label: `${q}T/${yy}` }
        }
        case 'semestral': {
          const s = month <= 6 ? 1 : 2
          return { key: `${year}-S${s}`, label: `${s}S/${yy}` }
        }
        case 'anual':
          return { key: year, label: year }
        case 'acumulado':
          return { key: 'acumulado', label: 'Acumulado' }
      }
    }

    filtered.forEach((l: any) => {
      const { key, label } = getGroupKey(l)
      if (!grouped[key]) grouped[key] = { key, label, receita: 0, custoMO: 0, outrasDesp: 0, provisoes: 0, despFin: 0 }
      const v = Number(l.valor || 0)
      if (l.tipo === 'receita' && l.natureza !== 'financiamento') grouped[key].receita += v
      else if (l.is_provisao) grouped[key].provisoes += v
      else if (l.categoria === 'Folha de Pagamento' || l.origem === 'folha_fechamento') grouped[key].custoMO += v
      else if (l.categoria === 'Despesas Financeiras' || l.categoria === 'Amortização de Empréstimos') grouped[key].despFin += v
      else grouped[key].outrasDesp += v
    })

    return Object.values(grouped).sort((a, b) => a.key.localeCompare(b.key))
  }, [lancamentos, granularidade, filtroObra, anoFiltro])

  // === DRE OFICIAL: classificar lançamentos ===
  const receitaBruta = lancamentos.filter((l: any) => l.tipo === 'receita' && !l.is_provisao && l.natureza !== 'financiamento').reduce((s: number, l: any) => s + Number(l.valor), 0)
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

  const isDespFin = (l: any) => l.categoria === 'Despesas Financeiras' || l.categoria === 'Amortização de Empréstimos'
  const despOp = lancamentos.filter((l: any) => l.tipo === 'despesa' && !l.is_provisao && l.origem !== 'folha_fechamento' && !l.categoria?.toLowerCase().includes('folha') && !l.categoria?.toLowerCase().includes('salário') && !isDespFin(l)).reduce((s: number, l: any) => s + Number(l.valor), 0)
  const despFinOficial = lancamentos.filter((l: any) => l.tipo === 'despesa' && !l.is_provisao && isDespFin(l)).reduce((s: number, l: any) => s + Number(l.valor), 0)
  const ebitda = lucroBruto - despOp
  const lair = ebitda - despFinOficial
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
    { key: 'por_obra', label: 'Por Obra' },
    { key: 'obra_rateio', label: 'Obra + Rateio' },
    { key: 'sga', label: 'Matriz / SG&A' },
    { key: 'consolidada', label: 'Consolidada' },
    { key: 'por_cc', label: 'Por CC' },
    { key: 'oficial', label: 'DRE Oficial' },
    { key: 'bp', label: 'Balanço Patrimonial' },
    { key: 'dfc', label: 'Fluxo de Caixa' },
  ]

  const granularidades: { key: Granularidade; label: string }[] = [
    { key: 'mensal', label: 'Mensal' },
    { key: 'trimestral', label: 'Trimestral' },
    { key: 'semestral', label: 'Semestral' },
    { key: 'anual', label: 'Anual' },
    { key: 'acumulado', label: 'Acumulado' },
  ]

  const nenhumDadoReal = dre.length === 0 || dre.every((o: any) => !o.tem_dados_reais)

  return (
    <>
      {/* Banner global: sem dados reais */}
      {nenhumDadoReal && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5">
          <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-amber-600 text-xs font-bold">!</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-800">Sem folha fechada nem BM registrado</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Os valores exibidos são <strong>projeções</strong> baseadas nos salários dos funcionários alocados e composição contratual. Para dados reais, feche folhas e emita BMs.
            </p>
          </div>
        </div>
      )}

      {/* ══ CONTROL BAR (for DRE Consolidado) ══ */}
      {tab === 'dre' && (
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          {/* Granularity pills */}
          <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg">
            {granularidades.map(g => (
              <button key={g.key} onClick={() => setGranularidade(g.key)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${granularidade === g.key ? 'bg-brand text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {g.label}
              </button>
            ))}
          </div>

          {/* Obra dropdown */}
          <select value={filtroObra} onChange={e => setFiltroObra(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-brand">
            <option value="todas">Todas as Obras</option>
            {obrasUnicas.map(([id, nome]) => (
              <option key={id} value={id}>{nome}</option>
            ))}
          </select>

          {/* Year dropdown */}
          <select value={anoFiltro} onChange={e => setAnoFiltro(Number(e.target.value))}
            className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-brand">
            {anosDisponiveis.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {/* Acumulado YTD toggle */}
          <button onClick={() => setShowAcumulado(!showAcumulado)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors border ${showAcumulado ? 'bg-brand text-white border-brand' : 'bg-white text-gray-500 border-gray-200 hover:text-gray-700'}`}>
            <span className={`inline-block w-3 h-3 rounded border-2 ${showAcumulado ? 'bg-white border-white' : 'border-gray-300'}`}>
              {showAcumulado && <svg viewBox="0 0 12 12" className="w-full h-full text-brand"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </span>
            Acumulado YTD
          </button>
        </div>
      )}

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
              const temReais = obra.tem_dados_reais
              const recExib = temReais ? Number(obra.receita_realizada || 0) : Number(obra.receita_mensal_estimada || 0)
              const custoExib = temReais ? Number(obra.custo_realizado || 0) : Number(obra.custo_mo_estimado || 0)
              const margemExib = temReais ? obra.margem_real_pct : obra.margem_projetada_pct
              return (
                <div key={obra.obra_id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <button onClick={() => setExpandido(isOpen ? null : obra.obra_id)}
                    className="w-full px-5 py-4 flex items-center gap-4 hover:bg-gray-50/50 transition-colors text-left">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900">{obra.obra}</span>
                        <span className="text-xs text-gray-400">{obra.cliente}</span>
                        {temReais ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-green-100 text-green-700">Realizado</span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-700" title="Baseado nos salários e valor estimado do contrato. Feche folhas e emita BMs para dados reais.">Projetado ⓘ</span>
                        )}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${statusColor[obra.status_margem] ?? 'bg-gray-100 text-gray-600'}`}>
                          {obra.status_margem?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) ?? '—'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-4 text-xs text-gray-500 mt-1">
                        <span title={!temReais ? 'Valor estimado do contrato' : undefined}>Receita: <strong className="text-green-700">{fmt(recExib)}</strong>{temReais && obra.qtd_bms > 0 ? <span className="text-gray-400 ml-1">({obra.qtd_bms} BMs)</span> : ''}</span>
                        <span title={!temReais ? 'Custo estimado dos alocados' : undefined}>Custo MO: <strong className="text-red-700">{fmt(custoExib)}</strong>{temReais && obra.meses_com_folha > 0 ? <span className="text-gray-400 ml-1">({obra.meses_com_folha} folhas)</span> : ''}</span>
                        <span>Margem: <strong className={margemExib != null && Number(margemExib) >= 0 ? 'text-green-700' : 'text-red-700'}>{margemExib != null ? `${Number(margemExib).toFixed(1)}%` : '—'}</strong></span>
                        <span><Users className="w-3 h-3 inline" /> {obra.funcionarios_alocados}</span>
                      </div>
                    </div>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </button>
                  {isOpen && (
                    <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-3">
                      {(() => {
                        const mesesObra = dreMes.filter((m: any) => m.obra_id === obra.obra_id)
                        if (mesesObra.length === 0) return <div>{!temReais && <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 mb-2"><strong>Dados projetados</strong> — valores baseados no contrato ({fmt(obra.receita_mensal_estimada)}/mês) e salários dos {obra.funcionarios_alocados} alocados. Para dados reais: feche folhas e emita BMs.</div>}<p className="text-sm text-gray-400">Sem dados mensais.</p></div>
                        return (
                          <table className="w-full text-sm">
                            <thead><tr className="border-b border-gray-200">
                              {['Mês', 'Funcs', 'Receita', 'Custo MO', 'Margem', '%'].map(h => <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
                            </tr></thead>
                            <tbody>{mesesObra.map((m: any) => {
                              const rec = Number(m.receita_realizada || 0) // APENAS realizada, nunca prevista
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
              {['Período', 'Receita', 'Custo MO', 'Outras Desp.', 'Desp. Financ.', 'Provisões', 'Resultado', 'Margem %'].map(h => (
                <th key={h} className="text-right first:text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
              {showAcumulado && <>
                <th className="text-right px-4 py-3 text-xs font-semibold text-brand/70 uppercase border-l border-gray-200">Acum. Receita</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-brand/70 uppercase">Acum. Resultado</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-brand/70 uppercase">Margem Acum.</th>
              </>}
            </tr></thead>
            <tbody>{dreMesesFiltered.length > 0 ? (() => {
              let acumReceita = 0
              let acumResultado = 0
              return dreMesesFiltered.map(m => {
                const res = m.receita - m.custoMO - m.outrasDesp - (m.despFin || 0) - m.provisoes
                const mp = m.receita > 0 ? res / m.receita * 100 : 0
                acumReceita += m.receita
                acumResultado += res
                const margemAcum = acumReceita > 0 ? acumResultado / acumReceita * 100 : 0
                return (
                  <tr key={m.key} className="border-b border-gray-50 hover:bg-gray-50/80">
                    <td className="px-4 py-2.5 font-medium">{m.label}</td>
                    <td className="px-4 py-2.5 text-right text-green-600">{m.receita > 0 ? fmt(m.receita) : '—'}</td>
                    <td className="px-4 py-2.5 text-right text-red-600">{m.custoMO > 0 ? fmt(m.custoMO) : '—'}</td>
                    <td className="px-4 py-2.5 text-right text-orange-600">{m.outrasDesp > 0 ? fmt(m.outrasDesp) : '—'}</td>
                    <td className="px-4 py-2.5 text-right text-rose-600">{(m.despFin || 0) > 0 ? fmt(m.despFin) : '—'}</td>
                    <td className="px-4 py-2.5 text-right text-purple-600">{m.provisoes > 0 ? fmt(m.provisoes) : '—'}</td>
                    <td className={`px-4 py-2.5 text-right font-bold ${res >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(res)}</td>
                    <td className={`px-4 py-2.5 text-right font-bold ${mp >= 25 ? 'text-green-700' : mp >= 0 ? 'text-amber-600' : 'text-red-700'}`}>{mp.toFixed(1)}%</td>
                    {showAcumulado && <>
                      <td className="px-4 py-2.5 text-right text-green-600 border-l border-gray-100">{acumReceita > 0 ? fmt(acumReceita) : '—'}</td>
                      <td className={`px-4 py-2.5 text-right font-bold ${acumResultado >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(acumResultado)}</td>
                      <td className={`px-4 py-2.5 text-right font-bold ${margemAcum >= 25 ? 'text-green-700' : margemAcum >= 0 ? 'text-amber-600' : 'text-red-700'}`}>{margemAcum.toFixed(1)}%</td>
                    </>}
                  </tr>
                )
              })
            })() : <tr><td colSpan={showAcumulado ? 11 : 8} className="px-4 py-10 text-center text-gray-400">Sem lançamentos para o período selecionado.</td></tr>}</tbody>
          </table>
        </div>
      )}

      {/* ══ POR OBRA ══ */}
      {tab === 'por_obra' && (() => {
        const filtered = lancamentos.filter((l: any) => {
          const year = l.data_competencia?.slice(0, 4)
          return year && Number(year) === anoFiltro
        })

        type ObraRow = { obra_id: string; nome: string; receita: number; cpvCampo: number; suporte: number }
        const byObra: Record<string, ObraRow> = {}

        filtered.forEach((l: any) => {
          const obraId = l.obra_id || 'sem_obra'
          const nome = l.obra_nome || l.obra || 'Sem obra'
          const ccTipo = l.centros_custo?.tipo || ''

          if (!byObra[obraId]) byObra[obraId] = { obra_id: obraId, nome, receita: 0, cpvCampo: 0, suporte: 0 }
          const v = Number(l.valor || 0)

          if (l.tipo === 'receita' && l.natureza !== 'financiamento') {
            byObra[obraId].receita += v
          } else if (l.tipo === 'despesa' && !l.is_provisao) {
            if (ccTipo === 'suporte_obra') {
              // Suporte vai para a obra vinculada ao CC
              const ccObraId = l.centros_custo?.obra_id || obraId
              const key = ccObraId || obraId
              if (!byObra[key]) byObra[key] = { obra_id: key, nome: nome, receita: 0, cpvCampo: 0, suporte: 0 }
              byObra[key].suporte += v
            } else if (ccTipo !== 'administrativo') {
              byObra[obraId].cpvCampo += v
            }
          }
        })

        const rows = Object.values(byObra).sort((a, b) => b.receita - a.receita)
        const totRec = rows.reduce((s, r) => s + r.receita, 0)
        const totCpv = rows.reduce((s, r) => s + r.cpvCampo, 0)
        const totSup = rows.reduce((s, r) => s + r.suporte, 0)
        const totRes = totRec - totCpv - totSup

        return (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">DRE Por Obra — {anoFiltro}</h3>
              <select value={anoFiltro} onChange={e => setAnoFiltro(Number(e.target.value))}
                className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700">
                {anosDisponiveis.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100 bg-gray-50">
                {['Obra', 'Receita', 'CPV Campo', 'Suporte', 'Resultado', 'Margem %'].map(h => (
                  <th key={h} className="text-right first:text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {rows.length > 0 ? rows.map(r => {
                  const res = r.receita - r.cpvCampo - r.suporte
                  const margem = r.receita > 0 ? (res / r.receita * 100) : r.cpvCampo > 0 || r.suporte > 0 ? -100 : 0
                  return (
                    <tr key={r.obra_id} className="border-b border-gray-50 hover:bg-gray-50/80">
                      <td className="px-4 py-2.5 font-medium text-left">{r.nome}{r.obra_id === 'sem_obra' && <span className="ml-1 text-gray-400 text-[10px]">(sem vínculo)</span>}</td>
                      <td className="px-4 py-2.5 text-right text-green-600">{r.receita > 0 ? fmt(r.receita) : '—'}</td>
                      <td className="px-4 py-2.5 text-right text-red-600">{r.cpvCampo > 0 ? fmt(r.cpvCampo) : '—'}</td>
                      <td className="px-4 py-2.5 text-right text-amber-600">{r.suporte > 0 ? fmt(r.suporte) : '—'}</td>
                      <td className={`px-4 py-2.5 text-right font-bold ${res >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(res)}</td>
                      <td className={`px-4 py-2.5 text-right font-bold ${margem >= 0 ? 'text-green-700' : 'text-red-700'}`}>{r.receita > 0 || r.cpvCampo > 0 ? `${margem.toFixed(1)}%` : '—'}</td>
                    </tr>
                  )
                }) : <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">Sem lançamentos para o período.</td></tr>}
                {rows.length > 0 && (
                  <tr className="bg-gray-50 font-bold border-t border-gray-200">
                    <td className="px-4 py-3 text-left">TOTAL</td>
                    <td className="px-4 py-3 text-right text-green-700">{fmt(totRec)}</td>
                    <td className="px-4 py-3 text-right text-red-700">{fmt(totCpv)}</td>
                    <td className="px-4 py-3 text-right text-amber-700">{fmt(totSup)}</td>
                    <td className={`px-4 py-3 text-right ${totRes >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(totRes)}</td>
                    <td className={`px-4 py-3 text-right ${totRec > 0 && totRes / totRec >= 0 ? 'text-green-700' : 'text-red-700'}`}>{totRec > 0 ? `${(totRes / totRec * 100).toFixed(1)}%` : '—'}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )
      })()}

      {/* ══ OBRA + RATEIO ══ */}
      {tab === 'obra_rateio' && (() => {
        const filtered = lancamentos.filter((l: any) => {
          const year = l.data_competencia?.slice(0, 4)
          return year && Number(year) === anoFiltro
        })

        // Calcular total SG&A (lançamentos em CCs administrativos)
        const totalSGA = filtered.filter((l: any) => l.tipo === 'despesa' && !l.is_provisao && l.centros_custo?.tipo === 'administrativo')
          .reduce((s: number, l: any) => s + Number(l.valor || 0), 0)

        type ObraRow = { obra_id: string; nome: string; receita: number; cpv: number; suporte: number; diasRestantes: number }
        const byObra: Record<string, ObraRow> = {}

        filtered.forEach((l: any) => {
          const obraId = l.obra_id || 'sem_obra'
          const nome = l.obra_nome || l.obra || 'Sem obra'
          const ccTipo = l.centros_custo?.tipo || ''

          if (!byObra[obraId]) byObra[obraId] = { obra_id: obraId, nome, receita: 0, cpv: 0, suporte: 0, diasRestantes: 0 }
          const v = Number(l.valor || 0)

          if (l.tipo === 'receita' && l.natureza !== 'financiamento') {
            byObra[obraId].receita += v
          } else if (l.tipo === 'despesa' && !l.is_provisao && ccTipo !== 'administrativo') {
            if (ccTipo === 'suporte_obra') {
              byObra[obraId].suporte += v
            } else {
              byObra[obraId].cpv += v
            }
          }
        })

        // Calcular dias restantes para cada obra
        const hoje = new Date()
        ;(obrasAtivas ?? []).forEach((o: any) => {
          if (byObra[o.id]) {
            const fim = o.data_fim ? new Date(o.data_fim) : null
            byObra[o.id].diasRestantes = fim ? Math.max(0, Math.ceil((fim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))) : 0
          }
        })

        const rows = Object.values(byObra).filter(r => r.obra_id !== 'sem_obra').sort((a, b) => b.receita - a.receita)
        const semObra = byObra['sem_obra']
        const totalRecObras = rows.reduce((s, r) => s + r.receita, 0)
        const totalDiasRest = rows.reduce((s, r) => s + r.diasRestantes, 0)

        // Método de rateio
        const metodo = rateioConfig?.metodo || 'sem_rateio'
        const manuais: Record<string, number> = rateioConfig?.definicoes_manuais || {}

        const getRateio = (r: ObraRow): number => {
          if (metodo === 'sem_rateio') return 0
          if (metodo === 'por_receita') {
            const pctObra = totalRecObras > 0 ? r.receita / totalRecObras : 0
            return totalSGA * pctObra
          }
          if (metodo === 'por_tempo_remanescente') {
            const pctObra = totalDiasRest > 0 ? r.diasRestantes / totalDiasRest : 0
            return totalSGA * pctObra
          }
          if (metodo === 'manual') {
            const pctObra = Number(manuais[r.obra_id] || 0) / 100
            return totalSGA * pctObra
          }
          return 0
        }

        const totRec = rows.reduce((s, r) => s + r.receita, 0)
        const totCpv = rows.reduce((s, r) => s + r.cpv, 0)
        const totSup = rows.reduce((s, r) => s + r.suporte, 0)
        const totRateio = rows.reduce((s, r) => s + getRateio(r), 0)
        const totResReal = totRec - totCpv - totSup - totRateio

        const METODO_LABELS: Record<string, string> = {
          sem_rateio: 'Sem Rateio',
          por_receita: 'Por Receita',
          por_hh: 'Por HH',
          por_tempo_remanescente: 'Por Tempo Restante',
          manual: 'Manual',
        }

        return (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-700">DRE Obra + Rateio Overhead — {anoFiltro}</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Método: {METODO_LABELS[metodo] || metodo} | SG&A total: {fmt(totalSGA)}</p>
              </div>
              <div className="flex items-center gap-2">
                <select value={anoFiltro} onChange={e => setAnoFiltro(Number(e.target.value))}
                  className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700">
                  {anosDisponiveis.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <Link href="/cc/rateio" className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
                  <Settings className="w-3.5 h-3.5" /> Configurar Rateio
                </Link>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100 bg-gray-50">
                {['Obra', 'Receita', 'CPV', 'Suporte', 'Rateio', 'Resultado Real', 'Margem Real'].map(h => (
                  <th key={h} className="text-right first:text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {rows.length > 0 ? rows.map(r => {
                  const rateio = getRateio(r)
                  const resReal = r.receita - r.cpv - r.suporte - rateio
                  const margemReal = r.receita > 0 ? (resReal / r.receita * 100) : 0
                  return (
                    <tr key={r.obra_id} className="border-b border-gray-50 hover:bg-gray-50/80">
                      <td className="px-4 py-2.5 font-medium text-left">{r.nome}</td>
                      <td className="px-4 py-2.5 text-right text-green-600">{r.receita > 0 ? fmt(r.receita) : '—'}</td>
                      <td className="px-4 py-2.5 text-right text-red-600">{r.cpv > 0 ? fmt(r.cpv) : '—'}</td>
                      <td className="px-4 py-2.5 text-right text-amber-600">{r.suporte > 0 ? fmt(r.suporte) : '—'}</td>
                      <td className="px-4 py-2.5 text-right text-purple-600">{rateio > 0 ? fmt(rateio) : '—'}</td>
                      <td className={`px-4 py-2.5 text-right font-bold ${resReal >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(resReal)}</td>
                      <td className={`px-4 py-2.5 text-right font-bold ${margemReal >= 0 ? 'text-green-700' : 'text-red-700'}`}>{r.receita > 0 ? `${margemReal.toFixed(1)}%` : '—'}</td>
                    </tr>
                  )
                }) : <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Sem lançamentos para o período.</td></tr>}
                {semObra && (
                  <tr className="border-b border-gray-50 bg-amber-50/30">
                    <td className="px-4 py-2.5 font-medium text-left text-gray-400">Sem obra</td>
                    <td className="px-4 py-2.5 text-right text-green-600">{semObra.receita > 0 ? fmt(semObra.receita) : '—'}</td>
                    <td className="px-4 py-2.5 text-right text-red-600">{semObra.cpv > 0 ? fmt(semObra.cpv) : '—'}</td>
                    <td className="px-4 py-2.5 text-right text-amber-600">{semObra.suporte > 0 ? fmt(semObra.suporte) : '—'}</td>
                    <td className="px-4 py-2.5 text-right text-gray-400">—</td>
                    <td className={`px-4 py-2.5 text-right font-bold ${(semObra.receita - semObra.cpv - semObra.suporte) >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(semObra.receita - semObra.cpv - semObra.suporte)}</td>
                    <td className="px-4 py-2.5 text-right text-gray-400">—</td>
                  </tr>
                )}
                {rows.length > 0 && (
                  <tr className="bg-gray-50 font-bold border-t border-gray-200">
                    <td className="px-4 py-3 text-left">TOTAL</td>
                    <td className="px-4 py-3 text-right text-green-700">{fmt(totRec)}</td>
                    <td className="px-4 py-3 text-right text-red-700">{fmt(totCpv)}</td>
                    <td className="px-4 py-3 text-right text-amber-700">{fmt(totSup)}</td>
                    <td className="px-4 py-3 text-right text-purple-700">{fmt(totRateio)}</td>
                    <td className={`px-4 py-3 text-right ${totResReal >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(totResReal)}</td>
                    <td className={`px-4 py-3 text-right ${totRec > 0 && totResReal / totRec >= 0 ? 'text-green-700' : 'text-red-700'}`}>{totRec > 0 ? `${(totResReal / totRec * 100).toFixed(1)}%` : '—'}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )
      })()}

      {/* ══ MATRIZ / SG&A ══ */}
      {tab === 'sga' && (() => {
        const CC_TIPO_COLORS: Record<string, string> = { obra: 'bg-blue-100 text-blue-700', administrativo: 'bg-purple-100 text-purple-700', suporte_obra: 'bg-amber-100 text-amber-700', equipamento: 'bg-gray-100 text-gray-600' }
        const filtered = lancamentos.filter((l: any) => {
          const year = l.data_competencia?.slice(0, 4)
          return year && Number(year) === anoFiltro
        })

        // Apenas lançamentos administrativos + sem CC/obra
        type SGARow = { cc_id: string; cc_label: string; receita: number; despesa: number }
        const byCC: Record<string, SGARow> = {}

        filtered.forEach((l: any) => {
          const ccTipo = l.centros_custo?.tipo || ''
          const isAdm = ccTipo === 'administrativo'
          const semCCeObra = !l.centro_custo_id && !l.obra_id

          if (!isAdm && !semCCeObra) return

          const ccId = l.centro_custo_id || 'nao_classificado'
          const ccLabel = l.centros_custo ? `${l.centros_custo.codigo} — ${l.centros_custo.nome}` : (semCCeObra ? 'Não classificados' : 'Sem CC')

          if (!byCC[ccId]) byCC[ccId] = { cc_id: ccId, cc_label: ccLabel, receita: 0, despesa: 0 }
          const v = Number(l.valor || 0)

          if (l.tipo === 'receita' && l.natureza !== 'financiamento') byCC[ccId].receita += v
          else if (l.tipo === 'despesa' && !l.is_provisao) byCC[ccId].despesa += v
        })

        const rows = Object.values(byCC).sort((a, b) => b.despesa - a.despesa)
        const totRec = rows.reduce((s, r) => s + r.receita, 0)
        const totDesp = rows.reduce((s, r) => s + r.despesa, 0)
        const totRes = totRec - totDesp

        return (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-700">Matriz / SG&A — {anoFiltro}</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Receitas da matriz + despesas SG&A por centro de custo administrativo</p>
              </div>
              <select value={anoFiltro} onChange={e => setAnoFiltro(Number(e.target.value))}
                className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700">
                {anosDisponiveis.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100 bg-gray-50">
                {['Centro de Custo', 'Receitas', 'Despesas SG&A', 'Resultado'].map(h => (
                  <th key={h} className="text-right first:text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {rows.length > 0 ? rows.map(r => {
                  const res = r.receita - r.despesa
                  return (
                    <tr key={r.cc_id} className={`border-b border-gray-50 hover:bg-gray-50/80 ${r.cc_id === 'nao_classificado' ? 'bg-amber-50/30' : ''}`}>
                      <td className="px-4 py-2.5 font-medium text-left">{r.cc_label}</td>
                      <td className="px-4 py-2.5 text-right text-green-600">{r.receita > 0 ? fmt(r.receita) : '—'}</td>
                      <td className="px-4 py-2.5 text-right text-red-600">{r.despesa > 0 ? fmt(r.despesa) : '—'}</td>
                      <td className={`px-4 py-2.5 text-right font-bold ${res >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(res)}</td>
                    </tr>
                  )
                }) : <tr><td colSpan={4} className="px-4 py-10 text-center text-gray-400">Sem lançamentos administrativos para o período.</td></tr>}
                {rows.length > 0 && (
                  <tr className="bg-gray-50 font-bold border-t border-gray-200">
                    <td className="px-4 py-3 text-left">TOTAL SG&A</td>
                    <td className="px-4 py-3 text-right text-green-700">{fmt(totRec)}</td>
                    <td className="px-4 py-3 text-right text-red-700">{fmt(totDesp)}</td>
                    <td className={`px-4 py-3 text-right ${totRes >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(totRes)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )
      })()}

      {/* ══ CONSOLIDADA ══ */}
      {tab === 'consolidada' && (() => {
        // Classificação expandida
        const filtered = lancamentos.filter((l: any) => !l.is_provisao)
        const recBruta = filtered.filter((l: any) => l.tipo === 'receita' && l.natureza !== 'financiamento').reduce((s: number, l: any) => s + Number(l.valor), 0)

        // CPV Campo: despesas em CCs tipo obra ou suporte_obra
        const cpvCampo = filtered.filter((l: any) => l.tipo === 'despesa' && (l.centros_custo?.tipo === 'obra' || l.centros_custo?.tipo === 'suporte_obra' || (!l.centros_custo?.tipo && l.obra_id && (l.origem === 'folha_fechamento' || l.categoria?.toLowerCase().includes('folha'))))).reduce((s: number, l: any) => s + Number(l.valor), 0)

        const lucroBrutoC = recBruta - deducoes - cpvCampo

        // SG&A: despesas em CCs administrativos
        const sgaTotal = filtered.filter((l: any) => l.tipo === 'despesa' && l.centros_custo?.tipo === 'administrativo').reduce((s: number, l: any) => s + Number(l.valor), 0)

        const ebitdaC = lucroBrutoC - sgaTotal

        // Desp financeiras
        const despFinC = filtered.filter((l: any) => l.tipo === 'despesa' && (l.categoria === 'Despesas Financeiras' || l.categoria === 'Amortização de Empréstimos')).reduce((s: number, l: any) => s + Number(l.valor), 0)

        const lairC = ebitdaC - despFinC
        const lucroLiquidoC = lairC - irpjVal - csllVal

        // Distribuições
        const totalDistribuicoes = (distribuicoes ?? []).reduce((s: number, d: any) => s + Math.abs(Number(d.valor || 0)), 0)
        const lucroRetido = lucroLiquidoC - totalDistribuicoes

        return (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Descrição</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-36">Valor</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-20">AV%</th>
              </tr></thead>
              <tbody>
                <tr><td colSpan={3} className="px-4 pt-3 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Receita</td></tr>
                <DreLine label="Receita Bruta de Serviços" valor={recBruta} base={recBruta} indent />
                <DreLine label="(=) RECEITA BRUTA" valor={recBruta} base={recBruta} bold />

                <tr><td colSpan={3} className="px-4 pt-3 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Deduções</td></tr>
                {isSimples ? (
                  <DreLine label={`Simples Nacional (${(Number(empresa?.aliquota_simples_efetiva || 0.06) * 100).toFixed(0)}%)`} valor={simplesVal} base={recBruta} indent negative />
                ) : (<>
                  <DreLine label="ISS" valor={issVal} base={recBruta} indent negative />
                  <DreLine label="PIS" valor={pisVal} base={recBruta} indent negative />
                  <DreLine label="COFINS" valor={cofinsVal} base={recBruta} indent negative />
                </>)}

                <tr><td colSpan={3} className="px-4 pt-3 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Custo dos Serviços</td></tr>
                <DreLine label="(-) CPV Campo (MO + insumos de obra)" valor={cpvCampo} base={recBruta} indent negative />
                <DreLine label="(=) LUCRO BRUTO" valor={lucroBrutoC} base={recBruta} bold />

                <tr><td colSpan={3} className="px-4 pt-3 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Despesas Operacionais</td></tr>
                <DreLine label="(-) SG&A (Despesas Administrativas)" valor={sgaTotal} base={recBruta} indent negative />
                <DreLine label="(=) EBITDA" valor={ebitdaC} base={recBruta} bold />

                {despFinC > 0 && (<>
                  <tr><td colSpan={3} className="px-4 pt-3 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Resultado Financeiro</td></tr>
                  <DreLine label="(-) Despesas Financeiras" valor={despFinC} base={recBruta} indent negative />
                </>)}
                <DreLine label="(=) LAIR" valor={lairC} base={recBruta} bold />

                {!isSimples && (<>
                  <tr><td colSpan={3} className="px-4 pt-3 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tributos sobre o Lucro</td></tr>
                  <DreLine label="IRPJ" valor={irpjVal} base={recBruta} indent negative />
                  <DreLine label="CSLL" valor={csllVal} base={recBruta} indent negative />
                </>)}
                <DreLine label="(=) LUCRO LÍQUIDO" valor={lucroLiquidoC} base={recBruta} bold />

                <tr><td colSpan={3} className="px-4 pt-4 pb-1 text-[10px] font-bold text-brand/70 uppercase tracking-wider border-t-2 border-brand/10">Destinação do Resultado</td></tr>
                <DreLine label="(-) Distribuição de Lucros" valor={totalDistribuicoes} base={recBruta} indent negative />
                <DreLine label="(=) LUCRO RETIDO" valor={lucroRetido} base={recBruta} bold />
              </tbody>
            </table>
            <div className="px-4 py-3 border-t border-gray-100 text-[10px] text-gray-400 italic">
              DRE consolidada expandida com separação CPV Campo / SG&A. Aproximação gerencial.
            </div>
          </div>
        )
      })()}

      {/* ══ POR CENTRO DE CUSTO ══ */}
      {tab === 'por_cc' && (() => {
        const CC_TIPO_COLORS: Record<string, string> = { obra: 'bg-blue-100 text-blue-700', administrativo: 'bg-purple-100 text-purple-700', suporte_obra: 'bg-amber-100 text-amber-700', equipamento: 'bg-gray-100 text-gray-600' }
        const filtered = lancamentos.filter((l: any) => {
          const year = l.data_competencia?.slice(0, 4)
          return year && Number(year) === anoFiltro
        })

        type CCRow = { cc_id: string; cc_label: string; cc_tipo: string; receita: number; despesa: number }
        const byCC: Record<string, CCRow> = {}
        filtered.forEach((l: any) => {
          const ccId = l.centro_custo_id || 'sem_cc'
          const ccLabel = l.centros_custo ? `${l.centros_custo.codigo} — ${l.centros_custo.nome}` : l.centro_custo || 'Sem CC'
          const ccTipo = l.centros_custo?.tipo || ''
          if (!byCC[ccId]) byCC[ccId] = { cc_id: ccId, cc_label: ccLabel, cc_tipo: ccTipo, receita: 0, despesa: 0 }
          const v = Number(l.valor || 0)
          if (l.tipo === 'receita' && l.natureza !== 'financiamento') byCC[ccId].receita += v
          else if (l.tipo === 'despesa' && !l.is_provisao) byCC[ccId].despesa += v
        })
        const rows = Object.values(byCC).sort((a, b) => (b.receita - b.despesa) - (a.receita - a.despesa))
        const totRec = rows.reduce((s, r) => s + r.receita, 0)
        const totDesp = rows.reduce((s, r) => s + r.despesa, 0)
        const totRes = totRec - totDesp

        return (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Resultado por Centro de Custo — {anoFiltro}</h3>
              <select value={anoFiltro} onChange={e => setAnoFiltro(Number(e.target.value))}
                className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700">
                {anosDisponiveis.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100 bg-gray-50">
                {['Centro de Custo', 'Tipo', 'Receitas', 'Despesas', 'Resultado', 'Margem %'].map(h => (
                  <th key={h} className="text-right first:text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {rows.length > 0 ? rows.map(r => {
                  const res = r.receita - r.despesa
                  const margem = r.receita > 0 ? (res / r.receita * 100) : r.despesa > 0 ? -100 : 0
                  return (
                    <tr key={r.cc_id} className="border-b border-gray-50 hover:bg-gray-50/80">
                      <td className="px-4 py-2.5 font-medium text-left">{r.cc_label}</td>
                      <td className="px-4 py-2.5 text-right">
                        {r.cc_tipo ? <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${CC_TIPO_COLORS[r.cc_tipo] || 'bg-gray-100 text-gray-600'}`}>{r.cc_tipo.replace(/_/g, ' ')}</span> : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right text-green-600">{r.receita > 0 ? fmt(r.receita) : '—'}</td>
                      <td className="px-4 py-2.5 text-right text-red-600">{r.despesa > 0 ? fmt(r.despesa) : '—'}</td>
                      <td className={`px-4 py-2.5 text-right font-bold ${res >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(res)}</td>
                      <td className={`px-4 py-2.5 text-right font-bold ${margem >= 0 ? 'text-green-700' : 'text-red-700'}`}>{r.receita > 0 || r.despesa > 0 ? `${margem.toFixed(1)}%` : '—'}</td>
                    </tr>
                  )
                }) : <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">Sem lancamentos para o periodo.</td></tr>}
                {rows.length > 0 && (
                  <tr className="bg-gray-50 font-bold border-t border-gray-200">
                    <td className="px-4 py-3 text-left" colSpan={2}>TOTAL</td>
                    <td className="px-4 py-3 text-right text-green-700">{fmt(totRec)}</td>
                    <td className="px-4 py-3 text-right text-red-700">{fmt(totDesp)}</td>
                    <td className={`px-4 py-3 text-right ${totRes >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(totRes)}</td>
                    <td className={`px-4 py-3 text-right ${totRec > 0 && totRes / totRec >= 0 ? 'text-green-700' : 'text-red-700'}`}>{totRec > 0 ? `${(totRes / totRec * 100).toFixed(1)}%` : '—'}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )
      })()}

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
              {despFinOficial > 0 && (<>
                <tr><td colSpan={3} className="px-4 pt-3 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Resultado Financeiro</td></tr>
                <DreLine label="Despesas Financeiras e Amortizações" valor={despFinOficial} base={receitaBruta} indent negative />
              </>)}
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
