'use client'

import { useState } from 'react'
import { ClipboardList, ChevronRight } from 'lucide-react'

interface Props {
  funcName: string
  stepLabel: string
  onTogglePanel: () => void
}

export default function AdmissaoBanner({ funcName, stepLabel, onTogglePanel }: Props) {
  return (
    <div className="mb-4 bg-blue-600 text-white rounded-xl px-4 py-2.5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <ClipboardList className="w-4 h-4 flex-shrink-0" />
        <span className="text-sm font-medium truncate">
          Preenchendo <strong>{stepLabel}</strong> da admissao de <strong>{funcName}</strong>
        </span>
      </div>
      <button
        onClick={onTogglePanel}
        className="flex items-center gap-1 text-xs font-bold text-blue-100 hover:text-white flex-shrink-0"
      >
        Ver checklist
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
