'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import BackButton from '@/components/BackButton'

const MESES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

export default function FolhaDetalhePage() {
  const { id } = useParams<{ id: string }>()
  const [folha, setFolha] = useState<any>(null)
  const [itens, setItens] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    (async () => {
      const { data: f } = await supabase.from('folha_fechamentos').select('*, obras(nome,cliente)').eq('id', id).single()
      const { data: its } = await supabase.from('folha_itens').select('*, funcionarios(nome,cargo,matricula)').eq('folha_id', id).order('created_at')
      setFolha(f); setItens(its || []); setLoading(false)
    })()
  }, [id])

  const fmt = (v: any) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  if (loading) return <div className="p-6 text-gray-400 text-sm">Carregando...</div>
  if (!folha) return <div className="p-6 text-gray-400">Fechamento não encontrado.</div>

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/rh/folha" />
        <Link href="/rh/folha" className="text-gray-400 hover:text-gray-600">Folha</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700">{MESES[folha.mes]}/{folha.ano} — {folha.obras?.nome}</span>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-5">
        <h1 className="text-lg font-bold font-display text-brand mb-1">Folha {MESES[folha.mes]}/{folha.ano}</h1>
        <p className="text-sm text-gray-500 mb-4">{folha.obras?.nome} · {folha.funcionarios_incluidos} funcionários</p>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-[10px] text-gray-400 font-semibold uppercase">Bruto</div>
            <div className="text-sm font-bold text-gray-900">{fmt(folha.valor_total_bruto)}</div>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-[10px] text-gray-400 font-semibold uppercase">Encargos</div>
            <div className="text-sm font-bold text-gray-900">{fmt(folha.valor_total_encargos)}</div>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-[10px] text-gray-400 font-semibold uppercase">Provisões</div>
            <div className="text-sm font-bold text-gray-900">{fmt(folha.valor_total_provisoes)}</div>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-[10px] text-gray-400 font-semibold uppercase">Benefícios</div>
            <div className="text-sm font-bold text-gray-900">{fmt(folha.valor_total_beneficios)}</div>
          </div>
          <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
            <div className="text-[10px] text-red-500 font-semibold uppercase">TOTAL</div>
            <div className="text-sm font-bold text-red-700">{fmt(folha.valor_total)}</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {['Funcionário', 'Dias', 'Desc.', 'Bruto', 'Encargos', 'Provisões', 'Benef.', 'Custo Total'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {itens.map(it => (
              <tr key={it.id} className="border-b border-gray-50 hover:bg-gray-50/80">
                <td className="px-4 py-3">
                  <Link href={`/funcionarios/${it.funcionario_id}`} className="font-medium text-gray-900 hover:text-brand">{it.funcionarios?.nome}</Link>
                  <div className="text-xs text-gray-400">{it.funcionarios?.cargo} · {it.funcionarios?.matricula}</div>
                </td>
                <td className="px-4 py-3 text-gray-600">{Number(it.dias_trabalhados)}</td>
                <td className="px-4 py-3 text-red-600">{Number(it.dias_descontados) > 0 ? `-${Number(it.dias_descontados).toFixed(1)}d` : '—'}</td>
                <td className="px-4 py-3">{fmt(it.valor_bruto)}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{fmt(it.encargos_valor)}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{fmt(it.provisoes_valor)}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{fmt(it.beneficios_valor)}</td>
                <td className="px-4 py-3 font-bold text-red-700">{fmt(it.custo_total_empresa)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
