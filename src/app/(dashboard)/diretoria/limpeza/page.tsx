'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import BackButton from '@/components/BackButton'
import { AlertTriangle, Bell, Clock, History, DollarSign, Calendar, Users, FileText, Package, Building, X, Trash2 } from 'lucide-react'
import {
  contagens, limparNotificacoes, limparPonto, limparAuditoria,
  limparFinanceiro, limparBancoHorasFerias, limparWorkflows,
  limparDiario, limparFuncionarios, limparObras, limparEstoque,
} from '@/app/actions/limpeza'

type Card = {
  key: string
  titulo: string
  descricao: string
  icone: any
  tabelas: string[] // para somar contagens
  action: () => Promise<{ success: boolean; error?: string; deletados?: number }>
  aviso?: string
}

const CARDS: Card[] = [
  { key: 'notif', titulo: 'Notificações', descricao: 'Apaga todas as notificações do sistema', icone: Bell, tabelas: ['notificacoes'], action: limparNotificacoes },
  { key: 'ponto', titulo: 'Registros de Ponto', descricao: 'Apaga todos os lançamentos de ponto (registros, marcações, fechamentos)', icone: Clock, tabelas: ['ponto_registros', 'ponto_marcacoes', 'ponto_dia_status'], action: limparPonto },
  { key: 'audit', titulo: 'Histórico de Auditoria', descricao: 'Apaga logs de auditoria e histórico de alterações', icone: History, tabelas: ['audit_log', 'email_logs'], action: limparAuditoria },
  { key: 'fin', titulo: 'Dados Financeiros', descricao: 'Apaga lançamentos, BMs, forecast e folhas', icone: DollarSign, tabelas: ['financeiro_lancamentos', 'boletins_medicao', 'forecast_contrato', 'folha_fechamentos'], action: limparFinanceiro, aviso: 'Isso apaga faturamento e BMs emitidos' },
  { key: 'bh', titulo: 'Banco de Horas e Férias', descricao: 'Apaga saldos de banco de horas, férias e faltas', icone: Calendar, tabelas: ['banco_horas', 'ferias', 'faltas'], action: limparBancoHorasFerias },
  { key: 'wf', titulo: 'Admissões e Desligamentos', descricao: 'Apaga workflows de admissão, desligamento e rescisões', icone: FileText, tabelas: ['admissoes_workflow', 'desligamentos_workflow', 'rescisoes'], action: limparWorkflows },
  { key: 'diario', titulo: 'Diário de Obra (RDO)', descricao: 'Apaga todos os RDOs, ocorrências, fotos e registros associados', icone: FileText, tabelas: ['diario_obra'], action: limparDiario },
  { key: 'func', titulo: 'Funcionários', descricao: 'Apaga todos os funcionários, alocações e documentos', icone: Users, tabelas: ['funcionarios', 'alocacoes'], action: limparFuncionarios, aviso: 'Exige que Admissões e Ponto já estejam limpos' },
  { key: 'obras', titulo: 'Obras e Clientes', descricao: 'Apaga obras, contratos, aditivos e clientes', icone: Building, tabelas: ['obras', 'clientes'], action: limparObras, aviso: 'Exige que Funcionários e Financeiro já estejam limpos' },
  { key: 'est', titulo: 'Estoque e Compras', descricao: 'Apaga itens de estoque, lotes, movimentações e fornecedores', icone: Package, tabelas: ['estoque_itens', 'estoque_lotes', 'fornecedores'], action: limparEstoque },
]

