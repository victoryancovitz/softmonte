'use client'

import { useState } from 'react'
import AIDrawer from './AIDrawer'

export type AIMsg = any // tipo compartilhado leve; o tipo detalhado fica no AIDrawer

export default function AIButton() {
  const [open, setOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [messages, setMessages] = useState<AIMsg[]>([])

  const hasConversa = messages.length > 0

  return (
    <>
      {/* Botão flutuante: esconde quando drawer aberto (não minimizado) */}
      {(!open || minimized) && (
        <button
          type="button"
          onClick={() => { setOpen(true); setMinimized(false) }}
          title={hasConversa ? 'Continuar conversa com o Assistente IA' : 'Assistente IA Softmonte'}
          aria-label="Assistente IA Softmonte"
          className="fixed bottom-24 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95"
          style={{ backgroundColor: '#00215B' }}
        >
          <span className="text-2xl leading-none text-white">{'\u2728'}</span>
          {hasConversa && (
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-400 border-2 border-white" />
          )}
        </button>
      )}

      {/* Drawer sempre montado para preservar state; visibilidade via prop */}
      <AIDrawer
        open={open}
        minimized={minimized}
        messages={messages}
        onMessagesChange={setMessages}
        onClose={() => setOpen(false)}
        onMinimize={() => setMinimized(true)}
      />
    </>
  )
}
