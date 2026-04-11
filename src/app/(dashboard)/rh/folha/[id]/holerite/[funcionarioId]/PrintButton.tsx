'use client'

export default function PrintButton() {
  return (
    <div className="no-print fixed top-4 right-4 z-50 flex gap-2">
      <button onClick={() => window.print()} className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium shadow-lg hover:bg-brand-dark">
        Imprimir / Salvar PDF
      </button>
      <button onClick={() => window.history.back()} className="px-4 py-2 bg-white text-gray-700 rounded-lg text-sm font-medium shadow-lg border border-gray-200">
        Voltar
      </button>
    </div>
  )
}
