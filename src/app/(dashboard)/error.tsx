'use client'
import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log pro console de dev/Vercel e futuramente pro Sentry
    console.error('[dashboard error boundary]', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Algo deu errado</h1>
        <p className="text-sm text-gray-500 mb-1">
          Ocorreu um erro ao carregar esta página. A equipe foi notificada.
        </p>
        {error.digest && (
          <p className="text-[11px] text-gray-400 font-mono mb-4">ID: {error.digest}</p>
        )}
        {process.env.NODE_ENV === 'development' && (
          <pre className="text-[11px] text-left bg-red-50 border border-red-100 rounded-lg p-3 mb-4 overflow-auto max-h-40">
            {error.message}
            {'\n'}
            {error.stack}
          </pre>
        )}
        <div className="flex gap-2 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-semibold hover:bg-brand-dark flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Tentar novamente
          </button>
          <Link
            href="/dashboard"
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-2"
          >
            <Home className="w-4 h-4" />
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  )
}
