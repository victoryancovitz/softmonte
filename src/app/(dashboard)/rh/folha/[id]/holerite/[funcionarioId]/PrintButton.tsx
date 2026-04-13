'use client'

import { useState } from 'react'
import { Mail, Loader2 } from 'lucide-react'

interface PrintButtonProps {
  folhaItemId?: string
  funcionarioId?: string
  email?: string
}

export default function PrintButton({ folhaItemId, funcionarioId, email }: PrintButtonProps) {
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSendEmail() {
    if (!folhaItemId || !funcionarioId) {
      alert('Dados insuficientes para enviar o holerite.')
      return
    }

    const destinatario = email || prompt('Informe o email do funcionário:')
    if (!destinatario) return

    setSending(true)
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      // Get current session token from supabase cookie
      const { createClient } = await import('@/lib/supabase')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.access_token) {
        alert('Sessão expirada. Faça login novamente.')
        return
      }

      const res = await fetch(`${supabaseUrl}/functions/v1/enviar-holerite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          folha_item_id: folhaItemId,
          funcionario_id: funcionarioId,
          email: destinatario,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        alert(`Erro ao enviar: ${data.error || 'Erro desconhecido'}`)
        return
      }

      setSent(true)
      alert(`Holerite enviado com sucesso para ${destinatario}`)
    } catch (err: any) {
      alert(`Erro ao enviar email: ${err.message || 'Erro de conexão'}`)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="no-print fixed top-4 right-4 z-50 flex gap-2">
      <button onClick={() => window.print()} className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium shadow-lg hover:bg-brand-dark">
        Imprimir / Salvar PDF
      </button>
      {folhaItemId && funcionarioId && (
        <button
          onClick={handleSendEmail}
          disabled={sending}
          className={`px-4 py-2 rounded-lg text-sm font-medium shadow-lg flex items-center gap-2 ${
            sent
              ? 'bg-green-600 text-white'
              : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {sending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Mail className="w-4 h-4" />
          )}
          {sending ? 'Enviando...' : sent ? 'Enviado!' : 'Enviar por email'}
        </button>
      )}
      <button onClick={() => window.history.back()} className="px-4 py-2 bg-white text-gray-700 rounded-lg text-sm font-medium shadow-lg border border-gray-200">
        Voltar
      </button>
    </div>
  )
}
