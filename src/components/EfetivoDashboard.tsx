'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import type { getEfetivoDashboard } from '@/lib/efetivo/get-efetivo-dashboard'

type Props = { data: Awaited<ReturnType<typeof getEfetivoDashboard>> }

function corPresenca(pct: number) {
  if (pct >= 90) return { text: 'text-green-700', bg: 'bg-green-500', pill: 'bg-green-100 text-green-700', border: 'border-green-200' }
  if (pct >= 70) return { text: 'text-amber-700', bg: 'bg-amber-500', pill: 'bg-amber-100 text-amber-700', border: 'border-amber-200' }
  return { text: 'text-red-700', bg: 'bg-red-500', pill: 'bg-red-100 text-red-700', border: 'border-red-200' }
}

function formatHora(h: string | null) {
  if (!h) return '—'
  return h.slice(0, 5)
}

export default function EfetivoDashboard({ data }: Props) {
  const [detalhesAberto, setDetalhesAberto] = useState(false)
  const [busca, setBusca] = useState('')

  const { hoje, obraIds, obrasAtivas, alocados, efetivoHoje, historico30d } = data

  // --- Compute main metrics ---
  const esperados = alocados.length
  const presenteIds = new Set(efetivoHoje.filter((e: any) => e.tipo_dia === 'trabalhado' || e.tipo_dia === 'hora_extra').map((e: any) => e.funcionario_id))
  const presentes = presenteIds.size
  const pctPresenca = esperados > 0 ? (presentes / esperados * 100) : 0
  const cores = corPresenca(pctPresenca)

  // Absences breakdown
  const faltas = efetivoHoje.filter((e: any) => e.tipo_dia === 'falta').length
  const atestados = efetivoHoje.filter((e: any) => e.tipo_dia === 'atestado').length
  const ferias = efetivoHoje.filter((e: any) => e.tipo_dia === 'ferias').length

  // Per-obra breakdown
  const porObra = useMemo(() => {
    if (obraIds.length <= 1) return []
    return obrasAtivas.map((obra: any) => {
      const alocObra = alocados.filter((a: any) => a.obra_id === obra.id).length
      const presObra = efetivoHoje.filter((e: any) => e.obra_id === obra.id && (e.tipo_dia === 'trabalhado' || e.tipo_dia === 'hora_extra')).length
      return { id: obra.id, nome: obra.nome, esperados: alocObra, presentes: presObra }
    }).filter((o: any) => o.esperados > 0)
  }, [obraIds, obrasAtivas, alocados, efetivoHoje])

  // By function (horizontal bars)
  const porFuncao = useMemo(() => {
    const map: Record<string, { nome: string; total: number; presentes: number }> = {}
    alocados.forEach((a: any) => {
      const fn = (a.funcionarios as any)?.funcoes?.nome || 'Sem função'
      if (!map[fn]) map[fn] = { nome: fn, total: 0, presentes: 0 }
      map[fn].total++
    })
    efetivoHoje.forEach((e: any) => {
      if (e.tipo_dia !== 'trabalhado' && e.tipo_dia !== 'hora_extra') return
      const fn = (e.funcionarios as any)?.funcoes?.nome || 'Sem função'
      if (!map[fn]) map[fn] = { nome: fn, total: 0, presentes: 0 }
      map[fn].presentes++
    })
    return Object.values(map).sort((a, b) => b.total - a.total)
  }, [alocados, efetivoHoje])

  const maxFuncao = Math.max(...porFuncao.map(f => f.total), 1)

  // --- Week comparison ---
  const semana = useMemo(() => {
    const hojeDate = new Date(hoje + 'T12:00:00')
    const dow = hojeDate.getDay() // 0=Sun
    const monday = new Date(hojeDate)
    monday.setDate(hojeDate.getDate() - ((dow === 0 ? 7 : dow) - 1))

    const dias = []
    const nomesDia = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex']
    for (let i = 0; i < 5; i++) {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      const dStr = d.toISOString().split('T')[0]
      const presD = new Set(
        historico30d.filter((h: any) => h.data === dStr && (h.tipo_dia === 'trabalhado' || h.tipo_dia === 'hora_extra'))
          .map((_: any, idx: number) => idx) // unique by index since we don't have func_id here
      ).size
      // Actually count rows for each day
      const presDia = historico30d.filter((h: any) => h.data === dStr && (h.tipo_dia === 'trabalhado' || h.tipo_dia === 'hora_extra')).length
      dias.push({ label: nomesDia[i], data: dStr, presentes: presDia, isHoje: dStr === hoje })
    }
    return dias
  }, [hoje, historico30d])

  const mediaSemana = semana.filter(d => d.presentes > 0).length > 0
    ? Math.round(semana.filter(d => d.presentes > 0).reduce((s, d) => s + d.presentes, 0) / semana.filter(d => d.presentes > 0).length)
    : 0

  // --- 30-day chart ---
  const chart30d = useMemo(() => {
    const byDay: Record<string, number> = {}
    historico30d.forEach((h: any) => {
      if (h.tipo_dia === 'trabalhado' || h.tipo_dia === 'hora_extra') {
        byDay[h.data] = (byDay[h.data] || 0) + 1
      }
    })
    const days: { data: string; presentes: number }[] = []
    const d = new Date(new Date().getTime() - 30 * 86400000)
    for (let i = 0; i <= 30; i++) {
      const dStr = d.toISOString().split('T')[0]
      days.push({ data: dStr, presentes: byDay[dStr] || 0 })
      d.setDate(d.getDate() + 1)
    }
    return days
  }, [historico30d])

  const maxChart = Math.max(...chart30d.map(d => d.presentes), esperados, 1)

  // --- Detail table ---
  const detalhes = useMemo(() => {
    const map = new Map<string, any>()
    // Start with allocated employees
    alocados.forEach((a: any) => {
      const f = a.funcionarios as any
      map.set(a.funcionario_id, {
        id: a.funcionario_id,
        nome: f?.nome || '—',
        funcao: f?.funcoes?.nome || '—',
        entrada: null,
        saida: null,
        horas: null,
        status: 'ausente',
      })
    })
    // Overlay efetivo data
    efetivoHoje.forEach((e: any) => {
      const f = e.funcionarios as any
      map.set(e.funcionario_id, {
        id: e.funcionario_id,
        nome: f?.nome || '—',
        funcao: f?.funcoes?.nome || '—',
        entrada: e.entrada,
        saida: e.saida,
        horas: e.horas_trabalhadas,
        status: e.tipo_dia || 'ausente',
      })
    })
    let rows = Array.from(map.values())
    if (busca) {
      const q = busca.toLowerCase()
      rows = rows.filter(r => r.nome.toLowerCase().includes(q) || r.funcao.toLowerCase().includes(q))
    }
    rows.sort((a, b) => a.nome.localeCompare(b.nome))
    return rows
  }, [alocados, efetivoHoje, busca])

  const statusBadge = (s: string) => {
    switch (s) {
      case 'trabalhado': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-100 text-green-700">Presente</span>
      case 'hora_extra': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 text-blue-700">HE</span>
      case 'falta': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-100 text-red-700">Falta</span>
      case 'atestado': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-100 text-purple-700">Atestado</span>
      case 'ferias': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-cyan-100 text-cyan-700">Ferias</span>
      default: return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-500">Ausente</span>
    }
  }

  const agora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const semEfetivo = efetivoHoje.length === 0

  return (
    <div className="mb-8">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Efetivo Diario</p>

      {/* ══════ SECTION 1: EFETIVO HOJE ══════ */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: '#00215B' }}>Efetivo Hoje</h2>
          <span className="text-[10px] text-gray-400">Atualizado as {agora}</span>
        </div>

        {semEfetivo ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <span className="text-4xl mb-3">&#128119;</span>
            <p className="text-gray-500 text-sm mb-2">Aguardando lancamento do efetivo de hoje</p>
            <Link href="/ponto" className="text-sm font-medium hover:underline" style={{ color: '#c8960c' }}>
              Ir para Ponto &rarr;
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: big number + progress + per-obra */}
            <div>
              <div className="flex items-baseline gap-3 mb-2">
                <span className={`text-5xl font-bold font-display ${cores.text}`}>{presentes}</span>
                <span className="text-lg text-gray-400">/ {esperados}</span>
                <span className={`text-sm font-semibold px-2 py-0.5 rounded-full ${cores.pill}`}>
                  {pctPresenca.toFixed(0)}%
                </span>
              </div>
              <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden mb-4">
                <div className={`h-full rounded-full transition-all ${cores.bg}`} style={{ width: `${Math.min(pctPresenca, 100)}%` }} />
              </div>

              {/* Per-obra breakdown */}
              {porObra.length > 1 && (
                <div className="space-y-2 mb-4">
                  {porObra.map((o: any) => {
                    const pct = o.esperados > 0 ? (o.presentes / o.esperados * 100) : 0
                    const c = corPresenca(pct)
                    return (
                      <div key={o.id} className="flex items-center gap-3 text-xs">
                        <span className="w-28 truncate text-gray-600 font-medium">{o.nome}</span>
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${c.bg}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                        <span className={`font-semibold ${c.text}`}>{o.presentes}/{o.esperados}</span>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Absence summary */}
              <div className="flex gap-4 text-xs text-gray-500">
                {faltas > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" />{faltas} falta{faltas > 1 ? 's' : ''}</span>}
                {atestados > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-400" />{atestados} atestado{atestados > 1 ? 's' : ''}</span>}
                {ferias > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-400" />{ferias} ferias</span>}
                {faltas === 0 && atestados === 0 && ferias === 0 && <span className="text-green-600">Sem ausencias</span>}
              </div>
            </div>

            {/* Right: bar chart by function */}
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Por Funcao</p>
              <div className="space-y-1.5">
                {porFuncao.slice(0, 8).map(f => (
                  <div key={f.nome} className="flex items-center gap-2 text-xs">
                    <span className="w-24 truncate text-gray-600">{f.nome}</span>
                    <div className="flex-1 flex items-center gap-1">
                      <div className="flex-1 h-4 bg-gray-50 rounded relative overflow-hidden">
                        <div className="absolute inset-y-0 left-0 rounded" style={{ width: `${(f.total / maxFuncao) * 100}%`, backgroundColor: '#e5e7eb' }} />
                        <div className="absolute inset-y-0 left-0 rounded" style={{ width: `${(f.presentes / maxFuncao) * 100}%`, backgroundColor: '#00215B', opacity: 0.8 }} />
                      </div>
                    </div>
                    <span className="text-gray-500 font-mono w-10 text-right">{f.presentes}/{f.total}</span>
                  </div>
                ))}
                {porFuncao.length === 0 && <p className="text-xs text-gray-400">Sem dados de funcao</p>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══════ SECTION 2: WEEK COMPARISON ══════ */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Semana Atual</h3>
          {mediaSemana > 0 && <span className="text-[10px] text-gray-400">Media: {mediaSemana}</span>}
        </div>
        <div className="grid grid-cols-5 gap-2">
          {semana.map(d => {
            const pct = esperados > 0 ? (d.presentes / esperados * 100) : 0
            const c = d.presentes > 0 ? corPresenca(pct) : { text: 'text-gray-300', bg: 'bg-gray-200', pill: '', border: '' }
            return (
              <div key={d.data} className={`text-center rounded-xl p-2 ${d.isHoje ? 'ring-2 ring-offset-1 ring-[#c8960c]' : ''}`}>
                <p className={`text-[10px] font-bold uppercase ${d.isHoje ? 'text-gray-900' : 'text-gray-400'}`}>{d.label}</p>
                <p className={`text-lg font-bold ${c.text}`}>{d.presentes || '—'}</p>
                <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden mt-1">
                  <div className={`h-full rounded-full ${c.bg}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
                {esperados > 0 && d.presentes > 0 && (
                  <p className="text-[9px] text-gray-400 mt-0.5">/{esperados}</p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ══════ SECTION 3: 30-DAY CHART ══════ */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5 mb-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Ultimos 30 dias</h3>
        <div className="relative h-24">
          {/* Expected line (dashed) */}
          {esperados > 0 && (
            <div
              className="absolute left-0 right-0 border-t-2 border-dashed border-gray-300"
              style={{ bottom: `${(esperados / maxChart) * 100}%` }}
            >
              <span className="absolute -top-3.5 right-0 text-[9px] text-gray-400">{esperados}</span>
            </div>
          )}
          {/* Bars */}
          <div className="flex items-end h-full gap-px">
            {chart30d.map(d => {
              const h = maxChart > 0 ? (d.presentes / maxChart) * 100 : 0
              const isHoje = d.data === hoje
              return (
                <div key={d.data} className="flex-1 flex flex-col items-center justify-end h-full" title={`${d.data}: ${d.presentes}`}>
                  <div
                    className={`w-full rounded-t-sm ${isHoje ? 'opacity-100' : 'opacity-60'}`}
                    style={{
                      height: `${Math.max(h, d.presentes > 0 ? 3 : 0)}%`,
                      backgroundColor: isHoje ? '#c8960c' : '#00215B',
                      minHeight: d.presentes > 0 ? '2px' : '0',
                    }}
                  />
                </div>
              )
            })}
          </div>
        </div>
        <div className="flex justify-between mt-1 text-[9px] text-gray-400">
          <span>{chart30d[0]?.data ? new Date(chart30d[0].data + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : ''}</span>
          <span>Hoje</span>
        </div>
      </div>

      {/* ══════ SECTION 4: DETAIL TABLE ══════ */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <button
          onClick={() => setDetalhesAberto(!detalhesAberto)}
          className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
        >
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Ver detalhes de hoje
          </span>
          <span className={`text-gray-400 transition-transform ${detalhesAberto ? 'rotate-180' : ''}`}>
            &#9660;
          </span>
        </button>

        {detalhesAberto && (
          <div className="px-5 pb-4">
            {/* Search */}
            <div className="mb-3">
              <input
                type="text"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar funcionario ou funcao..."
                className="w-full sm:w-72 pl-3 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00215B] bg-white"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-[10px] font-bold text-gray-400 uppercase">
                    <th className="py-2 pr-3">Funcionario</th>
                    <th className="py-2 pr-3">Funcao</th>
                    <th className="py-2 pr-3">Entrada</th>
                    <th className="py-2 pr-3">Saida</th>
                    <th className="py-2 pr-3">HH</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {detalhes.map(r => (
                    <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 pr-3 font-medium text-gray-700">{r.nome}</td>
                      <td className="py-2 pr-3 text-gray-500">{r.funcao}</td>
                      <td className="py-2 pr-3 font-mono text-gray-600">{formatHora(r.entrada)}</td>
                      <td className="py-2 pr-3 font-mono text-gray-600">{formatHora(r.saida)}</td>
                      <td className="py-2 pr-3 font-mono text-gray-600">{r.horas != null ? Number(r.horas).toFixed(1) : '—'}</td>
                      <td className="py-2">{statusBadge(r.status)}</td>
                    </tr>
                  ))}
                  {detalhes.length === 0 && (
                    <tr><td colSpan={6} className="py-6 text-center text-gray-400">Nenhum registro encontrado</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
