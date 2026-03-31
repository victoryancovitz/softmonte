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
                redirectTo: `${window.location.origin}/reset-password`,
        })
        if (error) { setError(error.message); setLoading(false); return }
        setSent(true)
        setLoading(false)
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
                                            </svg>svg>
                                </div>div>
                                <div>
                                            <div className="text-xl font-semibold leading-none">Softmonte</div>div>
                                            <div className="text-xs text-gray-500 mt-0.5">Gestao de Obras e HH</div>div>
                                </div>div>
                      </div>div>
                      <div className="bg-white rounded-2xl border border-gray-200 p-8">
                        {!sent ? (
                      <>
                                    <h1 className="text-lg font-semibold mb-1">Esqueci minha senha</h1>h1>
                                    <p className="text-sm text-gray-500 mb-6">Informe seu e-mail e enviaremos um link para redefinir sua senha.</p>p>
                        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>div>}
                                    <form onSubmit={handleSubmit} className="space-y-4">
                                                    <div>
                                                                      <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>label>
                                                                      <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                                                                                            placeholder="voce@empresa.com.br"
                                                                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"/>
                                                    </div>div>
                                                    <button type="submit" disabled={loading}
                                                                        className="w-full py-2.5 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark transition-colors disabled:opacity-50">
                                                      {loading ? 'Enviando...' : 'Enviar link de recuperacao'}
                                                    </button>button>
                                    </form>form>
                      </>>
                    ) : (
                      <div className="text-center py-4">
                                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>svg>
                                    </div>div>
                                    <h2 className="text-base font-semibold mb-2">E-mail enviado!</h2>h2>
                                    <p className="text-sm text-gray-500">Verifique sua caixa de entrada em <strong>{email}</strong>strong> e clique no link para redefinir sua senha.</p>p>
                      </div>div>
                                )}
                                <p className="text-sm text-center text-gray-500 mt-5">
                                            <Link href="/login" className="text-brand font-medium hover:underline">Voltar para o login</Link>Link>
                                </p>p>
                      </div>div>
              </div>div>
        </div>div>
      )
}</></div>
