import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'

export default async function RelatoriosPage() {
  const supabase = createClient()

  const [obras, funcs, hh, efetivo, financeiro, docs] = await Promise.all([
    supabase.from('obras').select('id,nome,cliente,status').eq('status','ativo'),
    supabase.from('funcionarios').select('id,nome,cargo,status,prazo1,prazo2'),
    supabase.from('hh_lancamentos').select('funcionario_id,obra_id,mes,ano,horas_normais,horas_extras,horas_noturnas,funcionarios(nome,cargo),obras(nome)').order('ano').order('mes'),
    supabase.from('efetivo_diario').select('obra_id,data,tipo_dia,funcionarios(cargo),obras(nome)').gte('data', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]),
    supabase.from('financeiro_lancamentos').select('tipo,valor,status,categoria,data_competencia,obra_id,obras(nome)').is('deleted_at', null),
    supabase.from('documentos').select('tipo,vencimento,funcionarios(nome)'),
  ])

  const hoje = new Date()

  // 1. Efetivo do mês atual por obra
  const efetivoMes: Record<string, number> = {}
  efetivo.data?.forEach((e: any) => {
    const k = e.obras?.nome ?? 'Sem obra'
    efetivoMes[k] = (efetivoMes[k] ?? 0) + 1
  })

  // 2. HH por obra (totais)
  const hhObra: Record<string, { normais: number; extras: number; noturnas: number }> = {}
  hh.data?.forEach((h: any) => {
    const k = h.obras?.nome ?? 'Sem obra'
    if (!hhObra[k]) hhObra[k] = { normais: 0, extras: 0, noturnas: 0 }
    hhObra[k].normais += Number(h.horas_normais ?? 0)
    hhObra[k].extras += Number(h.horas_extras ?? 0)
    hhObra[k].noturnas += Number(h.horas_noturnas ?? 0)
  })

  // 3. Financeiro por obra
  const finObra: Record<string, { rec: number; desp: number }> = {}
  financeiro.data?.forEach((f: any) => {
    const k = f.obras?.nome ?? 'Geral'
    if (!finObra[k]) finObra[k] = { rec: 0, desp: 0 }
    if (f.tipo === 'receita') finObra[k].rec += Number(f.valor)
    else finObra[k].desp += Number(f.valor)
  })

  // 4. Vencimentos críticos
  const vencDocs = docs.data?.filter((d: any) => {
    if (!d.vencimento) return false
    const dias = Math.ceil((new Date(d.vencimento+'T12:00').getTime() - hoje.getTime()) / 86400000)
    return dias <= 30
  }).map((d: any) => ({
    ...d,
    dias: Math.ceil((new Date(d.vencimento+'T12:00').getTime() - hoje.getTime()) / 86400000)
  })) ?? []

  const vencContratos = funcs.data?.filter((f: any) => {
    if (!f.prazo1) return false
    const dias = Math.ceil((new Date(f.prazo1+'T12:00').getTime() - hoje.getTime()) / 86400000)
    return dias <= 45 && dias >= -7
  }).map((f: any) => ({
    ...f,
    dias: Math.ceil((new Date(f.prazo1+'T12:00').getTime() - hoje.getTime()) / 86400000)
  })) ?? []

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold font-display text-brand">Relatórios</h1>
        <p className="text-sm text-gray-500 mt-0.5">Visão consolidada — {hoje.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p>
      </div>

      <div className="grid grid-cols-2 gap-5 mb-5">
        {/* Efetivo do mês */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="text-sm font-bold font-display text-brand mb-4">📋 Efetivo — {hoje.toLocaleDateString('pt-BR', { month: 'short' })}</h2>
          {Object.keys(efetivoMes).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(efetivoMes).sort((a,b) => b[1]-a[1]).map(([obra, total]) => (
                <div key={obra} className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 truncate">{obra}</span>
                  <span className="text-sm font-bold text-brand ml-2">{total} pess.-dia</span>
                </div>
              ))}
              <div className="pt-2 border-t border-gray-100 flex justify-between">
                <span className="text-xs font-bold text-gray-500">TOTAL</span>
                <span className="text-sm font-bold text-brand">{Object.values(efetivoMes).reduce((a,b)=>a+b,0)} pess.-dia</span>
              </div>
            </div>
          ) : <p className="text-sm text-gray-400">Nenhum efetivo registrado este mês.</p>}
        </div>

        {/* HH por obra */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="text-sm font-bold font-display text-brand mb-4">⏱️ HH por Obra</h2>
          {Object.keys(hhObra).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(hhObra).map(([obra, h]) => (
                <div key={obra} className="flex justify-between items-start">
                  <span className="text-sm text-gray-600 truncate">{obra}</span>
                  <div className="text-right ml-2 text-xs">
                    <div className="font-bold text-gray-900">{(h.normais + h.extras + h.noturnas).toFixed(0)}h total</div>
                    <div className="text-gray-400">{h.normais.toFixed(0)}N + {h.extras.toFixed(0)}E + {h.noturnas.toFixed(0)}Not</div>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-gray-400">Nenhum HH lançado.</p>}
        </div>

        {/* Financeiro por obra */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="text-sm font-bold font-display text-brand mb-4">💰 Resultado Financeiro por Obra</h2>
          {Object.keys(finObra).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(finObra).map(([obra, f]) => {
                const margem = f.rec - f.desp
                return (
                  <div key={obra} className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <div className="text-sm font-semibold text-gray-900 mb-1">{obra}</div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div><div className="text-gray-400">Receita</div><div className="font-bold text-green-700">{fmt(f.rec)}</div></div>
                      <div><div className="text-gray-400">Despesa</div><div className="font-bold text-red-700">{fmt(f.desp)}</div></div>
                      <div><div className="text-gray-400">Margem</div><div className={`font-bold ${margem >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(margem)}</div></div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : <p className="text-sm text-gray-400">Nenhum dado financeiro.</p>}
        </div>

        {/* Alertas de vencimento */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="text-sm font-bold font-display text-brand mb-4">🚨 Alertas de Vencimento</h2>
          {vencContratos.length === 0 && vencDocs.length === 0 ? (
            <div className="text-center py-4">
              <div className="text-2xl mb-2">✅</div>
              <p className="text-sm text-gray-500">Nenhum vencimento nos próximos 45 dias!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {vencContratos.map((f: any) => (
                <div key={f.id} className={`p-2.5 rounded-xl border text-xs ${f.dias < 0 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                  <div className="font-semibold text-gray-800">{f.nome}</div>
                  <div className={f.dias < 0 ? 'text-red-600' : 'text-amber-600'}>
                    Contrato {f.dias < 0 ? `venceu há ${Math.abs(f.dias)}d` : `vence em ${f.dias}d`} — {new Date(f.prazo1+'T12:00').toLocaleDateString('pt-BR')}
                  </div>
                </div>
              ))}
              {vencDocs.map((d: any) => (
                <div key={d.id} className={`p-2.5 rounded-xl border text-xs ${d.dias < 0 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                  <div className="font-semibold text-gray-800">{d.funcionarios?.nome} — {d.tipo}</div>
                  <div className={d.dias < 0 ? 'text-red-600' : 'text-amber-600'}>
                    {d.dias < 0 ? `Vencido há ${Math.abs(d.dias)}d` : `Vence em ${d.dias}d`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabela de funcionários por cargo */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <h2 className="text-sm font-bold text-gray-700">👷 Equipe por Cargo</h2>
        </div>
        <div className="p-5">
          {(() => {
            const byCargo: Record<string, number> = {}
            funcs.data?.forEach((f: any) => { byCargo[f.cargo] = (byCargo[f.cargo] ?? 0) + 1 })
            return (
              <div className="grid grid-cols-4 gap-3">
                {Object.entries(byCargo).sort((a,b)=>b[1]-a[1]).map(([cargo, qtd]) => (
                  <div key={cargo} className="bg-brand/5 rounded-xl p-3 text-center border border-brand/10">
                    <div className="text-2xl font-bold font-display text-brand">{qtd}</div>
                    <div className="text-xs text-gray-600 mt-0.5">{cargo}</div>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
