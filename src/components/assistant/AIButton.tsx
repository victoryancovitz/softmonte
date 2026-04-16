'use client'

import { useState } from 'react'
import AIDrawer from './AIDrawer'

export default function AIButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Assistente IA Softmonte"
        aria-label="Assistente IA Softmonte"
        className="fixed bottom-6 left-6 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95"
        style={{ backgroundColor: '#00215B' }}
      >
        <span className="text-2xl leading-none text-white">{'\u2728'}</span>
      </button>
      {open && <AIDrawer onClose={() => setOpen(false)} />}
    </>
  )
}
