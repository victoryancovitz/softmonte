'use client'

import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { confirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/Toast'
import { Trash2 } from 'lucide-react'

export function ExcluirFuncaoBtn({ funcaoId, nome }: { funcaoId: string; nome: string }) {
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()

  async function handleDelete() {
    if (!await confirmDialog({
      title: 'Excluir funcao?',
      message: `Excluir "${nome}"? Esta acao nao pode ser desfeita.`,
      variant: 'danger',
      confirmLabel: 'Excluir',
    })) return

    const { error } = await supabase.rpc('excluir_funcao', { p_id: funcaoId })
    if (error) {
      if (error.message.toLowerCase().includes('funcionario') || error.message.toLowerCase().includes('employee')) {
        toast.error('Nao e possivel excluir: existem funcionarios vinculados a esta funcao.')
      } else {
        toast.error('Erro ao excluir: ' + error.message)
      }
      return
    }
    toast.success('Funcao excluida')
    router.refresh()
  }

  return (
    <button
      onClick={handleDelete}
      className="text-xs text-red-500 hover:text-red-700 inline-flex items-center gap-1"
    >
      <Trash2 size={12} /> Excluir
    </button>
  )
}
