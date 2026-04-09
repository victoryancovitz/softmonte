'use client'
import { useState, useEffect } from 'react'
import { Zap, RefreshCw, Users, Calculator, AlertTriangle, Check, Info } from 'lucide-react'
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

  async function handleSync() {
    setLoading('sync')
    setLastResult(null)
    try {
      const r = await fetch('/api/ponto/sync-secullum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataInicio, dataFim, trigger: 'manual' }),
      })
      const j = await r.json()
      setLastResult({ kind: 'sync', data: j, ok: r.ok })
      if (r.ok) {
        toast.success(`Sync ok: ${j.novas ?? 0} marcações novas`)
        loadStatus(false) // atualiza status sem resetar datas do usuário
      } else {
        toast.error('Erro: ' + (j.error || 'desconhecido'))
      }
    } catch (e: any) {
      toast.error('Falha de rede: ' + (e?.message || ''))
    } finally {
      setLoading(null)
    }
  }

  async function handleCalcular() {
    setLoading('calc')
    setLastResult(null)
    try {
      const body: any = { dataInicio, dataFim }
      if (obraId) body.obraId = obraId
      const r = await fetch('/api/ponto/calcular-efetivo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const j = await r.json()
      setLastResult({ kind: 'calc', data: j, ok: r.ok })
      if (r.ok) toast.success(`Horas calculadas: ${j.criados_ou_atualizados ?? 0} dia(s)`)
      else toast.error('Erro: ' + (j.error || 'desconhecido'))
    } catch (e: any) {
      toast.error('Falha de rede: ' + (e?.message || ''))
    } finally {
      setLoading(null)
    }
  }

  async function handleReconciliar() {
    setLoading('rec')
    setLastResult(null)
    try {
      const r = await fetch('/api/ponto/reconciliar-funcionarios')
      const j = await r.json()
      setLastResult({ kind: 'rec', data: { totais: j.totais, so_secullum_amostra: j.so_secullum?.slice(0, 10), so_softmonte: j.so_softmonte }, ok: r.ok })
      if (r.ok) toast.success(`${j.totais?.match ?? 0} funcionários vinculados em ambos os sistemas`)
      else toast.error('Erro: ' + (j.error || 'desconhecido'))
    } catch (e: any) {
      toast.error('Falha de rede: ' + (e?.message || ''))
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

          {/* Botões na ordem correta do fluxo */}
          <div className="flex gap-2 flex-wrap">
            <button type="button" onClick={handleSync} disabled={loading !== null}
              className="px-3 py-1.5 bg-brand text-white rounded-lg text-xs font-bold hover:bg-brand-dark disabled:opacity-50 flex items-center gap-1.5">
              <RefreshCw className={`w-3.5 h-3.5 ${loading === 'sync' ? 'animate-spin' : ''}`} />
              {loading === 'sync' ? 'Importando...' : '1. Importar ponto'}
            </button>
            <button type="button" onClick={handleCalcular} disabled={loading !== null}
              className="px-3 py-1.5 border border-brand text-brand rounded-lg text-xs font-bold hover:bg-brand/5 disabled:opacity-50 flex items-center gap-1.5">
              <Calculator className={`w-3.5 h-3.5 ${loading === 'calc' ? 'animate-spin' : ''}`} />
              {loading === 'calc' ? 'Calculando...' : '2. Calcular horas'}
            </button>
            <button type="button" onClick={handleReconciliar} disabled={loading !== null}
              className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1.5">
              <Users className={`w-3.5 h-3.5 ${loading === 'rec' ? 'animate-spin' : ''}`} />
              Reconciliar cadastros
            </button>
          </div>

          <p className="text-[11px] text-gray-500">
            <strong>Fluxo:</strong> (1) importa marcações brutas da Secullum, (2) calcula horas trabalhadas aplicando a escala de cada obra.
            Ponto é do colaborador — a obra do dia é definida pela alocação vigente ou atribuição manual no efetivo.
          </p>

          {lastResult && (
            <div className={`p-3 rounded-lg border text-xs ${lastResult.ok ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
              <div className="flex items-center gap-1.5 font-bold mb-1">
                {lastResult.ok ? <Check className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                {lastResult.kind === 'sync' && 'Resultado da importação'}
                {lastResult.kind === 'calc' && 'Resultado do cálculo de horas'}
                {lastResult.kind === 'rec' && 'Reconciliação de cadastros'}
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
