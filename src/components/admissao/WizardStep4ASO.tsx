'use client'

import { useState } from 'react'
import { Upload, FileText, X, AlertTriangle, AlertCircle } from 'lucide-react'

interface Props {
  data: any
  onChange: (field: string, value: any) => void
  errors: Record<string, string>
  onFileUpload: (file: File) => Promise<string | null>
}

const inp = 'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand'
const lbl = 'block text-xs font-semibold text-gray-700 mb-1'

function Field({ label, required, error, children }: {
  label: string; required?: boolean; error?: string; children: React.ReactNode
}) {
  return (
    <div>
      <label className={lbl}>
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

export default function WizardStep4ASO({ data, onChange, errors, onFileUpload }: Props) {
  const [uploading, setUploading] = useState(false)
  const [fileName, setFileName] = useState<string | null>(data.aso_arquivo_nome ?? null)

  const resultado = data.aso_resultado ?? ''
  const isInapto = resultado === 'inapto'
  const isAptoRestricoes = resultado === 'apto_restricoes'

  function handleDataRealizacaoChange(value: string) {
    onChange('aso_data_realizacao', value)
    // Espelha em aso_data_exame (campo persistido no banco)
    onChange('aso_data_exame', value)
    // Auto-preenche vencimento +365 dias
    if (value) {
      const date = new Date(value + 'T12:00:00')
      date.setFullYear(date.getFullYear() + 1)
      onChange('aso_data_vencimento', date.toISOString().slice(0, 10))
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const url = await onFileUpload(file)
      if (url) {
        onChange('aso_arquivo', url)
        onChange('aso_arquivo_nome', file.name)
        setFileName(file.name)
      }
    } finally {
      setUploading(false)
    }
  }

  function clearFile() {
    onChange('aso_arquivo', null)
    onChange('aso_arquivo_nome', null)
    setFileName(null)
  }

  return (
    <div className="max-w-2xl">
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6">
        <p className="text-sm text-blue-800 font-medium">Exame Admissional (ASO)</p>
        <p className="text-xs text-blue-600 mt-1">
          O ASO admissional é obrigatório antes do início das atividades. O vencimento é calculado automaticamente para 1 ano após a data de realização do exame.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Clínica" error={errors.aso_clinica}>
          <input
            type="text"
            value={data.aso_clinica ?? ''}
            onChange={e => onChange('aso_clinica', e.target.value)}
            className={inp}
            placeholder="Nome da clínica"
          />
        </Field>

        <Field label="Médico" error={errors.aso_medico}>
          <input
            type="text"
            value={data.aso_medico ?? ''}
            onChange={e => onChange('aso_medico', e.target.value)}
            className={inp}
            placeholder="Nome do médico"
          />
        </Field>

        <Field label="Data de agendamento" error={errors.aso_data_agendamento}>
          <input
            type="date"
            value={data.aso_data_agendamento ?? ''}
            onChange={e => onChange('aso_data_agendamento', e.target.value)}
            className={inp}
          />
        </Field>

        <Field label="Data de realização" required error={errors.aso_data_exame || errors.aso_data_realizacao}>
          <input
            type="date"
            value={data.aso_data_realizacao ?? data.aso_data_exame ?? ''}
            onChange={e => handleDataRealizacaoChange(e.target.value)}
            className={inp}
          />
        </Field>

        <Field label="Data de vencimento" required error={errors.aso_data_vencimento}>
          <input
            type="date"
            value={data.aso_data_vencimento ?? ''}
            onChange={e => onChange('aso_data_vencimento', e.target.value)}
            className={inp}
          />
        </Field>

        <Field label="Resultado" error={errors.aso_resultado}>
          <select
            value={resultado}
            onChange={e => onChange('aso_resultado', e.target.value)}
            className={inp}
          >
            <option value="">Selecione…</option>
            <option value="apto">Apto</option>
            <option value="apto_restricoes">Apto com restrições</option>
            <option value="inapto">Inapto</option>
          </select>
        </Field>

        <Field label="CID" error={errors.aso_cid}>
          <input
            type="text"
            value={data.aso_cid ?? ''}
            onChange={e => onChange('aso_cid', e.target.value)}
            className={inp}
            placeholder="Código CID (opcional)"
          />
        </Field>

        <Field label="Custo do ASO (R$)" error={errors.aso_custo}>
          <input
            type="number"
            step="0.01"
            value={data.aso_custo ?? ''}
            onChange={e => onChange('aso_custo', e.target.value)}
            className={inp}
            placeholder="0,00"
          />
        </Field>
      </div>

      {/* Banner + motivo: Inapto */}
      {isInapto && (
        <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-800">
                Funcionário inapto — não pode ser admitido.
              </p>
              <p className="text-xs text-red-700 mt-1">
                Registre o motivo e encerre o processo.
              </p>
            </div>
          </div>
          <div className="mt-4">
            <Field label="Motivo da inaptidão" required error={errors.aso_motivo_inapto}>
              <textarea
                value={data.aso_motivo_inapto ?? ''}
                onChange={e => onChange('aso_motivo_inapto', e.target.value)}
                className={`${inp} min-h-[88px]`}
                placeholder="Descreva o motivo da inaptidão informado pelo médico"
              />
            </Field>
          </div>
        </div>
      )}

      {/* Banner + observações: Apto com restrições */}
      {isAptoRestricoes && (
        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">
                Apto com restrições.
              </p>
              <p className="text-xs text-amber-700 mt-1">
                Descreva as restrições e recomendações indicadas no ASO.
              </p>
            </div>
          </div>
          <div className="mt-4">
            <Field label="Observações / Restrições" error={errors.aso_observacoes_restricao}>
              <textarea
                value={data.aso_observacoes_restricao ?? ''}
                onChange={e => onChange('aso_observacoes_restricao', e.target.value)}
                className={`${inp} min-h-[88px]`}
                placeholder="Ex: evitar esforço físico intenso, uso obrigatório de EPI auditivo, etc."
              />
            </Field>
          </div>
        </div>
      )}

      {/* Upload do arquivo */}
      <div className="mt-6">
        <Field label="Arquivo do ASO (PDF)" error={errors.aso_arquivo}>
          {fileName ? (
            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
              <FileText className="w-5 h-5 text-green-600 flex-shrink-0" />
              <span className="text-sm text-green-800 font-medium truncate flex-1">{fileName}</span>
              <button
                type="button"
                onClick={clearFile}
                className="p-1 hover:bg-green-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-green-600" />
              </button>
            </div>
          ) : (
            <label className={`flex flex-col items-center gap-2 p-6 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-brand hover:bg-brand/5 transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
              <Upload className="w-6 h-6 text-gray-400" />
              <span className="text-sm text-gray-500">
                {uploading ? 'Enviando...' : 'Clique para enviar PDF ou imagem'}
              </span>
              <span className="text-xs text-gray-400">PDF, JPG, PNG (máx. 10MB)</span>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          )}
        </Field>
      </div>
    </div>
  )
}