export default function LimpezaPage() {
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [confirmCard, setConfirmCard] = useState<Card | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [executing, setExecuting] = useState(false)

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase
        .from('profiles').select('role').eq('user_id', user.id).maybeSingle()
      if (!profile || !['admin', 'diretoria'].includes((profile as any).role)) {
        setAuthorized(false); return
      }
      setAuthorized(true)
      const c = await contagens()
      setCounts(c)
      setLoading(false)
    })()
  }, [])

  const totalCard = (card: Card): number => {
    return card.tabelas.reduce((s, t) => s + (counts[t] ?? 0), 0)
  }

  const handleExecute = async () => {
    if (!confirmCard) return
    if (confirmText !== 'CONFIRMAR') { toast.warning('Digite CONFIRMAR'); return }
    setExecuting(true)
    try {
      const result = await confirmCard.action()
      if (result.error) {
        toast.error('Erro', result.error)
      } else {
        toast.success(`${confirmCard.titulo} limpo`, `${result.deletados ?? 0} registros apagados`)
        // Refresh counts
        const c = await contagens()
        setCounts(c)
      }
    } catch (e: any) {
      toast.error('Erro inesperado', e?.message ?? '')
    } finally {
      setExecuting(false)
      setConfirmCard(null)
      setConfirmText('')
    }
  }

  if (authorized === false) {
    return (
      <div className="p-10 text-center">
        <p className="text-red-700 font-semibold">Acesso negado — apenas admin/diretoria.</p>
        <button onClick={() => router.push('/diretoria')} className="mt-3 text-brand hover:underline text-sm">Voltar</button>
      </div>
    )
  }
  if (loading) return <div className="p-8 text-sm text-gray-400 text-center">Carregando...</div>

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-4 text-sm">
        <BackButton fallback="/diretoria" />
        <span className="text-gray-400">Diretoria</span>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700">Limpeza de Dados</span>
      </div>

      <h1 className="text-xl font-bold font-display text-brand">Limpeza de Dados</h1>
      <p className="text-sm text-gray-500 mt-1 mb-4">
        Apague dados e históricos de forma seletiva. Estas ações são irreversíveis.
      </p>

      {/* Banner */}
      <div className="mb-6 p-4 rounded-xl bg-red-50 border-2 border-red-200 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-red-900">⚠️ Esta página apaga dados permanentemente</p>
          <p className="text-xs text-red-700 mt-0.5">Não há como recuperar após a confirmação. Faça backup antes se necessário.</p>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {CARDS.map(card => {
          const total = totalCard(card)
          const Icon = card.icone
          return (
            <div key={card.key} className="bg-white rounded-xl border border-gray-100 p-4 flex flex-col">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-gray-800">{card.titulo}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{card.descricao}</p>
                </div>
              </div>
              {card.aviso && (
                <div className="mb-3 p-2 bg-amber-50 border border-amber-100 rounded text-[10px] text-amber-800">
                  ⚠️ {card.aviso}
                </div>
              )}
              <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-100">
                <div>
                  <div className="text-[10px] text-gray-400 uppercase font-semibold">Registros</div>
                  <div className={`text-lg font-bold ${total > 0 ? 'text-red-700' : 'text-gray-300'}`}>{total}</div>
                </div>
                <button
                  onClick={() => { setConfirmCard(card); setConfirmText('') }}
                  disabled={total === 0}
                  className="px-3 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Apagar
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal de confirmação */}
      {confirmCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !executing && setConfirmCard(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="bg-red-50 border-b border-red-100 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <h3 className="font-bold text-red-900">Confirmar exclusão</h3>
              </div>
              <button onClick={() => !executing && setConfirmCard(null)} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-6 py-5 space-y-3">
              <p className="text-sm text-gray-800">
                Você está prestes a apagar: <strong>{confirmCard.titulo}</strong>
              </p>
              <p className="text-xs text-gray-600">{confirmCard.descricao}</p>
              <div className="bg-red-50 rounded-lg p-3">
                <div className="text-xs text-red-700">Registros a serem deletados:</div>
                <div className="text-2xl font-bold text-red-900">{totalCard(confirmCard)}</div>
              </div>
              <p className="text-xs text-red-700 font-semibold">Esta ação NÃO pode ser desfeita.</p>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Digite <span className="font-mono font-bold">CONFIRMAR</span> para prosseguir:</label>
                <input
                  type="text" value={confirmText} onChange={e => setConfirmText(e.target.value)}
                  placeholder="CONFIRMAR"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setConfirmCard(null)} disabled={executing}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={handleExecute} disabled={confirmText !== 'CONFIRMAR' || executing}
                className="px-5 py-2 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed">
                {executing ? 'Apagando...' : 'Apagar definitivamente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
