'use client'

interface PontoAlertasProps {
  diasComExcesso: Record<string, number[]>
  temExcesso: boolean
}

export default function PontoAlertas({ diasComExcesso, temExcesso }: PontoAlertasProps) {
  if (!temExcesso) return null

  return (
    <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">
      <strong>⚠️ Excedente de HH contratadas:</strong>
      <ul className="mt-1 ml-4 list-disc space-y-0.5">
        {Object.entries(diasComExcesso).map(([cargo, dias]) => (
          <li key={cargo}>
            <strong>{cargo}</strong>: excedente em {dias.length} dia{dias.length > 1 ? 's' : ''} (dia{dias.length > 1 ? 's' : ''} {dias.join(', ')})
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-red-600">Dias acima do contratado não serão faturados. Verificar necessidade de aditivo.</p>
    </div>
  )
}
