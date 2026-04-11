import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'
import BackButton from '@/components/BackButton'
import SimuladorDistribuicao from './SimuladorDistribuicao'

const fmt = (v: any) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const n = (v: any) => Number(v || 0)

function Badge({ valor, green, amber }: { valor: number | null; green: number; amber: number }) {
  if (valor === null) return <span className="text-gray-400">—</span>
  const cor = valor >= green ? 'text-green-700' : valor >= amber ? 'text-amber-600' : 'text-red-700'
  const label = valor >= green ? 'Excelente' : valor >= amber ? 'Adequado' : valor >= 0 ? 'Baixo' : 'Negativo'
  return <span className={`text-xs font-semibold ${cor}`}>{label}</span>
}

export default async function IndicadoresPage() {
  const supabase = createClient()
  const { data: ind } = await supabase.from('vw_indicadores_empresa').select('*').maybeSingle()

  if (!ind) return <div className="p-6 text-gray-400">Sem dados suficientes para calcular indicadores.</div>

  const lucroAnual = n(ind.lucro_anualizado)
  const multiplos = [1, 3, 5, 8, 10, 15]

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/rh/rentabilidade" />
        <Link href="/diretoria" className="text-gray-400 hover:text-gray-600">Diretoria</Link>
        <span className="text-gray-300">/</span>
        <Link href="/rh/rentabilidade" className="text-gray-400 hover:text-gray-600">Rentabilidade</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700">Indicadores</span>
      </div>

      <h1 className="text-xl font-bold font-display text-brand mb-1">Indicadores Financeiros</h1>
      <p className="text-sm text-gray-500 mb-6">Avaliação a 1× P/L · Base: {ind.meses_com_dados} meses · Anualizado por {n(ind.fator_anual).toFixed(0)}×</p>

      {/* Aviso metodológico */}
      <details className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
        <summary className="text-sm font-semibold text-blue-800 cursor-pointer">Como ler estes indicadores</summary>
        <div className="mt-2 text-xs text-blue-700 space-y-1">
          <p>Estes indicadores avaliam a Tecnomonte como se fosse listada a 1× P/L — valor de mercado = lucro anualizado.</p>
          <p>Com 1× P/L: cada R$1 de lucro = R$1 de valor. Empresas de serviços industriais costumam negociar entre 5× e 15× P/L.</p>
          <p>Dados anualizados de {ind.meses_com_dados} meses (fator {n(ind.fator_anual).toFixed(0)}×). Mais histórico = mais precisão.</p>
        </div>
      </details>

      {/* Valor de mercado */}
      <div className="bg-[#0F3757] text-white rounded-2xl p-6 mb-6">
        <div className="text-[11px] font-bold uppercase tracking-wider text-blue-200">Valor de Mercado Teórico (1× P/L)</div>
        <div className="text-4xl font-bold font-display mt-2">{fmt(ind.valor_mercado_1pl)}</div>
        <div className="text-xs text-blue-200 mt-1">Lucro anualizado × P/L (1×)</div>
        <div className="flex flex-wrap gap-3 mt-4 text-xs">
          <span className="bg-white/10 px-3 py-1 rounded">5× P/L: {fmt(lucroAnual * 5)}</span>
          <span className="bg-white/10 px-3 py-1 rounded">10× P/L: {fmt(lucroAnual * 10)}</span>
          <span className="bg-white/10 px-3 py-1 rounded">15× P/L: {fmt(lucroAnual * 15)}</span>
        </div>
        <div className="flex gap-6 mt-4 text-xs text-blue-200">
          <span>Lucro anualizado: {fmt(lucroAnual)}</span>
          <span>Receita: {fmt(ind.receita_anualizada)}/ano</span>
        </div>
      </div>

      {/* Indicadores de retorno */}
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Retorno sobre Capital</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="text-[10px] font-bold text-gray-400 uppercase">ROE</div>
          <div className="text-2xl font-bold font-display text-gray-900">{n(ind.roe_pct).toFixed(1)}%</div>
          <Badge valor={n(ind.roe_pct)} green={30} amber={15} />
          <div className="text-[10px] text-gray-400 mt-2">Lucro anualizado / PL estimado ({fmt(ind.pl_estimado)})</div>
          <div className="text-[10px] text-gray-400">Benchmark: Ibovespa ~15% | Setor ~20-40%</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="text-[10px] font-bold text-gray-400 uppercase">ROIC</div>
          <div className="text-2xl font-bold font-display text-gray-900">{n(ind.roic_pct).toFixed(1)}%</div>
          <Badge valor={n(ind.roic_pct)} green={30} amber={15} />
          <div className="text-[10px] text-gray-400 mt-2">Lucro / Capital investido ({fmt(ind.capital_investido)})</div>
          <div className="text-[10px] text-gray-400">Benchmark: Acima de 15% é excelente</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="text-[10px] font-bold text-gray-400 uppercase">P/VPA</div>
          <div className="text-2xl font-bold font-display text-gray-900">{n(ind.p_vpa).toFixed(2)}×</div>
          <div className="text-xs text-gray-500 mt-1">{n(ind.p_vpa) < 1 ? 'Barato' : n(ind.p_vpa) < 3 ? 'Razoável' : 'Caro'}</div>
          <div className="text-[10px] text-gray-400 mt-2">Valor mercado / PL estimado</div>
        </div>
      </div>

      {/* Fluxo de caixa */}
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Fluxo de Caixa</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="text-[10px] font-bold text-gray-400 uppercase">FCO Anualizado</div>
          <div className="text-xl font-bold font-display text-gray-900">{fmt(ind.fco_anualizado)}</div>
          <div className="text-[10px] text-gray-400 mt-1">Lucro + provisões não desembolsadas</div>
          <div className="text-[10px] text-gray-400">{fmt(n(ind.fco_anualizado) / 12)}/mês</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="text-[10px] font-bold text-gray-400 uppercase">FCL Anualizado</div>
          <div className="text-xl font-bold font-display text-gray-900">{fmt(ind.fcl_anualizado)}</div>
          <div className="text-[10px] text-gray-400 mt-1">FCO − CapEx ({fmt(ind.total_capex)})</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="text-[10px] font-bold text-gray-400 uppercase">FCFY</div>
          <div className="text-2xl font-bold font-display text-green-700">{n(ind.fcfy_pct).toFixed(1)}%</div>
          <Badge valor={n(ind.fcfy_pct)} green={10} amber={5} />
          <div className="text-[10px] text-gray-400 mt-2">FCL / Valor de mercado</div>
        </div>
      </div>

      {/* Dividendos */}
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Dividendos</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="text-[10px] font-bold text-gray-400 uppercase">DY — Dividend Yield</div>
          <div className="text-2xl font-bold font-display text-gray-900">{n(ind.dy_pct).toFixed(1)}%</div>
          <div className="text-[10px] text-gray-400 mt-2">Distribuições: {fmt(ind.distribuicoes)}</div>
          <div className="text-[10px] text-gray-400">Para DY de 10%: distribuir {fmt(lucroAnual * 0.1)}/ano</div>
          <div className="text-[10px] text-gray-400">→ {fmt(lucroAnual * 0.1 / 2)} por sócio (50%)</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="text-[10px] font-bold text-gray-400 uppercase">Payout Ratio</div>
          <div className="text-2xl font-bold font-display text-gray-900">{lucroAnual > 0 ? `${(n(ind.distribuicoes) * n(ind.fator_anual) / lucroAnual * 100).toFixed(1)}%` : '0,0%'}</div>
          <div className="text-[10px] text-gray-400 mt-2">Capacidade de pagar: {fmt(lucroAnual)}/ano</div>
        </div>
      </div>

      {/* Eficiência */}
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Eficiência Operacional</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="text-[10px] font-bold text-gray-400 uppercase">Margem Líquida</div>
          <div className="text-2xl font-bold font-display text-gray-900">{n(ind.margem_liquida_pct).toFixed(1)}%</div>
          <Badge valor={n(ind.margem_liquida_pct)} green={20} amber={10} />
          <div className="text-[10px] text-gray-400 mt-2">Benchmark: 10-20% é saudável</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="text-[10px] font-bold text-gray-400 uppercase">Giro do Capital</div>
          <div className="text-2xl font-bold font-display text-gray-900">{n(ind.giro_capital).toFixed(2)}×</div>
          <div className="text-[10px] text-gray-400 mt-2">Cada R$1 investido gera R${n(ind.giro_capital).toFixed(2)} em receita</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="text-[10px] font-bold text-gray-400 uppercase">Índice de Eficiência</div>
          <div className="text-2xl font-bold font-display text-gray-900">{n(ind.indice_eficiencia_pct).toFixed(1)}%</div>
          <div className="text-xs text-gray-500">{n(ind.indice_eficiencia_pct) < 70 ? 'Excelente' : n(ind.indice_eficiencia_pct) < 80 ? 'Bom' : 'Atenção'}</div>
          <div className="text-[10px] text-gray-400 mt-2">Despesa / Receita</div>
        </div>
      </div>

      {/* Cenários de valuation */}
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Cenários de Valuation</p>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 border-b border-gray-100">
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">P/L</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Valor Empresa</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Por Sócio (50%)</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">DY mín. (10%)</th>
          </tr></thead>
          <tbody>
            {multiplos.map(m => (
              <tr key={m} className={`border-b border-gray-50 ${m === 1 ? 'bg-brand/5 font-semibold' : 'hover:bg-gray-50'}`}>
                <td className="px-4 py-2.5">{m}× {m === 1 && <span className="text-[10px] text-brand">(base)</span>}</td>
                <td className="px-4 py-2.5 text-right">{fmt(lucroAnual * m)}</td>
                <td className="px-4 py-2.5 text-right">{fmt(lucroAnual * m / 2)}</td>
                <td className="px-4 py-2.5 text-right text-gray-500">{fmt(lucroAnual * m * 0.1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Simulador */}
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Simulador de Distribuição</p>
      <SimuladorDistribuicao lucroAnual={lucroAnual} lucroCaixa={n(ind.lucro_liquido_caixa)} />

      {/* Benchmark */}
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 mt-6">Benchmark vs Setor</p>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 border-b border-gray-100">
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Indicador</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tecnomonte</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Setor Ind.</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Ibovespa</th>
          </tr></thead>
          <tbody>
            {[
              { label: 'ROE', val: `${n(ind.roe_pct).toFixed(1)}%`, setor: '20-40%', ibov: '~15%', ok: n(ind.roe_pct) >= 20 },
              { label: 'ROIC', val: `${n(ind.roic_pct).toFixed(1)}%`, setor: '15-30%', ibov: '~12%', ok: n(ind.roic_pct) >= 15 },
              { label: 'Margem Líq.', val: `${n(ind.margem_liquida_pct).toFixed(1)}%`, setor: '10-20%', ibov: 'variável', ok: n(ind.margem_liquida_pct) >= 10 },
              { label: 'FCFY', val: `${n(ind.fcfy_pct).toFixed(1)}%`, setor: '5-15%', ibov: '5-8%', ok: n(ind.fcfy_pct) >= 5 },
              { label: 'DY', val: `${n(ind.dy_pct).toFixed(1)}%`, setor: '4-8%', ibov: '4-6%', ok: n(ind.dy_pct) >= 4 },
              { label: 'Giro Capital', val: `${n(ind.giro_capital).toFixed(2)}×`, setor: '2-6×', ibov: 'variável', ok: n(ind.giro_capital) >= 2 },
            ].map(r => (
              <tr key={r.label} className="border-b border-gray-50">
                <td className="px-4 py-2.5 font-medium">{r.label}</td>
                <td className="px-4 py-2.5 text-right font-semibold">{r.val} {r.ok ? '✅' : '⚠️'}</td>
                <td className="px-4 py-2.5 text-right text-gray-500">{r.setor}</td>
                <td className="px-4 py-2.5 text-right text-gray-400">{r.ibov}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Notas */}
      <div className="text-[9px] text-gray-400 space-y-1 mt-6">
        <p>1. Anualização: {ind.meses_com_dados} meses × {n(ind.fator_anual).toFixed(0)}. Mais histórico = mais precisão.</p>
        <p>2. P/L 1× é conservador. Empresas saudáveis do setor negociam entre 5× e 15× P/L.</p>
        <p>3. ROE/ROIC elevados resultam do baixo capital social (R$100k). Tendem a normalizar com acumulação de reservas.</p>
        <p>4. FCFY alto porque P/L=1× e FCL≈Lucro. Em múltiplos maiores, FCFY cai proporcionalmente.</p>
        <p>5. DY 0%: sem distribuições registradas. Use o simulador acima para projetar cenários.</p>
        <p>6. Sem CapEx registrado (FCL=FCO). Aquisição de ativos reduziria o FCL.</p>
      </div>
    </div>
  )
}
