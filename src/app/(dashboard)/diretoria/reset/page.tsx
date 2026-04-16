'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { resetTotal, type DeleteLog } from '@/app/actions/reset'

const KEPT_ITEMS = [
  'Configurações da empresa (empresa_config)',
  'Usuários e perfis (auth + profiles)',
]

const DELETED_ITEMS = [
  'Funcionários, admissões, demissões',
  'Obras, alocações, diário de obra',
  'Folha de pagamento, holerites',
  'Ponto, efetivo, banco de horas',
  'Boletins de medição',
  'Financeiro, lançamentos, OFX',
  'Estoque, requisições',
  'Contratos, aditivos, composições',
  'Clientes, fornecedores, sócios',
  'Funções, tipos de contrato, treinamentos',
  'Notificações e logs de auditoria',
]

export default function ResetPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [step, setStep] = useState(0) // 0=info, 1=backup, 2=identity, 3=type confirm
  const [confirmText, setConfirmText] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [log, setLog] = useState<DeleteLog[]>([])
  const [contagensFinal, setContagensFinal] = useState<Record<string, number>>({})

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase.from('profiles').select('role, nome, email').eq('user_id', user.id).maybeSingle()
      if (!data || !['admin', 'diretoria'].includes((data as any).role)) { router.push('/'); return }
      setProfile(data)
      setLoading(false)
    })()
  }, [])

  async function executeReset() {
    setResetting(true)
    setError('')
    setShowModal(false)
    try {
      const result = await resetTotal(confirmText)
      if (result.error) {
        setError(result.error)
        setResetting(false)
      } else {
        setLog(result.log ?? [])
        setContagensFinal(result.contagens_final ?? {})
        setDone(true)
        setResetting(false)
        // Limpa wizard_hidden_until para setup wizard reaparecer
        try { localStorage.removeItem('wizard_hidden_until') } catch {}
      }
    } catch (e: any) {
      setError(e?.message || 'Erro inesperado ao executar reset.')
      setResetting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a0000] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-red-500 border-t-transparent" />
      </div>
    )
  }

  // Success screen
  if (done) {
    const totalDeletados = log.reduce((s, l) => s + l.deletados, 0)
    const erros = log.filter(l => l.erro)
    const linhasAfetadas = log.filter(l => l.deletados > 0 || l.erro)
    const tudoZerado = Object.values(contagensFinal).every(v => v === 0)
    return (
      <div className="min-h-screen bg-[#1a0000] flex items-center justify-center p-4">
        <div className="bg-[#2a0a0a] border border-red-800 rounded-2xl p-6 max-w-2xl w-full">
          <div className="text-center mb-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 ${tudoZerado ? 'bg-green-900/50' : 'bg-amber-900/50'}`}>
              <svg className={`w-8 h-8 ${tudoZerado ? 'text-green-400' : 'text-amber-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {tudoZerado ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                )}
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-1">
              {tudoZerado ? '✅ Plataforma zerada com sucesso' : '⚠️ Reset concluído com ressalvas'}
            </h2>
            <p className="text-red-300 text-sm">
              {totalDeletados} registros apagados em {linhasAfetadas.length} tabela(s).
              {erros.length > 0 && ` ${erros.length} tabela(s) com erro.`}
            </p>
          </div>

          {/* Log detalhado */}
          {linhasAfetadas.length > 0 && (
            <div className="bg-black/30 rounded-lg p-3 max-h-64 overflow-y-auto mb-4 font-mono text-[11px]">
              {linhasAfetadas.map(l => (
                <div key={l.tabela} className="flex items-center gap-2 py-0.5">
                  {l.erro ? (
                    <span className="text-red-400">❌</span>
                  ) : l.deletados > 0 ? (
                    <span className="text-green-400">✅</span>
                  ) : <span className="text-gray-500">·</span>}
                  <span className={`${l.erro ? 'text-red-300' : 'text-red-200'}`}>{l.tabela}</span>
                  <span className="text-red-400/60 ml-auto">
                    {l.erro ? l.erro : `${l.deletados} linha${l.deletados !== 1 ? 's' : ''}`}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Contagens finais */}
          {Object.keys(contagensFinal).length > 0 && (
            <div className="bg-black/30 rounded-lg p-3 mb-4">
              <div className="text-[10px] font-bold text-red-400 uppercase mb-2">Verificação final</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] font-mono">
                {Object.entries(contagensFinal).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between">
                    <span className="text-red-300">{k}</span>
                    <span className={`font-bold ${v === 0 ? 'text-green-400' : 'text-amber-400'}`}>
                      {v === 0 ? '✓ 0' : `⚠ ${v}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => router.push('/diretoria')}
              className="flex-1 px-6 py-3 bg-red-700 hover:bg-red-600 text-white rounded-xl text-sm font-bold transition-colors"
            >
              Voltar ao painel
            </button>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-3 bg-transparent border border-red-800 text-red-300 hover:bg-red-900/30 rounded-xl text-sm font-medium transition-colors"
            >
              Início
            </button>
          </div>
        </div>
      </div>
    )
  }

  const canProceed = confirmText === 'ZERAR SOFTMONTE'

  return (
    <div className="min-h-screen bg-[#1a0000] p-4 sm:p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button onClick={() => router.back()} className="text-red-400 hover:text-red-300 text-sm mb-3 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Voltar
          </button>
          <h1 className="text-2xl font-bold text-red-400">Reset Total do Sistema</h1>
          <p className="text-red-300/70 text-sm mt-1">
            Esta ação remove todos os dados operacionais. Use apenas para recomeçar do zero.
          </p>
        </div>

        {/* What will be deleted vs kept */}
        <div className="bg-[#2a0a0a] border border-red-800 rounded-2xl p-6 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <h3 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-3">Será removido</h3>
              <ul className="space-y-1.5">
                {DELETED_ITEMS.map(item => (
                  <li key={item} className="text-red-300 text-sm flex items-start gap-2">
                    <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-bold text-green-400 uppercase tracking-wider mb-3">Será mantido</h3>
              <ul className="space-y-1.5">
                {KEPT_ITEMS.map(item => (
                  <li key={item} className="text-green-300 text-sm flex items-start gap-2">
                    <svg className="w-4 h-4 text-green-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* 3-step confirmation */}
        <div className="bg-[#2a0a0a] border border-red-800 rounded-2xl p-6 space-y-6">

          {/* Step 1: Backup notice */}
          <div className={`transition-opacity ${step >= 0 ? 'opacity-100' : 'opacity-40'}`}>
            <div className="flex items-start gap-3">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${step > 0 ? 'bg-red-700 text-white' : 'bg-red-900 text-red-400 border border-red-700'}`}>
                {step > 0 ? '\u2713' : '1'}
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-red-300">Backup dos dados</h3>
                <p className="text-red-400/70 text-xs mt-1">
                  Certifique-se de que possui um backup atualizado antes de prosseguir.
                  Esta ação é irreversível.
                </p>
                {step === 0 && (
                  <button
                    onClick={() => setStep(1)}
                    className="mt-3 px-4 py-2 bg-red-900 border border-red-700 text-red-300 hover:bg-red-800 rounded-lg text-xs font-medium transition-colors"
                  >
                    Confirmo que tenho backup
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Step 2: User identity */}
          <div className={`transition-opacity ${step >= 1 ? 'opacity-100' : 'opacity-40'}`}>
            <div className="flex items-start gap-3">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${step > 1 ? 'bg-red-700 text-white' : 'bg-red-900 text-red-400 border border-red-700'}`}>
                {step > 1 ? '\u2713' : '2'}
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-red-300">Identificação do responsável</h3>
                {step >= 1 && (
                  <>
                    <p className="text-red-400/70 text-xs mt-1">
                      O reset será registrado como executado por:
                    </p>
                    <div className="mt-2 px-3 py-2 bg-red-950/50 border border-red-800/50 rounded-lg">
                      <p className="text-red-300 text-sm font-medium">{profile?.nome || 'Admin'}</p>
                      <p className="text-red-400/60 text-xs">{profile?.email}</p>
                    </div>
                    {step === 1 && (
                      <button
                        onClick={() => setStep(2)}
                        className="mt-3 px-4 py-2 bg-red-900 border border-red-700 text-red-300 hover:bg-red-800 rounded-lg text-xs font-medium transition-colors"
                      >
                        Sou eu, prosseguir
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Step 3: Type confirmation text */}
          <div className={`transition-opacity ${step >= 2 ? 'opacity-100' : 'opacity-40'}`}>
            <div className="flex items-start gap-3">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${canProceed ? 'bg-red-700 text-white' : 'bg-red-900 text-red-400 border border-red-700'}`}>
                {canProceed ? '\u2713' : '3'}
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-red-300">Confirmação final</h3>
                {step >= 2 && (
                  <>
                    <p className="text-red-400/70 text-xs mt-1">
                      Digite exatamente <span className="text-red-300 font-mono font-bold">ZERAR SOFTMONTE</span> para habilitar o botão de reset.
                    </p>
                    <input
                      type="text"
                      value={confirmText}
                      onChange={e => setConfirmText(e.target.value)}
                      placeholder="Digite aqui..."
                      className="mt-2 w-full px-4 py-2.5 bg-red-950/50 border border-red-800 rounded-lg text-red-200 text-sm font-mono placeholder:text-red-800 focus:outline-none focus:ring-2 focus:ring-red-600"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-950 border border-red-700 text-red-300 text-sm rounded-lg">
              {error}
            </div>
          )}

          {/* Execute button */}
          {step >= 2 && (
            <button
              disabled={!canProceed || resetting}
              onClick={() => setShowModal(true)}
              className="w-full px-6 py-3 bg-red-700 hover:bg-red-600 disabled:bg-red-900 disabled:text-red-700 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold transition-colors"
            >
              {resetting ? 'Executando reset...' : 'Executar Reset Total'}
            </button>
          )}
        </div>
      </div>

      {/* Last-chance modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#2a0a0a] border border-red-700 rounded-2xl p-6 max-w-sm w-full">
            <div className="w-12 h-12 bg-red-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-red-300 text-center mb-2">Tem certeza absoluta?</h3>
            <p className="text-red-400/70 text-sm text-center mb-6">
              Esta ação vai apagar <strong className="text-red-300">todos os dados operacionais</strong> do Softmonte. Não há como desfazer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2.5 bg-transparent border border-red-800 text-red-300 hover:bg-red-900/30 rounded-xl text-sm font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={executeReset}
                disabled={resetting}
                className="flex-1 px-4 py-2.5 bg-red-700 hover:bg-red-600 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
              >
                {resetting ? 'Resetando...' : 'Sim, resetar tudo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
