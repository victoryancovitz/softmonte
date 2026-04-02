'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

const ROLES = ['admin','encarregado','almoxarife','funcionario'] as const
type Role = typeof ROLES[number]
const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrador', encarregado: 'Encarregado',
  almoxarife: 'Almoxarife', funcionario: 'Funcionário',
}
const ROLE_COLOR: Record<Role, string> = {
  admin: 'bg-purple-100 text-purple-700',
  encarregado: 'bg-blue-100 text-blue-700',
  almoxarife: 'bg-amber-100 text-amber-700',
  funcionario: 'bg-gray-100 text-gray-600',
}

export default function UsuariosPage() {
  const [profiles, setProfiles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [{ data: { user } }, { data: prof }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from('profiles').select('*').order('nome'),
    ])
    setCurrentUser(user?.id ?? null)
    setProfiles(prof ?? [])
    setLoading(false)
  }

  async function changeRole(userId: string, newRole: Role) {
    setSaving(userId)
    await supabase.from('profiles').update({ role: newRole }).eq('user_id', userId)
    setProfiles(prev => prev.map(p => p.user_id === userId ? { ...p, role: newRole } : p))
    setSaving(null)
  }

  if (loading) return <div className="p-6 text-sm text-gray-400">Carregando...</div>

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold font-display text-brand">Usuários & Acesso</h1>
        <p className="text-sm text-gray-500 mt-0.5">{profiles.length} usuários cadastrados</p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5 text-sm text-amber-800">
        ⚠️ Alterar o nível de acesso afeta imediatamente o que o usuário pode ver e fazer no sistema.
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {['Usuário','Role atual','Alterar para',''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {profiles.map((p: any) => (
              <tr key={p.user_id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="font-semibold text-gray-900">{p.nome}</div>
                  {p.user_id === currentUser && <span className="text-[10px] text-brand font-medium">(você)</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${ROLE_COLOR[p.role as Role] ?? 'bg-gray-100'}`}>
                    {ROLE_LABEL[p.role as Role] ?? p.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {ROLES.filter(r => r !== p.role).map(role => (
                      <button key={role} onClick={() => changeRole(p.user_id, role)}
                        disabled={saving === p.user_id || p.user_id === currentUser}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-all disabled:opacity-40 hover:scale-105 ${ROLE_COLOR[role]} border-current`}>
                        {saving === p.user_id ? '...' : ROLE_LABEL[role]}
                      </button>
                    ))}
                  </div>
                  {p.user_id === currentUser && <span className="text-xs text-gray-400">Não é possível alterar seu próprio acesso</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={`w-2 h-2 rounded-full inline-block ${saving === p.user_id ? 'bg-amber-400 animate-pulse' : 'bg-green-400'}`}/>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 p-4 bg-gray-50 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-sm font-bold text-gray-700 mb-2">Níveis de acesso</h3>
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
          <div><span className="font-semibold text-purple-700">Administrador</span> — acesso total: edita, exclui, vê financeiro e auditoria</div>
          <div><span className="font-semibold text-blue-700">Encarregado</span> — efetivo diário, BMs, HH, alocação, relatórios</div>
          <div><span className="font-semibold text-amber-700">Almoxarife</span> — movimentação de estoque</div>
          <div><span className="font-semibold text-gray-700">Funcionário</span> — visualiza apenas seus próprios HH</div>
        </div>
      </div>
    </div>
  )
}
