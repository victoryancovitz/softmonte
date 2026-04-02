'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'

const ROLE_CONFIG: Record<string,{label:string;color:string}> = {
  admin:{label:'Administrador',color:'text-red-400'},
  encarregado:{label:'Encarregado',color:'text-blue-400'},
  rh:{label:'RH',color:'text-pink-400'},
  financeiro:{label:'Financeiro',color:'text-emerald-400'},
  almoxarife:{label:'Almoxarife',color:'text-amber-400'},
  funcionario:{label:'Funcionário',color:'text-gray-400'},
  visualizador:{label:'Visualizador',color:'text-purple-400'},
}

const MODULO_LABEL: Record<string,string> = {
  dashboard:'Dashboard',obras:'Obras',funcionarios:'Funcionários',ponto:'Ponto',
  faltas:'Faltas',boletins:'Boletins',financeiro:'Financeiro',documentos:'Documentos',
  cadastros:'Cadastros',admin:'Admin',usuarios:'Usuários',
}

type Etapa = 'carregando' | 'invalido' | 'boas_vindas' | 'cadastro' | 'sucesso'

export default function ConvitePage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const [etapa, setEtapa] = useState<Etapa>('carregando')
  const [convite, setConvite] = useState<any>(null)
  const [erro, setErro] = useState('')
  const [form, setForm] = useState({ email: '', senha: '', confirmar: '' })
  const [loading, setLoading] = useState(false)
  const [forcaSenha, setForcaSenha] = useState(0)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('convites')
        .select('*')
        .eq('token', params.token)
        .single()

      if (!data) { setEtapa('invalido'); setErro('Convite não encontrado.'); return }
      if (data.usado_em) { setEtapa('invalido'); setErro('Este convite já foi utilizado.'); return }
      if (!data.ativo) { setEtapa('invalido'); setErro('Este convite foi revogado.'); return }
      if (new Date(data.expires_at) < new Date()) { setEtapa('invalido'); setErro('Este convite expirou.'); return }

      setConvite(data)
      setForm(f => ({ ...f, email: data.email || '' }))
      setEtapa('boas_vindas')
    }
    load()
  }, [params.token])

  function calcForca(s: string) {
    let f = 0
    if (s.length >= 6) f++
    if (s.length >= 8) f++
    if (/[A-Z]/.test(s)) f++
    if (/[0-9]/.test(s)) f++
    if (/[^A-Za-z0-9]/.test(s)) f++
    return f
  }

  function setSenha(s: string) {
    setForm(f => ({ ...f, senha: s }))
    setForcaSenha(calcForca(s))
  }

  async function handleCriar(e: React.FormEvent) {
    e.preventDefault()
    if (form.senha !== form.confirmar) { setErro('As senhas não coincidem.'); return }
    if (form.senha.length < 6) { setErro('A senha deve ter pelo menos 6 caracteres.'); return }
    setLoading(true)
    setErro('')

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.senha,
    })

    if (authError) { setErro(authError.message); setLoading(false); return }

    if (authData.user) {
      const { error: rpcError } = await supabase.rpc('usar_convite', {
        p_token: params.token as string,
        p_user_id: authData.user.id,
        p_email: form.email,
      })
      if (rpcError) {
        // If RPC doesn't exist, update manually
        await supabase.from('convites').update({ usado_em: new Date().toISOString() }).eq('token', params.token as string)
        await supabase.from('profiles').upsert({
          user_id: authData.user.id,
          nome: convite.nome_convidado,
          email: form.email,
          role: convite.role,
          acessos: convite.acessos,
          ativo: true,
          funcionario_id: convite.funcionario_id,
        })
      }
    }

    setEtapa('sucesso')
    setLoading(false)
  }

  const initials = convite?.nome_convidado?.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() || '?'
  const roleCfg = ROLE_CONFIG[convite?.role] || { label: convite?.role, color: 'text-gray-400' }
  const modulos: string[] = convite?.acessos || []
  const forcaCores = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-lime-500', 'bg-green-500']
  const forcaLabels = ['Muito fraca', 'Fraca', 'Regular', 'Boa', 'Forte']

  // Carregando
  if (etapa === 'carregando') return (
    <div className="min-h-screen bg-gradient-to-br from-[#00215B] to-[#001640] flex items-center justify-center">
      <div className="text-white text-sm flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        Verificando convite...
      </div>
    </div>
  )

  // Inválido
  if (etapa === 'invalido') return (
    <div className="min-h-screen bg-gradient-to-br from-[#00215B] to-[#001640] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round"/></svg>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Convite inválido</h1>
        <p className="text-gray-500 text-sm">{erro}</p>
        <a href="/login" className="mt-6 inline-block text-sm text-blue-600 hover:underline">Ir para o login</a>
      </div>
    </div>
  )

  // Boas-vindas
  if (etapa === 'boas_vindas') return (
    <div className="min-h-screen bg-gradient-to-br from-[#00215B] to-[#001640] flex items-center justify-center p-6">
      <div className="max-w-lg w-full">
        <div className="bg-white rounded-2xl overflow-hidden shadow-2xl">
          {/* Header azul */}
          <div className="bg-[#00215B] px-8 pt-8 pb-10 text-center relative">
            <div className="text-[9px] text-blue-300/60 font-bold uppercase tracking-widest mb-4">SOFTMONTE · TECNOMONTE</div>
            <div className="w-20 h-20 rounded-full bg-white/10 border-2 border-[#C4972A] flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl font-bold text-[#C4972A]">{initials}</span>
            </div>
            <h1 className="text-xl font-bold text-white">{convite.nome_convidado}</h1>
            <p className={`text-sm mt-1 ${roleCfg.color}`}>{roleCfg.label}</p>
          </div>
          {/* Body */}
          <div className="px-8 py-6">
            {convite.mensagem_boas_vindas && (
              <div className="mb-5 p-4 bg-gray-50 rounded-xl text-sm text-gray-600 italic leading-relaxed">
                "{convite.mensagem_boas_vindas}"
                {convite.criado_por_nome && <div className="text-xs text-gray-400 mt-2 not-italic">— {convite.criado_por_nome}</div>}
              </div>
            )}
            {modulos.length > 0 && (
              <div className="mb-5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Acesso aos módulos:</p>
                <div className="flex flex-wrap gap-1.5">
                  {modulos.map(m => (
                    <span key={m} className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      {MODULO_LABEL[m] || m}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <button onClick={() => setEtapa('cadastro')}
              className="w-full py-3 bg-[#00215B] text-white rounded-xl font-semibold hover:bg-[#001640] transition-all text-sm">
              Criar minha conta
            </button>
            <p className="text-center text-xs text-gray-400 mt-3">
              Convite válido até {new Date(convite.expires_at).toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )

  // Cadastro
  if (etapa === 'cadastro') return (
    <div className="min-h-screen bg-gradient-to-br from-[#00215B] to-[#001640] flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl p-8 shadow-2xl">
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center mx-auto mb-3">
              <span className="text-lg font-bold text-[#00215B]">{initials}</span>
            </div>
            <h1 className="text-lg font-bold text-gray-900">Criar conta</h1>
            <p className="text-sm text-gray-500">{convite.nome_convidado}</p>
          </div>
          {erro && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200">{erro}</div>}
          <form onSubmit={handleCriar} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
              <input type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00215B]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Senha</label>
              <input type="password" required value={form.senha} onChange={e => setSenha(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00215B]" />
              {form.senha && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[0,1,2,3,4].map(i => (
                      <div key={i} className={`h-1 flex-1 rounded-full ${i < forcaSenha ? forcaCores[forcaSenha - 1] : 'bg-gray-200'}`} />
                    ))}
                  </div>
                  <p className={`text-xs ${forcaSenha <= 2 ? 'text-red-500' : forcaSenha <= 3 ? 'text-yellow-600' : 'text-green-600'}`}>
                    {forcaLabels[forcaSenha - 1] || 'Muito fraca'}
                  </p>
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Confirmar senha</label>
              <input type="password" required value={form.confirmar} onChange={e => setForm(f => ({ ...f, confirmar: e.target.value }))}
                className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00215B] ${
                  form.confirmar && form.confirmar !== form.senha ? 'border-red-300' : 'border-gray-200'
                }`} />
              {form.confirmar && form.confirmar !== form.senha && (
                <p className="text-xs text-red-500 mt-1">As senhas não coincidem</p>
              )}
            </div>
            <button type="submit" disabled={loading || !form.email || !form.senha || form.senha !== form.confirmar}
              className="w-full py-3 bg-[#00215B] text-white rounded-xl font-semibold hover:bg-[#001640] transition-all text-sm disabled:opacity-50">
              {loading ? 'Criando conta...' : 'Criar conta'}
            </button>
          </form>
          <button onClick={() => setEtapa('boas_vindas')} className="w-full mt-3 text-sm text-gray-400 hover:text-gray-600 text-center">
            Voltar
          </button>
        </div>
      </div>
    </div>
  )

  // Sucesso
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#00215B] to-[#001640] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 7" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Conta criada!</h1>
        <p className="text-gray-500 text-sm mb-4">
          Verifique seu email <strong>{form.email}</strong> para confirmar o cadastro.
        </p>
        <p className="text-xs text-gray-400 mb-6">
          Após confirmar, faça login em softmonte.vercel.app
        </p>
        <a href="/login" className="inline-block px-6 py-2.5 bg-[#00215B] text-white rounded-xl text-sm font-semibold hover:bg-[#001640] transition-all">
          Ir para o login
        </a>
      </div>
    </div>
  )
}
