'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const STATUS_BADGE: Record<string, string> = {
  aberto: 'bg-blue-100 text-blue-700',
  fechado: 'bg-gray-100 text-gray-600',
  enviado: 'bg-amber-100 text-amber-700',
  aprovado: 'bg-green-100 text-green-700',
}
const STATUS_LABEL: Record<string, string> = {
  aberto: 'Em aberto', fechado: 'Fechado', enviado: 'Enviado', aprovado: 'Aprovado'
}
const STATUSES = ['aberto', 'fechado', 'enviado', 'aprovado'] as const

export default function BMStatusButton({ bmId, currentStatus }: { bmId: string; currentStatus: string }) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState(currentStatus)
  const [updating, setUpdating] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  async function updateStatus(newStatus: string) {
    if (newStatus === status) { setOpen(false); return }
    setUpdating(true)
    await supabase.from('boletins_medicao').update({ status: newStatus }).eq('id', bmId)
    setStatus(newStatus)
    setOpen(false)
    setUpdating(false)
    router.refresh()
  }

  return (
    <div className="relative">
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(!open) }}
        disabled={updating}
        className={`text-xs px-2.5 py-1 rounded-full font-medium cursor-pointer hover:ring-2 hover:ring-brand/20 transition-all ${STATUS_BADGE[status]}`}
      >
        {updating ? '...' : STATUS_LABEL[status]}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-20 bg-white rounded-xl border border-gray-200 shadow-lg py-1 min-w-[120px]">
            {STATUSES.map(s => (
              <button key={s} onClick={(e) => { e.preventDefault(); e.stopPropagation(); updateStatus(s) }}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-2 ${s === status ? 'font-bold' : ''}`}>
                <span className={`w-2 h-2 rounded-full ${STATUS_BADGE[s].split(' ')[0].replace('100', '400')}`} />
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
