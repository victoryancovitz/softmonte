'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export function ExcluirFuncaoBtn({ funcaoId, nome }: { funcaoId: string; nome: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('funcoes').update({
        deleted_at: new Date().toISOString(),
        deleted_by: user?.id ?? null,
        ativo: false,
      }).eq('id', funcaoId)
      if (error) { alert('Erro ao excluir: ' + error.message); return }
      router.refresh()
    } finally {
      setLoading(false)
      setConfirming(false)
    }
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <button onClick={handleConfirm} disabled={loading}
          className="text-xs px-2.5 py-1 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50">
          {loading ? '...' : 'Confirmar?'}
        </button>
        <button onClick={() => setConfirming(false)} className="text-xs px-2 py-1 text-gray-500 hover:text-gray-700">Nao</button>
      </span>
    )
  }

  return (
    <button onClick={() => setConfirming(true)} className="text-xs text-red-500 hover:text-red-700">
      Excluir
    </button>
  )
}
