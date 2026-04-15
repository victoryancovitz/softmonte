'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { X, AlertTriangle } from 'lucide-react'

const MOTIVOS = [
  'Urgência operacional',
  'Atraso documentação',
  'Atraso RH',
  'Determinação diretoria',
] as const

function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date)
  let added = 0
  while (added < days) {
    result.setDate(result.getDate() + 1)
    const dow = result.getDay()
    if (dow !== 0 && dow !== 6) added++
  }
  return result
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

function addDays(date: Date, days: number): Date {
  const r = new Date(date)
  r.setDate(r.getDate() + days)
  return r
}

interface Props {
  funcionario: { id: string; nome: string }
  etapasPendentes: string[]
  onClose: () => void
  onSuccess: () => void
}

export default function ModalOverrideEmergencial({ funcionario, etapasPendentes, onClose, onSuccess }: Props) {
  const supabase = createClient()
  const toast = useToast()

  const hoje = new Date()
  const hojeStr = toDateStr(hoje)
  const defaultPrazo = toDateStr(addBusinessDays(hoje, 5))
  const maxPrazo = toDateStr(addDays(hoje, 15))

  const [motivo, setMotivo] = useState<string>(MOTIVOS[0])
  const [dataLiberacao, setDataLiberacao] = useState(hojeStr)
  const [prazoRegularizacao, setPrazoRegularizacao] = useState(defaultPrazo)
  const [observacao, setObservacao] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [saving, setSaving] = useState(false)

  const prazoExcedido = prazoRegularizacao > maxPrazo
  const podeConfirmar = confirmacao === 'LIBERAR' && !saving

  async function handleConfirm() {
    if (!podeConfirmar) return
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error('Sessão expirada'); setSaving(false); return }

      // 1. Update funcionario
      const { error: e1 } = await supabase.from('funcionarios').update({
        data_inicio_ponto: dataLiberacao,
        status: 'disponivel',
      }).eq('id', funcionario.id)
      if (e1) throw e1

      // 2. Insert override audit record
      const { error: e2 } = await supabase.from('admissao_overrides').insert({
        funcionario_id: funcionario.id,
        autorizado_por: user.id,
        motivo,
        data_liberacao: dataLiberacao,
        prazo_regularizacao: prazoRegularizacao,
        etapas_pendentes: etapasPendentes,
        observacao: observacao || null,
      })
      if (e2) throw e2

      // 3. Notify RH and admin users
      const { data: targets } = await supabase.from('profiles')
        .select('user_id')
        .in('role', ['rh', 'admin'])
      if (targets && targets.length > 0) {
        const notificacoes = targets.map((t: any) => ({
          user_id: t.user_id,
          tipo: 'override_emergencial',
          titulo: `Liberação emergencial: ${funcionario.nome}`,
          mensagem: `Ponto liberado emergencialmente. Motivo: ${motivo}. Prazo: ${prazoRegularizacao}.`,
          link: `/funcionarios/${funcionario.id}`,
        }))
        await supabase.from('notificacoes').insert(notificacoes)
      }

      toast.success(`Ponto de ${funcionario.nome} liberado emergencialmente`)
      onSuccess()
    } catch (err: any) {
      toast.error('Erro ao liberar: ' + (err?.message ?? 'erro desconhecido'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-red-200 bg-red-50 rounded-t-xl">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h3 className="text-base font-bold text-red-700">Liberação Emergencial de Ponto</h3>
          </div>
          <button onClick={onClose} className="text-red-400 hover:text-red-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Info */}
          <p className="text-sm text-gray-600">
            <strong>{funcionario.nome}</strong> possui etapas pendentes na admissão. Ao confirmar, o ponto será liberado provisoriamente.
          </p>

          {/* Etapas pendentes as chips */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Etapas pendentes</label>
            <div className="flex flex-wrap gap-1.5">
              {etapasPendentes.map(e => (
                <span key={e} className="text-[10px] px-2 py-1 rounded-full font-bold bg-red-100 text-red-700 border border-red-200">
                  {e}
                </span>
              ))}
            </div>
          </div>

          {/* Motivo */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Motivo</label>
            <select value={motivo} onChange={e => setMotivo(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
              {MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {/* Data de início provisória */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Data de início provisória</label>
            <input type="date" value={dataLiberacao} max={hojeStr}
              onChange={e => setDataLiberacao(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>

          {/* Prazo regularização */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Prazo para regularização</label>
            <input type="date" value={prazoRegularizacao}
              onChange={e => setPrazoRegularizacao(e.target.value)}
              className={`w-full px-3 py-2.5 border rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand ${prazoExcedido ? 'border-red-400' : 'border-gray-200'}`} />
            {prazoExcedido && (
              <p className="text-[11px] text-red-600 font-semibold mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Prazo excede o máximo de 15 dias. Requer aprovação extra.
              </p>
            )}
          </div>

          {/* Observação */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Observação <span className="text-gray-400 font-normal">(opcional)</span></label>
            <textarea value={observacao} onChange={e => setObservacao(e.target.value)}
              rows={2} placeholder="Detalhes adicionais..."
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand resize-none" />
          </div>

          {/* Confirmação */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Digite <strong className="text-red-600">LIBERAR</strong> para confirmar
            </label>
            <input type="text" value={confirmacao} onChange={e => setConfirmacao(e.target.value)}
              placeholder="LIBERAR"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-400 font-mono" />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-semibold">
              Cancelar
            </button>
            <button onClick={handleConfirm} disabled={!podeConfirmar}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all ${
                podeConfirmar
                  ? 'bg-red-600 hover:bg-red-700 animate-pulse'
                  : 'bg-gray-300 cursor-not-allowed'
              }`}>
              {saving ? 'Liberando...' : 'Liberar ponto emergencialmente'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
