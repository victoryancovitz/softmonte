'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

interface Props {
  userRole?: string
}

export default function JuridicoWidget({ userRole }: Props) {
  const supabase = createClient()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const allowedRoles = ['diretoria', 'admin', 'financeiro', 'rh']
  if (userRole && !allowedRoles.includes(userRole)) return null

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const { data: dashboard } = await supabase.from('vw_juridico_dashboard').select('*').single()
      setData(dashboard)
    } catch {} finally {
      setLoading(false)
    }
  }

  function fmtCurrency(v: number | null | undefined) {
    if (v == null) return 'R$ —'
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
  }

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-5 animate-pulse">
        <div className="h-5 bg-gray-200 rounded w-24 mb-4" />
        <div className="space-y-2">
          <div className="h-4 bg-gray-100 rounded w-full" />
          <div className="h-4 bg-gray-100 rounded w-3/4" />
          <div className="h-4 bg-gray-100 rounded w-1/2" />
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <Link href="/juridico" className="text-base font-semibold text-gray-900 hover:text-blue-600 transition-colors">
          ⚖️ Jurídico
        </Link>
        <Link href="/juridico" className="text-xs text-blue-600 hover:underline">Ver</Link>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Processos ativos</span>
          <span className="font-medium text-gray-900">{data.processos_ativos ?? '—'}</span>
        </div>
        {userRole !== 'rh' && (
          <div className="flex justify-between">
            <span className="text-gray-500">Provisionado</span>
            <span className="font-medium text-gray-900">{fmtCurrency(data.provisionado_total)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-gray-500">Próxima audiência</span>
          <span className="font-medium text-gray-900">{data.proxima_audiencia ? new Date(data.proxima_audiencia).toLocaleDateString('pt-BR') : '—'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Alertas</span>
          <span className="font-medium text-gray-900">{data.total_alertas ?? 0}</span>
        </div>
      </div>
    </div>
  )
}
