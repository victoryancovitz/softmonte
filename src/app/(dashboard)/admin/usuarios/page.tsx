'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import BackButton from '@/components/BackButton'
import SearchInput from '@/components/SearchInput'

const ROLE_CONFIG: Record<string, { label: string; color: string }> = {
  admin: { label: 'Administrador', color: 'bg-red-100 text-red-700' },
  encarregado: { label: 'Encarregado', color: 'bg-blue-100 text-blue-700' },
  rh: { label: 'RH', color: 'bg-pink-100 text-pink-700' },
  financeiro: { label: 'Financeiro', color: 'bg-emerald-100 text-emerald-700' },
  almoxarife: { label: 'Almoxarife', color: 'bg-amber-100 text-amber-700' },
  funcionario: { label: 'Funcionário', color: 'bg-gray-100 text-gray-600' },
  visualizador: { label: 'Visualizador', color: 'bg-purple-100 text-purple-700' },
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return '--'
  const now = Date.now()
  const date = new Date(dateStr).getTime()
  const diffMs = now - date
  const diffMin = Math.floor(diffMs / 60000)
  const diffH = Math.floor(diffMs / 3600000)
  const diffD = Math.floor(diffMs / 86400000)
  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `há ${diffMin}min`
  if (diffH < 24) return `há ${diffH}h`
  if (diffD < 30) return `há ${diffD} dias`
  return new Date(dateStr).toLocaleDateString('pt-BR')
}

