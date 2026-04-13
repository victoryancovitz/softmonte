import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'
import BackButton from '@/components/BackButton'
import EmptyState from '@/components/ui/EmptyState'
import { Wrench } from 'lucide-react'

const fmt = (v: any) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default async function PatrimonioPage() {
  const supabase = createClient()
  const { data: ativos } = await supabase.from('ativos_fixos').select('*, obras(nome), funcionarios(nome)').is('deleted_at', null).order('created_at', { ascending: false })

  const valorTotal = (ativos ?? []).reduce((s: number, a: any) => s + Number(a.valor_aquisicao || 0), 0)
  const depAcum = (ativos ?? []).reduce((s: number, a: any) => s + Number(a.depreciacao_acumulada || 0), 0)

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/almoxarifado" />
        <Link href="/almoxarifado" className="text-gray-400 hover:text-gray-600">Almoxarifado</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700">Patrimônio</span>
      </div>
      <h1 className="text-xl font-bold font-display text-brand mb-1">Patrimônio (Ativos Fixos)</h1>
      <p className="text-sm text-gray-500 mb-6">Ferramentas, equipamentos e bens com depreciação controlada.</p>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-[10px] font-bold text-gray-400 uppercase">Valor do Imobilizado</div>
          <div className="text-xl font-bold text-gray-900">{fmt(valorTotal)}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-[10px] font-bold text-gray-400 uppercase">Depreciação Acumulada</div>
          <div className="text-xl font-bold text-red-600">{fmt(depAcum)}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-[10px] font-bold text-gray-400 uppercase">Valor Líquido Contábil</div>
          <div className="text-xl font-bold text-brand">{fmt(valorTotal - depAcum)}</div>
        </div>
      </div>

      {(ativos ?? []).length === 0 ? (
        <EmptyState titulo="Nenhum ativo cadastrado" descricao="Cadastre ferramentas, equipamentos e bens patrimoniais." icone={<Wrench className="w-10 h-10" />} />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 border-b border-gray-100">
              {['TAG', 'Nome', 'Categoria', 'Valor Aquisição', 'Depr. Acum.', 'Valor Líquido', 'Status', 'Responsável'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {(ativos ?? []).map((a: any) => (
                <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{a.numero_patrimonio || '—'}</td>
                  <td className="px-4 py-3 font-medium">{a.nome}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{a.categoria || '—'}</td>
                  <td className="px-4 py-3">{fmt(a.valor_aquisicao)}</td>
                  <td className="px-4 py-3 text-red-600">{fmt(a.depreciacao_acumulada)}</td>
                  <td className="px-4 py-3 font-semibold">{fmt(Number(a.valor_aquisicao) - Number(a.depreciacao_acumulada || 0))}</td>
                  <td className="px-4 py-3"><span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${a.status_ativo === 'ativo' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{a.status_ativo || 'ativo'}</span></td>
                  <td className="px-4 py-3 text-xs text-gray-500">{a.funcionarios?.nome || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
