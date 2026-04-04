'use client'
import { useEffect } from 'react'

export default function NotificationTrigger() {
  useEffect(() => {
    const key = 'notif_generated_session'
    if (typeof window !== 'undefined' && !sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, '1')
      fetch('/api/notificacoes/gerar', { method: 'POST' }).catch(() => {})
    }
  }, [])
  return null
}
