'use client'
import { useState } from 'react'

interface Props {
  label: string
  confirmLabel?: string
  onConfirm: () => Promise<void> | void
  className?: string
  confirmClassName?: string
}

export default function ConfirmButton({ label, confirmLabel, onConfirm, className, confirmClassName }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    setLoading(true)
    try { await onConfirm() } finally { setLoading(false); setConfirming(false) }
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <button onClick={handleConfirm} disabled={loading}
          className={confirmClassName ?? 'text-xs px-2.5 py-1 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50'}>
          {loading ? '...' : confirmLabel ?? 'Confirmar?'}
        </button>
        <button onClick={() => setConfirming(false)}
          className="text-xs px-2 py-1 text-gray-500 hover:text-gray-700">
          Cancelar
        </button>
      </span>
    )
  }

  return (
    <button onClick={() => setConfirming(true)} className={className ?? 'text-xs text-red-500 hover:text-red-700'}>
      {label}
    </button>
  )
}
