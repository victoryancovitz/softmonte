'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { Profile } from '@/lib/types'
import NotificationBell from '@/components/NotificationBell'

const ic = {
  home:    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="6" height="6" rx="1.5"/><rect x="9" y="1" width="6" height="6" rx="1.5"/><rect x="1" y="9" width="6" height="6" rx="1.5"/><rect x="9" y="9" width="6" height="6" rx="1.5"/></svg>,
  func:    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><circle cx="5.5" cy="4" r="2.5"/><path d="M1 13c0-3 2-5 4.5-5s4.5 2 4.5 5" opacity=".5"/><circle cx="12" cy="5" r="2"/><path d="M10 13c0-2.5 1.5-4 3-4.5" opacity=".5"/></svg>,
  obras:   <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M1 14V6l7-4 7 4v8H1z" opacity=".2"/><path d="M1 6l7-4 7 4M6 14v-5h4v5" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round"/></svg>,
  bm:      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M3 2h10a1 1 0 011 1v11a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" opacity=".2"/><path d="M5 6h6M5 9h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none"/></svg>,
  stock:   <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="9" width="14" height="6" rx="1.5" opacity=".3"/><rect x="3" y="5" width="10" height="5" rx="1"/><rect x="5" y="1" width="6" height="5" rx="1"/></svg>,
  fin:     <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M2 10c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round"/><circle cx="8" cy="11" r="2" opacity=".7"/></svg>,
  report:  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="2" width="12" height="1.5" rx=".75"/><rect x="2" y="5.5" width="8" height="1.5" rx=".75"/><rect x="2" y="9" width="10" height="1.5" rx=".75"/><rect x="2" y="12.5" width="6" height="1.5" rx=".75"/></svg>,
  docs:    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M3 2h7l3 3v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" opacity=".4"/><path d="M10 2v3h3" stroke="currentColor" strokeWidth="1.2" fill="none"/></svg>,
  faltas:  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="2" width="12" height="12" rx="2" opacity=".15"/><path d="M5 5l6 6M11 5l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/></svg>,
  client:  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="3" width="14" height="10" rx="2" opacity=".2"/><path d="M4 7h8M4 10h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none"/></svg>,
  cad:     <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="6" height="14" rx="1.5" opacity=".3"/><rect x="9" y="1" width="6" height="6" rx="1.5"/><rect x="9" y="9" width="6" height="6" rx="1.5"/></svg>,
  config:  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M13 3l-1.5 1.5M4.5 11.5L3 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
  users:   <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="6" r="3"/><path d="M2 14c0-3.3 2.7-5 6-5s6 1.7 6 5" opacity=".5"/></svg>,
  manual:  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M2 2h5v12H2z" opacity=".2"/><path d="M9 2h5v12H9z" opacity=".15"/><path d="M7 2v12M2 2h12v12H2z" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinejoin="round"/></svg>,
  logout:  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M11 11l3-3-3-3M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
}

interface NavLink {
  href: string
  label: string
  icon: React.ReactNode
  disabled?: boolean
}

interface NavGroupDef {
  label: string
  links: NavLink[]
}

