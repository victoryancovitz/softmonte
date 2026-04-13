import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'
import EmptyState from '@/components/ui/EmptyState'
import { Package } from 'lucide-react'

const fmt = (v: any) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default async function AlmoxarifadoPage() {
  const supabase = createClient()
  const { data: itens } = await supabase.from('vw_estoque_posicao').select('*').order('nome')

  const totalValor = (itens ?? []).reduce((s: number, i: any) => s + Number(i.valor_estoque || 0), 0)
  const abaixoMin = (itens ?? []).filter((i: any) => i.abaixo_minimo).length

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold font-display text-brand">Almoxarifado</h1>
          <p className="text-sm text-gray-500">{(itens ?? []).length} itens cadastrados · {fmt(totalValor)} em estoque</p>
        </div>
        <Link href="/estoque/novo" className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark">+ Novo Item</Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-[10px] font-bold text-gray-400 uppercase">Valor em Estoque</div>
          <div className="text-xl font-bold text-gray-900">{fmt(totalValor)}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-[10px] font-bold text-gray-400 uppercase">Abaixo do Mínimo</div>
          <div className={`text-xl font-bold ${abaixoMin > 0 ? 'text-red-700' : 'text-green-700'}`}>{abaixoMin}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-[10px] font-bold text-gray-400 uppercase">Total de Itens</div>
          <div className="text-xl font-bold text-gray-900">{(itens ?? []).length}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-[10px] font-bold text-gray-400 uppercase">Lotes Ativos</div>
          <div className="text-xl font-bold text-gray-900">{(itens ?? []).reduce((s: number, i: any) => s + Number(i.lotes_ativos || 0), 0)}</div>
        </div>
      </div>

      {(itens ?? []).length === 0 ? (
        <EmptyState titulo="Almoxarifado vazio" descricao="Cadastre itens de estoque para controlar EPIs, materiais e ferramentas." icone={<Package className="w-10 h-10" />} acao={{ label: '+ Novo Item', href: '/estoque/novo' }} />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 border-b border-gray-100">
              {['Nome', 'Categoria', 'Tipo', 'Qtd', 'Mín', 'Custo Médio', 'Valor Total', 'Lotes', 'Status'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {(itens ?? []).map((i: any) => (
                <tr key={i.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{i.nome}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{i.categoria || '—'}</td>
                  <td className="px-4 py-3 text-xs">{i.tipo_item || 'consumivel'}</td>
                  <td className="px-4 py-3">{Number(i.quantidade || 0)}</td>
                  <td className="px-4 py-3 text-gray-400">{Number(i.quantidade_minima || 0)}</td>
                  <td className="px-4 py-3 text-xs">{fmt(i.custo_medio_atual)}</td>
                  <td className="px-4 py-3 font-semibold">{fmt(i.valor_estoque)}</td>
                  <td className="px-4 py-3 text-center">{i.lotes_ativos || 0}</td>
                  <td className="px-4 py-3">
                    {i.abaixo_minimo ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold">Abaixo</span>
                      : <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-bold">Normal</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
