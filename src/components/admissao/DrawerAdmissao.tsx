'use client'

import { X } from 'lucide-react'
import ChecklistAdmissao from '@/app/(dashboard)/rh/admissoes/ChecklistAdmissao'

interface Props {
  funcionario: any
  workflow: any
  open: boolean
  onClose: () => void
  onEtapaConcluida: () => void
  onNavigateTab?: (tab: string) => void
}

export default function DrawerAdmissao({ funcionario, workflow, open, onClose, onEtapaConcluida, onNavigateTab }: Props) {
  if (!open) return null

  function handleNavigateTab(tab: string) {
    onClose()
    onNavigateTab?.(tab)
  }

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/40 z-40 transition-opacity" onClick={onClose} />

      {/* Drawer panel */}
      <div className="fixed top-0 right-0 h-full w-full max-w-[420px] bg-white shadow-2xl z-50 flex flex-col overflow-hidden transition-transform duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-sm font-bold text-brand truncate">
            {'📋'} Admissão — {funcionario.nome_guerra || funcionario.nome}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Body: scrollable checklist */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <ChecklistAdmissao
            workflow={workflow}
            funcionario={funcionario}
            onUpdate={onEtapaConcluida}
            onNavigateTab={handleNavigateTab}
          />
        </div>
      </div>
    </>
  )
}
