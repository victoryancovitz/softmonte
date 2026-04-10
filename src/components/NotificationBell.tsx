'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min}min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h}h`
  const d = Math.floor(h / 24)
  return `há ${d}d`
}

const TIPO_ICON: Record<string, string> = {
  documento_vencendo: '📄',
  treinamento_vencendo: '🎓',
  contrato_vencendo: '📋',
  aso_vencendo: '🩺',
  alerta: '⚠️',
}

export default function NotificationBell() {
  const supabase = createClient()
  const router = useRouter()
  const [count, setCount] = useState(0)
  const [notifs, setNotifs] = useState<any[]>([])
  const [alertas, setAlertas] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  async function loadCount() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Notificações persistidas
    const { count: c } = await supabase
      .from('notificacoes')
      .select('id', { count: 'exact', head: true })
      .eq('destinatario_id', user.id)
      .eq('lida', false)
    const notifCount = c ?? 0

    // Alertas de vw_alertas (sempre "ao vivo")
    const { data: alData } = await supabase
      .from('vw_alertas')
      .select('*')
      .order('dias_restantes')
      .limit(20)
    const alertCount = alData?.length ?? 0
    setAlertas(alData ?? [])

    setCount(notifCount + alertCount)
  }

  async function loadNotifs() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('notificacoes')
      .select('*')
      .eq('destinatario_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)
    setNotifs(data ?? [])
  }

  useEffect(() => {
    const initialTimeout = setTimeout(loadCount, 2000)
    const interval = setInterval(loadCount, 60 * 1000)
    return () => { clearTimeout(initialTimeout); clearInterval(interval) }
  }, [])

  useEffect(() => {
    if (open) loadNotifs()
  }, [open])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function markRead(notifId: string) {
    await supabase.from('notificacoes').update({ lida: true, lida_em: new Date().toISOString() }).eq('id', notifId)
    setCount(c => Math.max(0, c - 1))
    setNotifs(n => n.map(x => x.id === notifId ? { ...x, lida: true } : x))
    router.push('/rh/vencimentos')
    setOpen(false)
  }

  async function markAllRead() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('notificacoes').update({ lida: true, lida_em: new Date().toISOString() })
      .eq('destinatario_id', user.id).eq('lida', false)
    setCount(alertas.length)
    setNotifs(n => n.map(x => ({ ...x, lida: true })))
  }

  function alertaHref(a: any): string {
    if (a.funcionario_id) return `/funcionarios/${a.funcionario_id}`
    if (a.obra_id) return `/obras/${a.obra_id}`
    return '/rh/vencimentos'
  }

  function alertaIcon(a: any): string {
    const tipo = (a.tipo || '').toLowerCase()
    if (tipo.includes('contrato') || tipo.includes('experiencia')) return '📋'
    if (tipo.includes('aso')) return '🩺'
    if (tipo.includes('nr') || tipo.includes('treinamento')) return '🎓'
    if (tipo.includes('documento')) return '📄'
    return '⚠️'
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="relative p-1.5 rounded-lg hover:bg-white/10 transition-colors">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M14 6.5a5 5 0 00-10 0c0 5-2 6.5-2 6.5h14s-2-1.5-2-6.5M10.73 15a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-bold text-gray-800">Notificações</span>
            {notifs.some(n => !n.lida) && (
              <button onClick={markAllRead} className="text-[10px] text-brand font-semibold hover:underline">
                Marcar todas como lidas
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {/* Alertas ao vivo de vw_alertas */}
            {alertas.length > 0 && (
              <div>
                <div className="px-4 py-1.5 bg-red-50 text-[10px] font-bold text-red-600 uppercase tracking-wider">
                  Alertas ({alertas.length})
                </div>
                {alertas.slice(0, 6).map((a: any, i: number) => (
                  <button key={`alerta-${i}`} onClick={() => { router.push(alertaHref(a)); setOpen(false) }}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors bg-red-50/30">
                    <div className="flex items-start gap-2">
                      <span className="text-sm flex-shrink-0">{alertaIcon(a)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs leading-snug font-semibold text-gray-900">{a.descricao || a.tipo}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          {a.funcionario_nome || a.obra_nome || ''} · {Number(a.dias_restantes)} dias restantes
                        </p>
                      </div>
                      <span className={`text-[10px] font-bold flex-shrink-0 ${Number(a.dias_restantes) <= 7 ? 'text-red-600' : Number(a.dias_restantes) <= 15 ? 'text-amber-600' : 'text-gray-500'}`}>
                        {a.dias_restantes}d
                      </span>
                    </div>
                  </button>
                ))}
                {alertas.length > 6 && (
                  <button onClick={() => { router.push('/rh/vencimentos'); setOpen(false) }}
                    className="w-full px-4 py-2 text-center text-[10px] text-brand font-semibold hover:bg-gray-50">
                    + {alertas.length - 6} alertas → Ver todos
                  </button>
                )}
              </div>
            )}

            {/* Notificações persistidas */}
            {notifs.length > 0 && (
              <div>
                {alertas.length > 0 && (
                  <div className="px-4 py-1.5 bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    Notificações
                  </div>
                )}
                {notifs.map(n => (
                  <button key={n.id} onClick={() => markRead(n.id)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${!n.lida ? 'bg-blue-50/50' : ''}`}>
                    <div className="flex items-start gap-2">
                      <span className="text-sm flex-shrink-0">{TIPO_ICON[n.tipo] ?? '🔔'}</span>
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs leading-snug ${!n.lida ? 'font-bold text-gray-900' : 'text-gray-600'}`}>{n.titulo}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{n.mensagem}</p>
                        <p className="text-[10px] text-gray-300 mt-1">{timeAgo(n.created_at)}</p>
                      </div>
                      {!n.lida && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1" />}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {notifs.length === 0 && alertas.length === 0 && (
              <div className="px-4 py-8 text-center text-xs text-gray-400">Nenhuma notificação</div>
            )}
          </div>
          <div className="px-4 py-2 border-t border-gray-100 text-center">
            <button onClick={() => { router.push('/rh/vencimentos'); setOpen(false) }} className="text-[10px] text-brand font-semibold hover:underline">
              Ver Central de Vencimentos
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
