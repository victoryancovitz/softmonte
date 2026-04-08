'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import ImpactConfirmDialog from '@/components/ImpactConfirmDialog'

interface Props {
  table: string
  id: string
  entityName: string
  redirectTo: string
  label?: string
  /** Nome lógico da entidade para cálculo de impacto (ex: 'obra', 'cliente', 'funcao', 'funcionario', 'tipo_contrato', 'categoria_financeira', 'bm') */
  impactEntity?: string
  /** Título customizado do dialog */
  impactTitle?: string
  /** Descrição customizada */
  impactAction?: string
}

export default function DeleteEntityButton({
  table,
  id,
  entityName,
  redirectTo,
  label = 'Excluir',
  impactEntity,
  impactTitle,
  impactAction,
}: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const router = useRouter()
  const toast = useToast()

  async function handleDelete() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase
      .from(table)
      .update({ deleted_at: new Date().toISOString(), deleted_by: user?.id ?? null })
      .eq('id', id)

    if (error) {
      toast.error('Erro ao excluir: ' + error.message)
      setLoading(false)
      return
    }
    toast.success('Registro excluído com sucesso')
    router.push(redirectTo)
    router.refresh()
  }

  // Se tem impactEntity definido, usa o dialog de impacto (mostra o que será afetado)
  if (impactEntity) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="px-4 py-2 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors"
        >
          {label}
        </button>
        <ImpactConfirmDialog
          open={open}
          onClose={() => setOpen(false)}
          onConfirm={handleDelete}
          entity={impactEntity}
          entityId={id}
          title={impactTitle || `Excluir ${entityName}`}
          action={impactAction || `A exclusão é feita como soft-delete (deleted_at). Os dados permanecem no banco e podem ser recuperados pelo admin.`}
          actionType="delete"
        />
      </>
    )
  }

  // Fallback: modal simples (legado)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-4 py-2 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors"
      >
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 7v4M10 14v.5" stroke="#dc2626" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="10" cy="10" r="8.5" stroke="#dc2626" strokeWidth="1.5"/>
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-gray-900">Confirmar exclusão</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Tem certeza que deseja excluir <strong>{entityName}</strong>? Esta ação não pode ser desfeita.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={loading}
                className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? 'Excluindo...' : 'Excluir definitivamente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
