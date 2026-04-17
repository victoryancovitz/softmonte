'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronDown } from 'lucide-react'
import { MODULE_TABS } from '@/components/Topbar'

export default function ModuleTabs() {
  const pathname = usePathname() || ''
  const [maisOpen, setMaisOpen] = useState(false)
  const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  // Fecha ao clicar fora
  useEffect(() => {
    if (!maisOpen) return
    function onClick(e: MouseEvent) {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) {
        // Verifica se clicou no dropdown (que agora é fixed, fora do button)
        const dropdown = document.getElementById('mais-dropdown')
        if (dropdown && dropdown.contains(e.target as Node)) return
        setMaisOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [maisOpen])

  // Fecha ao mudar de rota
  useEffect(() => { setMaisOpen(false) }, [pathname])

  // Calcula posição do dropdown relativa ao botão
  const toggleMais = useCallback(() => {
    if (!maisOpen && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setDropdownPos({
        top: rect.bottom + 2,
        right: window.innerWidth - rect.right,
      })
    }
    setMaisOpen(o => !o)
  }, [maisOpen])

  const mod = MODULE_TABS.find(m => m.groupPaths.some(p => pathname === p || pathname.startsWith(p)))
  if (!mod) return null

  function isActive(tab: { href: string; match?: string[] }) {
    const paths = tab.match || [tab.href]
    return paths.some(p => {
      if (pathname === p) return true
      if (pathname.startsWith(p + '/')) {
        return !mod!.tabs.some(t2 =>
          t2.href !== tab.href &&
          t2.href.length > tab.href.length &&
          (pathname === t2.href || pathname.startsWith(t2.href + '/'))
        )
      }
      return false
    })
  }

  const primarias = mod.tabs.filter(t => !t.secondary)
  const secundarias = mod.tabs.filter(t => t.secondary)
  const algumaSecundariaAtiva = secundarias.some(isActive)

  return (
    <>
      <nav className="bg-white border-b border-gray-100 sticky top-12 z-30">
        <div className="flex gap-1 px-3 sm:px-6 min-w-max items-stretch overflow-x-auto scrollbar-thin">
          {primarias.map(tab => {
            const active = isActive(tab)
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`relative px-3 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                  active ? 'text-brand' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
                {active && <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-brand rounded-t-full" />}
              </Link>
            )
          })}

          {secundarias.length > 0 && (
            <button
              ref={btnRef}
              type="button"
              onClick={toggleMais}
              className={`relative px-3 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1 ${
                algumaSecundariaAtiva || maisOpen ? 'text-brand' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Mais
              <ChevronDown className={`w-3 h-3 transition-transform ${maisOpen ? 'rotate-180' : ''}`} />
              {algumaSecundariaAtiva && <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-brand rounded-t-full" />}
            </button>
          )}
        </div>
      </nav>

      {/* Dropdown renderizado FORA da nav (position: fixed) para não ser cortado pelo overflow */}
      {maisOpen && dropdownPos && (
        <div
          id="mais-dropdown"
          className="fixed z-50 w-56 bg-white rounded-lg shadow-lg border border-gray-100 overflow-hidden"
          style={{ top: dropdownPos.top, right: dropdownPos.right }}
        >
          {secundarias.map(tab => {
            const active = isActive(tab)
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`block px-4 py-2.5 text-xs font-semibold transition-colors ${
                  active
                    ? 'text-brand bg-brand/5'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                }`}
              >
                {tab.label}
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}
