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
  efetivo: <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="2" width="12" height="12" rx="2" opacity=".15"/><path d="M5 8l2.5 2.5 3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>,
  bm:      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M3 2h10a1 1 0 011 1v11a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" opacity=".2"/><path d="M5 6h6M5 9h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none"/></svg>,
  alloc:   <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="3" width="14" height="2" rx="1"/><rect x="1" y="7" width="10" height="2" rx="1"/><rect x="1" y="11" width="12" height="2" rx="1"/></svg>,
  stock:   <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="9" width="14" height="6" rx="1.5" opacity=".3"/><rect x="3" y="5" width="10" height="5" rx="1"/><rect x="5" y="1" width="6" height="5" rx="1"/></svg>,
  hh:      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M8 5v3.5l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/></svg>,
  fin:     <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M2 10c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round"/><circle cx="8" cy="11" r="2" opacity=".7"/></svg>,
  report:  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="2" width="12" height="1.5" rx=".75"/><rect x="2" y="5.5" width="8" height="1.5" rx=".75"/><rect x="2" y="9" width="10" height="1.5" rx=".75"/><rect x="2" y="12.5" width="6" height="1.5" rx=".75"/></svg>,
  docs:    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M3 2h7l3 3v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" opacity=".4"/><path d="M10 2v3h3" stroke="currentColor" strokeWidth="1.2" fill="none"/></svg>,
  users:   <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="6" r="3"/><path d="M2 14c0-3.3 2.7-5 6-5s6 1.7 6 5" opacity=".5"/></svg>,
  audit:   <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1L1 4v5c0 3.9 3 7.1 7 8 4-0.9 7-4.1 7-8V4L8 1z" opacity=".2"/><path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>,
  faltas:  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="2" width="12" height="12" rx="2" opacity=".15"/><path d="M5 5l6 6M11 5l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/></svg>,
  ponto:   <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M8 4.5v4l2.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none"/><path d="M5 8l2 2 3.5-3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity=".5"/></svg>,
  client:  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="3" width="14" height="10" rx="2" opacity=".2"/><path d="M4 7h8M4 10h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none"/></svg>,
  config:  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M13 3l-1.5 1.5M4.5 11.5L3 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
  cad:     <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="6" height="14" rx="1.5" opacity=".3"/><rect x="9" y="1" width="6" height="6" rx="1.5"/><rect x="9" y="9" width="6" height="6" rx="1.5"/></svg>,
}

interface NavLink {
  href: string
  label: string
  icon: React.ReactNode
}

interface NavGroupDef {
  label: string
  links: NavLink[]
}

const NAV_GROUPS: NavGroupDef[] = [
  {
    label: 'Contratos',
    links: [
      { href: '/contratos', label: 'Contratos', icon: ic.obras },
      { href: '/tipos-contrato', label: 'Tipos de contrato', icon: ic.bm },
    ],
  },
  {
    label: 'Equipe',
    links: [
      { href: '/funcionarios', label: 'Funcionários', icon: ic.func },
      { href: '/alocacao', label: 'Alocação', icon: ic.alloc },
      { href: '/ponto', label: 'Ponto', icon: ic.ponto },
      { href: '/rh/banco-horas', label: 'Banco de horas', icon: ic.hh },
      { href: '/rh/ferias', label: 'Férias', icon: ic.efetivo },
    ],
  },
  {
    label: 'RH & Legal',
    links: [
      { href: '/rh/treinamentos', label: 'Treinamentos NR', icon: ic.audit },
      { href: '/documentos', label: 'Documentos', icon: ic.docs },
      { href: '/rh/admissoes', label: 'Admissões', icon: ic.func },
      { href: '/rh/desligamentos', label: 'Desligamentos', icon: ic.faltas },
      { href: '/rastreio', label: 'Vencimentos', icon: ic.audit },
    ],
  },
  {
    label: 'Obras',
    links: [
      { href: '/obras', label: 'Obras', icon: ic.obras },
      { href: '/boletins', label: 'Boletins', icon: ic.bm },
      { href: '/hh', label: 'Efetivo', icon: ic.hh },
      { href: '/faltas', label: 'Faltas', icon: ic.faltas },
      { href: '/estoque', label: 'Estoque', icon: ic.stock },
    ],
  },
  {
    label: 'Financeiro',
    links: [
      { href: '/financeiro', label: 'Financeiro', icon: ic.fin },
      { href: '/forecast', label: 'Forecast', icon: ic.report },
      { href: '/relatorios', label: 'Relatórios', icon: ic.report },
      { href: '/relatorios/margem', label: 'Margem', icon: ic.fin },
    ],
  },
  {
    label: 'Admin',
    links: [
      { href: '/admin/usuarios', label: 'Usuários', icon: ic.users },
      { href: '/clientes', label: 'Clientes', icon: ic.client },
      { href: '/compras/fornecedores', label: 'Fornecedores', icon: ic.client },
      { href: '/compras/cotacoes', label: 'Cotações', icon: ic.bm },
      { href: '/compras/pedidos', label: 'Pedidos', icon: ic.stock },
      { href: '/cadastros', label: 'Cadastros', icon: ic.cad },
      { href: '/configuracoes', label: 'Configurações', icon: ic.config },
      { href: '/manual', label: 'Manual', icon: ic.docs },
      { href: '/audit', label: 'Auditoria', icon: ic.audit },
    ],
  },
]