export default function AdminUsuariosPage() {
  const [profiles, setProfiles] = useState<any[]>([])
  const [convites, setConvites] = useState<any[]>([])
  const [tab, setTab] = useState<'usuarios' | 'convites'>('usuarios')
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: prof }, { data: conv }] = await Promise.all([
      supabase.from('profiles').select('*').order('nome'),
      supabase.from('convites').select('*').order('created_at', { ascending: false }),
    ])
    setProfiles(prof ?? [])
    setConvites(conv ?? [])
    setLoading(false)
  }

  async function revogarConvite(id: string) {
    await supabase.from('convites').update({ ativo: false }).eq('id', id)
    await loadData()
  }

  function copyLink(token: string, id: string) {
    const link = `${window.location.origin}/convite/${token}`
    navigator.clipboard.writeText(link)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const now = new Date()
  const ativos = profiles.filter((p: any) => p.ativo !== false)
  const bloqueados = profiles.filter((p: any) => p.ativo === false)
  const buscaFilter = (c: any) => !busca || c.nome_convidado?.toLowerCase().includes(busca.toLowerCase()) || c.email?.toLowerCase().includes(busca.toLowerCase())
  const convitesPendentes = convites.filter((c: any) => c.ativo && !c.usado_em && new Date(c.expires_at) > now).filter(buscaFilter)
  const convitesAceitos = convites.filter((c: any) => c.usado_em).filter(buscaFilter)
  const convitesExpirados = convites.filter((c: any) => (!c.ativo || new Date(c.expires_at) <= now) && !c.usado_em).filter(buscaFilter)

  if (loading) return <div className="p-6 text-sm text-gray-400">Carregando...</div>

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/dashboard" />
        <Link href="/dashboard" className="text-gray-400 hover:text-gray-600">Dashboard</Link>
        <span className="text-gray-300">/</span>
        <Link href="/admin/usuarios" className="text-gray-400 hover:text-gray-600">Admin</Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-700 font-medium">Usuários</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold font-display text-brand">Usuários & Acessos</h1>
          <p className="text-sm text-gray-500 mt-0.5">{profiles.length} usuários cadastrados</p>
        </div>
        <Link
          href="/admin/usuarios/convidar"
          className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark transition-colors"
        >
          + Convidar
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Ativos</p>
          <p className="text-2xl font-bold text-brand mt-1">{ativos.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Convites Pendentes</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{convitesPendentes.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Aceitos</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{convitesAceitos.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Bloqueados</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{bloqueados.length}</p>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 mb-6 w-fit">
        <button
          onClick={() => setTab('usuarios')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
            tab === 'usuarios' ? 'bg-white text-brand shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Usuários
        </button>
        <button
          onClick={() => setTab('convites')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
            tab === 'convites' ? 'bg-white text-brand shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Convites
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <SearchInput value={busca} onChange={setBusca} placeholder="Buscar usuário..." />
      </div>

      {/* Tab: Usuários */}
      {tab === 'usuarios' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Usuário', 'Role', 'Módulos', 'Último acesso', 'Ações'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {profiles.length > 0 ? profiles.filter((p: any) => !busca || p.nome?.toLowerCase().includes(busca.toLowerCase()) || p.email?.toLowerCase().includes(busca.toLowerCase())).map((p: any) => {
                const initials = (p.nome || '??').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
                const roleConf = ROLE_CONFIG[p.role] || { label: p.role || '--', color: 'bg-gray-100 text-gray-600' }
                const modulosCount = Array.isArray(p.acessos) ? p.acessos.length : 0
                return (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 group cursor-pointer" onClick={() => router.push(`/admin/usuarios/${p.id}`)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-brand/10 text-brand font-bold text-sm flex items-center justify-center flex-shrink-0">
                          {initials}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">{p.nome || '--'}</div>
                          <div className="text-xs text-gray-500">{p.email || '--'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${roleConf.color}`}>
                        {roleConf.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {modulosCount > 0 ? `${modulosCount} módulos` : '--'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {formatRelativeTime(p.last_sign_in_at || p.updated_at)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/usuarios/${p.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-brand hover:underline font-medium"
                      >
                        Editar
                      </Link>
                    </td>
                  </tr>
                )
              }) : (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-gray-400">Nenhum usuário cadastrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Convites */}
      {tab === 'convites' && (
        <div className="space-y-8">
          {/* Aguardando */}
          <div>
            <h2 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">Aguardando</h2>
            {convitesPendentes.length > 0 ? (
              <div className="grid gap-3">
                {convitesPendentes.map((c: any) => {
                  const roleConf = ROLE_CONFIG[c.role] || { label: c.role || '--', color: 'bg-gray-100 text-gray-600' }
                  return (
                    <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div>
                          <div className="font-semibold text-gray-900">{c.nome_convidado}</div>
                          <div className="text-xs text-gray-500">{c.email}</div>
                        </div>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${roleConf.color}`}>
                          {roleConf.label}
                        </span>
                        <span className="text-xs text-gray-400">
                          Expira em {new Date(c.expires_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => copyLink(c.token, c.id)}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                          {copiedId === c.id ? 'Copiado!' : 'Copiar link'}
                        </button>
                        <button
                          onClick={() => revogarConvite(c.id)}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                        >
                          Revogar
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-400">
                Nenhum convite aguardando aceite.
              </div>
            )}
          </div>

          {/* Aceitos */}
          <div>
            <h2 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">Aceitos</h2>
            {convitesAceitos.length > 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nome</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Aceito em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {convitesAceitos.map((c: any) => (
                      <tr key={c.id} className="border-b border-gray-50">
                        <td className="px-4 py-3 font-semibold text-gray-900">{c.nome_convidado}</td>
                        <td className="px-4 py-3 text-gray-500">{c.email}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {c.usado_em ? new Date(c.usado_em).toLocaleDateString('pt-BR') : '--'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-400">
                Nenhum convite aceito ainda.
              </div>
            )}
          </div>

          {/* Expirados/Revogados */}
          <div>
            <h2 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">Expirados / Revogados</h2>
            {convitesExpirados.length > 0 ? (
              <div className="space-y-2">
                {convitesExpirados.map((c: any) => (
                  <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 text-gray-400">
                    <div>
                      <div className="font-medium">{c.nome_convidado}</div>
                      <div className="text-xs">{c.email}</div>
                    </div>
                    <span className="text-xs">
                      {!c.ativo ? 'Revogado' : 'Expirado'}
                    </span>
                    <span className="text-xs ml-auto">
                      {new Date(c.expires_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-400">
                Nenhum convite expirado ou revogado.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
