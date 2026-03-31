'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/reset-password',
    })
    if (error) { setError(error.message); setLoading(false); return }
    setSent(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          {!sent ? (
            <>
              <h1 className="text-lg font-semibold mb-4">Esqueci minha senha</h1>
              {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none"/>
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-2.5 bg-brand text-white rounded-lg text-sm font-medium disabled:opacity-50">
                  {loading ? 'Enviando...' : 'Enviar link'}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center py-4">
              <h2 className="text-base font-semibold mb-2">E-mail enviado!</h2>
              <p className="text-sm text-gray-500">Verifique sua caixa de entrada.</p>
            </div>
          )}
          <p className="text-sm text-center mt-5">
            <Link href="/login" className="text-brand hover:underline">Voltar ao login</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
