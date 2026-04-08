'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { Plus, X, Loader2 } from 'lucide-react'
import { useToast } from '@/components/Toast'

export interface QuickCreateField {
  name: string
  label: string
  type?: 'text' | 'number' | 'select'
  required?: boolean
  placeholder?: string
  uppercase?: boolean
  default?: any
  options?: { value: string; label: string }[]
}

interface QuickCreateSelectProps {
  /** Tabela do Supabase */
  table: string
  /** Coluna usada como label visível */
  labelColumn?: string
  /** Valor atual selecionado */
  value: string
  /** Callback disparado ao selecionar ou criar */
  onChange: (id: string, record?: any) => void
  /** Filtros adicionais para a query de listagem (ex: { ativo: true }) */
  filter?: Record<string, any>
  /** Ordem */
  orderBy?: string
  /** Placeholder do select */
  placeholder?: string
  /** Campos do mini-form para criar inline */
  createFields: QuickCreateField[]
  /** Título do mini-form */
  createTitle?: string
  /** Classname do select */
  className?: string
  /** Mostra ícone + no botão de criar */
  buttonLabel?: string
  /** Callback quando os dados recarregam (pra notificar pai) */
  onOptionsChange?: (options: any[]) => void
  /** Se true, exibe coluna extra (ex: nome + categoria) */
  secondaryColumn?: string
}

export default function QuickCreateSelect({
  table,
  labelColumn = 'nome',
  value,
  onChange,
  filter = {},
  orderBy = 'nome',
  placeholder = 'Selecione...',
  createFields,
  createTitle = 'Criar novo',
  className = '',
  buttonLabel = 'Novo',
  onOptionsChange,
  secondaryColumn,
}: QuickCreateSelectProps) {
  const [options, setOptions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const supabase = createClient()
  const toast = useToast()
  const modalRef = useRef<HTMLDivElement>(null)

  async function load() {
    let q = supabase.from(table).select('*').order(orderBy)
    for (const [k, v] of Object.entries(filter)) {
      // null precisa usar .is() — .eq(k, null) gera SQL "k = null" que é sempre falso
      if (v === null) q = q.is(k, null)
      else q = q.eq(k, v)
    }
    const { data, error } = await q
    if (error) {
      console.error('[QuickCreateSelect]', table, 'load error:', error)
    }
    setOptions(data || [])
    onOptionsChange?.(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [table])

  function openCreate() {
    // Inicializa form com defaults
    const init: Record<string, any> = {}
    createFields.forEach(f => { if (f.default != null) init[f.name] = f.default })
    setFormData(init)
    setCreating(true)
    setTimeout(() => modalRef.current?.querySelector('input,select')?.dispatchEvent(new Event('focus')), 50)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      // Valida required
      for (const f of createFields) {
        if (f.required && !formData[f.name]) {
          toast.error(`${f.label} é obrigatório`)
          setSaving(false); return
        }
      }
      // Normaliza (uppercase + trim)
      const payload: Record<string, any> = { ...filter }
      createFields.forEach(f => {
        let v = formData[f.name]
        if (v == null || v === '') return
        if (f.type === 'number') v = Number(v)
        if (f.uppercase && typeof v === 'string') v = v.toUpperCase().trim()
        payload[f.name] = v
      })
      const { data: created, error } = await supabase.from(table).insert(payload).select().single()
      if (error) {
        console.error('[QuickCreateSelect]', table, 'insert failed:', error, 'payload:', payload)
        throw error
      }
      toast.success('Criado com sucesso')
      await load()
      onChange(created.id, created)
      setCreating(false)
    } catch (err: any) {
      const msg = err?.message || err?.details || err?.hint || String(err) || 'erro desconhecido'
      toast.error('Erro ao criar: ' + msg)
      console.error('[QuickCreateSelect] handleCreate error:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`relative ${className}`}>
      <div className="flex gap-2">
        <select
          value={value}
          onChange={e => {
            const rec = options.find(o => o.id === e.target.value)
            onChange(e.target.value, rec)
          }}
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand"
          disabled={loading}
        >
          <option value="">{loading ? 'Carregando...' : placeholder}</option>
          {options.map(o => (
            <option key={o.id} value={o.id}>
              {o[labelColumn]}
              {secondaryColumn && o[secondaryColumn] ? ` — ${o[secondaryColumn]}` : ''}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={openCreate}
          className="px-3 py-2 bg-brand text-white rounded-lg text-sm font-semibold hover:bg-brand-dark flex items-center gap-1 whitespace-nowrap"
          title={buttonLabel}
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">{buttonLabel}</span>
        </button>
      </div>

      {creating && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4">
          <div ref={modalRef} className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-sm font-bold text-brand">{createTitle}</h3>
              <button onClick={() => setCreating(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              {createFields.map(f => (
                <div key={f.name}>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    {f.label} {f.required && <span className="text-red-500">*</span>}
                  </label>
                  {f.type === 'select' ? (
                    <select
                      value={formData[f.name] ?? ''}
                      onChange={e => setFormData({ ...formData, [f.name]: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                    >
                      <option value="">— Selecione —</option>
                      {f.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    <input
                      type={f.type === 'number' ? 'number' : 'text'}
                      step={f.type === 'number' ? '0.01' : undefined}
                      value={formData[f.name] ?? ''}
                      onChange={e => setFormData({ ...formData, [f.name]: e.target.value })}
                      placeholder={f.placeholder}
                      className={`w-full px-3 py-2 border border-gray-200 rounded-lg text-sm ${f.uppercase ? 'uppercase' : ''}`}
                      required={f.required}
                    />
                  )}
                </div>
              ))}
              <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setCreating(false)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  className="px-3 py-2 bg-brand text-white rounded-lg text-sm font-bold hover:bg-brand-dark disabled:opacity-50 flex items-center gap-1">
                  {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                  Criar e selecionar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
