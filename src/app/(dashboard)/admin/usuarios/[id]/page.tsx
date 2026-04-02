'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import BackButton from '@/components/BackButton'
import { useToast } from '@/components/Toast'

const ROLES = [
  { key: 'admin', label: 'Administrador', desc: 'Acesso total ao sistema', color: 'bg-red-50 border-red-200 text-red-700' },
  { key: 'encarregado', label: 'Encarregado', desc: 'Gestão de obras e equipes', color: 'bg-blue-50 border-blue-200 text-blue-700' },
  { key: 'rh', label: 'RH', desc: 'Funcionários, faltas, documentos', color: 'bg-pink-50 border-pink-200 text-pink-700' },
  { key: 'financeiro', label: 'Financeiro', desc: 'Lançamentos e relatórios financeiros', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
  { key: 'almoxarife', label: 'Almoxarife', desc: 'Controle de estoque e EPIs', color: 'bg-amber-50 border-amber-200 text-amber-700' },
  { key: 'funcionario', label: 'Funcionário', desc: 'Visualiza próprios dados e HH', color: 'bg-gray-50 border-gray-200 text-gray-700' },
  { key: 'visualizador', label: 'Visualizador', desc: 'Apenas visualização, sem edição', color: 'bg-purple-50 border-purple-200 text-purple-700' },
]

const ROLE_CONFIG: Record<string, { label: string; color: string }> = {
  admin: { label: 'Administrador', color: 'bg-red-100 text-red-700' },
  encarregado: { label: 'Encarregado', color: 'bg-blue-100 text-blue-700' },
  rh: { label: 'RH', color: 'bg-pink-100 text-pink-700' },
  financeiro: { label: 'Financeiro', color: 'bg-emerald-100 text-emerald-700' },
  almoxarife: { label: 'Almoxarife', color: 'bg-amber-100 text-amber-700' },
  funcionario: { label: 'Funcionário', color: 'bg-gray-100 text-gray-600' },
  visualizador: { label: 'Visualizador', color: 'bg-purple-100 text-purple-700' },
}

const MODULOS = ['dashboard', 'obras', 'funcionarios', 'ponto', 'faltas', 'boletins', 'financeiro', 'documentos', 'cadastros', 'admin', 'usuarios']

export default function EditarUsuarioPage() {
  const [profile, setProfile] = useState<any>(null)
  const [role, setRole] = useState('')
  const [modulos, setModulos] = useState<string[]>([])
  const [ativo, setAtivo] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()

  useEffect(() => {
    loadProfile()
  }, [params.id])

  async function loadProfile() {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').eq('id', params.id).single()
    if (data) {
      setProfile(data)
      setRole(data.role || 'funcionario')
      setModulos(Array.isArray(data.acessos) ? data.acessos : [])
      setAtivo(data.ativo !== false)
    }
    setLoading(false)
  }

  function toggleModulo(m: string) {
    setModulos(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])
  }

  useEffect(() => {
    if (role === 'admin') {
      setModulos([...MODULOS])
    }
  }, [role])

  async function handleSave() {
    setSaving(true)
    const { error } = await supabase.from('profiles').update({
      role,
      acessos: modulos,
      ativo,
    }).eq('id', params.id)

    if (error) {
      toast.show('Erro ao salvar: ' + error.message, 'error')
    } else {
      toast.show('Alterações salvas com sucesso!')
    }
    setSaving(false)
  }

  if (loading) return <div className="p-6 text-sm text-gray-400">Carregando...</div>
  if (!profile) return <div className="p-6 text-sm text-gray-400">Usuário não encontrado.</div>

  const initials = (profile.nome || '??').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
  const currentRoleConf = ROLE_CONFIG[profile.role] || { label: profile.role || '--', color: 'bg-gray-100 text-gray-600' }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/admin/usuarios" />
        <Link href="/admin/usuarios" className="text-gray-400 hover:text-gray-600">Admin</Link>
        <span className="text-gray-300">/</span>
        <Link href="/admin/usuarios" className="text-gray-400 hover:text-gray-600">Usuários</Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-700 font-medium">{profile.nome || '--'}</span>
      </div>

      {/* User Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-brand/10 text-brand font-bold text-xl flex items-center justify-center flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold font-display text-gray-900">{profile.nome || '--'}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{profile.email || '--'}</p>
            <div className="flex items-center gap-3 mt-2">
              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${currentRoleConf.color}`}>
                {currentRoleConf.label}
              </span>
              <span className="text-xs text-gray-400">
                Último acesso: {profile.last_sign_in_at
                  ? new Date(profile.last_sign_in_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                  : '--'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Toggle Ativo/Bloqueado */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-gray-700">Status do usuário</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {ativo ? 'O usuário pode acessar o sistema normalmente.' : 'O usuário está bloqueado e não pode acessar o sistema.'}
            </p>
          </div>
          <button
            onClick={() => setAtivo(!ativo)}
            className={`relative w-14 h-7 rounded-full transition-colors ${ativo ? 'bg-green-500' : 'bg-red-400'}`}
          >
            <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${ativo ? 'left-7' : 'left-0.5'}`} />
          </button>
        </div>
        {!ativo && (
          <div className="mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            Usuário bloqueado. Ele não conseguirá fazer login enquanto estiver neste estado.
          </div>
        )}
      </div>

      {/* Perfil de acesso */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h2 className="text-sm font-bold text-gray-700 mb-3">Perfil de acesso</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {ROLES.map(r => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRole(r.key)}
              className={`p-3 rounded-xl border text-left transition-all ${
                role === r.key
                  ? `border-2 ${r.color}`
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-2.5 h-2.5 rounded-full ${
                  r.key === 'admin' ? 'bg-red-500' :
                  r.key === 'encarregado' ? 'bg-blue-500' :
                  r.key === 'rh' ? 'bg-pink-500' :
                  r.key === 'financeiro' ? 'bg-emerald-500' :
                  r.key === 'almoxarife' ? 'bg-amber-500' :
                  r.key === 'funcionario' ? 'bg-gray-500' :
                  'bg-purple-500'
                }`} />
                <span className="text-sm font-bold">{r.label}</span>
              </div>
              <p className="text-xs text-gray-500">{r.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Módulos permitidos */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-700">Módulos permitidos</h2>
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
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

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark transition-colors disabled:opacity-40"
        >
          {saving ? 'Salvando...' : 'Salvar alterações'}
        </button>
        <Link
          href="/admin/usuarios"
          className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </Link>
      </div>
    </div>
  )
}
