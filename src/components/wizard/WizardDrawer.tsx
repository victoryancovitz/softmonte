'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { WIZARD_STEPS, type WizardStepConfig } from '@/lib/wizard/config'
import { type AuditResult, type StepResult } from '@/lib/wizard/audit'

interface Props {
  audit: AuditResult | null
  onClose: () => void
  onRefresh: () => void
}

type StepStatus = 'done' | 'pending' | 'locked'

function getStepStatus(step: WizardStepConfig, audit: AuditResult | null): StepStatus {
  if (!audit) return 'locked'
  const result = audit[step.key]
  if (result?.ok) return 'done'
  // Check if all dependencies are done
  const depsOk = step.depends.every(depId => {
    const dep = WIZARD_STEPS.find(s => s.id === depId)
    return dep && audit[dep.key]?.ok
  })
  return depsOk ? 'pending' : 'locked'
}

const statusIcon: Record<StepStatus, string> = {
  done: '\u2705',
  pending: '\u26A0\uFE0F',
  locked: '\uD83D\uDD12',
}

const statusColor: Record<StepStatus, string> = {
  done: 'border-green-500 bg-green-50',
  pending: 'border-amber-500 bg-amber-50',
  locked: 'border-gray-300 bg-gray-50',
}

const lineColor: Record<StepStatus, string> = {
  done: 'bg-green-400',
  pending: 'bg-amber-400',
  locked: 'bg-gray-300',
}

