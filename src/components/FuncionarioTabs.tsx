'use client'
import { useState, ReactNode } from 'react'
import { User, Briefcase, DollarSign, Clock, FileText, History, TrendingUp, AlertTriangle } from 'lucide-react'

export interface Tab {
  id: string
  label: string
  icon?: ReactNode
  badge?: number | string
  content: ReactNode
}

export default function FuncionarioTabs({ tabs, defaultTab }: { tabs: Tab[]; defaultTab?: string }) {
  const [active, setActive] = useState(defaultTab || tabs[0]?.id)
  const current = tabs.find(t => t.id === active) || tabs[0]

  return (
    <div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-5 overflow-hidden">
        <nav className="flex overflow-x-auto scrollbar-thin border-b border-gray-100">
          {tabs.map(t => {
            const isActive = t.id === active
            return (
              <button
                key={t.id}
                onClick={() => setActive(t.id)}
                className={`flex-shrink-0 px-4 sm:px-5 py-3 text-xs font-semibold whitespace-nowrap transition-colors relative flex items-center gap-2 ${
                  isActive ? 'text-brand' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                {t.icon}
                {t.label}
                {t.badge != null && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    isActive ? 'bg-brand/10 text-brand' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {t.badge}
                  </span>
                )}
                {isActive && <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-brand rounded-t-full" />}
              </button>
            )
          })}
        </nav>
      </div>
      <div>{current?.content}</div>
    </div>
  )
}

export const TAB_ICONS = {
  visao: <User className="w-3.5 h-3.5" />,
  contrato: <Briefcase className="w-3.5 h-3.5" />,
  remuneracao: <DollarSign className="w-3.5 h-3.5" />,
  ponto: <Clock className="w-3.5 h-3.5" />,
  docs: <FileText className="w-3.5 h-3.5" />,
  historico: <History className="w-3.5 h-3.5" />,
  salarial: <TrendingUp className="w-3.5 h-3.5" />,
  avisos: <AlertTriangle className="w-3.5 h-3.5" />,
}
