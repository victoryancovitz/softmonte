'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setError('E-mail ou senha incorretos.'); setLoading(false); return }
      router.push('/dashboard')
      router.refresh()
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) { setError(error.message); setLoading(false); return }
      if (data.user) {
        await supabase.from('profiles').insert({ user_id: data.user.id, nome, role: 'funcionario' })
        setSuccess('Conta criada com sucesso!')
      }
      setLoading(false)
    }
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
          <h1 className="text-lg font-semibold mb-1">{mode === 'login' ? 'Entrar na plataforma' : 'Criar conta'}</h1>
          <p className="text-sm text-gray-500 mb-6">{mode === 'login' ? 'Acesse com seu e-mail e senha.' : 'Preencha os dados para criar sua conta.'}</p>
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>}
          {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg">{success}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo</label>
                <input type="text" required value={nome} onChange={e => setNome(e.target.value)} placeholder="Joao Silva" autoComplete="name" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@empresa.com.br" autoComplete="email" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">Senha</label>
                {mode === 'login' && <Link href="/forgot-password" className="text-xs text-brand hover:underline">Esqueci minha senha</Link>}
              </div>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" minLength={6} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <button type="submit" disabled={loading} className="w-full py-2.5 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark transition-colors disabled:opacity-50">
              {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          </form>
          <p className="text-sm text-center text-gray-500 mt-5">
            {mode === 'login' ? 'Nao tem conta?' : 'Ja tem conta?'}{' '}
            <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setSuccess('') }} className="text-brand font-medium hover:underline">
              {mode === 'login' ? 'Criar conta' : 'Entrar'}
            </button>
          </p>
        </div>
        <p className="text-xs text-center text-gray-400 mt-4">Conta criada automaticamente com acesso de funcionario. O administrador pode alterar o nivel de acesso.</p>
      </div>
    </div>
  )
}