export default function WizardDrawer({ audit, onClose, onRefresh }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null)
  const [loading, setLoading] = useState(!audit)
  const [obrasInativas, setObrasInativas] = useState<{ id: string; nome: string }[]>([])
  const [activating, setActivating] = useState<string | null>(null)

  useEffect(() => {
    if (audit) setLoading(false)
  }, [audit])

  // Load inactive obras for step 4 expansion
  const loadObrasInativas = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('obras')
      .select('id, nome')
      .neq('status', 'ativo')
      .is('deleted_at', null)
      .order('nome')
      .limit(10)
    setObrasInativas(data ?? [])
  }, [])

  useEffect(() => {
    if (expanded === 4) loadObrasInativas()
  }, [expanded, loadObrasInativas])

  const handleActivateObra = async (obraId: string) => {
    setActivating(obraId)
    const supabase = createClient()
    await supabase.from('obras').update({ status: 'ativo' }).eq('id', obraId)
    await loadObrasInativas()
    onRefresh()
    setActivating(null)
  }

  const handleBypassAdmissao = async () => {
    // Mark all em_andamento workflows as bypass
    const supabase = createClient()
    await supabase
      .from('admissoes_workflow')
      .update({ status: 'bypass' })
      .eq('status', 'em_andamento')
    onRefresh()
  }

  const doneCount = audit
    ? WIZARD_STEPS.filter(s => audit[s.key]?.ok).length
    : 0
  const total = WIZARD_STEPS.length
  const pct = Math.round((doneCount / total) * 100)

  const toggle = (id: number) => setExpanded(prev => (prev === id ? null : id))

  const renderDetails = (step: WizardStepConfig, result: StepResult | undefined, status: StepStatus) => {
    if (status === 'locked') {
      const depNames = step.depends
        .map(depId => WIZARD_STEPS.find(s => s.id === depId)?.titulo)
        .filter(Boolean)
        .join(', ')
      return (
        <p className="text-sm text-gray-400 italic">
          Requer: {depNames}
        </p>
      )
    }

    return (
      <div className="space-y-2">
        {/* Sub-items */}
        {result?.subItems && result.subItems.length > 0 && (
          <ul className="space-y-1">
            {result.subItems.map((si, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span>{si.ok ? '\u2705' : '\u274C'}</span>
                <span className={si.ok ? 'text-gray-700' : 'text-gray-500'}>
                  {si.label}
                  {si.count !== undefined && ` (${si.count})`}
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* Detalhes text */}
        {result?.detalhes && !result.subItems && (
          <p className="text-sm text-gray-600">{result.detalhes}</p>
        )}

        {/* Count only */}
        {result?.count !== undefined && !result.subItems && !result.detalhes && (
          <p className="text-sm text-gray-600">{result.count} registro(s)</p>
        )}

        {/* Step 4: Obras ativar */}
        {step.id === 4 && status === 'pending' && obrasInativas.length > 0 && (
          <div className="mt-2 space-y-1">
            <p className="text-xs font-medium text-gray-500 uppercase">Obras inativas:</p>
            {obrasInativas.map(obra => (
              <div key={obra.id} className="flex items-center justify-between bg-white rounded px-2 py-1 border">
                <span className="text-sm truncate">{obra.nome}</span>
                <button
                  onClick={() => handleActivateObra(obra.id)}
                  disabled={activating === obra.id}
                  className="text-xs px-2 py-0.5 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                  {activating === obra.id ? '...' : 'Ativar'}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Step 7: Bypass admissoes */}
        {step.id === 7 && status === 'pending' && (
          <button
            onClick={handleBypassAdmissao}
            className="mt-1 text-xs px-3 py-1 bg-amber-600 text-white rounded hover:bg-amber-700"
          >
            Equipe ja integrada (bypass)
          </button>
        )}

        {/* Action link */}
        {step.rota && (
          <Link
            href={step.rota}
            onClick={onClose}
            className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800 mt-1"
          >
            {status === 'done' ? 'Ver' : 'Configurar'} &rarr;
          </Link>
        )}
      </div>
    )
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-[60] transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed top-0 right-0 h-full w-[500px] max-w-[90vw] bg-white shadow-2xl z-[61] flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b bg-gradient-to-r from-amber-50 to-white">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <span className="text-2xl">{'\uD83E\uDDD9'}</span> Setup Wizard
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            >
              &times;
            </button>
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  backgroundColor: pct === 100 ? '#16a34a' : '#c8960c',
                }}
              />
            </div>
            <span className="text-sm font-semibold text-gray-600 whitespace-nowrap">
              {doneCount}/{total}
            </span>
          </div>
        </div>

        {/* Body — timeline */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-gray-400">
              Carregando auditoria...
            </div>
          ) : (
            <div className="relative">
              {WIZARD_STEPS.map((step, idx) => {
                const status = getStepStatus(step, audit)
                const result = audit?.[step.key]
                const isExpanded = expanded === step.id
                const isLast = idx === WIZARD_STEPS.length - 1

                return (
                  <div key={step.id} className="relative flex gap-4">
                    {/* Timeline line + dot */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`flex items-center justify-center w-8 h-8 rounded-full border-2 text-sm flex-shrink-0 ${statusColor[status]}`}
                      >
                        {statusIcon[status]}
                      </div>
                      {!isLast && (
                        <div className={`w-0.5 flex-1 min-h-[24px] ${lineColor[status]}`} />
                      )}
                    </div>

                    {/* Content */}
                    <div className={`flex-1 pb-4 ${isLast ? '' : ''}`}>
                      <button
                        onClick={() => toggle(step.id)}
                        className="w-full text-left group"
                        disabled={status === 'locked' && !isExpanded}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold text-sm ${status === 'locked' ? 'text-gray-400' : 'text-gray-800'}`}>
                            {step.id}. {step.titulo}
                          </span>
                          <span className={`text-xs transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                            {'\u25B6'}
                          </span>
                        </div>
                        <p className={`text-xs mt-0.5 ${status === 'locked' ? 'text-gray-300' : 'text-gray-500'}`}>
                          {step.descricao}
                        </p>
                      </button>

                      {isExpanded && (
                        <div className="mt-2 pl-1 border-l-2 border-gray-200 ml-1 pl-3">
                          {renderDetails(step, result, status)}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-3 border-t bg-gray-50 flex items-center justify-between">
          <button
            onClick={onRefresh}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            {'\u21BB'} Atualizar
          </button>
          <span className="text-xs text-gray-400">
            {pct === 100 ? 'Tudo pronto!' : `${pct}% concluido`}
          </span>
        </div>
      </div>
    </>
  )
}
