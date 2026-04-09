'use client'
import { useEffect } from 'react'

export default function NotificationTrigger() {
  useEffect(() => {
    const key = 'notif_generated_session'
    if (typeof window !== 'undefined' && !sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, '1')
      fetch('/api/notificacoes/gerar', { method: 'POST' })
        .then(res => {
          if (!res.ok) {
            // Se falhou por permissao (403), nao tentar novamente nesta sessao
            // Se falhou por auth (401), limpar flag pra tentar de novo
            if (res.status === 401) sessionStorage.removeItem(key)
          }
        })
        .catch(() => {
          // Falha de rede: limpar flag pra tentar novamente
          sessionStorage.removeItem(key)
        })
    }
  }, [])
  return null
}
