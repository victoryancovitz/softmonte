'use client'
import { useRouter, useSearchParams } from 'next/navigation'

export default function ViewToggle({ currentView }: { currentView: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function setView(v: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', v)
    router.push(`/funcionarios?${params.toString()}`)
  }

  return (
    <div className="flex border border-gray-200 rounded-lg overflow-hidden">
      <button onClick={() => setView('cards')}
        className={`px-3 py-1.5 text-xs font-medium transition-all ${currentView === 'cards' ? 'bg-brand text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
        Cards
      </button>
      <button onClick={() => setView('table')}
        className={`px-3 py-1.5 text-xs font-medium transition-all ${currentView === 'table' ? 'bg-brand text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
        Tabela
      </button>
    </div>
  )
}
