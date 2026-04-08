'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import ImpactConfirmDialog from '@/components/ImpactConfirmDialog'

// Reusable inline confirm pattern
function useConfirm() {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  return { confirming, loading, setConfirming, setLoading }
}

function InlineConfirm({ label, onConfirm, className }: { label: string; onConfirm: () => Promise<void>; className?: string }) {
  const { confirming, loading, setConfirming, setLoading } = useConfirm()

  async function handleConfirm() {
    setLoading(true)
    try { await onConfirm() } finally { setLoading(false); setConfirming(false) }
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <button onClick={handleConfirm} disabled={loading}
          className="text-xs px-2.5 py-1 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50">
          {loading ? '...' : 'Confirmar?'}
        </button>
        <button onClick={() => setConfirming(false)} className="text-xs px-2 py-1 text-gray-500 hover:text-gray-700">Não</button>
      </span>
    )
  }

  return <button onClick={() => setConfirming(true)} className={className ?? 'text-xs text-red-500 hover:text-red-700'}>
    {label}
  </button>
}

// 1. Desativar funcionário (soft delete) — com ImpactConfirmDialog
export function DesativarFuncionarioBtn({ funcId, role }: { funcId: string; role: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  if (role !== 'admin') return null

  async function handleConfirm() {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('funcionarios').update({
      status: 'inativo',
      deleted_at: new Date().toISOString(),
      deleted_by: user?.id ?? null,
    }).eq('id', funcId)
    router.refresh()
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="px-4 py-2 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors">
        Desativar funcionário
      </button>
      <ImpactConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={handleConfirm}
        entity="funcionario"
        entityId={funcId}
        title="Desativar funcionário"
        action="O funcionário será marcado como inativo (soft-delete). Todos os dados históricos são preservados — ponto, folhas, BMs e documentos continuam acessíveis. Para reativar depois, remova o deleted_at via admin."
        actionType="deactivate"
        confirmLabel="Desativar mesmo assim"
      />
    </>
  )
}

// 2. Encerrar/Cancelar obra
export function ObraStatusBtns({ obraId, status, role }: { obraId: string; status: string; role: string }) {
  const router = useRouter()
  const supabase = createClient()
  if (role !== 'admin' || status === 'concluido' || status === 'cancelado') return null

  async function updateStatus(newStatus: string) {
    await supabase.from('obras').update({ status: newStatus }).eq('id', obraId)
    router.refresh()
  }

  return (
    <div className="flex items-center gap-2">
      <InlineConfirm label="Encerrar obra"
        className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50"
        onConfirm={() => updateStatus('concluido')} />
      <InlineConfirm label="Cancelar obra"
        className="px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs font-medium hover:bg-red-50"
        onConfirm={() => updateStatus('cancelado')} />
    </div>
  )
}

// 4. Encerrar alocação
export function EncerrarAlocacaoBtn({ alocacaoId, funcId, role }: { alocacaoId: string; funcId: string; role: string }) {
  const router = useRouter()
  const supabase = createClient()
  if (role !== 'admin' && role !== 'encarregado' && role !== 'engenheiro') return null

  return (
    <InlineConfirm label="Encerrar"
      className="text-xs text-red-500 hover:text-red-700 font-medium"
      onConfirm={async () => {
        const hoje = new Date()
        const dataHoje = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`
        await supabase.from('alocacoes').update({ ativo: false, data_fim: dataHoje }).eq('id', alocacaoId)
        // Check if func has other active alocations
        const { data: others } = await supabase.from('alocacoes').select('id').eq('funcionario_id', funcId).eq('ativo', true).neq('id', alocacaoId)
        if (!others || others.length === 0) {
          await supabase.from('funcionarios').update({ status: 'disponivel' }).eq('id', funcId)
        }
        router.refresh()
      }} />
  )
}

// 5. Excluir HH
export function ExcluirHHBtn({ hhId, nome, role }: { hhId: string; nome: string; role: string }) {
  const router = useRouter()
  const supabase = createClient()
  if (role !== 'admin') return null

  return (
    <InlineConfirm label="Excluir"
      onConfirm={async () => {
        await supabase.from('hh_lancamentos').delete().eq('id', hhId)
        router.refresh()
      }} />
  )
}

// 6. Excluir documento (soft delete)
export function ExcluirDocBtn({ docId, role }: { docId: string; role: string }) {
  const router = useRouter()
  const supabase = createClient()
  if (role !== 'admin') return null

  return (
    <InlineConfirm label="Excluir"
      onConfirm={async () => {
        const { data: { user } } = await supabase.auth.getUser()
        await supabase.from('documentos')
          .update({ deleted_at: new Date().toISOString(), deleted_by: user?.id ?? null })
          .eq('id', docId)
        router.refresh()
      }} />
  )
}

// 7. Excluir financeiro (soft delete)
export function ExcluirFinanceiroBtn({ lancId, role }: { lancId: string; role: string }) {
  const router = useRouter()
  const supabase = createClient()
  if (role !== 'admin') return null

  return (
    <InlineConfirm label="Excluir"
      onConfirm={async () => {
        const { data: { user } } = await supabase.auth.getUser()
        await supabase.from('financeiro_lancamentos')
          .update({ deleted_at: new Date().toISOString(), deleted_by: user?.id ?? null })
          .eq('id', lancId)
        router.refresh()
      }} />
  )
}

// 8. Excluir BM (soft delete) — com ImpactConfirmDialog
export function ExcluirBMBtn({ bmId, status, role }: { bmId: string; status: string; role: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  if (role !== 'admin') return null

  async function handleConfirm() {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('boletins_medicao')
      .update({ deleted_at: new Date().toISOString(), deleted_by: user?.id ?? null })
      .eq('id', bmId)
    router.push('/boletins')
    router.refresh()
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50">
        Excluir BM
      </button>
      <ImpactConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={handleConfirm}
        entity="bm"
        entityId={bmId}
        title="Excluir boletim de medição"
        action={`Status atual: ${status}. A exclusão afeta relatórios de margem, DRE real × BM e forecast. Operação soft-delete — reversível pelo admin.`}
        actionType="delete"
      />
    </>
  )
}

// 9. Zerar estoque
export function ZerarEstoqueBtn({ itemId, quantidade, unidade }: { itemId: string; quantidade: number; unidade: string }) {
  const router = useRouter()
  const supabase = createClient()
  if (quantidade <= 0) return null

  return (
    <InlineConfirm label={`Zerar estoque (${quantidade} ${unidade})`}
      className="text-xs text-red-500 hover:text-red-700 font-medium"
      onConfirm={async () => {
        await supabase.from('estoque_movimentacoes').insert({
          item_id: itemId, tipo: 'saida', quantidade,
          motivo: 'Zeragem de estoque',
        })
        await supabase.from('estoque_itens').update({ quantidade: 0 }).eq('id', itemId)
        router.refresh()
      }} />
  )
}
