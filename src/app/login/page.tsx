'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    // Lazy: cria o client só no submit (evita crash no prerender sem env vars)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('E-mail ou senha incorretos.'); setLoading(false); return }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex" style={{background: 'linear-gradient(135deg, #00215B 0%, #001640 50%, #000D2A 100%)'}}>
      {/* Left panel - branding */}
      <div className="hidden lg:flex flex-col justify-between w-[480px] flex-shrink-0 p-12 relative overflow-hidden">
        {/* Geometric decoration */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full" style={{background: 'radial-gradient(circle, #C4972A 0%, transparent 70%)', transform: 'translate(30%, -30%)'}}/>
          <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full" style={{background: 'radial-gradient(circle, #C4972A 0%, transparent 70%)', transform: 'translate(-30%, 30%)'}}/>
        </div>
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-5" style={{backgroundImage: 'linear-gradient(rgba(255,255,255,.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.3) 1px, transparent 1px)', backgroundSize: '40px 40px'}}/>

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-4">
            <svg width="52" height="52" viewBox="0 0 32 32" fill="none">
              <rect x="4" y="20" width="8" height="10" rx="1" fill="#C4972A"/>
              <rect x="13" y="12" width="8" height="18" rx="1" fill="#C4972A" opacity=".85"/>
              <rect x="22" y="4" width="8" height="26" rx="1" fill="#C4972A" opacity=".65"/>
              <rect x="0" y="30" width="32" height="2" rx="1" fill="#C4972A" opacity=".4"/>
            </svg>
            <div>
              <div className="font-display font-bold text-white text-2xl tracking-widest">TECNOMONTE</div>
              <div className="text-blue-300 text-xs tracking-wider">FABRICAÇÃO, MONTAGEM E MANUTENÇÃO INDUSTRIAL</div>
            </div>
          </div>
        </div>

        {/* Middle content */}
        <div className="relative z-10">
          <div className="w-12 h-0.5 bg-[#C4972A] mb-6"/>
          <h2 className="font-display font-bold text-white text-4xl leading-tight mb-4">
            Plataforma de<br/>Gestão de Obras
          </h2>
          <p className="text-blue-200 text-base leading-relaxed">
            Controle completo de equipes, alocação, boletins de medição e resultados financeiros.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-4">
            {[['Efetivo Diário','Check-in em tempo real'],['Boletins de Medição','Geração automática'],['Gestão de HH','Lançamentos e audit'],['Financeiro','Fluxo e provisões']].map(([t,d]) => (
              <div key={t} className="bg-white/5 rounded-xl p-3 border border-white/10">
                <div className="text-[#C4972A] font-display font-semibold text-sm">{t}</div>
                <div className="text-blue-300 text-xs mt-0.5">{d}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 text-blue-400 text-xs">
          © {new Date().getFullYear()} Tecnomonte — Todos os direitos reservados
        </div>
      </div>

      {/* Right panel - login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <svg width="36" height="36" viewBox="0 0 32 32" fill="none">
              <rect x="4" y="20" width="8" height="10" rx="1" fill="#C4972A"/>
              <rect x="13" y="12" width="8" height="18" rx="1" fill="#C4972A" opacity=".85"/>
              <rect x="22" y="4" width="8" height="26" rx="1" fill="#C4972A" opacity=".65"/>
            </svg>
            <div>
              <div className="font-display font-bold text-white text-xl tracking-widest">TECNOMONTE</div>
              <div className="text-blue-300 text-[10px] tracking-wider">SOFTMONTE</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <div className="mb-7">
              <h1 className="font-display font-bold text-2xl text-brand" style={{fontFamily:'Kanit,sans-serif'}}>Entrar na plataforma</h1>
              <p className="text-gray-500 text-sm mt-1">Acesse com seu e-mail e senha corporativa</p>
            </div>

            {error && (
              <div className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="7"/><path d="M8 5v4M8 11v1" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">E-mail</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="voce@tecnomonte.com.br" autoComplete="email"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all"
                  style={{'--tw-ring-color': '#00215B'} as any}
                  onFocus={e => e.target.style.borderColor = '#00215B'}
                  onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-semibold text-gray-700">Senha</label>
                  <Link href="/forgot-password" className="text-xs font-medium hover:underline" style={{color:'#00215B'}}>
                    Esqueci minha senha
                  </Link>
                </div>
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" autoComplete="current-password"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all"
                  onFocus={e => e.target.style.borderColor = '#00215B'}
                  onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl text-white text-sm font-bold tracking-wide transition-all disabled:opacity-60 font-display mt-2"
                style={{background: loading ? '#666' : 'linear-gradient(135deg, #00215B 0%, #001640 100%)'}}>
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-gray-100 text-center text-xs text-gray-400">
              Acesso restrito a colaboradores da Tecnomonte
            </div>
          </div>

          <p className="text-center text-blue-300/60 text-xs mt-6">
            Softmonte v1.0 — Plataforma interna Tecnomonte
          </p>
        </div>
      </div>
    </div>
  )
}
