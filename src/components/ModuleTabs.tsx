'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MODULE_TABS } from '@/components/Topbar'

export default function ModuleTabs() {
  const pathname = usePathname() || ''

  // Encontra o módulo cujas rotas matcham o pathname atual
  const mod = MODULE_TABS.find(m => m.groupPaths.some(p => pathname === p || pathname.startsWith(p)))
  if (!mod) return null

  function isActive(tab: { href: string; match?: string[] }) {
    const paths = tab.match || [tab.href]
    return paths.some(p => {
      if (pathname === p) return true
      // Match exato para /funcionarios (não pegar /funcionarios/novo que deveria ser /funcionarios)
      // mas pegar /funcionarios/[id] que também é /funcionarios
      if (pathname.startsWith(p + '/')) {
        // Para links mais específicos (ex: /rh/folha) prefere o mais longo
        // Se outro tab tem href mais específico que também casa, esse outro vence
        return !mod!.tabs.some(t2 =>
          t2.href !== tab.href &&
          t2.href.length > tab.href.length &&
          (pathname === t2.href || pathname.startsWith(t2.href + '/'))
        )
      }
      return false
    })
  }

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-12 z-30 overflow-x-auto scrollbar-thin">
      <div className="flex gap-1 px-3 sm:px-6 min-w-max">
        {mod.tabs.map(tab => {
          const active = isActive(tab)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative px-3 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                active
                  ? 'text-brand'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {active && <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-brand rounded-t-full" />}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
