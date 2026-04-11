'use client'

const fmt = (v: any) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const n = (v: any) => Number(v || 0)

export default function SimulacaoTributaria({ data }: { data: any }) {
  if (!data) return null

  const lpTotal = n(data.lp_pis) + n(data.lp_cofins) + n(data.lp_iss) + n(data.lp_irpj) + n(data.lp_csll)
  const lrTotal = n(data.lr_pis_bruto) + n(data.lr_cofins_bruto) + n(data.lr_iss) + n(data.lr_irpj) + n(data.lr_csll)
  const economia = lpTotal - lrTotal
  const receita = n(data.receita_periodo)
  const cargaLP = receita > 0 ? (lpTotal / receita * 100) : 0
  const cargaLR = receita > 0 ? (lrTotal / receita * 100) : 0
  const lucroLP = n(data.lucro_periodo) - lpTotal
  const lucroLR = n(data.lucro_periodo) - lrTotal
  const fator = n(data.fator_anual)
  const vantajoso = economia > 0

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Lucro Presumido */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="text-xs font-bold text-gray-400 uppercase mb-3">Lucro Presumido (atual)</div>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">PIS (0,65%)</span><span>{fmt(data.lp_pis)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">COFINS (3%)</span><span>{fmt(data.lp_cofins)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">ISS (2%)</span><span>{fmt(data.lp_iss)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">IRPJ (base 32%)</span><span>{fmt(data.lp_irpj)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">CSLL (base 32%)</span><span>{fmt(data.lp_csll)}</span></div>
            <div className="flex justify-between pt-2 border-t font-bold"><span>Total impostos</span><span className="text-red-700">{fmt(lpTotal)}</span></div>
            <div className="flex justify-between text-xs text-gray-400"><span>Carga tributária</span><span>{cargaLP.toFixed(1)}%</span></div>
            <div className="flex justify-between font-semibold"><span>Lucro líquido</span><span className="text-green-700">{fmt(lucroLP)}</span></div>
          </div>
        </div>

        {/* Lucro Real */}
        <div className={`bg-white rounded-xl shadow-sm border p-5 ${vantajoso ? 'border-green-300' : 'border-gray-100'}`}>
          <div className="text-xs font-bold text-gray-400 uppercase mb-3">Lucro Real (simulado)</div>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">PIS (1,65%)</span><span>{fmt(data.lr_pis_bruto)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">COFINS (7,6%)</span><span>{fmt(data.lr_cofins_bruto)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">ISS (2%)</span><span>{fmt(data.lr_iss)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">IRPJ (lucro real)</span><span>{fmt(data.lr_irpj)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">CSLL (lucro real)</span><span>{fmt(data.lr_csll)}</span></div>
            <div className="flex justify-between pt-2 border-t font-bold"><span>Total impostos</span><span className="text-red-700">{fmt(lrTotal)}</span></div>
            <div className="flex justify-between text-xs text-gray-400"><span>Carga tributária</span><span>{cargaLR.toFixed(1)}%</span></div>
            <div className="flex justify-between font-semibold"><span>Lucro líquido</span><span className="text-green-700">{fmt(lucroLR)}</span></div>
          </div>
        </div>
      </div>

      {/* Resultado */}
      <div className={`rounded-xl p-4 ${vantajoso ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className={`text-sm font-bold ${vantajoso ? 'text-green-700' : 'text-gray-700'}`}>
              {vantajoso ? `Lucro Real é mais vantajoso: economia de ${fmt(economia)}` : 'Lucro Presumido é mais vantajoso'}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {data.meses_base} meses · Anualizado: {fmt(economia * fator)}/ano
            </div>
          </div>
          <div className={`text-2xl font-bold ${vantajoso ? 'text-green-700' : 'text-gray-600'}`}>
            {vantajoso ? '-' : '+'}{fmt(Math.abs(economia))}
          </div>
        </div>
      </div>

      <div className="text-[9px] text-gray-400 italic">
        Simulação estimada. Consulte o contador antes de alterar o regime tributário. Prazo para opção: janeiro de cada ano.
      </div>
    </div>
  )
}
