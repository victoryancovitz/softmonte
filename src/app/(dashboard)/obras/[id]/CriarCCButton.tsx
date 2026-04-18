'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { useRouter } from 'next/navigation'

export default function CriarCCButton({ obraId, obraNome, dataInicio }: { obraId: string; obraNome: string; dataInicio?: string | null }) {
  const [creating, setCreating] = useState(false)
  const supabase = createClient()
  const toast = useToast()
  const router = useRouter()

  async function handleCreate() {
    setCreating(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('centros_custo')
        .insert({
          nome: obraNome,
          tipo: 'obra',
          obra_id: obraId,
          data_inicio: dataInicio || new Date().toISOString().slice(0, 10),
          ativo: true,
          created_by: user?.id ?? null,
        })
        .select('id, codigo')
        .single()
      if (error) throw error
      toast.success('Centro de custo criado', `Código: ${data?.codigo ?? '—'}`)
      router.refresh()
    } catch (e: any) {
      toast.error('Erro ao criar CC', e?.message ?? '')
    } finally {
      setCreating(false)
    }
  }

  return (
    <button onClick={handleCreate} disabled={creating}
      className="text-xs text-brand hover:underline disabled:opacity-50">
      {creating ? 'Criando...' : '+ Criar centro de custo'}
    </button>
  )
}
