'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { runWizardAudit, type AuditResult } from '@/lib/wizard/audit'
import { WIZARD_STEPS } from '@/lib/wizard/config'
import WizardDrawer from './WizardDrawer'

const HIDE_KEY = 'wizard_hidden_until'

export default function WizardButton() {
  const [visible, setVisible] = useState(false)
  const [open, setOpen] = useState(false)
  const [audit, setAudit] = useState<AuditResult | null>(null)
  const [allowed, setAllowed] = useState(false)

  // Check role
  useEffect(() => {
    const check = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .single()
      const role = profile?.role
      if (role === 'admin' || role === 'rh') {
        setAllowed(true)
      }
    }
    check()
  }, [])

  // Check localStorage hide
  useEffect(() => {
    const hiddenUntil = localStorage.getItem(HIDE_KEY)
    if (hiddenUntil && Date.now() < Number(hiddenUntil)) {
      setVisible(false)
    } else {
      localStorage.removeItem(HIDE_KEY)
      setVisible(true)
    }
  }, [])

  // Run audit
  useEffect(() => {
    if (!allowed) return
    runWizardAudit().then(setAudit).catch(console.error)
  }, [allowed])

  if (!allowed || !visible) return null

  const pending = audit
    ? WIZARD_STEPS.filter(s => !audit[s.key]?.ok).length
    : null

  const allDone = pending === 0

  const handleHide = (e: React.MouseEvent) => {
    e.stopPropagation()
    const in24h = Date.now() + 24 * 60 * 60 * 1000
    localStorage.setItem(HIDE_KEY, String(in24h))
    setVisible(false)
  }

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2">
        <button
          onClick={() => setOpen(true)}
          className="relative flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95"
          style={{ backgroundColor: allDone ? '#16a34a' : '#c8960c' }}
          title={allDone ? 'Setup completo!' : `Setup Wizard — ${pending ?? '...'} pendente(s)`}
        >
          <span className="text-2xl">{allDone ? '\u2713' : '\uD83E\uDDD9'}</span>
          {pending !== null && pending > 0 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center w-6 h-6 rounded-full bg-red-600 text-white text-xs font-bold">
              {pending}
            </span>
          )}
        </button>
        {!allDone && (
          <button
            onClick={handleHide}
            className="flex items-center justify-center w-7 h-7 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-500 text-sm transition-colors"
            title="Ocultar por 24h"
          >
            &times;
          </button>
        )}
      </div>

      {open && (
        <WizardDrawer
          audit={audit}
          onClose={() => setOpen(false)}
          onRefresh={() => runWizardAudit().then(setAudit)}
        />
      )}
    </>
  )
}
