'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import { ADMISSAO_STEPS_FIELDS } from '@/lib/admissao-steps-config'
import { Check, Square, ChevronUp, ChevronDown, ArrowLeft, X } from 'lucide-react'
import Link from 'next/link'

interface Props {
  funcionario: any
  step: string
  workflowId: string
}

export default function AdmissaoStepPanel({ funcionario, step, workflowId }: Props) {
  const config = ADMISSAO_STEPS_FIELDS[step]
  const router = useRouter()
  const toast = useToast()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [func, setFunc] = useState(funcionario)

  // Refresh func data periodically to catch saves from the edit page
  useEffect(() => {
    setFunc(funcionario)
  }, [funcionario])

  if (!config) return null

  const campos = config.campos
  const obrigatorios = campos.filter(c => c.obrigatorio)
  const opcionais = campos.filter(c => !c.obrigatorio)

  function isFilled(field: string): boolean {
    const val = func[field]
    if (val === null || val === undefined || val === '') return false
    return true
  }

  const filledObrigatorios = obrigatorios.filter(c => isFilled(c.field)).length
  const filledOpcionais = opcionais.filter(c => isFilled(c.field)).length
  const filledTotal = filledObrigatorios + filledOpcionais
  const totalCampos = campos.length
  const percentage = totalCampos > 0 ? Math.round((filledTotal / totalCampos) * 100) : 0
  const allRequiredFilled = filledObrigatorios === obrigatorios.length

  function handleFieldClick(field: string) {
    // Navigate to edit page with field focus
    const editUrl = `/funcionarios/${func.id}/editar?field=${field}&from=admissao&workflow_id=${workflowId}&step=${step}`
    router.push(editUrl)
  }

  async function handleConcluir() {
    if (!allRequiredFilled) return
    setSaving(true)
    try {
      // Map step name to the workflow column
      const etapaColumn = step === 'docs_pessoais' ? 'etapa_docs_pessoais' : `etapa_${step}`
      const { error } = await supabase
        .from('admissoes_workflow')
        .update({ [etapaColumn]: true })
        .eq('id', workflowId)
      if (error) throw error
      toast.success('Etapa concluida!', `${config.label} marcada como completa.`)
      router.push('/rh/admissoes')
      router.refresh()
    } catch (e: any) {
      toast.error('Erro ao concluir etapa', e?.message || 'Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  function FieldItem({ campo }: { campo: { field: string; label: string; obrigatorio: boolean } }) {
    const filled = isFilled(campo.field)
    return (
      <button
        onClick={() => !filled && handleFieldClick(campo.field)}
        className={`w-full flex items-center gap-2 py-1.5 px-2 rounded-lg text-left text-xs transition-colors ${
          filled
            ? 'text-green-700 bg-green-50/50'
            : 'text-gray-500 hover:bg-gray-50 cursor-pointer'
        }`}
        disabled={filled}
      >
        {filled ? (
          <Check className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
        ) : (
          <Square className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
        )}
        <span className={filled ? 'line-through opacity-60' : ''}>{campo.label}</span>
        {campo.obrigatorio && !filled && (
          <span className="text-[9px] text-red-400 font-bold ml-auto">*</span>
        )}
      </button>
    )
  }

  // ─── Desktop sidebar ───
  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-100">
        <Link
          href="/rh/admissoes"
          className="flex items-center gap-1.5 text-xs text-brand hover:text-brand-dark font-semibold mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar a admissao
        </Link>
        <h3 className="text-sm font-bold text-gray-900">{config.label}</h3>
        <p className="text-[11px] text-gray-400 mt-0.5">
          Preencha os campos obrigatorios para concluir esta etapa.
        </p>
      </div>

      {/* Progress bar */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1.5">
          <span>{filledTotal}/{totalCampos} campos</span>
          <span className="font-bold">{percentage}%</span>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              allRequiredFilled ? 'bg-green-500' : 'bg-brand'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Field lists */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {obrigatorios.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 px-1">
              Obrigatorios ({filledObrigatorios}/{obrigatorios.length})
            </p>
            <div className="space-y-0.5">
              {obrigatorios.map(c => <FieldItem key={c.field} campo={c} />)}
            </div>
          </div>
        )}
        {opcionais.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 px-1">
              Opcionais ({filledOpcionais}/{opcionais.length})
            </p>
            <div className="space-y-0.5">
              {opcionais.map(c => <FieldItem key={c.field} campo={c} />)}
            </div>
          </div>
        )}
      </div>

      {/* Concluir button */}
      <div className="px-4 py-3 border-t border-gray-100">
        <button
          onClick={handleConcluir}
          disabled={!allRequiredFilled || saving}
          className={`w-full py-2.5 rounded-xl text-sm font-bold transition-colors ${
            allRequiredFilled
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          {saving ? 'Salvando...' : allRequiredFilled ? 'Concluir esta etapa' : `Faltam ${obrigatorios.length - filledObrigatorios} obrigatorios`}
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:block fixed right-0 top-0 w-[280px] h-screen bg-white border-l border-gray-200 shadow-lg z-30">
        {sidebarContent}
      </div>

      {/* Mobile bottom bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40">
        {mobileOpen && (
          <div className="bg-white border-t border-gray-200 shadow-2xl rounded-t-2xl max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 sticky top-0 bg-white">
              <h3 className="text-sm font-bold text-gray-900">{config.label}</h3>
              <button onClick={() => setMobileOpen(false)} className="text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-3 py-3 space-y-3">
              {obrigatorios.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 px-1">
                    Obrigatorios ({filledObrigatorios}/{obrigatorios.length})
                  </p>
                  <div className="space-y-0.5">
                    {obrigatorios.map(c => <FieldItem key={c.field} campo={c} />)}
                  </div>
                </div>
              )}
              {opcionais.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 px-1">
                    Opcionais ({filledOpcionais}/{opcionais.length})
                  </p>
                  <div className="space-y-0.5">
                    {opcionais.map(c => <FieldItem key={c.field} campo={c} />)}
                  </div>
                </div>
              )}
            </div>
            <div className="px-4 py-3 border-t border-gray-100 sticky bottom-0 bg-white">
              <button
                onClick={handleConcluir}
                disabled={!allRequiredFilled || saving}
                className={`w-full py-2.5 rounded-xl text-sm font-bold transition-colors ${
                  allRequiredFilled
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                {saving ? 'Salvando...' : allRequiredFilled ? 'Concluir esta etapa' : `Faltam ${obrigatorios.length - filledObrigatorios} obrigatorios`}
              </button>
            </div>
          </div>
        )}

        {/* Minimized bar */}
        <button
          onClick={() => setMobileOpen(prev => !prev)}
          className="w-full bg-brand text-white px-4 py-3 flex items-center justify-between"
        >
          <span className="text-sm font-semibold">
            {config.label} — {filledTotal}/{totalCampos} campos
          </span>
          {mobileOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>
    </>
  )
}