// Map every link path to its group and label for breadcrumb generation
const PATH_MAP: Record<string, { group: string; label: string }> = {}
NAV_GROUPS.forEach(g => {
  g.links.forEach(l => {
    PATH_MAP[l.href] = { group: g.label, label: l.label }
  })
})
PATH_MAP['/dashboard'] = { group: '', label: 'Dashboard' }

function getActiveGroup(pathname: string): string | null {
  for (const g of NAV_GROUPS) {
    for (const l of g.links) {
      if (pathname === l.href || pathname.startsWith(l.href + '/')) return g.label
    }
  }
  return null
}

function getBreadcrumb(pathname: string): { group: string; page: string } | null {
  // Exact match first
  if (PATH_MAP[pathname]) {
    return { group: PATH_MAP[pathname].group, page: PATH_MAP[pathname].label }
  }
  // Try prefix match for nested routes like /funcionarios/[id]
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
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const initials = profile?.nome?.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() ?? 'U'
  const activeGroup = getActiveGroup(pathname)
  const breadcrumb = getBreadcrumb(pathname)

  // Close mobile drawer on navigation
  useEffect(() => { setMobileOpen(false) }, [pathname])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function handleGroupEnter(label: string) {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current)
    setOpenGroup(label)
  }

  function handleGroupLeave() {
    hoverTimeout.current = setTimeout(() => setOpenGroup(null), 150)
  }

  return (
    <>
      {/* ─── DESKTOP TOPBAR ─── */}
      <header className="hidden lg:block fixed top-0 left-0 right-0 z-50">
        {/* Main bar — 48px */}
        <div className="h-12 bg-brand flex items-center px-4">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2.5 mr-6 flex-shrink-0">
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
              <rect x="4" y="20" width="8" height="10" rx="1" fill="#C4972A"/>
              <rect x="13" y="12" width="8" height="18" rx="1" fill="#C4972A" opacity=".85"/>
              <rect x="22" y="4" width="8" height="26" rx="1" fill="#C4972A" opacity=".65"/>
            </svg>
            <span className="font-display font-black text-white text-xs tracking-widest">SOFTMONTE</span>
          </Link>

          {/* Nav groups */}
          <nav className="flex items-center h-full gap-0.5 flex-1 min-w-0">
            {NAV_GROUPS.map(g => {
              const isActive = activeGroup === g.label
              const isOpen = openGroup === g.label
              return (
                <div
                  key={g.label}
                  className="relative h-full flex items-center"
                  onMouseEnter={() => handleGroupEnter(g.label)}
                  onMouseLeave={handleGroupLeave}
                >
                  <button
                    className={`px-3 h-full text-[13px] font-medium transition-colors relative ${
                      isActive ? 'text-white' : 'text-blue-200 hover:text-white'
                    }`}
                  >
                    {g.label}
                    {isActive && (
                      <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-brand-gold rounded-t" />
                    )}
                  </button>

                  {/* Dropdown */}
                  {isOpen && (
                    <div
                      className="absolute top-full left-0 bg-white border border-gray-200 rounded-b-lg p-2 min-w-[200px]"
                      style={{ boxShadow: '0 4px 16px rgba(0,0,21,0.12)' }}
                    >
                      {g.links.map(link => {
                        const linkActive = pathname === link.href || pathname.startsWith(link.href + '/')
                        return (
                          <Link
                            key={link.href}
                            href={link.href}
                            onClick={() => setOpenGroup(null)}
                            className={`flex items-center gap-2 px-2.5 py-[7px] rounded-[5px] text-[13px] transition-colors ${
                              linkActive
                                ? 'text-[#00215B] bg-[rgba(0,33,91,0.07)] font-medium'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                            }`}
                          >
                            <span className={`flex-shrink-0 ${linkActive ? 'text-[#00215B]' : 'text-gray-400'}`}>{link.icon}</span>
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
              <span className="text-[11px] font-medium text-brand-gold border border-brand-gold/50 rounded px-2 py-0.5">
                {activeGroup}
              </span>
            )}

            {/* Notification bell */}
            <div className="text-white">
              <NotificationBell />
            </div>

            {/* Avatar */}
            <button
              onClick={handleLogout}
              title="Sair"
              className="w-[30px] h-[30px] rounded-full bg-[#c8960c] flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 hover:opacity-90 transition-opacity"
            >
              {initials}
            </button>
          </div>
        </div>

        {/* Breadcrumb bar — 34px */}
        <div className="h-[34px] bg-white border-b border-gray-200 flex items-center px-4">
          {breadcrumb ? (
            <div className="flex items-center gap-1.5 text-[13px]">
              {breadcrumb.group && (
                <>
                  <span className="text-[#00215B] font-medium">{breadcrumb.group}</span>
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

      {/* Desktop spacer: 48px topbar + 34px breadcrumb = 82px */}
      <div className="hidden lg:block h-[82px]" />

      {/* ─── MOBILE ─── */}
      <div className="lg:hidden">
        {/* Mobile top bar */}
        <div className="fixed top-0 left-0 right-0 z-40 bg-brand flex items-center justify-between px-4 h-12">
          <Link href="/dashboard" className="flex items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
              <rect x="4" y="20" width="8" height="10" rx="1" fill="#C4972A"/>
              <rect x="13" y="12" width="8" height="18" rx="1" fill="#C4972A" opacity=".85"/>
              <rect x="22" y="4" width="8" height="26" rx="1" fill="#C4972A" opacity=".65"/>
            </svg>
            <span className="font-display font-black text-white text-sm tracking-wide">SOFTMONTE</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="text-white">
              <NotificationBell />
            </div>
            <button
              onClick={handleLogout}
              title="Sair"
              className="w-[30px] h-[30px] rounded-full bg-[#c8960c] flex items-center justify-center text-white text-[11px] font-bold"
            >
              {initials}
            </button>
          </div>
        </div>
        <div className="h-12" />

        {/* Mobile drawer */}
        {mobileOpen && (
          <>
            <div className="fixed inset-0 z-30 bg-black/50" onClick={() => setMobileOpen(false)} />
            <aside className="fixed top-12 left-0 bottom-0 z-40 w-64 bg-brand text-white flex flex-col shadow-2xl overflow-y-auto">
              <nav className="flex-1 px-2 py-2 overflow-y-auto scrollbar-none">
                {NAV_GROUPS.map(g => (
                  <div key={g.label} className="mb-1">
                    <div className="text-[9px] font-black text-blue-400/60 uppercase tracking-widest px-3 pt-2 pb-0.5">{g.label}</div>
                    {g.links.map(link => {
                      const active = pathname === link.href || pathname.startsWith(link.href + '/')
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-all duration-150 mb-0.5 ${
                            active
                              ? 'bg-brand-gold/20 text-brand-gold font-semibold'
                              : 'text-blue-200 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <span className={`flex-shrink-0 ${active ? 'text-brand-gold' : 'text-blue-300'}`}>{link.icon}</span>
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
                className={`flex flex-col items-center gap-0.5 px-2 py-1 transition-colors ${isActive ? 'text-brand' : 'text-gray-400'}`}>
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
