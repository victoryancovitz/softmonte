'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import BackButton from '@/components/BackButton'

export default function PortalPontoPage() {
  const [pontos, setPontos] = useState<any[]>([])
  const [faltas, setFaltas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data: func } = await supabase.from('funcionarios').select('id').eq('user_id', user.id).maybeSingle()
      if (!func) { setLoading(false); return }
      const ha60 = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10)
      const [{ data: p }, { data: f }] = await Promise.all([
        supabase.from('efetivo_diario').select('*, obras(nome)').eq('funcionario_id', func.id).gte('data', ha60).order('data', { ascending: false }),
        supabase.from('faltas').select('*, obras(nome)').eq('funcionario_id', func.id).gte('data', ha60).order('data', { ascending: false }),
      ])
      setPontos(p || []); setFaltas(f || []); setLoading(false)
    })()
  }, [])

  if (loading) return <div className="p-6 text-gray-400 text-sm">Carregando...</div>

  // Merge e ordena cronologicamente
  const all = [
    ...pontos.map(p => ({ ...p, kind: 'presente', label: 'Presente', color: 'green' })),
    ...faltas.map(f => ({ ...f, kind: f.tipo, label: f.tipo.replace(/_/g, ' '), color: f.tipo === 'atestado_medico' ? 'blue' : f.tipo === 'falta_injustificada' ? 'red' : 'amber' })),
  ].sort((a, b) => b.data.localeCompare(a.data))

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/portal" />
        <Link href="/portal" className="text-gray-400 hover:text-gray-600">Portal</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700">Meu ponto</span>
      </div>

      <h1 className="text-xl font-bold font-display text-brand mb-1">Meu ponto (60 dias)</h1>
      <p className="text-sm text-gray-500 mb-6">Histórico de presença, faltas e atestados.</p>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Data</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Obra</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Horas</th>
            </tr>
          </thead>
          <tbody>
            {all.map((r, i) => (
              <tr key={i} className="border-b border-gray-50">
                <td className="px-4 py-2 text-xs text-gray-600">{new Date(r.data + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}</td>
                <td className="px-4 py-2 text-xs text-gray-500">{r.obras?.nome || '—'}</td>
                <td className="px-4 py-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-${r.color}-100 text-${r.color}-700`}>
                    {r.label}
                  </span>
                </td>
                <td className="px-4 py-2 text-xs">
                  {r.kind === 'presente' && r.horas_trabalhadas ? `${r.horas_trabalhadas}h` : '—'}
                </td>
              </tr>
            ))}
            {all.length === 0 && <tr><td colSpan={4} className="p-10 text-center text-gray-400 text-sm">Sem registros.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
