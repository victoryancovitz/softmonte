'use client'
import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { Calendar, Video, MapPin, Monitor } from 'lucide-react'

type AudienciaRow = {
  id: string
  processo_id: string
  data_audiencia: string
  tipo: string
  modalidade: string
  local: string | null
  link_virtual: string | null
  status: string
  processos_juridicos: {
    id: string
    parte_contraria: string | null
    numero_cnj: string | null
  }
}

const STATUS_BADGE: Record<string, string> = {
  agendada: 'bg-blue-100 text-blue-700',
  realizada: 'bg-emerald-100 text-emerald-700',
  remarcada: 'bg-amber-100 text-amber-700',
  cancelada: 'bg-zinc-100 text-zinc-700',
}

const TIPO_LABELS: Record<string, string> = {
  inicial: 'Inicial',
  instrucao: 'Instrução',
  una: 'Una',
  conciliacao: 'Conciliação',
  julgamento: 'Julgamento',
}

const MODALIDADE_ICONS: Record<string, typeof Video> = {
  presencial: MapPin,
  virtual: Video,
  hibrida: Monitor,
}

function isToday(d: string) {
  return d.split('T')[0] === new Date().toISOString().split('T')[0]
}
function isTomorrow(d: string) {
  const t = new Date(); t.setDate(t.getDate() + 1)
  return d.split('T')[0] === t.toISOString().split('T')[0]
}
function isThisWeek(d: string) {
  const now = new Date()
  const end = new Date(); end.setDate(now.getDate() + (7 - now.getDay()))
  const date = new Date(d)
  return date >= now && date <= end
}
function isNextWeek(d: string) {
  const now = new Date()
  const startNext = new Date(); startNext.setDate(now.getDate() + (7 - now.getDay()) + 1)
  const endNext = new Date(startNext); endNext.setDate(startNext.getDate() + 6)
  const date = new Date(d)
  return date >= startNext && date <= endNext
}

export default function AudienciasPage() {
  const supabase = createClient()
  const [audiencias, setAudiencias] = useState<AudienciaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('processo_audiencias')
        .select('*, processos_juridicos:processo_id(id, parte_contraria, numero_cnj)')
        .order('data_audiencia', { ascending: true })
      setAudiencias((data as AudienciaRow[]) ?? [])
      setLoading(false)
    }
    fetch()
  }, [])

  const filtered = useMemo(() => {
    return audiencias.filter(a => {
      if (filtroTipo && a.tipo !== filtroTipo) return false
      if (filtroStatus && a.status !== filtroStatus) return false
      return true
    })
  }, [audiencias, filtroTipo, filtroStatus])

  const hoje = new Date().toISOString().split('T')[0]
  const em7dias = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
  const inicioMes = new Date().toISOString().slice(0, 7) + '-01'

  const kpis = useMemo(() => ({
    agendadasHoje: audiencias.filter(a => a.status === 'agendada' && isToday(a.data_audiencia)).length,
    prox7dias: audiencias.filter(a => a.status === 'agendada' && a.data_audiencia.split('T')[0] >= hoje && a.data_audiencia.split('T')[0] <= em7dias).length,
    pendentesRegistro: audiencias.filter(a => a.status === 'agendada' && a.data_audiencia < new Date().toISOString()).length,
    realizadasMes: audiencias.filter(a => a.status === 'realizada' && a.data_audiencia >= inicioMes).length,
  }), [audiencias])

  const groups = useMemo(() => {
    const g: Record<string, AudienciaRow[]> = { 'Hoje': [], 'Amanhã': [], 'Esta semana': [], 'Próxima semana': [], 'Outras': [] }
    filtered.forEach(a => {
      if (isToday(a.data_audiencia)) g['Hoje'].push(a)
      else if (isTomorrow(a.data_audiencia)) g['Amanhã'].push(a)
      else if (isThisWeek(a.data_audiencia)) g['Esta semana'].push(a)
      else if (isNextWeek(a.data_audiencia)) g['Próxima semana'].push(a)
      else g['Outras'].push(a)
    })
    return g
  }, [filtered])

  if (loading) return <div className="animate-pulse h-64 bg-gray-100 rounded-lg" />

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-800">Audiências</h1>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="border rounded-lg p-4">
          <div className="text-xs text-gray-500">Agendadas hoje</div>
          <div className="text-2xl font-bold text-blue-700">{kpis.agendadasHoje}</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-xs text-gray-500">Próximos 7 dias</div>
          <div className="text-2xl font-bold text-brand">{kpis.prox7dias}</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-xs text-gray-500">Pendentes registro</div>
          <div className="text-2xl font-bold text-amber-600">{kpis.pendentesRegistro}</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-xs text-gray-500">Realizadas mês</div>
          <div className="text-2xl font-bold text-emerald-700">{kpis.realizadasMes}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <select
          value={filtroTipo}
          onChange={e => setFiltroTipo(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Todos os tipos</option>
          <option value="inicial">Inicial</option>
          <option value="instrucao">Instrução</option>
          <option value="una">Una</option>
          <option value="conciliacao">Conciliação</option>
          <option value="julgamento">Julgamento</option>
        </select>
        <select
          value={filtroStatus}
          onChange={e => setFiltroStatus(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Todos os status</option>
          <option value="agendada">Agendada</option>
          <option value="realizada">Realizada</option>
          <option value="remarcada">Remarcada</option>
          <option value="cancelada">Cancelada</option>
        </select>
      </div>

      {/* Grouped list */}
      <div className="space-y-6">
        {Object.entries(groups).map(([label, items]) => {
          if (items.length === 0) return null
          return (
            <div key={label} className="space-y-2">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{label}</h2>
              <div className="space-y-2">
                {items.map(a => {
                  const ModalIcon = MODALIDADE_ICONS[a.modalidade] || MapPin
                  return (
                    <Link
                      key={a.id}
                      href={`/juridico/processos/${a.processo_id}?tab=audiencias`}
                      className="flex items-center justify-between border rounded-lg px-4 py-3 hover:bg-gray-50 transition"
                    >
                      <div className="flex items-center gap-3">
                        <Calendar size={16} className="text-gray-400" />
                        <div>
                          <div className="text-sm font-medium text-gray-800">
                            {new Date(a.data_audiencia).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                          </div>
                          <div className="text-xs text-gray-500">
                            {a.processos_juridicos?.parte_contraria || 'Sem parte contrária'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <ModalIcon size={14} className="text-gray-400" />
                        <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600 font-medium">
                          {TIPO_LABELS[a.tipo] || a.tipo}
                        </span>
                        <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${STATUS_BADGE[a.status] || 'bg-gray-100 text-gray-600'}`}>
                          {a.status}
                        </span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
