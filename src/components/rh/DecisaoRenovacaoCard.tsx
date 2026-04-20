'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { confirmDialog } from '@/components/ui/ConfirmDialog'

interface Props {
  funcionario_id: string
}

function formatDate(d: string | null): string {
  if (!d) return '--'
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + 'T12:00:00')
  const now = new Date()
  now.setHours(12, 0, 0, 0)
  return Math.round((target.getTime() - now.getTime()) / 86400000)
}

export default function DecisaoRenovacaoCard({ funcionario_id }: Props) {
  const supabase = createClient()
  const toast = useToast()
  const router = useRouter()

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    loadData()
  }, [funcionario_id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    setLoading(true)
    const { data: row } = await supabase
      .from('vw_prazos_legais')
      .select('*')
      .eq('funcionario_id', funcionario_id)
      .maybeSingle()
    setData(row)
    setLoading(false)
  }

  async function handleRenovar() {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/funcionarios/${funcionario_id}/renovacao`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisao: 'renovar' }),
      })
      if (!res.ok) throw new Error('Erro ao registrar decisão')
      toast.success('Contrato prorrogado para o 2o periodo')
      await loadData()
    } catch (e: any) {
      toast.error(e.message || 'Erro ao prorrogar')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleNaoRenovar() {
    const ok = await confirmDialog({
      title: 'Não prorrogar contrato?',
      message: 'O funcionário será encaminhado para desligamento ao fim do 1º período. Esta ação não pode ser desfeita.',
      confirmLabel: 'Confirmar',
      cancelLabel: 'Cancelar',
      variant: 'danger',
      requireTyping: 'NAO RENOVAR',
    })
    if (!ok) return
    const motivo = prompt('Informe o motivo (obrigatório):')
    if (!motivo?.trim()) { toast.warning('Motivo é obrigatório.'); return }
    if (!motivo) return

    setActionLoading(true)
    try {
      const res = await fetch(`/api/funcionarios/${funcionario_id}/renovacao`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisao: 'nao_renovar', observacao: motivo }),
      })
      if (!res.ok) throw new Error('Erro ao registrar decisão')
      toast.success('Decisão registrada. Desligamento será iniciado.')
      router.push('/rh/vencimentos')
    } catch (e: any) {
      toast.error(e.message || 'Erro ao registrar')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) return null
  if (!data) return null

  const { fase_contrato, renovacao_decisao, prazo_experiencia_1, prazo_experiencia_2, converte_clt_em, renovacao_data, renovacao_por } = data

  // CLT efetivado
  if (fase_contrato === 'clt_efetivado') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
        CLT efetivado
      </span>
    )
  }

  // 2o periodo em andamento
  if (fase_contrato === 'em_periodo_2') {
    const dias = converte_clt_em ? daysUntil(converte_clt_em) : null
    return (
      <div className="p-4 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-700">
        <p className="font-semibold">2o periodo em andamento</p>
        <p className="mt-1">
          Conversao para CLT em {formatDate(converte_clt_em)}
          {dias !== null && ` (${dias} dias)`}.
        </p>
      </div>
    )
  }

  // Decisao ja tomada: renovar
  if (renovacao_decisao === 'renovar') {
    return (
      <div className="p-4 rounded-xl border border-green-200 bg-green-50 text-sm text-green-800">
        <p className="font-semibold">Contrato prorrogado para o 2o periodo</p>
        <p className="mt-1">
          Registrado em {formatDate(renovacao_data)}
          {renovacao_por && ` por ${renovacao_por}`}.
        </p>
      </div>
    )
  }

  // Decisao ja tomada: nao renovar
  if (renovacao_decisao === 'nao_renovar') {
    return (
      <div className="p-4 rounded-xl border border-orange-200 bg-orange-50 text-sm text-orange-800">
        <p className="font-semibold">Contrato nao sera prorrogado</p>
        <p className="mt-1">
          Desligamento previsto para {formatDate(prazo_experiencia_1)}.
        </p>
      </div>
    )
  }

  // Em periodo 1, sem decisao
  if (fase_contrato === 'em_periodo_1' && !renovacao_decisao) {
    const dias = prazo_experiencia_1 ? daysUntil(prazo_experiencia_1) : null
    return (
      <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-sm">
        <p className="font-semibold text-amber-800">Decisao de Prorrogacao do 1o Periodo</p>
        {dias !== null && (
          <p className="mt-1 text-amber-700">
            Faltam {dias} dias para o fim do 1o periodo ({formatDate(prazo_experiencia_1)})
          </p>
        )}
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleRenovar}
            disabled={actionLoading}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
          >
            Prorrogar para o 2o periodo
          </button>
          <button
            onClick={handleNaoRenovar}
            disabled={actionLoading}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
          >
            Nao prorrogar (iniciar desligamento)
          </button>
        </div>
      </div>
    )
  }

  return null
}
