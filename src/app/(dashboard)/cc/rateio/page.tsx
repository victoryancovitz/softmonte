'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import BackButton from '@/components/BackButton'

const fmt = (v: number | null) => v != null ? Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'

type Metodo = 'sem_rateio' | 'por_receita' | 'por_hh' | 'por_tempo_remanescente' | 'manual'

const METODO_OPTIONS: { value: Metodo; label: string; desc: string }[] = [
  { value: 'sem_rateio', label: 'Sem Rateio', desc: 'SG&A não é distribuído para as obras' },
  { value: 'por_receita', label: 'Proporção por Receita', desc: 'Distribui pela participação de cada obra na receita total' },
  { value: 'por_tempo_remanescente', label: 'Por Tempo Remanescente', desc: 'Distribui pela quantidade de dias restantes de cada obra' },
  { value: 'manual', label: 'Definição Manual', desc: 'Defina o percentual de rateio para cada obra' },
]

export default function RateioPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [obras, setObras] = useState<any[]>([])
  const [metodo, setMetodo] = useState<Metodo>('sem_rateio')
  const [manuais, setManuais] = useState<Record<string, number>>({})
  const [sgaTotal, setSgaTotal] = useState(0)
  const [receitasPorObra, setReceitasPorObra] = useState<Record<string, number>>({})
  const [configId, setConfigId] = useState<string | null>(null)

  const hoje = new Date()
  const mesAtual = hoje.getMonth() + 1
  const anoAtual = hoje.getFullYear()

  useEffect(() => {
    async function load() {
      const [{ data: obrasData }, { data: configData }, { data: lancData }] = await Promise.all([
        supabase.from('obras').select('id, nome, data_inicio, data_fim, status').in('status', ['em_andamento', 'planejamento']),
        supabase.from('cc_rateio_config').select('*').eq('mes', mesAtual).eq('ano', anoAtual).limit(1),
        supabase.from('financeiro_lancamentos').select('obra_id, tipo, valor, natureza, is_provisao, centros_custo(tipo)').is('deleted_at', null),
      ])

      setObras(obrasData ?? [])

      // Calcular SG&A total e receitas por obra
      let sga = 0
      const recMap: Record<string, number> = {}
      ;(lancData ?? []).forEach((l: any) => {
        if (l.tipo === 'despesa' && !l.is_provisao && (l.centros_custo as any)?.tipo === 'administrativo') {
          sga += Number(l.valor || 0)
        }
        if (l.tipo === 'receita' && l.natureza !== 'financiamento' && l.obra_id) {
          recMap[l.obra_id] = (recMap[l.obra_id] || 0) + Number(l.valor || 0)
        }
      })
      setSgaTotal(sga)
      setReceitasPorObra(recMap)

      if (configData && configData.length > 0) {
        const cfg = configData[0]
        setConfigId(cfg.id)
        setMetodo(cfg.metodo || 'sem_rateio')
        setManuais(cfg.definicoes_manuais || {})
      }

      setLoading(false)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const receitaTotal = useMemo(() => Object.values(receitasPorObra).reduce((s, v) => s + v, 0), [receitasPorObra])

  const preview = useMemo(() => {
    return obras.map(o => {
      const fim = o.data_fim ? new Date(o.data_fim) : null
      const diasRest = fim ? Math.max(0, Math.ceil((fim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))) : 0
      const receita = receitasPorObra[o.id] || 0

      let pctVal = 0
      if (metodo === 'por_receita') {
        pctVal = receitaTotal > 0 ? (receita / receitaTotal) * 100 : 0
      } else if (metodo === 'por_tempo_remanescente') {
        const totalDias = obras.reduce((s: number, ob: any) => {
          const f = ob.data_fim ? new Date(ob.data_fim) : null
          return s + (f ? Math.max(0, Math.ceil((f.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))) : 0)
        }, 0)
        pctVal = totalDias > 0 ? (diasRest / totalDias) * 100 : 0
      } else if (metodo === 'manual') {
        pctVal = Number(manuais[o.id] || 0)
      }

      return {
        id: o.id,
        nome: o.nome,
        diasRest,
        pct: pctVal,
        valor: sgaTotal * (pctVal / 100),
      }
    })
  }, [obras, metodo, manuais, sgaTotal, receitasPorObra, receitaTotal]) // eslint-disable-line react-hooks/exhaustive-deps

  const somaManual = useMemo(() => preview.reduce((s, p) => s + p.pct, 0), [preview])

  const handleSave = async () => {
    setSaving(true)
    const payload = {
      mes: mesAtual,
      ano: anoAtual,
      metodo,
      definicoes_manuais: metodo === 'manual' ? manuais : null,
    }

    if (configId) {
      await supabase.from('cc_rateio_config').update(payload).eq('id', configId)
    } else {
      const { data } = await supabase.from('cc_rateio_config').insert(payload).select('id').single()
      if (data) setConfigId(data.id)
    }
    setSaving(false)
  }

  if (loading) return <div className="p-6 text-center text-gray-400">Carregando...</div>

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/cc" />
        <Link href="/cc" className="text-gray-400 hover:text-gray-600">Centros de Custo</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700">Rateio</span>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold font-display text-brand mb-1">Configuracao de Rateio de Overhead</h1>
          <p className="text-sm text-gray-500">Defina como o SG&A ({fmt(sgaTotal)}) sera distribuido entre as obras ativas.</p>
        </div>
      </div>

      {/* Seletor de metodo */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Metodo de Rateio</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {METODO_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setMetodo(opt.value)}
              className={`text-left p-3 rounded-lg border-2 transition-colors ${metodo === opt.value ? 'border-brand bg-brand/5' : 'border-gray-100 hover:border-gray-200'}`}>
              <div className="text-sm font-medium text-gray-800">{opt.label}</div>
              <div className="text-[11px] text-gray-400 mt-0.5">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Preview */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto mb-6">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Preview — {mesAtual}/{anoAtual}</h3>
          {metodo === 'manual' && (
            <span className={`text-xs font-medium px-2 py-1 rounded ${Math.abs(somaManual - 100) < 0.1 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              Soma: {somaManual.toFixed(1)}%
            </span>
          )}
        </div>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-100 bg-gray-50">
            {['Obra', 'Dias Rest.', '%', 'R$ Rateado', ...(metodo === 'manual' ? [''] : [])].map(h => (
              <th key={h} className="text-right first:text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {preview.length > 0 ? preview.map(p => (
              <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/80">
                <td className="px-4 py-2.5 font-medium text-left">{p.nome}</td>
                <td className="px-4 py-2.5 text-right text-gray-500">{p.diasRest}d</td>
                <td className="px-4 py-2.5 text-right text-gray-700 font-medium">
                  {metodo === 'manual' ? (
                    <input type="number" min={0} max={100} step={0.1}
                      value={manuais[p.id] ?? ''}
                      onChange={e => setManuais({ ...manuais, [p.id]: Number(e.target.value) })}
                      className="w-20 text-right border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand"
                      placeholder="0" />
                  ) : (
                    `${p.pct.toFixed(1)}%`
                  )}
                </td>
                <td className="px-4 py-2.5 text-right text-purple-600 font-medium">{p.valor > 0 ? fmt(p.valor) : '—'}</td>
              </tr>
            )) : <tr><td colSpan={4} className="px-4 py-10 text-center text-gray-400">Nenhuma obra ativa encontrada.</td></tr>}
            {preview.length > 0 && (
              <tr className="bg-gray-50 font-bold border-t border-gray-200">
                <td className="px-4 py-3 text-left">TOTAL</td>
                <td className="px-4 py-3 text-right">—</td>
                <td className="px-4 py-3 text-right">{preview.reduce((s, p) => s + p.pct, 0).toFixed(1)}%</td>
                <td className="px-4 py-3 text-right text-purple-700">{fmt(preview.reduce((s, p) => s + p.valor, 0))}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Save */}
      <div className="flex justify-end gap-3">
        <Link href="/financeiro/dre" className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">Voltar para DRE</Link>
        <button onClick={handleSave} disabled={saving || (metodo === 'manual' && Math.abs(somaManual - 100) >= 0.1)}
          className="px-6 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed">
          {saving ? 'Salvando...' : 'Salvar Configuracao'}
        </button>
      </div>
    </div>
  )
}
