'use client'
import { useState, useEffect } from 'react'
import { Zap, RefreshCw, AlertTriangle, Check, Info } from 'lucide-react'
import { useToast } from '@/components/Toast'

type ImportStatus = {
  importacao: {
    primeira_data: string | null
    ultima_data: string | null
    total_marcacoes: number
    dias_distintos: number
  }
  ultimo_sync: {
    started_at: string
    periodo_inicio: string
    periodo_fim: string
    total_batidas: number
    novas: number
    trigger: string
  } | null
}

export default function SecullumSyncPanel({ obraId }: { obraId?: string }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<ImportStatus | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(false)

  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return d.toISOString().slice(0, 10)
  })
  const [dataFim, setDataFim] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return d.toISOString().slice(0, 10)
  })
  const [loading, setLoading] = useState<'sync' | 'calc' | 'rec' | null>(null)
  const [lastResult, setLastResult] = useState<any>(null)

  const [initialFillDone, setInitialFillDone] = useState(false)

  // Carrega status quando abre o painel
  useEffect(() => {
    if (!open) return
    loadStatus(!initialFillDone)
  }, [open])

  async function loadStatus(autoFillDates = false) {
    setLoadingStatus(true)
    try {
      const r = await fetch('/api/ponto/status')
      if (r.ok) {
        const j = await r.json()
        setStatus(j)
        // Auto-preenche datas apenas na primeira abertura (não após cada sync)
        if (autoFillDates && j.importacao?.ultima_data) {
          const ultimaDate = new Date(j.importacao.ultima_data + 'T12:00:00')
          ultimaDate.setDate(ultimaDate.getDate() + 1)
          setDataInicio(ultimaDate.toISOString().slice(0, 10))
          setInitialFillDone(true)
        }
      }
    } catch { /* silencioso */ }
    finally { setLoadingStatus(false) }
  }

  // Verifica se o período selecionado sobrepõe dados já importados
  const temSobreposicao = status?.importacao?.ultima_data
    ? dataInicio <= status.importacao.ultima_data
    : false

  async function handleSincronizar() {
    setLoading('sync')
    setLastResult(null)
    const results: any = {}

    try {
      // Passo 1: Importar marcações do Secullum
      toast.warning('Passo 1/3 — Importando marcações...')
      const r1 = await fetch('/api/ponto/sync-secullum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataInicio, dataFim, trigger: 'manual' }),
      })
      const j1 = await r1.json()
      results.sync = j1
      if (!r1.ok) {
        toast.error('Erro na importação: ' + (j1.error || 'desconhecido'))
        setLastResult({ kind: 'sync', data: results, ok: false })
        return
      }

      // Passo 2: Calcular horas (efetivo diário)
      toast.warning('Passo 2/3 — Calculando horas...')
      setLoading('calc')
      const body2: any = { dataInicio, dataFim }
      if (obraId) body2.obraId = obraId
      const r2 = await fetch('/api/ponto/calcular-efetivo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body2),
      })
      const j2 = await r2.json()
      results.calc = j2
      if (!r2.ok) {
        toast.error('Erro no cálculo: ' + (j2.error || 'desconhecido'))
        setLastResult({ kind: 'all', data: results, ok: false })
        return
      }

      // Passo 3: Reconciliar cadastros
      toast.warning('Passo 3/3 — Reconciliando cadastros...')
      setLoading('rec')
      const r3 = await fetch('/api/ponto/reconciliar-funcionarios')
      const j3 = await r3.json()
      results.rec = { totais: j3.totais, so_secullum_amostra: j3.so_secullum?.slice(0, 10), so_softmonte: j3.so_softmonte }

      // Resultado final
      const novas = j1.novas ?? 0
      const dias = j2.criados_ou_atualizados ?? 0
      const match = j3.totais?.match ?? 0
      toast.success(`Sincronização completa: ${novas} marcações, ${dias} dias calculados, ${match} funcionários vinculados`)
      setLastResult({ kind: 'all', data: results, ok: true })
      loadStatus(false)
    } catch (e: any) {
      toast.error('Falha de rede: ' + (e?.message || ''))
      setLastResult({ kind: 'all', data: results, ok: false })
    } finally {
      setLoading(null)
    }
  }

  function fmtData(d: string | null): string {
    if (!d) return '—'
    return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between text-left"
        type="button"
      >
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-bold text-brand">Importação do Ponto — Secullum</h3>
          {status?.importacao?.ultima_data && !open && (
            <span className="text-[11px] text-gray-500">
              Importado até {fmtData(status.importacao.ultima_data)}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">{open ? 'Fechar' : 'Abrir'}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          {/* Status da importação */}
          {loadingStatus ? (
            <div className="text-xs text-gray-400">Carregando status...</div>
          ) : status?.importacao?.primeira_data ? (
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
              <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <div>
                <strong>Ponto importado de {fmtData(status.importacao.primeira_data)} até {fmtData(status.importacao.ultima_data)}</strong>
                <span className="text-blue-700"> — {status.importacao.total_marcacoes.toLocaleString('pt-BR')} marcações em {status.importacao.dias_distintos} dias</span>
                {status.ultimo_sync && (
                  <div className="text-[11px] text-blue-600 mt-0.5">
                    Último sync: {new Date(status.ultimo_sync.started_at).toLocaleString('pt-BR')} ({status.ultimo_sync.trigger})
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              <strong>Nenhum ponto importado ainda.</strong> Selecione o período e clique em "Importar ponto".
            </div>
          )}

          {/* Seletor de período */}
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">Data início</label>
              <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">Data fim</label>
              <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm" />
            </div>
          </div>

          {/* Aviso de sobreposição */}
          {temSobreposicao && (
            <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>
                O período selecionado inclui dias já importados (até {fmtData(status!.importacao.ultima_data)}).
                Marcações existentes serão <strong>atualizadas</strong> com os dados mais recentes da Secullum.
              </span>
            </div>
          )}

          {/* Botão único */}
          <button type="button" onClick={handleSincronizar} disabled={loading !== null}
            className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-bold hover:bg-brand-dark disabled:opacity-50 flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading === 'sync' ? 'Importando marcações...' : loading === 'calc' ? 'Calculando horas...' : loading === 'rec' ? 'Reconciliando...' : 'Sincronizar'}
          </button>

          <p className="text-[11px] text-gray-500">
            Importa marcações da Secullum, calcula horas trabalhadas e reconcilia cadastros em um único passo.
          </p>

          {lastResult && (
            <div className={`p-3 rounded-lg border text-xs ${lastResult.ok ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
              <div className="flex items-center gap-1.5 font-bold mb-1">
                {lastResult.ok ? <Check className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                {lastResult.kind === 'all' ? 'Resultado da sincronização' : lastResult.kind === 'sync' ? 'Resultado da importação' : lastResult.kind === 'calc' ? 'Resultado do cálculo' : 'Reconciliação'}
              </div>
              <pre className="whitespace-pre-wrap text-[11px] leading-tight max-h-60 overflow-y-auto">
                {JSON.stringify(lastResult.data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
