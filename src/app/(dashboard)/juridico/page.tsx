'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { useToast } from '@/components/Toast'

export default function JuridicoDashboardPage() {
  const supabase = createClient()
  const toast = useToast()

  const [loading, setLoading] = useState(true)
  const [kpis, setKpis] = useState<any>(null)
  const [proximaAudiencia, setProximaAudiencia] = useState<any>(null)
  const [acordosAbertos, setAcordosAbertos] = useState<number>(0)
  const [audiencias7d, setAudiencias7d] = useState<any[]>([])
  const [alertas, setAlertas] = useState<any[]>([])

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const hoje = new Date().toISOString().slice(0, 10)
      const em7d = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

      const [
        { data: dashboard },
        { data: proxAud },
        { data: acordos },
        { data: auds7d },
        { data: procs },
      ] = await Promise.all([
        supabase.from('vw_juridico_dashboard').select('*').single(),
        supabase.from('processo_audiencias').select('*, processos_juridicos(numero_cnj, parte_contraria)').eq('status', 'agendada').order('data_audiencia').limit(1),
        supabase.from('financeiro_lancamentos').select('valor').eq('origem', 'juridico_acordo').eq('status', 'em_aberto').is('deleted_at', null),
        supabase.from('processo_audiencias').select('*, processos_juridicos(numero_cnj, parte_contraria)').eq('status', 'agendada').gte('data_audiencia', hoje).lte('data_audiencia', em7d).order('data_audiencia'),
        supabase.from('processos_juridicos').select('id, numero_cnj, prognostico, updated_at').is('deleted_at', null),
      ])

      setKpis(dashboard)
      setProximaAudiencia(proxAud?.[0] || null)
      setAcordosAbertos(acordos?.reduce((sum: number, l: any) => sum + (l.valor || 0), 0) || 0)
      setAudiencias7d(auds7d || [])

      // Compute alertas
      const alertasList: any[] = []
      const semPrognostico = procs?.filter((p: any) => !p.prognostico || p.prognostico === 'nao_avaliado') || []
      if (semPrognostico.length > 0) {
        alertasList.push({ tipo: 'prognostico_pendente', msg: `${semPrognostico.length} processo(s) sem prognóstico definido`, cor: 'border-amber-300 bg-amber-50' })
      }
      const ha60d = new Date(Date.now() - 60 * 86400000).toISOString()
      const semMov = procs?.filter((p: any) => p.updated_at && p.updated_at < ha60d) || []
      if (semMov.length > 0) {
        alertasList.push({ tipo: 'sem_movimentacao', msg: `${semMov.length} processo(s) sem movimentação há 60+ dias`, cor: 'border-red-300 bg-red-50' })
      }
      setAlertas(alertasList)
    } catch (e: any) {
      toast.error('Erro ao carregar dashboard jurídico')
    } finally {
      setLoading(false)
    }
  }

  function fmtCurrency(v: number | null | undefined) {
    if (v == null) return 'R$ —'
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  function fmtDate(d: string | null | undefined) {
    if (!d) return '—'
    return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
  }

  if (loading) {
    return <div className="p-6"><div className="animate-pulse space-y-4"><div className="h-24 bg-gray-200 rounded-xl" /><div className="h-64 bg-gray-200 rounded-xl" /></div></div>
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold font-display text-gray-900">Jurídico — Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm text-gray-500">Processos Ativos</p>
          <p className="text-2xl font-bold font-display text-gray-900">{kpis?.processos_ativos ?? '—'}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm text-gray-500">Provisionado Total</p>
          <p className="text-2xl font-bold font-display text-gray-900">{fmtCurrency(kpis?.provisionado_total)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm text-gray-500">Próxima Audiência</p>
          <p className="text-2xl font-bold font-display text-gray-900">{proximaAudiencia ? fmtDate(proximaAudiencia.data_audiencia) : '—'}</p>
          {proximaAudiencia && <p className="text-xs text-gray-500 mt-1 truncate">{proximaAudiencia.processos_juridicos?.numero_cnj}</p>}
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm text-gray-500">Acordos em Aberto</p>
          <p className="text-2xl font-bold font-display text-gray-900">{fmtCurrency(acordosAbertos)}</p>
        </div>
      </div>

      {/* Próximas Audiências */}
      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Próximas Audiências (7 dias)</h2>
          <Link href="/juridico/audiencias" className="text-sm text-blue-600 hover:underline">Ver todos</Link>
        </div>
        {audiencias7d.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhuma audiência nos próximos 7 dias.</p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500 border-b"><th className="pb-2">Data</th><th className="pb-2">Hora</th><th className="pb-2">Processo</th><th className="pb-2">Parte Contrária</th><th className="pb-2">Tipo</th></tr></thead>
            <tbody>
              {audiencias7d.map((a: any) => (
                <tr key={a.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-2">{fmtDate(a.data_audiencia)}</td>
                  <td className="py-2">{a.hora || '—'}</td>
                  <td className="py-2 font-mono text-xs">{a.processos_juridicos?.numero_cnj || '—'}</td>
                  <td className="py-2">{a.processos_juridicos?.parte_contraria || '—'}</td>
                  <td className="py-2">{a.tipo || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Alertas */}
      {alertas.length > 0 && (
        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Alertas</h2>
            <Link href="/juridico/processos" className="text-sm text-blue-600 hover:underline">Ver todos</Link>
          </div>
          <div className="space-y-3">
            {alertas.map((a, i) => (
              <div key={i} className={`border rounded-lg p-3 ${a.cor}`}>
                <p className="text-sm font-medium text-gray-800">{a.msg}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