const NAV_GROUPS: NavGroupDef[] = [
  {
    label: 'Engenharia',
    links: [
      { href: '/obras', label: 'Obras', icon: ic.obras },
      { href: '/boletins', label: 'Boletins de Medição', icon: ic.bm },
    ],
  },
  {
    label: 'Administrativo',
    links: [
      { href: '/funcionarios', label: 'Funcionários', icon: ic.func },
      { href: '/alocacao', label: 'Alocação de Equipes', icon: ic.func },
      { href: '/ponto', label: 'Ponto', icon: ic.faltas },
      { href: '/faltas', label: 'Faltas', icon: ic.faltas },
      { href: '/rh/banco-horas', label: 'Banco de Horas', icon: ic.docs },
      { href: '/rh/ferias', label: 'Férias', icon: ic.docs },
      { href: '/rh/treinamentos', label: 'Treinamentos NR', icon: ic.docs },
      { href: '/rh/admissoes', label: 'Admissões', icon: ic.func },
      { href: '/rh/desligamentos', label: 'Desligamentos', icon: ic.faltas },
      { href: '/documentos', label: 'Documentos', icon: ic.docs },
      { href: '/rastreio', label: 'Vencimentos', icon: ic.docs },
    ],
  },
  {
    label: 'Compras',
    links: [
      { href: '/estoque', label: 'Almoxarifado', icon: ic.stock },
      { href: '/compras/fornecedores', label: 'Fornecedores', icon: ic.client },
      { href: '/compras/cotacoes', label: 'Cotações', icon: ic.bm },
      { href: '/compras/pedidos', label: 'Pedidos', icon: ic.stock },
    ],
  },
  {
    label: 'Financeiro',
    links: [
      { href: '/financeiro', label: 'Lançamentos', icon: ic.fin },
      { href: '/financeiro/contas', label: 'Contas Correntes', icon: ic.fin },
      { href: '/relatorios', label: 'Relatórios', icon: ic.report },
      { href: '/relatorios/margem', label: 'Margem', icon: ic.fin },
      { href: '/forecast', label: 'Forecast', icon: ic.report },
    ],
  },
  {
    label: 'Cadastros',
    links: [
      { href: '/cadastros', label: 'Visão Geral', icon: ic.cad },
      { href: '/cadastros/funcoes', label: 'Funções', icon: ic.cad },
      { href: '/cadastros/categorias', label: 'Categorias Financeiras', icon: ic.cad },
      { href: '/clientes', label: 'Clientes', icon: ic.client },
      { href: '/tipos-contrato', label: 'Tipos de Contrato', icon: ic.docs },
    ],
  },
]

// Map every link path to its group and label for breadcrumb generation
const PATH_MAP: Record<string, { group: string; label: string }> = {}
NAV_GROUPS.forEach(g => {
  g.links.forEach(l => {
    if (!l.disabled) PATH_MAP[l.href] = { group: g.label, label: l.label }
  })
})
PATH_MAP['/dashboard'] = { group: '', label: 'Dashboard' }
PATH_MAP['/configuracoes'] = { group: '', label: 'Configurações' }
PATH_MAP['/admin/usuarios'] = { group: '', label: 'Gerenciar Usuários' }
PATH_MAP['/admin/usuarios/auditoria'] = { group: '', label: 'Auditoria' }
PATH_MAP['/admin/usuarios/convidar'] = { group: '', label: 'Convidar Usuário' }
PATH_MAP['/manual'] = { group: '', label: 'Manual' }
PATH_MAP['/importar'] = { group: '', label: 'Importar dados' }
PATH_MAP['/assistente'] = { group: '', label: 'Assistente IA' }
PATH_MAP['/audit'] = { group: '', label: 'Auditoria' }

function getActiveGroup(pathname: string): string | null {
  // Check PATH_MAP first for extra routes
  for (const [path, info] of Object.entries(PATH_MAP)) {
    if (info.group && (pathname === path || pathname.startsWith(path + '/'))) return info.group
  }
  for (const g of NAV_GROUPS) {
    for (const l of g.links) {
      if (!l.disabled && (pathname === l.href || pathname.startsWith(l.href + '/'))) return g.label
    }
  }
  return null
}

function getBreadcrumb(pathname: string): { group: string; page: string } | null {
  if (PATH_MAP[pathname]) {
    return { group: PATH_MAP[pathname].group, page: PATH_MAP[pathname].label }
  }
  const segments = pathname.split('/').filter(Boolean)
  for (let i = segments.length; i >= 1; i--) {
    const prefix = '/' + segments.slice(0, i).join('/')
    if (PATH_MAP[prefix]) {
      return { group: PATH_MAP[prefix].group, page: PATH_MAP[prefix].label }
    }
  }
  return null
}

