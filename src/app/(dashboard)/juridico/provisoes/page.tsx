'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { useToast } from '@/components/Toast'
import { PrognosticoBadge, TipoProcessoBadge } from '@/components/juridico/ProcessoBadges'

const PROGNOSTICOS_ORDER = ['provavel', 'possivel', 'remoto'] as const
const PROGNOSTICO_LABELS: Record<string, string> = {
  provavel: 'Provisões — Prováveis',
  possivel: 'Passivos Contingentes — Possíveis',
  remoto: 'Remotas',
}
const PROGNOSTICO_CARD_STYLES: Record<string, string> = {
  provavel: 'border-red-200 bg-red-50',
  possivel: 'border-amber-200 bg-amber-50',
  remoto: 'border-green-200 bg-green-50',
}

export default function ProvisoesPage() {
  const supabase = createClient()
  const toast = useToast()

  const [loading, setLoading] = useState(true)
  const [processos, setProcessos] = useState<any[]>([])
  const [historico, setHistorico] = useState<any[]>([])

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [{ data: procs }, { data: hist }] = await Promise.all([
        supabase.from('processos_juridicos')
          .select('id, numero_cnj, parte_contraria, tipo, prognostico, valor_causa, valor_provisionado, centro_custo, advogado_id, advogados_juridicos(nome)')
          .is('deleted_at', null)
          .in('prognostico', ['provavel', 'possivel', 'remoto'])
          .order('prognostico')
          .order('valor_provisionado', { ascending: false }),
        supabase.from('processo_provisoes_historico')
          .select('*, processos_juridicos(numero_cnj)')
          .order('created_at', { ascending: false })
          .limit(50),
      ])
      setProcessos(procs || [])
      setHistorico(hist || [])
    } catch (e: any) {
      toast.error('Erro ao carregar provisões')
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
    return new Date(d).toLocaleDateString('pt-BR')
  }

  const grouped = PROGNOSTICOS_ORDER.reduce((acc, prog) => {
    acc[prog] = processos.filter(p => p.prognostico === prog)
    return acc
  }, {} as Record<string, any[]>)

  const totals = PROGNOSTICOS_ORDER.reduce((acc, prog) => {
    acc[prog] = grouped[prog].reduce((sum: number, p: any) => sum + (p.valor_provisionado || 0), 0)
    return acc
  }, {} as Record<string, number>)

  if (loading) {
    return <div className="p-6"><div className="animate-pulse space-y-4"><div className="h-24 bg-gray-200 rounded-xl" /><div className="h-64 bg-gray-200 rounded-xl" /></div></div>
  }

  return (
    <div className="p-6 space-y-6 print:p-2">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-gray-900">Provisões e Contingências — CPC 25</h1>
          <p className="text-sm text-gray-500">Posição em {new Date().toLocaleDateString('pt-BR')}</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <button onClick={() => window.print()} className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg border border-gray-300 transition-colors">
            Exportar PDF
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={`border rounded-xl p-5 ${PROGNOSTICO_CARD_STYLES.provavel}`}>
          <p className="text-sm text-gray-600">Provisões (Prováveis)</p>
          <p className="text-2xl font-bold font-display text-red-700">{fmtCurrency(totals.provavel)}</p>
          <p className="text-xs text-gray-500 mt-1">{grouped.provavel.length} processo(s)</p>
        </div>
        <div className={`border rounded-xl p-5 ${PROGNOSTICO_CARD_STYLES.possivel}`}>
          <p className="text-sm text-gray-600">Passivos Contingentes (Possíveis)</p>
          <p className="text-2xl font-bold font-display text-amber-700">{fmtCurrency(totals.possivel)}</p>
          <p className="text-xs text-gray-500 mt-1">{grouped.possivel.length} processo(s)</p>
        </div>
        <div className={`border rounded-xl p-5 ${PROGNOSTICO_CARD_STYLES.remoto}`}>
          <p className="text-sm text-gray-600">Remotas</p>
          <p className="text-2xl font-bold font-display text-green-700">{fmtCurrency(totals.remoto)}</p>
          <p className="text-xs text-gray-500 mt-1">{grouped.remoto.length} processo(s)</p>
        </div>
      </div>

      {/* Tables by Prognóstico */}
      {PROGNOSTICOS_ORDER.map(prog => (
        <section key={prog} className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{PROGNOSTICO_LABELS[prog]}</h2>
          {grouped[prog].length === 0 ? (
            <p className="text-sm text-gray-400">Nenhum processo nesta classificação.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="pb-2">CNJ</th>
                    <th className="pb-2">Parte Contrária</th>
                    <th className="pb-2">Tipo</th>
                    <th className="pb-2 text-right">Valor Causa</th>
                    <th className="pb-2 text-right">Provisionado</th>
                    <th className="pb-2">CC</th>
                    <th className="pb-2">Advogado</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped[prog].map((p: any) => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-2 font-mono text-xs">
                        <Link href={`/juridico/processos/${p.id}`} className="text-blue-600 hover:underline">{p.numero_cnj || '—'}</Link>
                      </td>
                      <td className="py-2">{p.parte_contraria || '—'}</td>
                      <td className="py-2">{p.tipo ? <TipoProcessoBadge tipo={p.tipo} /> : '—'}</td>
                      <td className="py-2 text-right">{fmtCurrency(p.valor_causa)}</td>
                      <td className="py-2 text-right font-medium">{fmtCurrency(p.valor_provisionado)}</td>
                      <td className="py-2">{p.centro_custo || '—'}</td>
                      <td className="py-2">{p.advogados_juridicos?.nome || '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t font-semibold">
                    <td colSpan={4} className="py-2 text-right">Subtotal:</td>
                    <td className="py-2 text-right">{fmtCurrency(totals[prog])}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>
      ))}

      {/* Movimentações */}
      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Movimentações de Provisão</h2>
        {historico.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhuma movimentação registrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-2">Data</th>
                  <th className="pb-2">Processo</th>
                  <th className="pb-2">Prognóstico</th>
                  <th className="pb-2 text-right">Valor Anterior</th>
                  <th className="pb-2 text-right">Valor Novo</th>
                  <th className="pb-2">Justificativa</th>
                </tr>
              </thead>
              <tbody>
                {historico.map((h: any) => (
                  <tr key={h.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-2">{fmtDate(h.created_at)}</td>
                    <td className="py-2 font-mono text-xs">{h.processos_juridicos?.numero_cnj || '—'}</td>
                    <td className="py-2">
                      <span className="text-gray-400">{h.prognostico_anterior || '—'}</span>
                      <span className="mx-1">→</span>
                      <span className="font-medium">{h.prognostico_novo || '—'}</span>
                    </td>
                    <td className="py-2 text-right">{fmtCurrency(h.valor_anterior)}</td>
                    <td className="py-2 text-right font-medium">{fmtCurrency(h.valor_novo)}</td>
                    <td className="py-2 text-gray-600 max-w-xs truncate">{h.justificativa || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
