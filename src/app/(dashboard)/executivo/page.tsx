'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import BackButton from '@/components/BackButton'
import { TrendingUp, DollarSign, AlertTriangle, Users, Calendar, Target, ArrowRight } from 'lucide-react'

export default function ExecutivoPage() {
  const [dre, setDre] = useState<any[]>([])
  const [dreMes, setDreMes] = useState<any[]>([])
  const [cashflow, setCashflow] = useState<any[]>([])
  const [alertas, setAlertas] = useState<any[]>([])
  const [rescPendentes, setRescPendentes] = useState<any[]>([])
  const [obras, setObras] = useState<any[]>([])
  const [contasSaldo, setContasSaldo] = useState(0)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    (async () => {
      const [d, dm, cf, al, rp, o, cs] = await Promise.all([
        supabase.from('vw_dre_obra').select('*'),
        supabase.from('vw_dre_obra_mes').select('*'),
        supabase.from('vw_cashflow_projetado').select('*'),
        supabase.from('vw_alertas').select('*').order('dias_restantes').limit(10),
        supabase.from('rescisoes').select('*, funcionarios(nome)').eq('status', 'rascunho').is('deleted_at', null),
        supabase.from('obras').select('*').eq('status', 'ativo').is('deleted_at', null),
        supabase.from('vw_contas_saldo').select('*'),
      ])
      setDre(d.data || [])
      setDreMes(dm.data || [])
      setCashflow(cf.data || [])
      setAlertas(al.data || [])
      setRescPendentes(rp.data || [])
      setObras(o.data || [])
      setContasSaldo((cs.data || []).reduce((s: number, c: any) => s + Number(c.saldo || 0), 0))
      setLoading(false)
    })()
  }, [])

  const fmt = (v: any) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const fmtK = (v: any) => {
    const n = Number(v || 0)
    if (Math.abs(n) >= 1000000) return `R$ ${(n/1000000).toFixed(2)}M`
    if (Math.abs(n) >= 1000) return `R$ ${(n/1000).toFixed(0)}k`
    return fmt(n)
  }

  // Margem real acumulada × alvo
  const totReceita = dreMes.reduce((s, m) => s + Number(m.receita_realizada || m.receita_prevista || 0), 0)
  const totCusto = dreMes.reduce((s, m) => s + Number(m.custo_mo_real || 0), 0)
  const margemBruta = totReceita - totCusto
  const margemPct = totReceita > 0 ? (margemBruta / totReceita * 100) : 0
  const alvoMedio = dre.length > 0 ? dre.reduce((s, o) => s + Number(o.margem_alvo_pct || 0), 0) / dre.length : 45

  // Cashflow próximos 30 dias
  const hoje = new Date().toISOString().slice(0, 10)
  const em30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  const cf30 = cashflow.filter(e => e.data >= hoje && e.data <= em30)
  const entrada30 = cf30.filter(e => Number(e.valor) > 0).reduce((s, e) => s + Number(e.valor), 0)
  const saida30 = cf30.filter(e => Number(e.valor) < 0).reduce((s, e) => s + Number(e.valor), 0)
  const saldo30 = contasSaldo + entrada30 + saida30

  // Próximo marco: contrato com menor data_prev_fim
  const proxContrato = obras.filter(o => o.data_prev_fim).sort((a, b) => a.data_prev_fim.localeCompare(b.data_prev_fim))[0]
  const diasParaFim = proxContrato ? Math.ceil((new Date(proxContrato.data_prev_fim).getTime() - Date.now()) / 86400000) : null

  if (loading) return <div className="p-6 text-gray-400 text-sm">Carregando...</div>

  const margemOk = margemPct >= alvoMedio
  const saldo30Ok = saldo30 >= 0

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/dashboard" />
        <span className="font-medium text-gray-700">Painel Executivo</span>
      </div>

      <h1 className="text-2xl font-bold font-display text-brand mb-1">Painel Executivo</h1>
      <p className="text-sm text-gray-500 mb-6">Saúde da operação em tempo real — margem, caixa, alertas e marcos.</p>

      {/* Hero: 2 cards principais */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        {/* Margem real × alvo */}
        <div className={`rounded-2xl shadow-sm border p-5 ${margemOk ? 'bg-gradient-to-br from-green-50 to-white border-green-200' : 'bg-gradient-to-br from-red-50 to-white border-red-200'}`}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Margem Real Acumulada</div>
              <div className={`text-4xl font-bold font-display mt-1 ${margemOk ? 'text-green-700' : 'text-red-700'}`}>
                {margemPct.toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500 mt-1">Alvo: {alvoMedio.toFixed(0)}% · Resultado: {fmtK(margemBruta)}</div>
            </div>
            <Target className={`w-8 h-8 ${margemOk ? 'text-green-500' : 'text-red-500'}`} />
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${margemOk ? 'bg-green-500' : 'bg-red-500'}`}
                 style={{ width: `${Math.min(margemPct / alvoMedio * 100, 100)}%` }} />
          </div>
          <div className="mt-3 text-xs text-gray-500 flex justify-between">
            <span>Receita: <strong>{fmtK(totReceita)}</strong></span>
            <span>Custo MO: <strong>{fmtK(totCusto)}</strong></span>
          </div>
          <Link href="/relatorios/margem" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
            Ver DRE completo <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Cashflow 30d */}
        <div className={`rounded-2xl shadow-sm border p-5 ${saldo30Ok ? 'bg-gradient-to-br from-blue-50 to-white border-blue-200' : 'bg-gradient-to-br from-red-50 to-white border-red-200'}`}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Caixa Projetado (30 dias)</div>
              <div className={`text-4xl font-bold font-display mt-1 ${saldo30Ok ? 'text-blue-700' : 'text-red-700'}`}>
                {fmtK(saldo30)}
              </div>
              <div className="text-xs text-gray-500 mt-1">Saldo atual: {fmtK(contasSaldo)}</div>
            </div>
            <DollarSign className={`w-8 h-8 ${saldo30Ok ? 'text-blue-500' : 'text-red-500'}`} />
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="p-2 bg-white/60 rounded-lg">
              <div className="text-[10px] text-gray-400 font-semibold uppercase">Entradas</div>
              <div className="text-sm font-bold text-green-700">{fmtK(entrada30)}</div>
            </div>
            <div className="p-2 bg-white/60 rounded-lg">
              <div className="text-[10px] text-gray-400 font-semibold uppercase">Saídas</div>
              <div className="text-sm font-bold text-red-700">{fmtK(Math.abs(saida30))}</div>
            </div>
          </div>
          <Link href="/financeiro/cashflow" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
            Ver fluxo completo <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Linha secundária: marcos e obras */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1"><Users className="w-4 h-4 text-violet-500" /><span className="text-[10px] font-bold text-gray-400 uppercase">Obras ativas</span></div>
          <div className="text-2xl font-bold text-gray-900 font-display">{obras.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1"><Calendar className="w-4 h-4 text-amber-500" /><span className="text-[10px] font-bold text-gray-400 uppercase">Próximo fim de contrato</span></div>
          <div className="text-sm font-bold text-gray-900">
            {proxContrato ? (
              <>
                <div>{proxContrato.nome}</div>
                <div className={`text-xs font-normal ${(diasParaFim ?? 99) <= 30 ? 'text-red-600' : 'text-gray-500'}`}>
                  {diasParaFim !== null ? (diasParaFim >= 0 ? `${diasParaFim} dias` : `vencido há ${-diasParaFim}d`) : '—'}
                </div>
              </>
            ) : '—'}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1"><AlertTriangle className="w-4 h-4 text-red-500" /><span className="text-[10px] font-bold text-gray-400 uppercase">Alertas críticos</span></div>
          <div className="text-2xl font-bold text-red-700 font-display">{alertas.length}</div>
        </div>
      </div>

      {/* Alertas + rescisões pendentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-sm font-bold text-brand mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" /> Alertas operacionais
          </h3>
          {alertas.length > 0 ? (
            <ul className="space-y-2">
              {alertas.slice(0, 6).map((a: any, i: number) => (
                <li key={i} className="flex items-start gap-2 text-xs py-1.5 border-b border-gray-50 last:border-0">
                  <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${Number(a.dias_restantes) <= 7 ? 'bg-red-500' : Number(a.dias_restantes) <= 15 ? 'bg-amber-500' : 'bg-gray-300'}`} />
                  <div className="flex-1">
                    <div className="font-semibold text-gray-700">{a.descricao || a.tipo}</div>
                    <div className="text-gray-400">
                      {a.funcionario_nome || a.obra_nome || ''} · {Number(a.dias_restantes)} dias
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="text-xs text-gray-400">Nenhum alerta crítico.</p>}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-sm font-bold text-brand mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-500" /> Rescisões em rascunho
          </h3>
          {rescPendentes.length > 0 ? (
            <ul className="space-y-2">
              {rescPendentes.map((r: any) => (
                <li key={r.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <div>
                    <div className="text-xs font-semibold text-gray-700">{r.funcionarios?.nome}</div>
                    <div className="text-[10px] text-gray-400">{new Date(r.data_desligamento + 'T12:00').toLocaleDateString('pt-BR')}</div>
                  </div>
                  <Link href={`/rh/rescisoes/${r.id}`} className="text-[11px] text-brand font-semibold hover:underline">Revisar</Link>
                </li>
              ))}
            </ul>
          ) : <p className="text-xs text-gray-400">Nenhuma rescisão pendente.</p>}
        </div>
      </div>

      {/* Atalhos */}
      <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Link href="/rh/folha" className="p-3 bg-white rounded-lg border border-gray-100 hover:border-brand/50 transition-colors text-center text-xs font-semibold text-gray-700">Folha</Link>
        <Link href="/rh/rescisoes" className="p-3 bg-white rounded-lg border border-gray-100 hover:border-brand/50 transition-colors text-center text-xs font-semibold text-gray-700">Rescisões</Link>
        <Link href="/relatorios/absenteismo" className="p-3 bg-white rounded-lg border border-gray-100 hover:border-brand/50 transition-colors text-center text-xs font-semibold text-gray-700">Absenteísmo</Link>
        <Link href="/relatorios/bm-comparativo" className="p-3 bg-white rounded-lg border border-gray-100 hover:border-brand/50 transition-colors text-center text-xs font-semibold text-gray-700">BMs vs Real</Link>
      </div>
    </div>
  )
}
