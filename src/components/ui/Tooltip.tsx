'use client'
import { useState, useRef, useEffect } from 'react'

export default function Tooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function close(e: Event) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [open])

  return (
    <div className="relative inline-flex ml-1" ref={ref}>
      <button type="button" onClick={e => { e.preventDefault(); setOpen(!open) }}
        onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
        className="w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-[10px] font-bold flex items-center justify-center hover:bg-gray-300 transition-colors cursor-help">
        ?
      </button>
      {open && (
        <div className="absolute z-50 bottom-6 left-1/2 -translate-x-1/2 w-56 p-2.5 bg-gray-900 text-white text-xs rounded-lg shadow-xl leading-relaxed">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45 -mt-1" />
        </div>
      )}
    </div>
  )
}
