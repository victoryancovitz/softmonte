'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import DrawerAdmissao from './DrawerAdmissao'

interface Props {
  funcionario: any
  workflow: any
}

export default function AdmissaoDrawerTrigger({ funcionario, workflow }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const router = useRouter()

  function handleEtapaConcluida() {
    router.refresh()
  }

  function handleNavigateTab(tab: string) {
    setDrawerOpen(false)
    // Dispatch custom event for FuncionarioTabs to pick up
    window.dispatchEvent(new CustomEvent('funcionario-tab-switch', { detail: { tab } }))
  }

  return (
    <>
      {/* Admission banner */}
      <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-sm font-semibold text-amber-800">Admissão em andamento</span>
        </div>
        <button
          onClick={() => setDrawerOpen(true)}
          className="text-xs text-amber-700 font-semibold hover:underline"
        >
          Continuar
        </button>
      </div>

      {/* Drawer */}
      <DrawerAdmissao
        funcionario={funcionario}
        workflow={workflow}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onEtapaConcluida={handleEtapaConcluida}
        onNavigateTab={handleNavigateTab}
      />
    </>
  )
}
