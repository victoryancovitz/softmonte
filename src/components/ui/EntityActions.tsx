'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { confirmDialog } from '@/components/ui/ConfirmDialog'
import { MoreHorizontal, Pencil, Archive, Trash2, GitMerge } from 'lucide-react'

type EntityType = 'centro_custo' | 'funcionario' | 'cliente' | 'fornecedor' | 'categoria' | 'funcao' | 'conta_corrente' | 'socio'

interface EntityActionsProps {
  entity: EntityType
  id: string
  nome: string
  onEdit?: () => void
  onRefresh: () => void
  canDelete?: boolean
  role?: string
}

const ENTITY_CONFIG: Record<EntityType, {
  tabela: string
  label: string
  softDeleteOnly?: boolean
  deps: { tabela: string; campo: string; label: string }[]
}> = {
  centro_custo: {
    tabela: 'centros_custo',
    label: 'Centro de Custo',
    deps: [
      { tabela: 'financeiro_lancamentos', campo: 'centro_custo_id', label: 'lançamentos' },
      { tabela: 'funcionarios', campo: 'centro_custo_id', label: 'funcionários' },
      { tabela: 'alocacoes', campo: 'centro_custo_id', label: 'alocações' },
      { tabela: 'estoque_itens', campo: 'centro_custo_id', label: 'itens de estoque' },
      { tabela: 'cc_custos_fixos', campo: 'centro_custo_id', label: 'custos fixos' },
    ],
  },
  funcionario: {
    tabela: 'funcionarios',
    label: 'Funcionário',
    softDeleteOnly: true,
    deps: [
      { tabela: 'folha_itens', campo: 'funcionario_id', label: 'itens de folha' },
      { tabela: 'alocacoes', campo: 'funcionario_id', label: 'alocações' },
      { tabela: 'ponto_marcacoes', campo: 'funcionario_id', label: 'marcações de ponto' },
    ],
  },
  cliente: {
    tabela: 'clientes',
    label: 'Cliente',
    deps: [
      { tabela: 'obras', campo: 'cliente_id', label: 'obras' },
    ],
  },
  fornecedor: {
    tabela: 'fornecedores',
    label: 'Fornecedor',
    deps: [
      { tabela: 'financeiro_lancamentos', campo: 'fornecedor_id', label: 'lançamentos' },
    ],
  },
  categoria: {
    tabela: 'categorias_financeiras',
    label: 'Categoria',
    softDeleteOnly: true,
    deps: [],
  },
  funcao: {
    tabela: 'funcoes',
    label: 'Função',
    deps: [
      { tabela: 'funcionarios', campo: 'funcao_id', label: 'funcionários' },
      { tabela: 'alocacoes', campo: 'funcao_id', label: 'alocações' },
      { tabela: 'contrato_composicao', campo: 'funcao_id', label: 'composições' },
    ],
  },
  conta_corrente: {
    tabela: 'contas_correntes',
    label: 'Conta Corrente',
    deps: [
      { tabela: 'financeiro_lancamentos', campo: 'conta_id', label: 'lançamentos' },
    ],
  },
  socio: {
    tabela: 'socios',
    label: 'Sócio',
    deps: [
      { tabela: 'movimentacoes_societarias', campo: 'socio_id', label: 'movimentações' },
    ],
  },
}

export default function EntityActions({ entity, id, nome, onEdit, onRefresh, canDelete, role }: EntityActionsProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const toast = useToast()
  const config = ENTITY_CONFIG[entity]

  const isAdmin = !role || ['admin', 'diretoria'].includes(role)

  async function checkDeps(): Promise<{ label: string; count: number }[]> {
    const results: { label: string; count: number }[] = []
    for (const dep of config.deps) {
      const { count } = await supabase
        .from(dep.tabela)
        .select('id', { count: 'exact', head: true })
        .eq(dep.campo, id)
        .is('deleted_at', null)
      results.push({ label: dep.label, count: count || 0 })
    }
    return results
  }

  async function handleArchive() {
    setOpen(false)
    const ok = await confirmDialog({
      title: `Arquivar ${config.label}?`,
      message: `"${nome}" será marcado como inativo.\nO histórico será preservado, mas não aparecerá em novos formulários.`,
      variant: 'warning',
      confirmLabel: 'Arquivar',
    })
    if (!ok) return

    setLoading(true)
    const { error } = await supabase.from(config.tabela).update({ ativo: false }).eq('id', id)
    setLoading(false)
    if (error) return toast.error('Erro ao arquivar: ' + error.message)
    toast.success(`${config.label} arquivado`)
    onRefresh()
  }

  async function handleDelete() {
    setOpen(false)
    if (!isAdmin && !canDelete) {
      return toast.error('Apenas administradores podem excluir registros.')
    }

    setLoading(true)
    const deps = await checkDeps()
    const totalDeps = deps.reduce((s, d) => s + d.count, 0)
    setLoading(false)

    if (totalDeps > 0) {
      const depList = deps.filter(d => d.count > 0).map(d => `• ${d.count} ${d.label}`).join('\n')
      const ok = await confirmDialog({
        title: `${config.label} possui vínculos ativos`,
        message: `"${nome}" tem as seguintes dependências:\n\n${depList}\n\nRecomendamos arquivar em vez de excluir.\nExcluir com vínculos pode causar inconsistências.`,
        variant: 'danger',
        confirmLabel: 'Arquivar',
        cancelLabel: 'Cancelar',
      })
      if (ok) {
        // Arquivar em vez de excluir
        const { error } = await supabase.from(config.tabela).update({ ativo: false }).eq('id', id)
        if (error) return toast.error('Erro: ' + error.message)
        toast.success(`${config.label} arquivado (vínculos preservados)`)
        onRefresh()
      }
      return
    }

    // Sem dependências — pode excluir
    if (config.softDeleteOnly) {
      const ok = await confirmDialog({
        title: `Arquivar ${config.label}?`,
        message: `"${nome}" será marcado como inativo.`,
        variant: 'warning',
        confirmLabel: 'Arquivar',
      })
      if (!ok) return
      const { error } = await supabase.from(config.tabela).update({ ativo: false, deleted_at: new Date().toISOString() }).eq('id', id)
      if (error) return toast.error('Erro: ' + error.message)
      toast.success(`${config.label} arquivado`)
    } else {
      const ok = await confirmDialog({
        title: `Excluir ${config.label}?`,
        message: `"${nome}" será excluído permanentemente.\nEsta ação não pode ser desfeita.`,
        variant: 'danger',
        confirmLabel: 'Excluir',
      })
      if (!ok) return
      const { error } = await supabase.from(config.tabela).update({ deleted_at: new Date().toISOString() }).eq('id', id)
      if (error) return toast.error('Erro: ' + error.message)
      toast.success(`${config.label} excluído`)
    }
    onRefresh()
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} disabled={loading}
        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50">
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-40 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-1 animate-in fade-in zoom-in-95">
            {onEdit && (
              <button onClick={() => { setOpen(false); onEdit() }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700">
                <Pencil className="w-3.5 h-3.5" /> Editar
              </button>
            )}
            <button onClick={handleArchive}
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700">
              <Archive className="w-3.5 h-3.5" /> Arquivar
            </button>
            {isAdmin && !config.softDeleteOnly && (
              <button onClick={handleDelete}
                className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 flex items-center gap-2 text-red-600">
                <Trash2 className="w-3.5 h-3.5" /> Excluir
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
