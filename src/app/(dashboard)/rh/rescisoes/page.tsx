'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import BackButton from '@/components/BackButton'
import SearchInput from '@/components/SearchInput'
import { FileX, Plus } from 'lucide-react'

const TIPO_LABEL: Record<string, string> = {
  sem_justa_causa: 'Sem justa causa',
  justa_causa: 'Justa causa',
  pedido_demissao: 'Pedido demissão',
  comum_acordo: 'Comum acordo',
  fim_contrato_experiencia: 'Fim experiência',
  fim_contrato_determinado: 'Fim contrato',
  rescisao_indireta: 'Rescisão indireta',
  falecimento: 'Falecimento',
}

export default function RescisoesPage() {
  const [resc, setResc] = useState<any[]>([])
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('rescisoes')
        .select('*, funcionarios(nome,cargo,matricula), obras(nome)')
        .is('deleted_at', null)
        .order('data_desligamento', { ascending: false })
      setResc(data || []); setLoading(false)
    })()
  }, [])

  const fmt = (v: any) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const filtrados = resc.filter(r => !busca || r.funcionarios?.nome?.toLowerCase().includes(busca.toLowerCase()))

  if (loading) return <div className="p-6 text-gray-400 text-sm">Carregando...</div>

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/rh" />
        <span className="text-gray-400">RH</span>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700">Rescisões</span>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold font-display text-brand mb-1">Rescisões Trabalhistas</h1>
          <p className="text-sm text-gray-500">Cálculo CLT automatizado, editável, com vínculo a financeiro e auditoria.</p>
        </div>
        <Link href="/rh/rescisoes/nova" className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-semibold hover:bg-brand-dark flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nova rescisão
        </Link>
      </div>

      <div className="mb-4"><SearchInput value={busca} onChange={setBusca} placeholder="Buscar por funcionário..." /></div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {['Funcionário', 'Obra', 'Tipo', 'Desligamento', 'Líquido', 'Custo empresa', 'Status', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrados.length > 0 ? filtrados.map(r => (
              <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/80">
                <td className="px-4 py-3">
                  <Link href={`/rh/rescisoes/${r.id}`} className="font-semibold text-gray-900 hover:text-brand">{r.funcionarios?.nome}</Link>
                  <div className="text-xs text-gray-400">{r.funcionarios?.cargo}</div>
                </td>
                <td className="px-4 py-3 text-gray-600">{r.obras?.nome || '—'}</td>
                <td className="px-4 py-3 text-xs">{TIPO_LABEL[r.tipo] || r.tipo}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{new Date(r.data_desligamento + 'T12:00').toLocaleDateString('pt-BR')}</td>
                <td className="px-4 py-3 font-bold text-green-700">{fmt(r.valor_liquido)}</td>
                <td className="px-4 py-3 text-red-700">{fmt(r.custo_total_empresa)}</td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    r.status === 'paga' ? 'bg-green-100 text-green-700' :
                    r.status === 'homologada' ? 'bg-blue-100 text-blue-700' :
                    r.status === 'cancelada' ? 'bg-gray-100 text-gray-500' :
                    'bg-amber-100 text-amber-700'
                  }`}>{r.status.toUpperCase()}</span>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/rh/rescisoes/${r.id}`} className="text-xs text-brand hover:underline">Abrir</Link>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                <FileX className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p>Nenhuma rescisão cadastrada.</p>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
