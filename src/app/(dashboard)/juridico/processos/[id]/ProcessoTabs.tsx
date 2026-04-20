'use client'
import Link from 'next/link'

const TABS = [
  { key: 'geral', label: 'Geral' },
  { key: 'movimentacoes', label: 'Movimentações' },
  { key: 'audiencias', label: 'Audiências' },
  { key: 'acordo', label: 'Acordo' },
  { key: 'anexos', label: 'Anexos' },
  { key: 'financeiro', label: 'Financeiro' },
]

export default function ProcessoTabs({ currentTab, processoId }: { currentTab: string; processoId: string }) {
  return (
    <div className="flex border-b overflow-x-auto">
      {TABS.map(t => (
        <Link
          key={t.key}
          href={`/juridico/processos/${processoId}?tab=${t.key}`}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition ${currentTab === t.key ? 'border-brand text-brand' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  )
}
