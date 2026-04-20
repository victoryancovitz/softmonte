import { Gavel, FileText, AlertCircle, Scale, MessageSquare, Search, MoreHorizontal } from 'lucide-react'
import type { ProcessoMovimentacao, MovimentacaoTipo } from '@/types/juridico'

const TIPO_CONFIG: Record<MovimentacaoTipo, { icon: any; color: string; label: string }> = {
  peticao: { icon: FileText, color: 'bg-blue-100 text-blue-600', label: 'Petição' },
  despacho: { icon: MessageSquare, color: 'bg-gray-100 text-gray-600', label: 'Despacho' },
  decisao: { icon: Scale, color: 'bg-purple-100 text-purple-600', label: 'Decisão' },
  sentenca: { icon: Gavel, color: 'bg-indigo-100 text-indigo-600', label: 'Sentença' },
  intimacao: { icon: AlertCircle, color: 'bg-amber-100 text-amber-600', label: 'Intimação' },
  citacao: { icon: AlertCircle, color: 'bg-orange-100 text-orange-600', label: 'Citação' },
  audiencia: { icon: Scale, color: 'bg-emerald-100 text-emerald-600', label: 'Audiência' },
  recurso: { icon: FileText, color: 'bg-red-100 text-red-600', label: 'Recurso' },
  pericia: { icon: Search, color: 'bg-cyan-100 text-cyan-600', label: 'Perícia' },
  outros: { icon: MoreHorizontal, color: 'bg-gray-100 text-gray-500', label: 'Outros' },
}

interface Props {
  movimentacoes: ProcessoMovimentacao[]
  onAdd?: () => void
}

export default function ProcessoTimeline({ movimentacoes, onAdd }: Props) {
  const sorted = [...movimentacoes].sort((a, b) => new Date(b.data_movimento).getTime() - new Date(a.data_movimento).getTime())

  return (
    <div>
      {onAdd && (
        <button onClick={onAdd} className="mb-4 px-3 py-1.5 text-sm font-medium text-brand border border-brand/30 rounded-lg hover:bg-brand/5">
          + Adicionar movimentação
        </button>
      )}
      {sorted.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">Nenhuma movimentação registrada</div>
      ) : (
        <div className="space-y-0">
          {sorted.map((mov, i) => {
            const config = TIPO_CONFIG[mov.tipo] || TIPO_CONFIG.outros
            const Icon = config.icon
            return (
              <div key={mov.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${config.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  {i < sorted.length - 1 && <div className="w-0.5 flex-1 bg-gray-200 my-1" />}
                </div>
                <div className="pb-4 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${config.color}`}>{config.label}</span>
                    <span className="text-[10px] text-gray-400">{new Date(mov.data_movimento).toLocaleDateString('pt-BR')}</span>
                    {mov.responsavel && <span className="text-[10px] text-gray-400">• {mov.responsavel}</span>}
                  </div>
                  <p className="text-sm text-gray-700">{mov.descricao}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
