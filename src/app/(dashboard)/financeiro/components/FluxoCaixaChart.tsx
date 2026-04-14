'use client'
import { useState } from 'react'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtK = (v: number) => fmt(v)

interface FluxoCaixaChartProps {
  fluxo: any[]
  chartH: number
  maxVal: number
  barW: number
}

export default function FluxoCaixaChart({ fluxo, chartH, maxVal, barW }: FluxoCaixaChartProps) {
  const [hoveredBar, setHoveredBar] = useState<{ mes: string; receita: number; pago: number; aVencer: number; vencido: number; acumulado: number; x: number } | null>(null)

  return (
    <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold">Fluxo de Caixa Mensal</h2>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-400 inline-block"/>&nbsp;Receita</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-400 inline-block"/>&nbsp;Pago</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-400 inline-block"/>&nbsp;A vencer</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-rose-600 inline-block"/>&nbsp;Vencido</span>
          <span className="flex items-center gap-1"><span className="w-3 h-1 border-t-2 border-dashed border-brand inline-block"/>&nbsp;Acumulado</span>
        </div>
      </div>
      {fluxo.length > 0 ? (
        <div className="relative">
        <svg width="100%" viewBox={`0 0 600 ${chartH + 60}`} className="overflow-visible">
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map(p => (
            <g key={p}>
              <line x1="40" y1={chartH - p * chartH + 10} x2="590" y2={chartH - p * chartH + 10}
                stroke="#f3f4f6" strokeWidth="1"/>
              <text x="35" y={chartH - p * chartH + 14} textAnchor="end" fontSize="8" fill="#9ca3af">
                {fmtK(maxVal * p)}
              </text>
            </g>
          ))}
          {/* Zero line */}
          <line x1="40" y1={chartH + 10} x2="590" y2={chartH + 10} stroke="#e5e7eb" strokeWidth="1"/>

          {fluxo.map((m, i) => {
            const xStep = 550 / Math.max(fluxo.length, 1)
            const x = 40 + i * xStep + xStep / 2
            const recH = Math.min((m.totalRec / maxVal) * chartH, chartH)
            const despH = Math.min((m.totalDesp / maxVal) * chartH, chartH)
            const mes = m.mes.slice(5, 7) + '/' + m.mes.slice(2, 4)
            return (
              <g key={m.mes}>
                {/* Hit area for tooltip */}
                <rect x={x - barW - 6} y={0} width={barW * 2 + 12} height={chartH + 30} fill="transparent"
                  onMouseEnter={() => setHoveredBar({ mes, receita: m.totalRec, pago: m.despesa_pago, aVencer: m.despesa_aberto, vencido: m.despesa_vencido || 0, acumulado: m.acum, x })}
                  onMouseLeave={() => setHoveredBar(null)} style={{ cursor: 'pointer' }} />
                {/* Receita bar */}
                <rect x={x - barW - 2} y={chartH - recH + 10} width={barW} height={recH}
                  fill="#34d399" rx="2" opacity="0.85" style={{ pointerEvents: 'none' }}/>
                {/* Despesa stacked: pago + a vencer + vencido */}
                {(() => {
                  const pagoH = Math.min((m.despesa_pago / maxVal) * chartH, chartH)
                  const aVencerH = Math.min((m.despesa_aberto / maxVal) * chartH, chartH)
                  const vencidoH = Math.min(((m.despesa_vencido || 0) / maxVal) * chartH, chartH)
                  return <>
                    <rect x={x + 2} y={chartH - pagoH - aVencerH - vencidoH + 10} width={barW} height={vencidoH}
                      fill="#e11d48" rx="0" opacity="0.9"/>
                    <rect x={x + 2} y={chartH - pagoH - aVencerH + 10} width={barW} height={aVencerH}
                      fill="#fbbf24" rx="0" opacity="0.85"/>
                    <rect x={x + 2} y={chartH - pagoH + 10} width={barW} height={pagoH}
                      fill="#f87171" rx="2" opacity="0.85"/>
                  </>
                })()}
                {/* Month label */}
                <text x={x} y={chartH + 26} textAnchor="middle" fontSize="8" fill="#6b7280">{mes}</text>
              </g>
            )
          })}

          {/* Accumulated line */}
          {fluxo.length > 1 && (() => {
            const maxAcum = Math.max(...fluxo.map(m => Math.abs(m.acum)), 1)
            const midY = chartH / 2 + 10
            const pts = fluxo.map((m, i) => {
              const xStep = 550 / Math.max(fluxo.length, 1)
              const x = 40 + i * xStep + xStep / 2
              const y = midY - (m.acum / maxAcum) * (chartH / 2 - 5)
              return `${x},${y}`
            }).join(' ')
            return (
              <polyline points={pts} fill="none" stroke="#c07000" strokeWidth="2"
                strokeDasharray="4,3" strokeLinecap="round"/>
            )
          })()}
        </svg>
        {hoveredBar && (
          <div className="absolute z-20 pointer-events-none bg-[#0f1e2e] text-white rounded-xl shadow-2xl border border-white/10 p-3 text-xs min-w-[180px]" style={{ left: Math.min(hoveredBar.x * 100 / 600, 65) + '%', top: 20 }}>
            <p className="font-bold text-brand mb-2 text-sm">{hoveredBar.mes}</p>
            <div className="space-y-1.5">
              <div className="flex justify-between gap-4"><span className="text-green-400">Receita</span><span className="font-semibold">{fmt(hoveredBar.receita)}</span></div>
              <div className="flex justify-between gap-4"><span className="text-red-400">Pago</span><span className="font-semibold">{fmt(hoveredBar.pago)}</span></div>
              {hoveredBar.aVencer > 0 && <div className="flex justify-between gap-4"><span className="text-amber-400">A vencer</span><span>{fmt(hoveredBar.aVencer)}</span></div>}
              {hoveredBar.vencido > 0 && <div className="flex justify-between gap-4"><span className="text-rose-400">Vencido</span><span>{fmt(hoveredBar.vencido)}</span></div>}
              <div className="border-t border-white/10 pt-1.5 mt-1">
                <div className="flex justify-between gap-4"><span className="text-gray-400">Saldo mes</span><span className={`font-bold ${hoveredBar.receita - hoveredBar.pago >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(hoveredBar.receita - hoveredBar.pago)}</span></div>
                <div className="flex justify-between gap-4"><span className="text-gray-400">Acumulado</span><span className={`font-semibold ${hoveredBar.acumulado >= 0 ? 'text-green-300' : 'text-red-300'}`}>{fmt(hoveredBar.acumulado)}</span></div>
              </div>
            </div>
          </div>
        )}
        </div>
      ) : (
        <div className="h-40 flex items-center justify-center text-gray-400 text-sm">Sem dados</div>
      )}
    </div>
  )
}
