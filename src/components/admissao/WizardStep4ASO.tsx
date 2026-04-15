'use client'

import { useState } from 'react'
import { Upload, FileText, X } from 'lucide-react'

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

  function handleDataExameChange(value: string) {
    onChange('aso_data_exame', value)
    // Auto-fill vencimento +365 days
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
          O ASO admissional e obrigatorio antes do inicio das atividades. O vencimento e calculado automaticamente para 1 ano apos a data do exame.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Data do exame" required error={errors.aso_data_exame}>
          <input
            type="date"
            value={data.aso_data_exame ?? ''}
            onChange={e => handleDataExameChange(e.target.value)}
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

        <Field label="Medico" error={errors.aso_medico}>
          <input
            type="text"
            value={data.aso_medico ?? ''}
            onChange={e => onChange('aso_medico', e.target.value)}
            className={inp}
            placeholder="Nome do medico"
          />
        </Field>

        <Field label="CID" error={errors.aso_cid}>
          <input
            type="text"
            value={data.aso_cid ?? ''}
            onChange={e => onChange('aso_cid', e.target.value)}
            className={inp}
            placeholder="Codigo CID (opcional)"
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

      {/* File upload */}
      <div className="mt-6">
        <Field label="Arquivo do ASO" error={errors.aso_arquivo}>
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
              <span className="text-xs text-gray-400">PDF, JPG, PNG (max 10MB)</span>
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
