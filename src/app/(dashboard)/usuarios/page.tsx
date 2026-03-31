'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { Profile, UserRole } from '@/lib/types'

const ROLES: { value: UserRole; label: string; desc: string }[] = [
  { value: 'admin', label: 'Administrador', desc: 'Acesso total à plataforma' },
  { value: 'encarregado', label: 'Encarregado', desc: 'Funcionários, alocação e HH' },
  { value: 'almoxarife', label: 'Almoxarife', desc: 'Somente estoque e requisições' },
  { value: 'funcionario', label: 'Funcionário', desc: 'Somente próprio HH' },
]

export default function UsuariosPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('profiles').select('*').order('nome').then(({ data }) => {
      setProfiles(data ?? [])
      setLoading(false)
    })
  }, [])

  async function changeRole(profileId: string, role: UserRole) {
    await supabase.from('profiles').update({ role }).eq('id', profileId)
    setProfiles(p => p.map(x => x.id === profileId ? { ...x, role } : x))
  }

  const ROLE_BADGE: Record<string, string> = {
    admin: 'bg-purple-100 text-purple-700',
    encarregado: 'bg-blue-100 text-blue-700',
    almoxarife: 'bg-amber-100 text-amber-700',
    funcionario: 'bg-gray-100 text-gray-600',
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Usuários & Níveis de Acesso</h1>
        <p className="text-sm text-gray-500 mt-0.5">Gerencie quem tem acesso a cada módulo da plataforma.</p>
      </div>

      {/* Role legend */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {ROLES.map(r => (
          <div key={r.value} className="bg-white border border-gray-200 rounded-xl p-3">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_BADGE[r.value]}`}>{r.label}</span>
            <p className="text-xs text-gray-400 mt-2">{r.desc}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Carregando...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Nome</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Nível atual</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Alterar para</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {profiles.map(p => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-600">
                        {p.nome?.split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase()}
                      </div>
                      <span className="font-medium">{p.nome}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_BADGE[p.role]}`}>
                      {ROLES.find(r => r.value === p.role)?.label ?? p.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={p.role}
                      onChange={e => changeRole(p.id, e.target.value as UserRole)}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand"
                    >
                      {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    Criado em {new Date(p.created_at).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
