'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import BackButton from '@/components/BackButton'

const ROLES = [
  { key: 'admin', label: 'Administrador', desc: 'Acesso total ao sistema', color: 'bg-red-50 border-red-200 text-red-700' },
  { key: 'encarregado', label: 'Encarregado', desc: 'Gestão de obras e equipes', color: 'bg-blue-50 border-blue-200 text-blue-700' },
  { key: 'rh', label: 'RH', desc: 'Funcionários, faltas, documentos', color: 'bg-pink-50 border-pink-200 text-pink-700' },
  { key: 'financeiro', label: 'Financeiro', desc: 'Lançamentos e relatórios financeiros', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
  { key: 'almoxarife', label: 'Almoxarife', desc: 'Controle de estoque e EPIs', color: 'bg-amber-50 border-amber-200 text-amber-700' },
  { key: 'funcionario', label: 'Funcionário', desc: 'Visualiza próprios dados e HH', color: 'bg-gray-50 border-gray-200 text-gray-700' },
  { key: 'visualizador', label: 'Visualizador', desc: 'Apenas visualização, sem edição', color: 'bg-purple-50 border-purple-200 text-purple-700' },
]

const MODULOS = ['dashboard', 'obras', 'funcionarios', 'ponto', 'faltas', 'boletins', 'financeiro', 'documentos', 'cadastros', 'admin', 'usuarios']

export default function ConvidarUsuarioPage() {
  const [form, setForm] = useState({
    nome: '',
    email: '',
    role: '',
    funcionario_id: '',
    dias_expiracao: 7,
    mensagem: '',
  })
  const [funcionarios, setFuncionarios] = useState<any[]>([])
  const [modulos, setModulos] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [linkGerado, setLinkGerado] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.from('funcionarios').select('id, nome, cargo').order('nome').then(({ data }) => {
      setFuncionarios(data ?? [])
    })
  }, [])

  useEffect(() => {
    if (form.role === 'admin') {
      setModulos([...MODULOS])
    }
  }, [form.role])

  function set(field: string, value: any) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function toggleModulo(m: string) {
    setModulos(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nome || !form.email || !form.role) return
    setLoading(true)

    const token = crypto.randomUUID()
    const expires_at = new Date(Date.now() + form.dias_expiracao * 86400000).toISOString()

    const { error } = await supabase.from('convites').insert({
      token,
      nome_convidado: form.nome,
      email: form.email,
      role: form.role,
      acessos: modulos,
      funcionario_id: form.funcionario_id || null,
      mensagem_boas_vindas: form.mensagem,
      expires_at,
      ativo: true,
    })

    if (error) {
      console.error('Erro ao criar convite:', error)
      setLoading(false)
      return
    }

    setLinkGerado(`${window.location.origin}/convite/${token}`)
    setLoading(false)
  }

  function copyLink() {
    if (linkGerado) {
      navigator.clipboard.writeText(linkGerado)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  function resetForm() {
    setForm({ nome: '', email: '', role: '', funcionario_id: '', dias_expiracao: 7, mensagem: '' })
    setModulos([])
    setLinkGerado(null)
    setCopied(false)
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/admin/usuarios" />
        <Link href="/admin/usuarios" className="text-gray-400 hover:text-gray-600">Admin</Link>
        <span className="text-gray-300">/</span>
        <Link href="/admin/usuarios" className="text-gray-400 hover:text-gray-600">Usuários</Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-700 font-medium">Convidar</span>
      </div>

      <h1 className="text-xl font-bold font-display text-brand mb-6">Convidar Usuário</h1>

      {/* Success mode */}
      {linkGerado !== null ? (
        <div className="space-y-6">
          <div className="bg-green-50 border border-green-200 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M6 10l3 3 5-6" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-green-800">Convite criado!</h2>
                <p className="text-sm text-green-600">Compartilhe o link abaixo com o usuário.</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={linkGerado}
                className="flex-1 px-3 py-2 border border-green-200 rounded-lg bg-white text-sm text-gray-700"
              />
              <button
                onClick={copyLink}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
              >
                {copied ? 'Copiado!' : 'Copiar link'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-3">Resumo do convite</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">Nome:</span>
                <span className="ml-2 font-medium text-gray-900">{form.nome}</span>
              </div>
              <div>
                <span className="text-gray-500">Email:</span>
                <span className="ml-2 font-medium text-gray-900">{form.email}</span>
              </div>
              <div>
                <span className="text-gray-500">Perfil:</span>
                <span className="ml-2 font-medium text-gray-900">
                  {ROLES.find(r => r.key === form.role)?.label || form.role}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Módulos:</span>
                <span className="ml-2 font-medium text-gray-900">{modulos.length} módulos</span>
              </div>
              <div>
                <span className="text-gray-500">Expira em:</span>
                <span className="ml-2 font-medium text-gray-900">{form.dias_expiracao} dias</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={copyLink}
              className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark transition-colors"
            >
              {copied ? 'Copiado!' : 'Copiar link'}
            </button>
            <a
              href={linkGerado}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Visualizar convite
            </a>
            <button
              onClick={resetForm}
              className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Criar outro
            </button>
          </div>
        </div>
      ) : (
        /* Form mode */
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Vincular a funcionário */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-bold text-gray-700 mb-3">
              Vincular a funcionário <span className="text-gray-400 font-normal">(opcional)</span>
            </h2>
            <select
              value={form.funcionario_id}
              onChange={e => set('funcionario_id', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
            >
              <option value="">Selecione um funcionário...</option>
              {funcionarios.map((f: any) => (
                <option key={f.id} value={f.id}>{f.nome} {f.cargo ? `- ${f.cargo}` : ''}</option>
              ))}
            </select>
          </div>

          {/* Dados do convite */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-bold text-gray-700 mb-3">Dados do convite</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nome</label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={e => set('nome', e.target.value)}
                  placeholder="Nome do convidado"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                  placeholder="email@exemplo.com"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Validade do convite</label>
              <select
                value={form.dias_expiracao}
                onChange={e => set('dias_expiracao', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              >
                <option value={1}>1 dia</option>
                <option value={3}>3 dias</option>
                <option value={7}>7 dias</option>
                <option value={15}>15 dias</option>
                <option value={30}>30 dias</option>
              </select>
            </div>
            <div className="mt-4">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Mensagem de boas-vindas</label>
              <textarea
                value={form.mensagem}
                onChange={e => set('mensagem', e.target.value)}
                rows={3}
                placeholder="Mensagem opcional para o convidado..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand resize-none"
              />
            </div>
          </div>

          {/* Perfil de acesso */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-bold text-gray-700 mb-3">Perfil de acesso</h2>
            <div className="grid grid-cols-3 gap-3">
              {ROLES.map(role => (
                <button
                  key={role.key}
                  type="button"
                  onClick={() => set('role', role.key)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    form.role === role.key
                      ? `border-2 ${role.color}`
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-2.5 h-2.5 rounded-full ${
                      role.key === 'admin' ? 'bg-red-500' :
                      role.key === 'encarregado' ? 'bg-blue-500' :
                      role.key === 'rh' ? 'bg-pink-500' :
                      role.key === 'financeiro' ? 'bg-emerald-500' :
                      role.key === 'almoxarife' ? 'bg-amber-500' :
                      role.key === 'funcionario' ? 'bg-gray-500' :
                      'bg-purple-500'
                    }`} />
                    <span className="text-sm font-bold">{role.label}</span>
                  </div>
                  <p className="text-xs text-gray-500">{role.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Módulos */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-700">Módulos</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setModulos([...MODULOS])}
                  className="text-xs text-brand hover:underline font-medium"
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => setModulos([])}
                  className="text-xs text-gray-500 hover:underline font-medium"
                >
                  Nenhum
                </button>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {MODULOS.map(m => (
                <label key={m} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={modulos.includes(m)}
                    onChange={() => toggleModulo(m)}
                    className="rounded border-gray-300 text-brand focus:ring-brand"
                  />
                  <span className="capitalize text-gray-700">{m}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={!form.nome || !form.email || !form.role || loading}
              className="px-6 py-2.5 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? 'Criando...' : 'Criar Convite'}
            </button>
            <Link
              href="/admin/usuarios"
              className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </Link>
          </div>
        </form>
      )}
    </div>
  )
}
