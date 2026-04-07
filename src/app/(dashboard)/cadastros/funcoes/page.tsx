import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'
import BackButton from '@/components/BackButton'

const CAT_COLOR: Record<string, string> = {
  'Montagem': 'bg-blue-100 text-blue-700',
  'Elétrica': 'bg-yellow-100 text-yellow-700',
  'Gestão': 'bg-purple-100 text-purple-700',
  'Qualidade': 'bg-green-100 text-green-700',
  'Suporte': 'bg-gray-100 text-gray-600',
  'Tubulação': 'bg-cyan-100 text-cyan-700',
  'Pintura': 'bg-pink-100 text-pink-700',
  'Mecânica': 'bg-orange-100 text-orange-700',
  'Equipamentos': 'bg-red-100 text-red-700',
  'Operacional': 'bg-brand/10 text-brand',
}

export default async function FuncoesPage() {
  const supabase = createClient()
  const { data: funcoes } = await supabase
    .from('funcoes')
    .select('*')
    .order('categoria')
    .order('nome')

  const fmt = (v: any) => v != null ? Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'

  const byCat: Record<string, any[]> = {}
  funcoes?.forEach((f: any) => {
    if (!byCat[f.categoria]) byCat[f.categoria] = []
    byCat[f.categoria].push(f)
  })

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/cadastros" />
        <Link href="/cadastros" className="text-gray-400 hover:text-gray-600">Cadastros</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700">Funções / Cargos</span>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold font-display text-brand">Funções / Cargos</h1>
          <p className="text-sm text-gray-500 mt-0.5">{funcoes?.length ?? 0} funções · salários base, CBO, piso CLT e adicionais padrão</p>
        </div>
        <div className="flex gap-2">
          <Link href="/rh/correcoes"
            className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors">
            Correções salariais
          </Link>
          <Link href="/cadastros/funcoes/nova"
            className="px-4 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark transition-colors">
            + Nova função
          </Link>
        </div>
      </div>

      <div className="space-y-5">
        {Object.entries(byCat).sort().map(([cat, funcs]) => (
          <div key={cat} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${CAT_COLOR[cat] ?? 'bg-gray-100 text-gray-600'}`}>
                  {cat}
                </span>
                <span className="text-xs text-gray-400">{funcs.length} função(ões)</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nome / CBO</th>
                    <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Salário base</th>
                    <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Piso CLT</th>
                    <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Jornada</th>
                    <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Peric / Insal</th>
                    <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Custo/hora</th>
                    <th className="px-5 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {funcs.map((f: any) => {
                    const salTotal = Number(f.salario_base || 0) * (1 + Number(f.periculosidade_pct_padrao || 0)/100 + Number(f.insalubridade_pct_padrao || 0)/100)
                    const custoHora = f.jornada_horas_mes > 0 ? salTotal / Number(f.jornada_horas_mes) : null
                    const abaixoPiso = f.salario_base && f.piso_clt && Number(f.salario_base) < Number(f.piso_clt)
                    return (
                      <tr key={f.id} className="border-b border-gray-50 hover:bg-gray-50 group">
                        <td className="px-5 py-3">
                          <div className="font-semibold text-gray-900">{f.nome}</div>
                          <div className="text-[11px] text-gray-400">CBO {f.cbo || '—'}</div>
                          {!f.ativo && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">inativa</span>}
                        </td>
                        <td className="px-5 py-3 text-right font-bold font-display text-brand">
                          {fmt(f.salario_base)}
                          {abaixoPiso && (
                            <div className="text-[10px] text-red-600 font-normal">⚠ abaixo do piso</div>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right text-xs text-gray-500">{fmt(f.piso_clt)}</td>
                        <td className="px-5 py-3 text-right text-xs text-gray-600">{f.jornada_horas_mes}h</td>
                        <td className="px-5 py-3 text-right text-xs">
                          {Number(f.periculosidade_pct_padrao) > 0 && <div className="text-red-600">P {Number(f.periculosidade_pct_padrao)}%</div>}
                          {Number(f.insalubridade_pct_padrao) > 0 && <div className="text-amber-600">I {Number(f.insalubridade_pct_padrao)}%</div>}
                          {(!f.periculosidade_pct_padrao || Number(f.periculosidade_pct_padrao)===0) && (!f.insalubridade_pct_padrao || Number(f.insalubridade_pct_padrao)===0) && <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-5 py-3 text-right text-xs text-gray-500">
                          {custoHora ? fmt(custoHora) + '/h' : '—'}
                        </td>
                        <td className="px-5 py-3 text-right opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                          <Link href={`/cadastros/funcoes/${f.id}/editar`}
                            className="text-xs text-brand hover:underline font-medium">Editar</Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
