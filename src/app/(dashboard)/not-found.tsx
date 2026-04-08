import Link from 'next/link'
import { FileQuestion, Home } from 'lucide-react'

export default function DashboardNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-4">
          <FileQuestion className="w-8 h-8 text-gray-400" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Não encontrado</h1>
        <p className="text-sm text-gray-500 mb-4">
          A página ou recurso que você tentou acessar não existe ou foi removido.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg text-sm font-semibold hover:bg-brand-dark"
        >
          <Home className="w-4 h-4" />
          Voltar ao dashboard
        </Link>
      </div>
    </div>
  )
}
