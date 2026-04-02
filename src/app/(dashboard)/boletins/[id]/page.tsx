'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ConfirmButton from '@/components/ConfirmButton'

const STATUS_BADGE: Record<string, string> = {
  aberto: 'bg-blue-100 text-blue-700',
  fechado: 'bg-gray-100 text-gray-600',
  enviado: 'bg-amber-100 text-amber-700',
  aprovado: 'bg-green-100 text-green-700',
}
const TIPO_DIA_LABEL: Record<string, string> = {
  util: 'Úteis', sabado: 'Sábados', domingo_feriado: 'Dom/Fer'
}

export default function BMDetailPage({ params }: { params: { id: string } }) {
  const [bm, setBm] = useState<any>(null)
  const [resumo, setResumo] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    loadBM()
  }, [params.id])

  async function loadBM() {
    const { data: bmData } = await supabase.from('boletins_medicao')
      .select('*, obras(id,nome,cliente,local)')
      .eq('id', params.id).single()
    setBm(bmData)

    if (bmData) {
      const { data: efetivo } = await supabase.from('efetivo_diario')
        .select('funcionario_id, data, tipo_dia, funcionarios(nome, cargo)')
        .eq('obra_id', bmData.obras.id)
        .gte('data', bmData.data_inicio)
        .lte('data', bmData.data_fim)
        .order('data')

      // Aggregate by cargo + tipo_dia
      const agg: Record<string, Record<string, Set<string>>> = {}
      ;(efetivo ?? []).forEach((e: any) => {
        const cargo = e.funcionarios?.cargo ?? 'OUTROS'
        if (!agg[cargo]) agg[cargo] = { util: new Set(), sabado: new Set(), domingo_feriado: new Set() }
        agg[cargo][e.tipo_dia].add(e.data)
      })

      const rows = Object.entries(agg).map(([cargo, dias]) => ({
        cargo,
        dias_util: dias.util.size,
        dias_sabado: dias.sabado.size,
        dias_domingo: dias.domingo_feriado.size,
        total_dias: dias.util.size + dias.sabado.size + dias.domingo_feriado.size
      })).sort((a, b) => a.cargo.localeCompare(b.cargo))

      setResumo(rows)
    }
    setLoading(false)
  }

  async function updateStatus(status: string) {
    await supabase.from('boletins_medicao').update({ status }).eq('id', params.id)
    setBm((prev: any) => ({ ...prev, status }))
  }

  async function exportExcel() {
    setExporting(true)
    try {
      const response = await fetch('/api/boletins/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bm_id: params.id })
      })
      if (response.ok) {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `BM${String(bm.numero).padStart(2,'0')}_${bm.obras.nome.replace(/\s/g,'_')}.xlsx`
        a.click()
      }
    } catch (e) {
      console.error(e)
    }
    setExporting(false)
  }

  if (loading) return <div className="p-6 text-sm text-gray-400">Carregando...</div>
  if (!bm) return <div className="p-6 text-sm text-red-500">Boletim não encontrado.</div>

  const totalDias = resumo.reduce((s, r) => s + r.total_dias, 0)
  const dias = Math.ceil((new Date(bm.data_fim).getTime() - new Date(bm.data_inicio).getTime()) / 86400000) + 1

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/boletins" className="text-gray-400 hover:text-gray-600 text-sm">Boletins</Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-medium">BM {String(bm.numero).padStart(2,'0')} — {bm.obras.nome}</span>
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-semibold font-display">
                BM {String(bm.numero).padStart(2,'0')} — {bm.obras.nome}
              </h1>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_BADGE[bm.status]}`}>
                {bm.status}
              </span>
            </div>
            <p className="text-sm text-gray-500">{bm.obras.cliente} · {bm.obras.local}</p>
            <p className="text-sm text-gray-400 mt-1">
              {new Date(bm.data_inicio + 'T12:00:00').toLocaleDateString('pt-BR')} até {new Date(bm.data_fim + 'T12:00:00').toLocaleDateString('pt-BR')} · {dias} dias
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={exportExcel} disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-green-600">
                <rect x="1" y="1" width="14" height="14" rx="2" opacity=".2"/>
                <path d="M8 10V4M5 7l3 3 3-3M4 12h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
              </svg>
              {exporting ? 'Exportando...' : 'Exportar CSV'}
            </button>
            {bm.status === 'aberto' && (
              <>
                <button onClick={() => updateStatus('fechado')}
                  className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark">
                  Fechar BM
                </button>
                <ConfirmButton label="Excluir BM"
                  confirmLabel="Esta ação não pode ser desfeita. Confirmar?"
                  className="px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50"
                  confirmClassName="text-xs px-3 py-1.5 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700"
                  onConfirm={async () => {
                    await supabase.from('boletins_medicao').delete().eq('id', params.id)
                    router.push('/boletins')
                  }} />
              </>
            )}
            {bm.status === 'fechado' && (
              <button onClick={() => updateStatus('enviado')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                Marcar enviado
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Total pessoas-dia', value: totalDias },
          { label: 'Dias úteis', value: resumo.reduce((s, r) => s + r.dias_util, 0) },
          { label: 'Sábados', value: resumo.reduce((s, r) => s + r.dias_sabado, 0) },
          { label: 'Dom/Feriado', value: resumo.reduce((s, r) => s + r.dias_domingo, 0) },
        ].map(k => (
          <div key={k.label} className="bg-gray-100 rounded-xl p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{k.label}</div>
            <div className="text-2xl font-semibold">{k.value}</div>
          </div>
        ))}
      </div>

      {/* Resumo por função */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-5">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Resumo por Função</h2>
          <span className="text-xs text-gray-400">Carga horária: 07:00 às 17:00</span>
        </div>
        {resumo.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Função</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Dias Úteis</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Sábados</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Dom/Fer</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Total</th>
              </tr>
            </thead>
            <tbody>
              {resumo.map(r => (
                <tr key={r.cargo} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium">{r.cargo}</td>
                  <td className="px-4 py-3 text-center">{r.dias_util}</td>
                  <td className="px-4 py-3 text-center text-amber-600 font-medium">{r.dias_sabado || '-'}</td>
                  <td className="px-4 py-3 text-center text-red-600 font-medium">{r.dias_domingo || '-'}</td>
                  <td className="px-4 py-3 text-center font-semibold text-brand">{r.total_dias}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-gray-200 bg-gray-50">
                <td className="px-5 py-3 font-bold text-xs uppercase tracking-wide text-gray-600">Total</td>
                <td className="px-4 py-3 text-center font-bold">{resumo.reduce((s, r) => s + r.dias_util, 0)}</td>
                <td className="px-4 py-3 text-center font-bold text-amber-600">{resumo.reduce((s, r) => s + r.dias_sabado, 0) || '-'}</td>
                <td className="px-4 py-3 text-center font-bold text-red-600">{resumo.reduce((s, r) => s + r.dias_domingo, 0) || '-'}</td>
                <td className="px-4 py-3 text-center font-bold text-brand">{totalDias}</td>
              </tr>
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center text-gray-400 text-sm">
            Nenhum efetivo registrado para este período ainda.<br/>
            <Link href="/efetivo" className="text-brand hover:underline mt-1 inline-block">
              Registrar efetivo diário →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
