import Link from 'next/link'

const relatorios = [
  { title: 'Custo de mão de obra por obra', desc: 'HH normal, extra e noturno · custo total por projeto', href: '/relatorios/custo-mo', color: 'bg-amber-100 text-amber-700' },
  { title: 'HH total por funcionário', desc: 'Horas lançadas, extras, noturnas e custo individual', href: '/relatorios/hh-funcionario', color: 'bg-blue-100 text-blue-700' },
  { title: 'Funcionários por obra por período', desc: 'Histórico de alocações e datas de entrada/saída', href: '/relatorios/func-obra', color: 'bg-green-100 text-green-700' },
  { title: 'Estoque consumido por obra', desc: 'Materiais e EPIs consumidos por projeto e período', href: '/relatorios/estoque-obra', color: 'bg-purple-100 text-purple-700' },
]

export default function RelatoriosPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Relatórios</h1>
        <p className="text-sm text-gray-500 mt-0.5">Gere e exporte relatórios para análise e auditoria.</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {relatorios.map(r => (
          <Link key={r.href} href={r.href}
            className="bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-300 hover:shadow-sm transition-all group">
            <div className={`inline-flex text-xs font-medium px-2.5 py-1 rounded-lg mb-3 ${r.color}`}>
              Relatório
            </div>
            <h2 className="text-sm font-semibold mb-1 group-hover:text-brand transition-colors">{r.title}</h2>
            <p className="text-xs text-gray-400">{r.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
