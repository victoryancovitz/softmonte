'use client'
import { useState } from 'react'
import { Zap, RefreshCw, Users, Calculator, AlertTriangle, Check } from 'lucide-react'
import { useToast } from '@/components/Toast'

/**
 * Painel de controle manual da integração Secullum.
 * Exibido em /ponto pra admin/rh. Oferece 3 ações:
 *  1. Sincronizar batidas do período (POST /api/ponto/sync-secullum)
 *  2. Calcular efetivo a partir das marcações (POST /api/ponto/calcular-efetivo)
 *  3. Reconciliar cadastros (GET /api/ponto/reconciliar-funcionarios)
 */
export default function SecullumSyncPanel({ obraId }: { obraId?: string }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
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
      if (r.ok) toast.success(`Sync ok: ${j.novas ?? 0} batidas novas`)
      else toast.error('Erro: ' + (j.error || 'desconhecido'))
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
      if (r.ok) toast.success(`Efetivo: ${j.criados_ou_atualizados ?? 0} dia(s) processado(s)`)
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
      setLastResult({ kind: 'rec', data: j, ok: r.ok })
      if (r.ok) toast.success(`${j.totais?.match ?? 0} funcionários em ambos os sistemas`)
      else toast.error('Erro: ' + (j.error || 'desconhecido'))
    } catch (e: any) {
      toast.error('Falha de rede: ' + (e?.message || ''))
    } finally {
      setLoading(null)
    }
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
          <h3 className="text-sm font-bold text-brand">Secullum Ponto Web — Sincronização</h3>
          <span className="text-[11px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">Beta</span>
        </div>
        <span className="text-xs text-gray-400">{open ? 'Fechar' : 'Abrir'}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-3">
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
            <div className="flex gap-2">
              <button type="button" onClick={handleSync} disabled={loading !== null}
                className="px-3 py-1.5 bg-brand text-white rounded-lg text-xs font-bold hover:bg-brand-dark disabled:opacity-50 flex items-center gap-1.5">
                <RefreshCw className={`w-3.5 h-3.5 ${loading === 'sync' ? 'animate-spin' : ''}`} />
                {loading === 'sync' ? 'Sincronizando...' : '1. Sincronizar batidas'}
              </button>
              <button type="button" onClick={handleCalcular} disabled={loading !== null}
                className="px-3 py-1.5 border border-brand text-brand rounded-lg text-xs font-bold hover:bg-brand/5 disabled:opacity-50 flex items-center gap-1.5">
                <Calculator className={`w-3.5 h-3.5 ${loading === 'calc' ? 'animate-spin' : ''}`} />
                {loading === 'calc' ? 'Calculando...' : '2. Calcular efetivo'}
              </button>
              <button type="button" onClick={handleReconciliar} disabled={loading !== null}
                className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1.5">
                <Users className={`w-3.5 h-3.5 ${loading === 'rec' ? 'animate-spin' : ''}`} />
                Reconciliar cadastros
              </button>
            </div>
          </div>

          <p className="text-[11px] text-gray-500">
            <strong>Fluxo:</strong> (1) traz batidas brutas da Secullum pro Softmonte, (2) cruza com as alocações do período e a escala de cada obra pra gerar o efetivo diário. Reconciliar cadastros mostra quem existe em um sistema mas não no outro.
          </p>

          {lastResult && (
            <div className={`p-3 rounded-lg border text-xs ${lastResult.ok ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
              <div className="flex items-center gap-1.5 font-bold mb-1">
                {lastResult.ok ? <Check className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                {lastResult.kind === 'sync' && 'Resultado da sincronização'}
                {lastResult.kind === 'calc' && 'Resultado do cálculo'}
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
