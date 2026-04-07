'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { Profile } from '@/lib/types'
import NotificationBell from '@/components/NotificationBell'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador', encarregado: 'Encarregado',
  almoxarife: 'Almoxarife', funcionario: 'Funcionário',
}

function NavItem({ href, label, icon, badge }: { href: string; label: string; icon: React.ReactNode; badge?: string }) {
  const pathname = usePathname()
  const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
  return (
    <Link href={href} className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-all duration-150 mb-0.5 border-l-2 ${
      active
        ? 'bg-brand-gold/20 text-brand-gold font-semibold border-brand-gold'
        : 'text-blue-200 hover:bg-white/10 hover:text-white border-transparent'
    }`}>
      <span className={`flex-shrink-0 ${active ? 'text-brand-gold' : 'text-blue-300'}`}>{icon}</span>
      <span className="flex-1 leading-none">{label}</span>
      {badge && <span className="text-[9px] bg-brand-gold text-white px-1.5 py-0.5 rounded-full font-bold">{badge}</span>}
    </Link>
  )
}

function NavGroup({ label, children, defaultOpen, forceOpen }: { label: string; children: React.ReactNode; defaultOpen?: boolean; forceOpen?: boolean }) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(`sidebar_${label}`)
    if (stored !== null) {
      setOpen(stored === 'true')
    } else {
      setOpen(defaultOpen ?? false)
    }
    setMounted(true)
  }, [label, defaultOpen])

  const isOpen = forceOpen || open

  function toggle() {
    const next = !isOpen
    setOpen(next)
    localStorage.setItem(`sidebar_${label}`, String(next))
  }

  return (
    <div>
      <button
        onClick={toggle}
        className="text-[9px] font-black text-blue-400/60 uppercase tracking-widest px-3 pt-2 pb-0.5 cursor-pointer flex items-center justify-between w-full"
      >
        <span>{label}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="currentColor"
          className={`transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
        >
          <path d="M3 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        </svg>
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${isOpen ? 'max-h-[500px]' : 'max-h-0'}`}
      >
        {children}
      </div>
    </div>
  )
}

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
  ai:      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M5 8c0-1.7 1.3-3 3-3s3 1.3 3 3-1.3 3-3 3" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round"/><circle cx="8" cy="8" r="1.2"/></svg>,
  import:  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 10V3M5 7l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/><path d="M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none"/></svg>,
  cad:     <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="6" height="14" rx="1.5" opacity=".3"/><rect x="9" y="1" width="6" height="6" rx="1.5"/><rect x="9" y="9" width="6" height="6" rx="1.5"/></svg>,
  faltas:  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="2" width="12" height="12" rx="2" opacity=".15"/><path d="M5 5l6 6M11 5l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/></svg>,
  ponto:   <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M8 4.5v4l2.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none"/><path d="M5 8l2 2 3.5-3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity=".5"/></svg>,
  client:  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="3" width="14" height="10" rx="2" opacity=".2"/><path d="M4 7h8M4 10h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none"/></svg>,
  config:  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M13 3l-1.5 1.5M4.5 11.5L3 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
}

export default function Sidebar({ profile }: { profile: Profile | null }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const role = profile?.role ?? 'funcionario'
  const isAdmin = role === 'admin'
  const isOp = isAdmin || role === 'encarregado'
  const isStock = isAdmin || role === 'almoxarife' || role === 'encarregado'
  const initials = profile?.nome?.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() ?? 'U'

  const ROLE_BADGE: Record<string, string> = {
    admin: 'bg-brand-gold/20 text-brand-gold',
    encarregado: 'bg-blue-400/20 text-blue-200',
    almoxarife: 'bg-amber-400/20 text-amber-300',
    funcionario: 'bg-white/10 text-blue-200',
  }

  function hasActiveChild(paths: string[]) {
    return paths.some(p => pathname === p || pathname.startsWith(p + '/'))
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const nav = (
    <nav className="flex-1 px-2 py-2 overflow-y-auto scrollbar-none">
      <NavItem href="/dashboard" label="Dashboard" icon={ic.home} />

      <NavGroup label="Contratos HH" forceOpen={hasActiveChild(['/obras','/tipos-contrato','/efetivo','/faltas'])}>
        {isOp && <NavItem href="/obras" label="Contratos" icon={ic.obras} />}
        {isAdmin && <NavItem href="/tipos-contrato" label="Tipos de Contrato" icon={ic.bm} />}
      </NavGroup>

      <NavGroup label="Equipe" forceOpen={hasActiveChild(['/funcionarios','/alocacao','/ponto','/rh/banco-horas','/rh/ferias'])}>
        {isAdmin && <NavItem href="/funcionarios" label="Funcionários" icon={ic.func} />}
        {isOp && <NavItem href="/alocacao" label="Alocação" icon={ic.alloc} />}
        {isOp && <NavItem href="/ponto" label="Ponto" icon={ic.ponto} />}
        {isOp && <NavItem href="/rh/banco-horas" label="Banco de Horas" icon={ic.hh} />}
        {isOp && <NavItem href="/rh/ferias" label="Férias" icon={ic.efetivo} />}
      </NavGroup>

      {isOp && (
        <NavGroup label="RH & Legal" forceOpen={hasActiveChild(['/rh/treinamentos','/rh/admissoes','/rh/desligamentos','/documentos','/rastreio'])}>
          <NavItem href="/rh/treinamentos" label="Treinamentos NR" icon={ic.audit} />
          <NavItem href="/documentos" label="Documentos" icon={ic.docs} />
          <NavItem href="/rastreio" label="Vencimentos" icon={ic.audit} />
          <NavItem href="/rh/admissoes" label="Admissões" icon={ic.func} />
          <NavItem href="/rh/desligamentos" label="Desligamentos" icon={ic.faltas} />
        </NavGroup>
      )}

      {isOp && (
        <NavGroup label="Faturamento" forceOpen={hasActiveChild(['/boletins','/forecast','/financeiro'])}>
          <NavItem href="/boletins" label="Boletins (BM)" icon={ic.bm} />
          <NavItem href="/forecast" label="Forecast" icon={ic.report} />
          <NavItem href="/financeiro" label="Financeiro" icon={ic.fin} />
        </NavGroup>
      )}

      {isOp && (
        <NavGroup label="Campo" forceOpen={hasActiveChild(['/efetivo','/faltas','/compras','/relatorios','/estoque'])}>
          <NavItem href="/efetivo" label="Efetivo Diário" icon={ic.efetivo} />
          <NavItem href="/faltas" label="Faltas" icon={ic.faltas} />
          {isStock && <NavItem href="/estoque" label="Estoque" icon={ic.stock} />}
          <NavItem href="/compras/cotacoes" label="Cotações" icon={ic.bm} />
          <NavItem href="/compras/pedidos" label="Pedidos" icon={ic.stock} />
          <NavItem href="/compras/fornecedores" label="Fornecedores" icon={ic.client} />
          <NavItem href="/relatorios" label="Relatórios" icon={ic.report} />
          <NavItem href="/relatorios/margem" label="Margem" icon={ic.fin} />
          {isAdmin && <NavItem href="/assistente" label="Assistente IA" icon={ic.ai} badge="IA" />}
        </NavGroup>
      )}

      {isAdmin && (
        <NavGroup label="Administrativo" forceOpen={hasActiveChild(['/admin/usuarios','/configuracoes','/cadastros','/clientes','/importar','/audit','/manual','/ponto'])}>
          <NavItem href="/admin/usuarios" label="Usuários" icon={ic.users} />
          <NavItem href="/ponto" label="Ponto" icon={ic.ponto} />
          <NavItem href="/configuracoes" label="Empresa" icon={ic.config} />
          <NavItem href="/cadastros" label="Cadastros" icon={ic.cad} />
          <NavItem href="/clientes" label="Clientes" icon={ic.client} />
          <NavItem href="/importar" label="Importar" icon={ic.import} />
          <NavItem href="/manual" label="Manual" icon={ic.docs} />
        </NavGroup>
      )}

      {role === 'funcionario' && <NavItem href="/hh" label="Meu HH" icon={ic.hh} />}
    </nav>
  )

  const userBar = (
    <div className="px-3 py-3.5">
      <div className="flex items-center gap-2.5">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 font-display ${ROLE_BADGE[role]}`}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold truncate text-white">{profile?.nome ?? 'Usuário'}</div>
          <div className="text-[10px] text-blue-300">{ROLE_LABELS[role]}</div>
        </div>
        <div className="text-blue-300">
          <NotificationBell />
        </div>
        <button onClick={handleLogout} title="Sair"
          className="text-blue-400 hover:text-white transition-colors p-1 rounded hover:bg-white/10">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M11 11l3-3-3-3M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-56 flex-shrink-0 flex-col h-screen sticky top-0 bg-brand text-white shadow-xl">
        <div className="px-4 pt-5 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect x="4" y="20" width="8" height="10" rx="1" fill="#C4972A"/>
              <rect x="13" y="12" width="8" height="18" rx="1" fill="#C4972A" opacity=".85"/>
              <rect x="22" y="4" width="8" height="26" rx="1" fill="#C4972A" opacity=".65"/>
            </svg>
            <div>
              <div className="font-display font-black text-white text-sm tracking-widest">TECNOMONTE</div>
              <div className="text-[9px] text-blue-300/80 tracking-wider leading-tight">SOFTMONTE · GESTÃO DE OBRAS</div>
            </div>
          </div>
        </div>
        {nav}
        <div className="h-px bg-gradient-to-r from-transparent via-brand-gold/40 to-transparent mx-4"/>
        {userBar}
      </aside>

      {/* Mobile: hamburger + drawer */}
      <div className="lg:hidden">
        <div className="fixed top-0 left-0 right-0 z-40 bg-brand flex items-center justify-between px-4 py-3 shadow-lg">
          <div className="flex items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
              <rect x="4" y="20" width="8" height="10" rx="1" fill="#C4972A"/>
              <rect x="13" y="12" width="8" height="18" rx="1" fill="#C4972A" opacity=".85"/>
              <rect x="22" y="4" width="8" height="26" rx="1" fill="#C4972A" opacity=".65"/>
            </svg>
            <span className="font-display font-black text-white text-sm tracking-wide">SOFTMONTE</span>
          </div>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="text-white p-1">
            {mobileOpen
              ? <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/></svg>
              : <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><rect x="2" y="4" width="16" height="2" rx="1"/><rect x="2" y="9" width="16" height="2" rx="1"/><rect x="2" y="14" width="16" height="2" rx="1"/></svg>
            }
          </button>
        </div>
        <div className="h-14"/>

        {/* Drawer */}
        {mobileOpen && (
          <>
            <div className="fixed inset-0 z-30 bg-black/50" onClick={() => setMobileOpen(false)}/>
            <aside className="fixed top-14 left-0 bottom-0 z-40 w-64 bg-brand text-white flex flex-col shadow-2xl overflow-y-auto">
              {nav}
              <div className="h-px bg-gradient-to-r from-transparent via-brand-gold/40 to-transparent mx-4"/>
              {userBar}
            </aside>
          </>
        )}

        {/* Bottom tab bar */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 flex items-center justify-around px-2 py-1.5 safe-area-pb">
          {[
            { href: '/dashboard', label: 'Início', icon: ic.home },
            { href: '/obras', label: 'Contratos', icon: ic.obras },
            { href: '/funcionarios', label: 'Equipe', icon: ic.func },
            { href: '/boletins', label: 'BMs', icon: ic.bm },
            { href: '#', label: 'Menu', icon: ic.cad, isMenu: true },
          ].map(tab => {
            const isActive = tab.href !== '#' && (pathname === tab.href || (tab.href !== '/dashboard' && pathname.startsWith(tab.href)))
            if (tab.isMenu) {
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
        <div className="h-16" /> {/* Spacer for bottom tab */}
      </div>
    </>
  )
}
