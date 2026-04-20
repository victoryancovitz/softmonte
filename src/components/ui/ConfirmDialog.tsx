'use client'
import { useState, type ReactNode } from 'react'
import { AlertTriangle, Trash2, Info, X } from 'lucide-react'

type Variant = 'danger' | 'warning' | 'info'

type Options = {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: Variant
  requireTyping?: string
}

let resolveFn: ((v: boolean) => void) | null = null
let setStateFn: ((v: Options | null) => void) | null = null

export async function confirmDialog(opts: Options): Promise<boolean> {
  if (!setStateFn) return window.confirm(opts.message)
  return new Promise(resolve => {
    resolveFn = resolve
    setStateFn!(opts)
  })
}

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<Options | null>(null)
  const [typed, setTyped] = useState('')
  setStateFn = setOpts

  const close = (result: boolean) => {
    resolveFn?.(result)
    resolveFn = null
    setOpts(null)
    setTyped('')
  }

  const variantStyles = {
    danger: { bg: 'bg-red-50', icon: 'text-red-600', btn: 'bg-red-600 hover:bg-red-700', Icon: Trash2 },
    warning: { bg: 'bg-amber-50', icon: 'text-amber-600', btn: 'bg-amber-600 hover:bg-amber-700', Icon: AlertTriangle },
    info: { bg: 'bg-blue-50', icon: 'text-blue-600', btn: 'bg-blue-600 hover:bg-blue-700', Icon: Info },
  }

  return (
    <>
      {children}
      {opts && (() => {
        const s = variantStyles[opts.variant ?? 'warning']
        const typingOK = !opts.requireTyping || typed === opts.requireTyping
        return (
          <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => close(false)} onKeyDown={e => { if (e.key === 'Escape') close(false) }}>
            <div role="alertdialog" aria-labelledby="confirm-title"
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200"
              onClick={e => e.stopPropagation()}>
              <div className={`${s.bg} px-6 py-4 flex items-start gap-3`}>
                <div className={`${s.icon} mt-0.5`}><s.Icon className="w-6 h-6" /></div>
                <div className="flex-1">
                  <h2 id="confirm-title" className="font-semibold text-lg text-gray-900">{opts.title}</h2>
                </div>
                <button onClick={() => close(false)} className="text-gray-400 hover:text-gray-600" aria-label="Fechar">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="px-6 py-4 text-sm text-gray-700 whitespace-pre-line">{opts.message}</div>
              {opts.requireTyping && (
                <div className="px-6 pb-4">
                  <label className="text-xs text-gray-600 block mb-1.5">
                    Digite <strong className="text-red-600">{opts.requireTyping}</strong> para confirmar:
                  </label>
                  <input type="text" value={typed} onChange={e => setTyped(e.target.value)} autoFocus
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
                </div>
              )}
              <div className="px-6 py-4 bg-gray-50 flex justify-end gap-2 border-t border-gray-100">
                <button onClick={() => close(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                  {opts.cancelLabel ?? 'Cancelar'}
                </button>
                <button onClick={() => close(true)} disabled={!typingOK}
                  className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${s.btn} disabled:opacity-40 disabled:cursor-not-allowed`}>
                  {opts.confirmLabel ?? 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </>
  )
}