export default function Topbar({ profile }: { profile: Profile | null }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const [avatarOpen, setAvatarOpen] = useState(false)
  const avatarRef = useRef<HTMLDivElement>(null)
  const navRef = useRef<HTMLDivElement>(null)

  const initials = profile?.nome?.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() ?? 'U'
  const activeGroup = getActiveGroup(pathname)
  const breadcrumb = getBreadcrumb(pathname)
  const isAdmin = profile?.role === 'admin'

  useEffect(() => { setMobileOpen(false); setOpenGroup(null); setAvatarOpen(false) }, [pathname])

  // Close avatar dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) setAvatarOpen(false)
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenGroup(null)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function toggleGroup(label: string) {
    setOpenGroup(prev => prev === label ? null : label)
  }

  return (
    <>
      {/* ─── DESKTOP TOPBAR ─── */}
      <header className="hidden lg:block fixed top-0 left-0 right-0 z-50">
        {/* Main bar — 48px */}
        <div className="h-12 bg-[#0f1e2e] flex items-center px-4">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2.5 mr-6 flex-shrink-0">
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
              <rect x="4" y="20" width="8" height="10" rx="1" fill="#c8960c"/>
              <rect x="13" y="12" width="8" height="18" rx="1" fill="#c8960c" opacity=".85"/>
              <rect x="22" y="4" width="8" height="26" rx="1" fill="#c8960c" opacity=".65"/>
            </svg>
            <span className="font-display font-black text-white text-xs tracking-widest">SOFTMONTE</span>
          </Link>

          {/* Nav groups */}
          <nav ref={navRef} className="flex items-center h-full gap-0.5 flex-1 min-w-0">
            {NAV_GROUPS.map(g => {
              const isActive = activeGroup === g.label
              const isOpen = openGroup === g.label
              return (
                <div key={g.label} className="relative h-full flex items-center">
                  <button
                    onClick={() => toggleGroup(g.label)}
                    className={`px-3 h-full text-[13px] font-medium transition-colors relative flex items-center gap-1 ${
                      isActive ? 'text-white' : 'text-blue-200/70 hover:text-white'
                    }`}
                  >
                    {g.label}
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                      <path d="M2.5 4l2.5 2.5L7.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {isActive && (
                      <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-[#c8960c] rounded-t" />
                    )}
                  </button>

                  {/* Dropdown */}
                  {isOpen && (
                    <div
                      className="absolute top-full left-0 bg-white rounded-lg p-1.5 min-w-[220px] mt-0.5"
                      style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.15)', borderRadius: '8px' }}
                    >
                      {g.links.map(link => {
                        if (link.disabled) {
                          return (
                            <div key={link.href} className="flex items-center gap-2 px-2.5 py-[7px] rounded-md text-[13px] text-gray-300 cursor-not-allowed">
                              <span className="flex-shrink-0 text-gray-300">{link.icon}</span>
                              {link.label}
                              <span className="ml-auto text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded">Em breve</span>
                            </div>
                          )
                        }
                        const linkActive = pathname === link.href || pathname.startsWith(link.href + '/')
                        return (
                          <Link
                            key={link.href}
                            href={link.href}
                            onClick={() => setOpenGroup(null)}
                            className={`flex items-center gap-2 px-2.5 py-[7px] rounded-md text-[13px] transition-colors ${
                              linkActive
                                ? 'text-[#c8960c] bg-[#c8960c]/10 font-medium'
                                : 'text-gray-700 hover:bg-[#c8960c]/5 hover:text-gray-900'
                            }`}
                          >
                            <span className={`flex-shrink-0 ${linkActive ? 'text-[#c8960c]' : 'text-gray-400'}`}>{link.icon}</span>
                            {link.label}
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Sector badge */}
            {activeGroup && (
              <span className="text-[11px] font-medium text-[#c8960c] border border-[#c8960c]/40 rounded px-2 py-0.5">
                {activeGroup}
              </span>
            )}

            {/* Notification bell */}
            <div className="text-white">
              <NotificationBell />
            </div>

            {/* Avatar with dropdown */}
            <div ref={avatarRef} className="relative">
              <button
                onClick={() => setAvatarOpen(!avatarOpen)}
                className="w-[30px] h-[30px] rounded-full bg-[#c8960c] flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 hover:opacity-90 transition-opacity"
              >
                {initials}
              </button>

              {avatarOpen && (
                <div
                  className="absolute right-0 top-full mt-1.5 w-56 bg-white rounded-lg overflow-hidden"
                  style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.15)', borderRadius: '8px' }}
                >
                  {/* User info */}
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-900 truncate">{profile?.nome ?? 'Usuário'}</p>
                    <p className="text-xs text-gray-400 truncate">{(profile as any)?.email ?? ''}</p>
                  </div>
                  {/* Menu items */}
                  <div className="py-1">
                    <Link href="/manual" onClick={() => setAvatarOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-[13px] text-gray-700 hover:bg-[#c8960c]/5 transition-colors">
                      <span className="text-gray-400">{ic.manual}</span> Manual do usuário
                    </Link>
                    <Link href="/configuracoes" onClick={() => setAvatarOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-[13px] text-gray-700 hover:bg-[#c8960c]/5 transition-colors">
                      <span className="text-gray-400">{ic.config}</span> Empresa / Configurações
                    </Link>
                    {isAdmin && (
                      <>
                        <Link href="/admin/usuarios" onClick={() => setAvatarOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2 text-[13px] text-gray-700 hover:bg-[#c8960c]/5 transition-colors">
                          <span className="text-gray-400">{ic.users}</span> Gerenciar usuários
                        </Link>
                        <Link href="/admin/usuarios/auditoria" onClick={() => setAvatarOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2 text-[13px] text-gray-700 hover:bg-[#c8960c]/5 transition-colors">
                          <span className="text-gray-400">{ic.docs}</span> Auditoria do sistema
                        </Link>
                        <Link href="/importar" onClick={() => setAvatarOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2 text-[13px] text-gray-700 hover:bg-[#c8960c]/5 transition-colors">
                          <span className="text-gray-400">{ic.docs}</span> Importar dados
                        </Link>
                        <Link href="/assistente" onClick={() => setAvatarOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2 text-[13px] text-gray-700 hover:bg-[#c8960c]/5 transition-colors">
                          <span className="text-gray-400">{ic.report}</span> Assistente IA
                        </Link>
                      </>
                    )}
                  </div>
                  <div className="border-t border-gray-100 py-1">
                    <button onClick={handleLogout}
                      className="flex items-center gap-2.5 px-4 py-2 text-[13px] text-red-600 hover:bg-red-50 transition-colors w-full text-left">
                      <span className="text-red-400">{ic.logout}</span> Sair
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Breadcrumb bar — 34px */}
        <div className="h-[34px] bg-white border-b border-gray-200 flex items-center px-4">
          {breadcrumb ? (
            <div className="flex items-center gap-1.5 text-[13px]">
              {breadcrumb.group && (
                <>
                  <span className="text-[#0f1e2e] font-medium">{breadcrumb.group}</span>
                  <span className="text-gray-300">›</span>
                </>
              )}
              <span className="text-gray-500">{breadcrumb.page}</span>
            </div>
          ) : (
            <span className="text-[13px] text-gray-500">{pathname === '/dashboard' ? 'Dashboard' : ''}</span>
          )}
        </div>
      </header>

      {/* Desktop spacer */}
      <div className="hidden lg:block h-[82px]" />

      {/* ─── MOBILE ─── */}
      <div className="lg:hidden">
        {/* Mobile top bar */}
        <div className="fixed top-0 left-0 right-0 z-40 bg-[#0f1e2e] flex items-center justify-between px-4 h-12">
          <Link href="/dashboard" className="flex items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
              <rect x="4" y="20" width="8" height="10" rx="1" fill="#c8960c"/>
              <rect x="13" y="12" width="8" height="18" rx="1" fill="#c8960c" opacity=".85"/>
              <rect x="22" y="4" width="8" height="26" rx="1" fill="#c8960c" opacity=".65"/>
            </svg>
            <span className="font-display font-black text-white text-sm tracking-wide">SOFTMONTE</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="text-white">
              <NotificationBell />
            </div>
            <button
              onClick={() => setAvatarOpen(!avatarOpen)}
              className="w-[30px] h-[30px] rounded-full bg-[#c8960c] flex items-center justify-center text-white text-[11px] font-bold"
            >
              {initials}
            </button>
          </div>
        </div>
        <div className="h-12" />

        {/* Mobile avatar dropdown */}
        {avatarOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setAvatarOpen(false)} />
            <div className="fixed top-12 right-2 z-40 w-56 bg-white rounded-lg shadow-xl border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-900 truncate">{profile?.nome ?? 'Usuário'}</p>
                <p className="text-xs text-gray-400 truncate">{(profile as any)?.email ?? ''}</p>
              </div>
              <div className="py-1">
                <Link href="/manual" onClick={() => setAvatarOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                  <span className="text-gray-400">{ic.manual}</span> Manual
                </Link>
                <Link href="/configuracoes" onClick={() => setAvatarOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                  <span className="text-gray-400">{ic.config}</span> Configurações
                </Link>
                {isAdmin && (
                  <Link href="/admin/usuarios" onClick={() => setAvatarOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                    <span className="text-gray-400">{ic.users}</span> Gerenciar usuários
                  </Link>
                )}
              </div>
              <div className="border-t border-gray-100 py-1">
                <button onClick={handleLogout}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 w-full text-left">
                  <span className="text-red-400">{ic.logout}</span> Sair
                </button>
              </div>
            </div>
          </>
        )}

        {/* Mobile drawer */}
        {mobileOpen && (
          <>
            <div className="fixed inset-0 z-30 bg-black/50" onClick={() => setMobileOpen(false)} />
            <aside className="fixed top-12 left-0 bottom-0 z-40 w-64 bg-[#0f1e2e] text-white flex flex-col shadow-2xl overflow-y-auto">
              <nav className="flex-1 px-2 py-2 overflow-y-auto scrollbar-none">
                {NAV_GROUPS.map(g => (
                  <div key={g.label} className="mb-1">
                    <div className="text-[9px] font-black text-blue-400/60 uppercase tracking-widest px-3 pt-2 pb-0.5">{g.label}</div>
                    {g.links.filter(l => !l.disabled).map(link => {
                      const active = pathname === link.href || pathname.startsWith(link.href + '/')
                      return (
                        <Link key={link.href} href={link.href}
                          className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-all duration-150 mb-0.5 ${
                            active
                              ? 'bg-[#c8960c]/20 text-[#c8960c] font-semibold'
                              : 'text-blue-200 hover:bg-white/10 hover:text-white'
                          }`}>
                          <span className={`flex-shrink-0 ${active ? 'text-[#c8960c]' : 'text-blue-300'}`}>{link.icon}</span>
                          <span className="leading-none">{link.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                ))}
              </nav>
            </aside>
          </>
        )}

        {/* Bottom tab bar */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 flex items-center justify-around px-2 py-1.5 safe-area-pb">
          {[
            { href: '/dashboard', label: 'Início', icon: ic.home },
            { href: '/obras', label: 'Obras', icon: ic.obras },
            { href: '/funcionarios', label: 'Equipe', icon: ic.func },
            { href: '/boletins', label: 'BMs', icon: ic.bm },
            { href: '#', label: 'Menu', icon: ic.cad, isMenu: true },
          ].map(tab => {
            const isActive = tab.href !== '#' && (pathname === tab.href || (tab.href !== '/dashboard' && pathname.startsWith(tab.href)))
            if ((tab as any).isMenu) {
              return (
                <button key="menu" onClick={() => setMobileOpen(!mobileOpen)}
                  className="flex flex-col items-center gap-0.5 px-2 py-1 text-gray-400">
                  <span className="w-5 h-5">{tab.icon}</span>
                  <span className="text-[10px]">{tab.label}</span>
                </button>
              )
            }
            return (
              <Link key={tab.href} href={tab.href}
                className={`flex flex-col items-center gap-0.5 px-2 py-1 transition-colors ${isActive ? 'text-[#0f1e2e]' : 'text-gray-400'}`}>
                <span className="w-5 h-5">{tab.icon}</span>
                <span className="text-[10px] font-medium">{tab.label}</span>
              </Link>
            )
          })}
        </nav>
        <div className="h-16" />
      </div>
    </>
  )
}
