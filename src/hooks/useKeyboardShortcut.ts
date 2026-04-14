'use client'
import { useEffect } from 'react'

type ShortcutHandler = () => void

export function useKeyboardShortcut(
  key: string,
  handler: ShortcutHandler,
  options: { ctrl?: boolean; meta?: boolean; shift?: boolean; enabled?: boolean } = {}
) {
  const { ctrl, meta, shift, enabled = true } = options

  useEffect(() => {
    if (!enabled) return

    function onKeyDown(e: KeyboardEvent) {
      // Don't trigger when typing in inputs
      const target = e.target as HTMLElement
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (target.isContentEditable) return

      const ctrlMatch = ctrl ? (e.ctrlKey || e.metaKey) : true
      const metaMatch = meta ? e.metaKey : true
      const shiftMatch = shift ? e.shiftKey : !e.shiftKey

      if (e.key.toLowerCase() === key.toLowerCase() && ctrlMatch && metaMatch && shiftMatch) {
        e.preventDefault()
        handler()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [key, handler, ctrl, meta, shift, enabled])
}
