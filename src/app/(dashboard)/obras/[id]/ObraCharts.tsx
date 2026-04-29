'use client'

function getColor(value: number) {
  if (isNaN(value)) return '#22C55E'
  if (value > 95) return '#EF4444'
  if (value >= 80) return '#F59E0B'
  return '#22C55E'
}

function ProgressCircle({ value, label, color }: { value: number; label: string; color: string }) {
  const safeValue = isNaN(value) ? 0 : value
  const radius = 40, circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.min(safeValue, 100) / 100) * circumference
  return (
    <div className="flex flex-col items-center">
      <svg width="100" height="100" className="-rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#E2E8F0" strokeWidth="8" />
        <circle cx="50" cy="50" r={radius} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-700" />
      </svg>
      <div className="text-center -mt-16 mb-6">
        <div className="text-xl font-bold">{safeValue.toFixed(0)}%</div>
      </div>
      <div className="text-xs text-gray-500 font-medium">{label}</div>
    </div>
  )
}

interface ObraChartsProps {
  dataInicio: string | null
  dataPrevFim: string | null
  hhContratado: number
  hhConsumido: number
  valorContrato: number
  receitaRecebida: number
}

export default function ObraCharts({
  dataInicio,
  dataPrevFim,
  hhContratado,
  hhConsumido,
  valorContrato,
  receitaRecebida,
}: ObraChartsProps) {
  // Prazo: percentage of time elapsed
  let prazo = 0
  if (dataInicio && dataPrevFim) {
    const inicio = new Date(dataInicio + 'T12:00').getTime()
    const fim = new Date(dataPrevFim + 'T12:00').getTime()
    const agora = Date.now()
    const total = fim - inicio
    if (total > 0) {
      prazo = Math.max(0, ((agora - inicio) / total) * 100)
    }
  }

  // HH: percentage consumed vs contracted
  const hh = hhContratado > 0 ? (hhConsumido / hhContratado) * 100 : 0

  // Financeiro: percentage of revenue received vs contract value
  const financeiro = valorContrato > 0 ? (receitaRecebida / valorContrato) * 100 : 0

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
      <h2 className="text-sm font-semibold mb-5">Indicadores</h2>
      <div className="flex justify-around items-start">
        <ProgressCircle value={prazo} label="Prazo" color={getColor(prazo)} />
        <ProgressCircle value={hh} label="HH" color={getColor(hh)} />
        <ProgressCircle value={financeiro} label="Financeiro" color={getColor(financeiro)} />
      </div>
    </div>
  )
}
