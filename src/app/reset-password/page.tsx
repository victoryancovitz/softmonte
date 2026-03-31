'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          setSessionLoading(false)
        } else if (session) {
          setSessionLoading(false)
        }
      }
    )
    setTimeout(() => setSessionLoading(false), 3000)
    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('As senhas nao conferem.'); return }
    if (password.length < 6) { setError('Minimo 6 caracteres.'); return }
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError(error.message); setLoading(false); return }
    setDone(true)
    setTimeout(() => router.push('/login'), 2000)
  }

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-sm text-gray-500">Verificando link...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="10" width="4" height="4" rx="1" fill="white" opacity=".85"/>
              <rect x="6" y="6" width="4" height="8" rx="1" fill="white"/>
              <rect x="10" y="2" width="4" height="12" rx="1" fill="white" opacity=".65"/>
            </svg>
          </div>
          <div>
            <div className="text-xl font-semibold leading-none">Softmonte</div>
            <div className="text-xs text-gray-500 mt-0.5">Gestao de Obras e HH</div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          {!done ? (
            <>
              <h1 className="text-lg font-semibold mb-1">Redefinir senha</h1>
              <p className="text-sm text-gray-500 mb-6">Digite sua nova senha abaixo.</p>
              {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nova senha</label>
                  <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="minimo 6 caracteres" minLength={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar senha</label>
                  <input type="password" required value={confirm} onChange={e => setConfirm(e.target.value)}
                    placeholder="repita a senha"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"/>
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-2.5 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark transition-colors disabled:opacity-50">
                  {loading ? 'Salvando...' : 'Salvar nova senha'}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <h2 className="text-base font-semibold mb-2">Senha definida!</h2>
              <p className="text-sm text-gray-500">Redirecionando para o login...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
