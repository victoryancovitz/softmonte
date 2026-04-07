'use client'
import { useState, useEffect } from 'react'
import { AlertTriangle, X, Loader2, Link2 } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { calcularImpacto, type ImpactEntry } from '@/lib/impact'

interface Props {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  /** Nome lógico da entidade (ex: 'funcao', 'funcionario', 'obra', 'cliente') */
  entity: string
  /** UUID do registro */
  entityId: string
  /** Título do dialog */
  title: string
  /** Descrição do que vai acontecer (ex: "Deletar esta função") */
  action: string
  /** Tipo de ação — muda a cor e o comportamento */
  actionType?: 'delete' | 'edit' | 'deactivate'
  /** Label do botão de confirmação */
  confirmLabel?: string
}

const SEVERIDADE_STYLE: Record<string, string> = {
  info: 'bg-gray-50 border-gray-200 text-gray-700',
  warn: 'bg-amber-50 border-amber-200 text-amber-700',
  critico: 'bg-red-50 border-red-200 text-red-700',
}

const SEVERIDADE_DOT: Record<string, string> = {
  info: 'bg-gray-400',
  warn: 'bg-amber-500',
  critico: 'bg-red-500',
}

export default function ImpactConfirmDialog({
  open, onClose, onConfirm, entity, entityId,
  title, action, actionType = 'delete', confirmLabel,
}: Props) {
  const [impactos, setImpactos] = useState<ImpactEntry[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [confirmacaoTexto, setConfirmacaoTexto] = useState('')
  const supabase = createClient()

  useEffect(() => {
    if (!open) {
      setImpactos(null); setConfirmacaoTexto('')
      return
    }
    setLoading(true)
    calcularImpacto(supabase, entity, entityId)
      .then(setImpactos)
      .finally(() => setLoading(false))
  }, [open, entity, entityId])

  if (!open) return null

  const temCritico = impactos?.some(i => i.severidade === 'critico') ?? false
  const temImpacto = (impactos?.length ?? 0) > 0
  const precisaDigitarExcluir = actionType === 'delete' && temCritico
  const podeProsseguir = !precisaDigitarExcluir || confirmacaoTexto.toUpperCase() === 'EXCLUIR'

  async function handleConfirm() {
    setSubmitting(true)
    try {
      await onConfirm()
    } finally {
      setSubmitting(false)
    }
  }

  const colorHeader = actionType === 'delete' ? 'text-red-700' : actionType === 'deactivate' ? 'text-amber-700' : 'text-blue-700'
  const colorBtn = actionType === 'delete'
    ? 'bg-red-600 hover:bg-red-700'
    : actionType === 'deactivate'
      ? 'bg-amber-600 hover:bg-amber-700'
      : 'bg-brand hover:bg-brand-dark'

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className={`w-6 h-6 ${colorHeader} flex-shrink-0 mt-0.5`} />
            <div>
              <h3 className={`text-base font-bold ${colorHeader}`}>{title}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{action}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading && (
          <div className="py-6 flex items-center justify-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" /> Calculando impactos...
          </div>
        )}

        {!loading && impactos !== null && (
          <>
            {!temImpacto ? (
              <div className="p-4 bg-green-50 border border-green-100 rounded-lg text-sm text-green-700 mb-4">
                Nenhum impacto detectado em outras áreas da plataforma.
              </div>
            ) : (
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Esta ação afeta:</p>
                <ul className="space-y-2">
                  {impactos.map((imp, i) => (
                    <li key={i} className={`p-3 rounded-lg border ${SEVERIDADE_STYLE[imp.severidade]}`}>
                      <div className="flex items-start gap-2">
                        <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${SEVERIDADE_DOT[imp.severidade]}`} />
                        <div className="flex-1">
                          <div className="text-sm font-semibold flex items-center gap-2">
                            <span>{imp.label}: <strong>{imp.count}</strong></span>
                            {imp.pagina && (
                              <Link href={imp.pagina} target="_blank" rel="noopener"
                                className="text-[10px] font-normal hover:underline flex items-center gap-0.5">
                                <Link2 className="w-3 h-3" /> abrir
                              </Link>
                            )}
                          </div>
                          {imp.detalhes && <p className="text-[11px] mt-0.5 opacity-80">{imp.detalhes}</p>}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {precisaDigitarExcluir && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <label className="block text-xs font-bold text-red-700 mb-1">
                  Para confirmar, digite <code className="px-1.5 py-0.5 bg-white rounded">EXCLUIR</code>
                </label>
                <input
                  type="text"
                  value={confirmacaoTexto}
                  onChange={e => setConfirmacaoTexto(e.target.value)}
                  className="w-full px-3 py-2 border border-red-300 rounded-md text-sm uppercase"
                  placeholder="EXCLUIR"
                />
              </div>
            )}

            <div className="flex gap-2 justify-end pt-3 border-t border-gray-100">
              <button onClick={onClose} disabled={submitting}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-semibold hover:bg-gray-50 disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={handleConfirm} disabled={submitting || !podeProsseguir}
                className={`px-4 py-2 text-white rounded-lg text-sm font-bold disabled:opacity-50 flex items-center gap-2 ${colorBtn}`}>
                {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
                {confirmLabel || (actionType === 'delete' ? 'Excluir mesmo assim' : 'Prosseguir')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
