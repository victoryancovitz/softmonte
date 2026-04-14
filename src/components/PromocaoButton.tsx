'use client'
import { useState } from 'react'
import { TrendingUp } from 'lucide-react'
import PromocaoModal from '@/components/PromocaoModal'

interface Props {
  funcionario: any
  funcoes: any[]
}

export default function PromocaoButton({ funcionario, funcoes }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 border border-green-200 text-green-700 rounded-lg text-xs font-semibold hover:bg-green-50 flex items-center gap-1"
      >
        <TrendingUp className="w-3.5 h-3.5" />
        Registrar Promocao
      </button>
      {open && (
        <PromocaoModal
          funcionario={funcionario}
          funcoes={funcoes}
          onClose={() => {
            setOpen(false)
            // Refresh the page to reflect updated data
            window.location.reload()
          }}
        />
      )}
    </>
  )
}
