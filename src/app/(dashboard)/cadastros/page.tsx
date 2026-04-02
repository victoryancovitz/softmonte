import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'

export default async function CadastrosPage() {
  const supabase = createClient()

  const [funcoes, cats, obras, funcs] = await Promise.all([
    supabase.from('funcoes').select('id', { count: 'exact' }).eq('ativo', true),
    supabase.from('categorias_financeiras').select('id', { count: 'exact' }).eq('ativo', true),
    supabase.from('obras').select('id', { count: 'exact' }),
    supabase.from('funcionarios').select('id', { count: 'exact' }),
  ])

  const cards = [
    {
      href: '/cadastros/funcoes',
      icon: '🪖',
      title: 'Funções / Cargos',
      desc: 'Gerencie as funções e custos de hora para cada cargo da empresa.',
      count: funcoes.count ?? 0,
      label: 'funções ativas',
      color: 'border-brand/20 hover:border-brand bg-brand/5',
      btnColor: 'bg-brand text-white hover:bg-brand-dark',
    },
    {
      href: '/obras',
      icon: '🏗️',
      title: 'Obras',
      desc: 'Cadastre e gerencie obras, clientes e localidades.',
      count: obras.count ?? 0,
      label: 'obras cadastradas',
      color: 'border-green-200 hover:border-green-400 bg-green-50',
      btnColor: 'bg-green-600 text-white hover:bg-green-700',
    },
    {
      href: '/funcionarios',
      icon: '👷',
      title: 'Funcionários',
      desc: 'Cadastro completo: dados pessoais, bancários, documentação e contratos.',
      count: funcs.count ?? 0,
      label: 'funcionários',
      color: 'border-blue-200 hover:border-blue-400 bg-blue-50',
      btnColor: 'bg-blue-600 text-white hover:bg-blue-700',
    },
    {
      href: '/cadastros/categorias',
      icon: '🏷️',
      title: 'Categorias Financeiras',
      desc: 'Defina as categorias para classificar receitas e despesas.',
      count: cats.count ?? 0,
      label: 'categorias',
      color: 'border-amber-200 hover:border-amber-400 bg-amber-50',
      btnColor: 'bg-amber-600 text-white hover:bg-amber-700',
    },
    {
      href: '/documentos',
      icon: '📎',
      title: 'Documentos',
      desc: 'ASO, NR-10, NR-35 e outros documentos dos funcionários com controle de vencimento.',
      count: null,
      label: null,
      color: 'border-purple-200 hover:border-purple-400 bg-purple-50',
      btnColor: 'bg-purple-600 text-white hover:bg-purple-700',
    },
    {
      href: '/estoque/novo',
      icon: '📦',
      title: 'Itens de Estoque',
      desc: 'Gerencie EPIs, ferramentas, materiais e consumíveis.',
      count: null,
      label: null,
      color: 'border-orange-200 hover:border-orange-400 bg-orange-50',
      btnColor: 'bg-orange-600 text-white hover:bg-orange-700',
    },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold font-display text-brand">Cadastros</h1>
        <p className="text-sm text-gray-500 mt-1">Dados mestres do sistema — funções, obras, funcionários e classificações</p>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {cards.map(card => (
          <div key={card.href} className={`rounded-2xl border-2 p-5 transition-all ${card.color}`}>
            <div className="flex items-start justify-between mb-3">
              <span className="text-3xl">{card.icon}</span>
              {card.count !== null && (
                <span className="text-2xl font-bold font-display text-brand">{card.count}</span>
              )}
            </div>
            <h2 className="text-base font-bold text-gray-900 mb-1">{card.title}</h2>
            <p className="text-xs text-gray-500 leading-relaxed mb-4">{card.desc}</p>
            {card.count !== null && card.label && (
              <p className="text-xs text-gray-400 mb-3">{card.count} {card.label}</p>
            )}
            <Link href={card.href}
              className={`inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl transition-all ${card.btnColor}`}>
              Gerenciar →
            </Link>
          </div>
        ))}
      </div>

      {/* Atalhos rápidos */}
      <div className="mt-8 p-5 bg-white rounded-2xl border border-gray-200">
        <h3 className="text-sm font-bold text-brand font-display mb-4">Ações rápidas de cadastro</h3>
        <div className="grid grid-cols-4 gap-3">
          {[
            { href: '/funcionarios/novo', label: '+ Funcionário', icon: '👷' },
            { href: '/obras/nova', label: '+ Obra', icon: '🏗️' },
            { href: '/cadastros/funcoes/nova', label: '+ Função', icon: '🪖' },
            { href: '/alocacao/nova', label: '+ Alocar funcionário', icon: '🔗' },
            { href: '/documentos/novo', label: '+ Documento', icon: '📎' },
            { href: '/estoque/novo', label: '+ Item estoque', icon: '📦' },
            { href: '/financeiro/novo', label: '+ Lançamento fin.', icon: '💰' },
            { href: '/importar', label: 'Importar CSV', icon: '📥' },
          ].map(a => (
            <Link key={a.href} href={a.href}
              className="flex items-center gap-2 text-xs font-semibold px-3 py-2.5 bg-gray-50 border border-gray-200 text-gray-700 rounded-xl hover:bg-brand hover:text-white hover:border-brand transition-all">
              <span>{a.icon}</span> {a.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
