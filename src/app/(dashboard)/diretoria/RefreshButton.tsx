'use client'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

export default function RefreshButton() {
  const router = useRouter()
  return (
    <button onClick={() => router.refresh()}
      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
      title="Atualizar dados">
      <RefreshCw className="w-3.5 h-3.5" />
      Atualizado em {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
    </button>
  )
}
