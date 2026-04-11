'use client'
import { useState } from 'react'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function SimuladorDistribuicao({ lucroAnual, lucroCaixa }: { lucroAnual: number; lucroCaixa: number }) {
  const [valor, setValor] = useState(0)
  const dy = lucroAnual > 0 ? (valor * 4 / lucroAnual * 100) : 0
  const porSocio = valor / 2
  const retido = lucroCaixa - valor
  const ok = valor <= lucroCaixa

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
      <div className="flex items-center gap-4 mb-4">
        <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Quanto distribuir?</label>
        <input type="range" min={0} max={Math.max(lucroCaixa, 1)} step={1000} value={valor}
          onChange={e => setValor(Number(e.target.value))}
          className="flex-1 accent-brand" />
        <input type="number" value={valor} onChange={e => setValor(Math.max(0, Number(e.target.value)))}
          className="w-32 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-right" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-[10px] text-gray-400 font-bold uppercase">DY resultante</div>
          <div className={`text-lg font-bold ${dy >= 10 ? 'text-green-700' : dy >= 5 ? 'text-amber-600' : 'text-gray-700'}`}>{dy.toFixed(1)}%</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-[10px] text-gray-400 font-bold uppercase">Por sócio (50%)</div>
          <div className="text-lg font-bold text-gray-900">{fmt(porSocio)}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-[10px] text-gray-400 font-bold uppercase">Lucro retido</div>
          <div className={`text-lg font-bold ${retido >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(retido)}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-[10px] text-gray-400 font-bold uppercase">Status</div>
          <div className={`text-sm font-bold ${ok ? 'text-green-700' : 'text-red-700'}`}>{ok ? '✅ Sustentável' : '⚠️ Excede lucro'}</div>
        </div>
      </div>
    </div>
  )
}
