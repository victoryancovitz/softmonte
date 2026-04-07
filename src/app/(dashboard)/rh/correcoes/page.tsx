'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import BackButton from '@/components/BackButton'
import { TrendingUp, Plus } from 'lucide-react'

const MOTIVOS: Record<string, string> = {
  acordo_coletivo: 'Acordo coletivo',
  dissidio: 'Dissídio',
  merito: 'Mérito',
  promocao: 'Promoção',
  correcao: 'Correção',
  piso: 'Ajuste ao piso',
  outro: 'Outro',
}

export default function CorrecoesPage() {
  const [correcoes, setCorrecoes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('correcoes_salariais').select('*, funcoes(nome), obras(nome)').order('data_efetivo', { ascending: false }).then(({ data }) => {
      setCorrecoes(data || []); setLoading(false)
    })
  }, [])

  const fmt = (v: any) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  if (loading) return <div className="p-6 text-gray-400 text-sm">Carregando...</div>

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/rh" />
        <span className="text-gray-400">RH</span>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700">Correções Salariais</span>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold font-display text-brand mb-1">Correções Salariais</h1>
          <p className="text-sm text-gray-500">Acordos coletivos, dissídios, méritos — aplicados em massa com rastreabilidade.</p>
        </div>
        <Link href="/rh/correcoes/nova" className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-semibold hover:bg-brand-dark flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nova correção
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {['Título', 'Motivo', 'Escopo', 'Efetivo em', 'Tipo', 'Reajuste', 'Afetados', 'Total', 'Status'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {correcoes.length > 0 ? correcoes.map(c => (
              <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/80">
                <td className="px-4 py-3">
                  <Link href={`/rh/correcoes/${c.id}`} className="font-semibold text-gray-900 hover:text-brand">{c.titulo}</Link>
                </td>
                <td className="px-4 py-3 text-xs text-gray-600">{MOTIVOS[c.motivo] || c.motivo}</td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {c.funcoes?.nome && <div>Função: {c.funcoes.nome}</div>}
                  {c.obras?.nome && <div>Obra: {c.obras.nome}</div>}
                  {!c.funcoes?.nome && !c.obras?.nome && <span>Todos</span>}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{new Date(c.data_efetivo + 'T12:00').toLocaleDateString('pt-BR')}</td>
                <td className="px-4 py-3 text-xs">
                  {c.tipo_reajuste === 'percentual' ? 'Percentual' : c.tipo_reajuste === 'valor_fixo' ? 'Valor fixo' : 'Novo salário'}
                </td>
                <td className="px-4 py-3 font-semibold">
                  {c.tipo_reajuste === 'percentual' ? `+${Number(c.percentual).toFixed(2)}%` : fmt(c.valor_fixo)}
                </td>
                <td className="px-4 py-3 text-center">{c.funcionarios_afetados || '—'}</td>
                <td className="px-4 py-3 font-bold text-green-700">{fmt(c.total_reajuste)}</td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    c.status === 'aplicada' ? 'bg-green-100 text-green-700' :
                    c.status === 'revertida' ? 'bg-gray-100 text-gray-500' :
                    'bg-amber-100 text-amber-700'
                  }`}>{c.status.toUpperCase()}</span>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">
                <TrendingUp className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p>Nenhuma correção cadastrada.</p>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
