import Link from 'next/link'

interface EmptyStateProps {
  titulo: string
  descricao?: string
  icone?: React.ReactNode
  acao?: { label: string; href: string }
}

export default function EmptyState({ titulo, descricao, icone, acao }: EmptyStateProps) {
  return (
    <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
      {icone && (
        <div className="flex justify-center mb-4 text-gray-300">
          {icone}
        </div>
      )}
      <h3 className="text-sm font-bold text-gray-600 mb-1">{titulo}</h3>
      {descricao && <p className="text-xs text-gray-400 mb-4 max-w-sm mx-auto">{descricao}</p>}
      {acao && (
        <Link href={acao.href}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark transition-colors">
          {acao.label}
        </Link>
      )}
    </div>
  )
}
