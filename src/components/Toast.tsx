'use client'
import { useState, useEffect, createContext, useContext, useCallback, useRef } from 'react'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface ToastItem {
  id: number
  message: string
  secondary?: string
  type: ToastType
  createdAt: number
}

interface ToastCtx {
  show: (message: string, type?: ToastType) => void
  success: (message: string, secondary?: string) => void
  error: (message: string, secondary?: string) => void
  warning: (message: string, secondary?: string) => void
}

const ToastContext = createContext<ToastCtx>({
  show: () => {},
  success: () => {},
  error: () => {},
  warning: () => {},
})

export function useToast() {
  return useContext(ToastContext)
}

const DURATION = 4000

const ICONS: Record<ToastType, React.ReactNode> = {
  success: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="8" stroke="white" strokeWidth="1.5" />
      <path d="M5.5 9l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  error: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="8" stroke="white" strokeWidth="1.5" />
      <path d="M6 6l6 6M12 6l-6 6" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  warning: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M9 2L1.5 16h15L9 2z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
      <path d="M9 7v4M9 13.5v.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  info: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="8" stroke="white" strokeWidth="1.5" />
      <path d="M9 8v5M9 5.5v.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
}

const COLORS: Record<ToastType, string> = {
  success: 'bg-green-600',
  error: 'bg-red-600',
  warning: 'bg-amber-600',
  info: 'bg-blue-600',
}

const PROGRESS_COLORS: Record<ToastType, string> = {
  success: 'bg-green-300',
  error: 'bg-red-300',
  warning: 'bg-amber-300',
  info: 'bg-blue-300',
}

function ToastBar({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const [progress, setProgress] = useState(100)
  const startRef = useRef(toast.createdAt)

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - startRef.current
      const pct = Math.max(0, 100 - (elapsed / DURATION) * 100)
      setProgress(pct)
      if (pct <= 0) {
        clearInterval(interval)
        onDismiss()
      }
    }, 50)
    return () => clearInterval(interval)
  }, [onDismiss])

  return (
    <div
      className={`${COLORS[toast.type]} text-white rounded-xl shadow-lg overflow-hidden min-w-[300px] max-w-[420px] animate-toast-in cursor-pointer`}
      onClick={onDismiss}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <span className="flex-shrink-0 mt-0.5">{ICONS[toast.type]}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-snug">{toast.message}</p>
          {toast.secondary && <p className="text-xs opacity-80 mt-0.5">{toast.secondary}</p>}
        </div>
        <button className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity mt-0.5">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 3l8 8M11 3l-8 8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="h-1 w-full bg-white/20">
        <div
          className={`h-full ${PROGRESS_COLORS[toast.type]} transition-none`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const remove = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const addToast = useCallback((message: string, type: ToastType, secondary?: string) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, secondary, type, createdAt: Date.now() }])
  }, [])

  const ctx: ToastCtx = {
    show: useCallback((message: string, type: ToastType = 'success') => addToast(message, type), [addToast]),
    success: useCallback((message: string, secondary?: string) => addToast(message, 'success', secondary), [addToast]),
    error: useCallback((message: string, secondary?: string) => addToast(message, 'error', secondary), [addToast]),
    warning: useCallback((message: string, secondary?: string) => addToast(message, 'warning', secondary), [addToast]),
  }

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <ToastBar toast={t} onDismiss={() => remove(t.id)} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
