'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import EmptyState from '@/components/ui/EmptyState'
import { Trash2 } from 'lucide-react'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

interface LixeiraItem {
  id: string
  nome: string
  valor: number
  tipo: string
  deleted_at: string
  deleted_reason: string | null
}

interface LixeiraClientProps {
  lancamentos: LixeiraItem[]
}

export default function LixeiraClient({ lancamentos: initial }: LixeiraClientProps) {
  const supabase = createClient()
  const toast = useToast()
  const [lancamentos, setLancamentos] = useState<LixeiraItem[]>(initial)
  const [restaurando, setRestaurando] = useState<string | null>(null)

  async function restaurar(id: string) {
    setRestaurando(id)
    const { error } = await supabase.rpc('restaurar_lancamento', { p_lancamento_id: id })
    if (error) {
      toast.error('Erro ao restaurar: ' + error.message)
      setRestaurando(null)
      return
    }
    setLancamentos(prev => prev.filter(l => l.id !== id))
    toast.success('Restaurado')
    setRestaurando(null)
  }

  if (lancamentos.length === 0) {
    return (
      <>
        <h1 className="text-xl font-bold font-display text-brand mb-1">Lixeira</h1>
        <p className="text-sm text-gray-500 mb-6">Itens excluídos nos últimos 30 dias</p>
        <EmptyState
          icone={<Trash2 size={48} />}
          titulo="Lixeira vazia"
          descricao="Nenhum lançamento excluído nos últimos 30 dias."
        />
      </>
    )
  }

  return (
    <>
      <h1 className="text-xl font-bold font-display text-brand mb-1">Lixeira</h1>
      <p className="text-sm text-gray-500 mb-6">Itens excluídos nos últimos 30 dias</p>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left px-4 py-3 font-medium text-gray-500">Nome</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Valor</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Excluido em</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Motivo</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500">Acao</th>
            </tr>
          </thead>
          <tbody>
            {lancamentos.map(l => (
              <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-4 py-3 text-gray-800">{l.nome || '—'}</td>
                <td className={`px-4 py-3 text-right font-medium ${l.tipo === 'receita' ? 'text-green-700' : 'text-red-700'}`}>
                  {fmt(Number(l.valor))}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {l.deleted_at ? new Date(l.deleted_at).toLocaleDateString('pt-BR') : '—'}
                </td>
                <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate">
                  {l.deleted_reason || '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => restaurar(l.id)}
                    disabled={restaurando === l.id}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-brand/10 text-brand hover:bg-brand/20 disabled:opacity-50 transition-colors"
                  >
                    {restaurando === l.id ? 'Restaurando...' : 'Restaurar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
