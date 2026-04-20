'use client'
import { useState } from 'react'
import { validarCNJ, formatarCNJ } from '@/lib/juridico/cnj'

interface CNJInputProps {
  value: string
  onChange: (value: string) => void
  onValidChange?: (valid: boolean) => void
  className?: string
}

export default function CNJInput({ value, onChange, onValidChange, className }: CNJInputProps) {
  const [error, setError] = useState('')

  function handleBlur() {
    if (!value || value.trim() === '') {
      setError('')
      onValidChange?.(true)
      return
    }
    const digitos = value.replace(/\D/g, '')
    if (digitos.length > 0 && digitos.length < 20) {
      setError('CNJ incompleto — formato: NNNNNNN-DD.AAAA.J.TR.OOOO')
      onValidChange?.(false)
      return
    }
    if (digitos.length === 20) {
      if (validarCNJ(value)) {
        onChange(formatarCNJ(value))
        setError('')
        onValidChange?.(true)
      } else {
        setError('Dígito verificador inválido (algoritmo CNJ Res. 65/2008)')
        onValidChange?.(false)
      }
    }
  }

  return (
    <div>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={handleBlur}
        placeholder="0000000-00.0000.0.00.0000"
        className={`w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand ${error ? 'border-red-300 ring-red-200' : ''} ${className || ''}`}
      />
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}
