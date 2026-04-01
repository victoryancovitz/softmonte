'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { Profile } from '@/lib/types'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador', encarregado: 'Encarregado',
  almoxarife: 'Almoxarife', funcionario: 'Funcionario',
}

function NavItem({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  const pathname = usePathname()
  const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
  return (
    <Link href={href} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150 mb-0.5 group ${
      active
        ? 'bg-brand-gold/20 text-brand-gold font-semibold border-l-2 border-brand-gold pl-[10px]'
        : 'text-blue-200 hover:bg-white/10 hover:text-white border-l-2 border-transparent pl-[10px]'
    }`}>
      <span className={`flex-shrink-0 ${active ? 'text-brand-gold' : 'text-blue-300 group-hover:text-white'}`}>{icon}</span>
      <span className="leading-none">{label}</span>
    </Link>
  )
}

const ic = {
  home: <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="6" height="6" rx="1.5"/><rect x="9" y="1" width="6" height="6" rx="1.5"/><rect x="1" y="9" width="6" height="6" rx="1.5"/><rect x="9" y="9" width="6" height="6" rx="1.5"/></svg>,
  func: <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><circle cx="5.5" cy="4" r="2.5"/><path d="M1 13c0-3 2-5 4.5-5s4.5 2 4.5 5" opacity=".6"/><circle cx="12" cy="5" r="2"/><path d="M10 13c0-2.5 1.5-4 3-4.5" opacity=".6"/></svg>,
  obras: <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><path d="M1 14V6l7-4 7 4v8H1z" opacity=".2"/><path d="M1 6l7-4 7 4M6 14v-5h4v5" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round"/></svg>,
  efetivo: <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="2" width="12" height="12" rx="2" opacity=".15"/><path d="M5 8l2.5 2.5 3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>,
  bm: <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><path d="M3 2h10a1 1 0 011 1v11a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" opacity=".2"/><path d="M5 6h6M5 9h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none"/></svg>,
  alloc: <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="3" width="14" height="2" rx="1"/><rect x="1" y="7" width="10" height="2" rx="1"/><rect x="1" y="11" width="12" height="2" rx="1"/></svg>,
  stock: <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="9" width="14" height="6" rx="1.5" opacity=".3"/><rect x="3" y="5" width="10" height="5" rx="1"/><rect x="5" y="1" width="6" height="5" rx="1"/></svg>,
  hh: <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M8 5v3.5l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/></svg>,
  fin: <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><path d="M2 10c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round"/><circle cx="8" cy="11" r="2" opacity=".7"/></svg>,
  report: <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="2" width="12" height="1.5" rx=".75"/><rect x="2" y="5.5" width="8" height="1.5" rx=".75"/><rect x="2" y="9" width="10" height="1.5" rx=".75"/><rect x="2" y="12.5" width="6" height="1.5" rx=".75"/></svg>,
  docs: <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><path d="M3 2h7l3 3v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" opacity=".4"/><path d="M10 2v3h3" stroke="currentColor" strokeWidth="1.2" fill="none"/></svg>,
  users: <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="6" r="3"/><path d="M2 14c0-3.3 2.7-5 6-5s6 1.7 6 5" opacity=".5"/></svg>,
  audit: <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1L1 4v5c0 3.9 3 7.1 7 8 4-0.9 7-4.1 7-8V4L8 1z" opacity=".2"/><path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>,
}

function SectionLabel({ label }: { label: string }) {
  return <p className="text-[10px] font-bold text-blue-400/70 uppercase tracking-widest px-3 pt-4 pb-1.5">{label}</p>
}

export default function Sidebar({ profile }: { profile: Profile | null }) {
  const router = useRouter()
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

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col h-screen sticky top-0 bg-brand text-white shadow-xl">
      {/* Logo */}
      <div className="px-4 pt-5 pb-4 border-b border-white/10">
        {/* Tecnomonte Logo */}
        <div className="flex items-center gap-3 mb-1">
          {/* Logo Icon - building shape matching Tecnomonte */}
          <div className="flex-shrink-0">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect x="4" y="20" width="8" height="10" rx="1" fill="#C4972A"/>
              <rect x="13" y="12" width="8" height="18" rx="1" fill="#C4972A" opacity=".85"/>
              <rect x="22" y="4" width="8" height="26" rx="1" fill="#C4972A" opacity=".65"/>
              <rect x="0" y="30" width="32" height="2" rx="1" fill="#C4972A" opacity=".4"/>
            </svg>
          </div>
          <div>
            <div className="font-display font-bold text-base leading-tight tracking-wide">TECNOMONTE</div>
            <div className="text-[9px] text-blue-300 font-light tracking-wider leading-tight mt-0.5">SOFTMONTE — GESTÃO DE OBRAS</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto scrollbar-none">
        <NavItem href="/dashboard" label="Dashboard" icon={ic.home} />

        <SectionLabel label="Obras" />
        {isOp && <NavItem href="/obras" label="Obras" icon={ic.obras} />}
        {isOp && <NavItem href="/efetivo" label="Efetivo Diário" icon={ic.efetivo} />}
        {isOp && <NavItem href="/boletins" label="Boletins (BM)" icon={ic.bm} />}

        <SectionLabel label="Operacional" />
        {isAdmin && <NavItem href="/funcionarios" label="Funcionários" icon={ic.func} />}
        {isOp && <NavItem href="/alocacao" label="Alocação" icon={ic.alloc} />}
        {isStock && <NavItem href="/estoque" label="Estoque" icon={ic.stock} />}
        {isOp && <NavItem href="/hh" label="Gestão de HH" icon={ic.hh} />}
        {isOp && <NavItem href="/documentos" label="Documentos" icon={ic.docs} />}
        {role === 'funcionario' && <NavItem href="/hh" label="Meu HH" icon={ic.hh} />}

        {isOp && (
          <>
            <SectionLabel label="Análise" />
            <NavItem href="/financeiro" label="Financeiro" icon={ic.fin} />
            <NavItem href="/relatorios" label="Relatórios" icon={ic.report} />
          </>
        )}

        {isAdmin && (
          <>
            <SectionLabel label="Admin" />
            <NavItem href="/usuarios" label="Usuários & Acesso" icon={ic.users} />
            <NavItem href="/audit" label="Trilha de Auditoria" icon={ic.audit} />
          </>
        )}
      </nav>

      {/* Gold divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-brand-gold/50 to-transparent mx-4" />

      {/* User */}
      <div className="px-3 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 font-display ${ROLE_BADGE[role]}`}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold truncate text-white">{profile?.nome ?? 'Usuário'}</div>
            <div className="text-[10px] text-blue-300">{ROLE_LABELS[role]}</div>
          </div>
          <button onClick={handleLogout} title="Sair"
            className="text-blue-400 hover:text-white transition-colors p-1 rounded hover:bg-white/10">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M11 11l3-3-3-3M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </aside>
  )
}
