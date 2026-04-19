const STYLES: Record<string, string> = {
  em_aberto: 'bg-amber-50 text-amber-700 border-amber-200',
  pago: 'bg-green-50 text-green-700 border-green-200',
  cancelado: 'bg-gray-50 text-gray-600 border-gray-200',
  atrasado: 'bg-red-50 text-red-700 border-red-200',
  pendente: 'bg-blue-50 text-blue-700 border-blue-200',
  aprovado: 'bg-green-50 text-green-700 border-green-200',
  rejeitado: 'bg-red-50 text-red-700 border-red-200',
  ativo: 'bg-green-50 text-green-700 border-green-200',
  inativo: 'bg-gray-50 text-gray-500 border-gray-200',
  concluido: 'bg-green-50 text-green-700 border-green-200',
  em_andamento: 'bg-blue-50 text-blue-700 border-blue-200',
  alocado: 'bg-blue-50 text-blue-700 border-blue-200',
  disponivel: 'bg-green-50 text-green-700 border-green-200',
  afastado: 'bg-amber-50 text-amber-700 border-amber-200',
  em_admissao: 'bg-violet-50 text-violet-700 border-violet-200',
  aberto: 'bg-amber-50 text-amber-700 border-amber-200',
  enviado: 'bg-blue-50 text-blue-700 border-blue-200',
  fechada: 'bg-green-50 text-green-700 border-green-200',
  rascunho: 'bg-gray-50 text-gray-600 border-gray-200',
  revisado: 'bg-blue-50 text-blue-700 border-blue-200',
  pendente_confirmacao: 'bg-amber-50 text-amber-700 border-amber-200',
}

const LABELS: Record<string, string> = {
  em_aberto: 'Em aberto',
  pago: 'Pago',
  cancelado: 'Cancelado',
  atrasado: 'Atrasado',
  pendente: 'Pendente',
  aprovado: 'Aprovado',
  rejeitado: 'Rejeitado',
  ativo: 'Ativo',
  inativo: 'Inativo',
  concluido: 'Concluído',
  em_andamento: 'Em andamento',
  alocado: 'Alocado',
  disponivel: 'Disponível',
  afastado: 'Afastado',
  em_admissao: 'Em admissão',
  aberto: 'Aberto',
  enviado: 'Enviado',
  fechada: 'Fechada',
  rascunho: 'Rascunho',
  revisado: 'Revisado',
  pendente_confirmacao: 'Aguardando confirmação',
}

interface StatusBadgeProps {
  status: string
  label?: string
  className?: string
}

export default function StatusBadge({ status, label, className = '' }: StatusBadgeProps) {
  const style = STYLES[status] ?? 'bg-gray-50 text-gray-600 border-gray-200'
  const text = label ?? LABELS[status] ?? status

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${style} ${className}`}>
      {text}
    </span>
  )
}
