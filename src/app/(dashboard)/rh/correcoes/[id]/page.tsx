'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import BackButton from '@/components/BackButton'
import { useToast } from '@/components/Toast'

const MOTIVOS: Record<string, string> = {
  acordo_coletivo: 'Acordo coletivo', dissidio: 'Dissídio', merito: 'Mérito',
  promocao: 'Promoção', correcao: 'Correção', piso: 'Ajuste ao piso', outro: 'Outro',
}

export default function CorrecaoDetalhePage() {
  const { id } = useParams<{ id: string }>()
  const [c, setC] = useState<any>(null)
  const [historico, setHistorico] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const toast = useToast()

  useEffect(() => {
    (async () => {
      const [{ data: corr }, { data: hist }] = await Promise.all([
        supabase.from('correcoes_salariais').select('*, funcoes(nome), obras(nome)').eq('id', id).single(),
        supabase.from('funcionario_historico_salarial').select('*, funcionarios(nome,cargo)').eq('correcao_id', id).order('created_at'),
      ])
      setC(corr); setHistorico(hist || []); setLoading(false)
    })()
  }, [id])

  async function reverter() {
    if (!confirm('Reverter correção? Todos os salários voltarão ao valor anterior.')) return
    const { data: { user } } = await supabase.auth.getUser()
    // Aplica inversamente cada item do histórico
    for (const h of historico) {
      await supabase.from('funcionarios').update({ salario_base: h.salario_anterior }).eq('id', h.funcionario_id)
    }
    // Marca correção como revertida e registra histórico de reversão
    await supabase.from('correcoes_salariais').update({
      status: 'revertida',
      revertida_em: new Date().toISOString(),
      revertida_por: user?.id ?? null,
    }).eq('id', id)
    await supabase.from('funcionario_historico_salarial').insert(
      historico.map(h => ({
        funcionario_id: h.funcionario_id,
        data_efetivo: new Date().toISOString().slice(0, 10),
        salario_anterior: h.salario_novo,
        salario_novo: h.salario_anterior,
        motivo: 'correcao',
        correcao_id: id,
        observacao: 'Reversão da correção ' + c.titulo,
        created_by: user?.id ?? null,
      }))
    )
    toast.success('Correção revertida')
    location.reload()
  }

  const fmt = (v: any) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  if (loading) return <div className="p-6 text-gray-400 text-sm">Carregando...</div>
  if (!c) return <div className="p-6 text-gray-400">Correção não encontrada.</div>

  const totalReajuste = historico.reduce((s, h) => s + (Number(h.salario_novo) - Number(h.salario_anterior)), 0)

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/rh/correcoes" />
        <Link href="/rh/correcoes" className="text-gray-400 hover:text-gray-600">Correções</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700">{c.titulo}</span>
      </div>

      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold font-display text-brand mb-1">{c.titulo}</h1>
          <p className="text-sm text-gray-500">
            {MOTIVOS[c.motivo]} · Efetivo em {new Date(c.data_efetivo + 'T12:00').toLocaleDateString('pt-BR')}
            {c.funcoes?.nome && <> · Função: {c.funcoes.nome}</>}
            {c.obras?.nome && <> · Obra: {c.obras.nome}</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-3 py-1 rounded-full font-bold ${
            c.status === 'aplicada' ? 'bg-green-100 text-green-700' :
            c.status === 'revertida' ? 'bg-gray-100 text-gray-500' :
            'bg-amber-100 text-amber-700'
          }`}>{c.status.toUpperCase()}</span>
          {c.status === 'aplicada' && (
            <button onClick={reverter} className="text-xs text-red-600 hover:underline font-semibold">Reverter</button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-[11px] font-semibold text-gray-400 uppercase">Tipo</div>
          <div className="text-sm font-bold text-gray-900">
            {c.tipo_reajuste === 'percentual' ? `+${Number(c.percentual).toFixed(2)}%` :
             c.tipo_reajuste === 'valor_fixo' ? `+${fmt(c.valor_fixo)}` :
             `Novo: ${fmt(c.valor_fixo)}`}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-[11px] font-semibold text-gray-400 uppercase">Afetados</div>
          <div className="text-2xl font-bold text-gray-900 font-display">{c.funcionarios_afetados || historico.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-[11px] font-semibold text-gray-400 uppercase">Total reajuste mensal</div>
          <div className="text-xl font-bold text-green-700 font-display">+{fmt(totalReajuste)}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {['Funcionário', 'Cargo', 'Anterior', 'Novo', 'Diferença', 'Variação %'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {historico.map(h => {
              const diff = Number(h.salario_novo) - Number(h.salario_anterior)
              const pct = Number(h.salario_anterior) > 0 ? (diff / Number(h.salario_anterior) * 100) : 0
              return (
                <tr key={h.id} className="border-b border-gray-50 hover:bg-gray-50/80">
                  <td className="px-4 py-3">
                    <Link href={`/funcionarios/${h.funcionario_id}`} className="font-medium text-gray-900 hover:text-brand">{h.funcionarios?.nome}</Link>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{h.funcionarios?.cargo}</td>
                  <td className="px-4 py-3 text-gray-500">{fmt(h.salario_anterior)}</td>
                  <td className="px-4 py-3 font-bold text-green-700">{fmt(h.salario_novo)}</td>
                  <td className="px-4 py-3 font-semibold text-green-600">+{fmt(diff)}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-green-600">+{pct.toFixed(2)}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {c.observacao && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-700">
          <strong>Observação:</strong> {c.observacao}
        </div>
      )}
    </div>
  )
}
