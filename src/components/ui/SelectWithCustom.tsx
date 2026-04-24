'use client'
import { useState } from 'react'

interface Props {
  label: string
  value: string
  customValue?: string
  onChange: (value: string, customText?: string) => void
  options: Array<{ value: string; label: string }>
  required?: boolean
  otherValue?: string
  otherLabel?: string
}

export default function SelectWithCustom({
  label, value, customValue, onChange, options,
  required, otherValue = 'outros', otherLabel = 'Outro (digitar)',
}: Props) {
  const [showCustom, setShowCustom] = useState(value === otherValue && !!customValue)

  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1">{label}{required && ' *'}</label>
      <select
        value={showCustom ? otherValue : value}
        onChange={e => {
          const v = e.target.value
          if (v === otherValue) {
            setShowCustom(true)
            onChange(otherValue, customValue || '')
          } else {
            setShowCustom(false)
            onChange(v, undefined)
          }
        }}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        <option value={otherValue}>➕ {otherLabel}</option>
      </select>
      {showCustom && (
        <input
          value={customValue || ''}
          onChange={e => onChange(otherValue, e.target.value)}
          placeholder="Digite o nome..."
          className="w-full mt-1.5 px-3 py-2 border border-amber-200 bg-amber-50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          autoFocus
        />
      )}
    </div>
  )
}
