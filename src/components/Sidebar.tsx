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
    <Link href={href} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors mb-0.5 ${active ? 'bg-brand/10 text-brand font-medium' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}>
      <span className={active ? 'text-brand' : 'text-gray-400'}>{icon}</span>
      {label}
    </Link>
  )
}

const ic = {
  home: <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="6" height="6" rx="1.5"/><rect x="9" y="1" width="6" height="6" rx="1.5"/><rect x="1" y="9" width="6" height="6" rx="1.5"/><rect x="9" y="9" width="6" height="6" rx="1.5"/></svg>,
  func: <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><circle cx="5.5" cy="4" r="2.5"/><path d="M1 13c0-3 2-5 4.5-5s4.5 2 4.5 5" opacity=".5"/><circle cx="12" cy="5" r="2"/><path d="M10 13c0-2.5 1.5-4 3-4.5" opacity=".5"/></svg>,
  obras: <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><path d="M1 14V6l7-4 7 4v8H1z" opacity=".2"/><path d="M1 6l7-4 7 4M6 14v-5h4v5" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round"/></svg>,
  efetivo: <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="2" width="12" height="12" rx="2" opacity=".15"/><path d="M5 8l2.5 2.5 3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>,
  bm: <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><path d="M3 2h10a1 1 0 011 1v11a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" opacity=".2"/><path d="M5 6h6M5 9h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none"/></svg>,
  alloc: <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="3" width="14" height="2" rx="1"/><rect x="1" y="7" width="10" height="2" rx="1"/><rect x="1" y="11" width="12" height="2" rx="1"/></svg>,
  stock: <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="9" width="14" height="6" rx="1.5" opacity=".3"/><rect x="3" y="5" width="10" height="5" rx="1"/><rect x="5" y="1" width="6" height="5" rx="1"/></svg>,
  hh: <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M8 5v3.5l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/></svg>,
  fin: <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><path d="M2 10c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round"/><path d="M8 4v2M5 13h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none"/><circle cx="8" cy="11" r="2" opacity=".6"/></svg>,
  report: <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="2" width="12" height="1.5" rx=".75"/><rect x="2" y="5.5" width="8" height="1.5" rx=".75"/><rect x="2" y="9" width="10" height="1.5" rx=".75"/><rect x="2" y="12.5" width="6" height="1.5" rx=".75"/></svg>,
  docs: <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><path d="M3 2h7l3 3v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" opacity=".4"/><path d="M10 2v3h3" stroke="currentColor" strokeWidth="1.2" fill="none"/></svg>,
  users: <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="6" r="3"/><path d="M2 14c0-3.3 2.7-5 6-5s6 1.7 6 5" opacity=".5"/></svg>,
  audit: <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1L1 4v5c0 3.9 3 7.1 7 8 4-0.9 7-4.1 7-8V4L8 1z" opacity=".2"/><path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>,
}

function SectionLabel({ label }: { label: string }) {
  return <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 pt-4 pb-1.5">{label}</p>
}

export default function Sidebar({ profile }: { profile: Profile | null }) {
  const router = useRouter()
  const supabase = createClient()
  const role = profile?.role ?? 'funcionario'
  const isAdmin = role === 'admin'
  const isOp = isAdmin || role === 'encarregado'
  const isStock = isAdmin || role === 'almoxarife' || role === 'encarregado'
  const initials = profile?.nome?.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() ?? 'U'

  const ROLE_COLORS: Record<string, string> = {
    admin: 'bg-purple-100 text-purple-700',
    encarregado: 'bg-blue-100 text-blue-700',
    almoxarife: 'bg-amber-100 text-amber-700',
    funcionario: 'bg-gray-100 text-gray-600',
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="w-52 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-gray-100 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center flex-shrink-0">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="10" width="4" height="4" rx="1" fill="white" opacity=".85"/>
            <rect x="6" y="6" width="4" height="8" rx="1" fill="white"/>
            <rect x="10" y="2" width="4" height="12" rx="1" fill="white" opacity=".65"/>
          </svg>
        </div>
        <div>
          <div className="text-sm font-bold leading-none text-gray-900">Softmonte</div>
          <div className="text-[10px] text-gray-400 mt-0.5">Gestão de Obras & HH</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-2 overflow-y-auto scrollbar-none">
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

      {/* User */}
      <div className="px-3 py-3 border-t border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${ROLE_COLORS[role]}`}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold truncate text-gray-900">{profile?.nome ?? 'Usuário'}</div>
            <div className="text-[10px] text-gray-400">{ROLE_LABELS[role]}</div>
          </div>
          <button onClick={handleLogout} title="Sair" className="text-gray-300 hover:text-gray-600 transition-colors p-1">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M11 11l3-3-3-3M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      </div>
    </aside>
  )
}
