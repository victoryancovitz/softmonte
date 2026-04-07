'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { TrendingUp, TrendingDown, Calendar } from 'lucide-react'

const MOTIVO_LABEL: Record<string, string> = {
  admissao: 'Admissão',
  acordo_coletivo: 'Acordo coletivo',
  dissidio: 'Dissídio',
  merito: 'Mérito',
  promocao: 'Promoção',
  correcao: 'Correção',
  reenquadramento: 'Reenquadramento',
  piso: 'Ajuste ao piso',
  outro: 'Outro',
}

const MOTIVO_COLOR: Record<string, string> = {
  admissao: 'bg-blue-100 text-blue-700 border-blue-200',
  acordo_coletivo: 'bg-violet-100 text-violet-700 border-violet-200',
  dissidio: 'bg-violet-100 text-violet-700 border-violet-200',
  merito: 'bg-green-100 text-green-700 border-green-200',
  promocao: 'bg-green-100 text-green-700 border-green-200',
  correcao: 'bg-amber-100 text-amber-700 border-amber-200',
  piso: 'bg-amber-100 text-amber-700 border-amber-200',
  reenquadramento: 'bg-gray-100 text-gray-700 border-gray-200',
  outro: 'bg-gray-100 text-gray-700 border-gray-200',
}

export default function FuncionarioHistoricoSalarial({ funcionarioId }: { funcionarioId: string }) {
  const [historico, setHistorico] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('funcionario_historico_salarial')
      .select('*, correcoes_salariais(id, titulo)')
      .eq('funcionario_id', funcionarioId)
      .order('data_efetivo', { ascending: false })
      .then(({ data }) => { setHistorico(data || []); setLoading(false) })
  }, [funcionarioId])

  const fmt = (v: any) => v != null ? Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'

  if (loading) return <div className="text-xs text-gray-400 py-3">Carregando histórico...</div>
  if (historico.length === 0) {
    return <div className="text-xs text-gray-400 py-3 italic">Sem histórico salarial registrado.</div>
  }

  return (
    <div className="space-y-0">
      {historico.map((h, i) => {
        const anterior = Number(h.salario_anterior || 0)
        const novo = Number(h.salario_novo || 0)
        const diff = novo - anterior
        const pct = anterior > 0 ? (diff / anterior * 100) : null
        const isUp = diff > 0
        const isFirst = i === 0
        const isLast = i === historico.length - 1
        return (
          <div key={h.id} className="relative flex gap-3">
            {/* Vertical line */}
            <div className="flex flex-col items-center">
              <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-1.5 ${
                isFirst ? 'bg-brand ring-4 ring-brand/20' : 'bg-gray-300'
              }`} />
              {!isLast && <div className="w-px flex-1 bg-gray-200 my-1" />}
            </div>
            {/* Content */}
            <div className={`flex-1 pb-4 ${isLast ? '' : ''}`}>
              <div className="flex items-start justify-between flex-wrap gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${MOTIVO_COLOR[h.motivo] || 'bg-gray-100 text-gray-600'}`}>
                      {MOTIVO_LABEL[h.motivo] || h.motivo}
                    </span>
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(h.data_efetivo + 'T12:00').toLocaleDateString('pt-BR')}
                    </span>
                    {h.correcoes_salariais && (
                      <Link href={`/rh/correcoes/${h.correcoes_salariais.id}`}
                        className="text-[10px] text-brand hover:underline font-semibold">
                        {h.correcoes_salariais.titulo} →
                      </Link>
                    )}
                  </div>
                  {h.observacao && <p className="text-[11px] text-gray-400 mt-1 italic">{h.observacao}</p>}
                </div>
                <div className="text-right">
                  {h.motivo === 'admissao' ? (
                    <div className="text-sm font-bold text-brand">{fmt(novo)}</div>
                  ) : (
                    <>
                      <div className="flex items-center gap-1 justify-end">
                        <span className="text-[11px] text-gray-400 line-through">{fmt(anterior)}</span>
                        <span className="text-gray-300">→</span>
                        <span className="text-sm font-bold text-gray-900">{fmt(novo)}</span>
                      </div>
                      <div className={`text-[11px] font-bold flex items-center gap-0.5 justify-end ${isUp ? 'text-green-600' : 'text-red-600'}`}>
                        {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {isUp ? '+' : ''}{fmt(diff)}
                        {pct !== null && <span className="text-gray-400 font-normal">({isUp ? '+' : ''}{pct.toFixed(1)}%)</span>}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
