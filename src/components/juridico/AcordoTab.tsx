'use client'
import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { confirmDialog } from '@/components/ui/ConfirmDialog'
import { Plus, X, CheckCircle2, Clock, AlertCircle } from 'lucide-react'

type Acordo = {
  id: string
  processo_id: string
  valor_total: number
  numero_parcelas: number
  primeira_parcela: string
  intervalo_dias: number
  status: string
  parcela_grupo_id: string | null
  observacoes: string | null
  created_at: string
}

type Parcela = {
  id: string
  parcela_numero: number
  parcela_total: number
  valor: number
  data_vencimento: string
  status: string
  data_pagamento: string | null
}

const STATUS_BADGE: Record<string, string> = {
  proposta: 'bg-blue-100 text-blue-700',
  homologado: 'bg-emerald-100 text-emerald-700',
  inadimplente: 'bg-red-100 text-red-700',
  quitado: 'bg-green-100 text-green-700',
}

export default function AcordoTab({ processo_id }: { processo_id: string }) {
  const supabase = createClient()
  const toast = useToast()
  const [acordo, setAcordo] = useState<Acordo | null>(null)
  const [parcelas, setParcelas] = useState<Parcela[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    valor_total: '',
    numero_parcelas: '1',
    primeira_parcela: '',
    intervalo_dias: '30',
    observacoes: '',
  })

  async function fetchData() {
    const { data: acordoData } = await supabase
      .from('processo_acordos')
      .select('*')
      .eq('processo_id', processo_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    setAcordo(acordoData)

    if (acordoData?.parcela_grupo_id) {
      const { data: parcelasData } = await supabase
        .from('financeiro_lancamentos')
        .select('id, parcela_numero, parcela_total, valor, data_vencimento, status, data_pagamento')
        .eq('parcela_grupo_id', acordoData.parcela_grupo_id)
        .order('parcela_numero')
      setParcelas((parcelasData as Parcela[]) ?? [])
    }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [processo_id])

  const kpis = useMemo(() => {
    const totalPago = parcelas.filter(p => p.status === 'pago').reduce((s, p) => s + Number(p.valor), 0)
    const totalPendente = parcelas.filter(p => p.status !== 'pago').reduce((s, p) => s + Number(p.valor), 0)
    const prox = parcelas.find(p => p.status !== 'pago')
    return { totalPago, totalPendente, proximoVencimento: prox?.data_vencimento }
  }, [parcelas])

  const previewParcelas = useMemo(() => {
    const n = Number(form.numero_parcelas) || 1
    const total = Number(form.valor_total) || 0
    const intervalo = Number(form.intervalo_dias) || 30
    if (!form.primeira_parcela || !total) return []
    const valorParcela = Math.floor((total * 100) / n) / 100
    const resto = Number((total - valorParcela * n).toFixed(2))
    const base = new Date(form.primeira_parcela + 'T12:00:00')
    return Array.from({ length: n }, (_, i) => {
      const d = new Date(base)
      d.setDate(base.getDate() + i * intervalo)
      return {
        numero: i + 1,
        data: d.toISOString().split('T')[0],
        valor: i === 0 ? valorParcela + resto : valorParcela,
      }
    })
  }, [form])

  async function handleSave() {
    setSaving(true)
    const { error } = await supabase.from('processo_acordos').insert({
      processo_id,
      valor_total: Number(form.valor_total),
      numero_parcelas: Number(form.numero_parcelas),
      primeira_parcela: form.primeira_parcela,
      intervalo_dias: Number(form.intervalo_dias),
      observacoes: form.observacoes || null,
      status: 'proposta',
    })
    setSaving(false)
    if (error) {
      toast.error('Erro ao registrar acordo')
      return
    }
    toast.success('Proposta de acordo registrada')
    setShowModal(false)
    setForm({ valor_total: '', numero_parcelas: '1', primeira_parcela: '', intervalo_dias: '30', observacoes: '' })
    fetchData()
  }

  async function handleHomologar() {
    if (!acordo) return
    const ok = await confirmDialog({
      title: 'Homologar acordo',
      message: 'Ao homologar, as parcelas financeiras serão geradas automaticamente. Esta ação não pode ser desfeita.',
      confirmLabel: 'Homologar',
      variant: 'warning',
      requireTyping: 'HOMOLOGAR',
    })
    if (!ok) return

    const { error } = await supabase
      .from('processo_acordos')
      .update({ status: 'homologado' })
      .eq('id', acordo.id)
    if (error) {
      toast.error('Erro ao homologar acordo')
      return
    }

    // Generate parcelas via API
    const res = await fetch('/api/juridico/gerar-parcelas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acordo_id: acordo.id }),
    })
    if (!res.ok) {
      toast.error('Erro ao gerar parcelas')
      return
    }
    toast.success('Acordo homologado e parcelas geradas')
    fetchData()
  }

  if (loading) return <div className="animate-pulse h-32 bg-gray-100 rounded-lg" />

  if (!acordo) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-sm text-gray-400">Nenhum acordo registrado</p>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
        >
          <Plus size={16} /> Registrar proposta de acordo
        </button>
        {renderModal()}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Acordo Card */}
      <div className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Acordo</h3>
          <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${STATUS_BADGE[acordo.status] || 'bg-gray-100 text-gray-600'}`}>
            {acordo.status}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <div className="text-xs text-gray-500">Valor total</div>
            <div className="text-sm font-semibold">R$ {Number(acordo.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Parcelas</div>
            <div className="text-sm font-semibold">{acordo.numero_parcelas}x</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Primeira parcela</div>
            <div className="text-sm font-semibold">{new Date(acordo.primeira_parcela + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Intervalo</div>
            <div className="text-sm font-semibold">{acordo.intervalo_dias} dias</div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {acordo.status === 'proposta' && (
            <button
              onClick={handleHomologar}
              className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700"
            >
              Homologar
            </button>
          )}
          {acordo.status !== 'proposta' && parcelas.filter(p => p.status !== 'pago').length > 0 && (
            <button
              onClick={async () => {
                const ok = await confirmDialog({
                  title: 'Gerar lançamentos financeiros?',
                  message: `Criar lançamentos para as ${parcelas.filter(p => p.status !== 'pago').length} parcelas em aberto deste acordo?`,
                  confirmLabel: 'Gerar',
                  variant: 'info',
                })
                if (!ok) return
                const { data, error } = await supabase.rpc('materializar_lancamentos_acordo', {
                  p_processo_id: processo_id,
                  p_valor_parcela: Number(acordo.valor_total) / Number(acordo.numero_parcelas),
                })
                if (error) { toast.error('Erro: ' + error.message); return }
                toast.success(`${data?.lancamentos_criados ?? 0} lançamentos criados`)
                fetchData()
              }}
              className="px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand-dark"
            >
              Gerar lançamentos financeiros
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      {parcelas.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="border rounded-lg p-3">
            <div className="flex items-center gap-1 text-xs text-gray-500"><CheckCircle2 size={12} /> Total pago</div>
            <div className="text-sm font-semibold text-emerald-700">R$ {kpis.totalPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          </div>
          <div className="border rounded-lg p-3">
            <div className="flex items-center gap-1 text-xs text-gray-500"><Clock size={12} /> Total pendente</div>
            <div className="text-sm font-semibold text-amber-700">R$ {kpis.totalPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          </div>
          <div className="border rounded-lg p-3">
            <div className="flex items-center gap-1 text-xs text-gray-500"><AlertCircle size={12} /> Próximo venc.</div>
            <div className="text-sm font-semibold">{kpis.proximoVencimento ? new Date(kpis.proximoVencimento + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}</div>
          </div>
        </div>
      )}

      {/* Parcelas Table */}
      {parcelas.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">N</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Vencimento</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Valor</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Pagamento</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {parcelas.map(p => (
                <tr key={p.id}>
                  <td className="px-3 py-2 text-gray-700">{p.parcela_numero}/{p.parcela_total}</td>
                  <td className="px-3 py-2 text-gray-700">{new Date(p.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                  <td className="px-3 py-2 text-gray-700">R$ {Number(p.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${p.status === 'pago' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {p.status === 'pago' ? 'pago' : 'pendente'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-500">{p.data_pagamento ? new Date(p.data_pagamento + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {renderModal()}
    </div>
  )

  function renderModal() {
    if (!showModal) return null
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-gray-800">Registrar proposta de acordo</h4>
            <button onClick={() => setShowModal(false)}><X size={18} className="text-gray-400" /></button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-600">Valor total (R$)</label>
              <input
                type="number"
                step="0.01"
                value={form.valor_total}
                onChange={e => setForm(f => ({ ...f, valor_total: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Parcelas</label>
                <input
                  type="number"
                  min="1"
                  value={form.numero_parcelas}
                  onChange={e => setForm(f => ({ ...f, numero_parcelas: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Intervalo (dias)</label>
                <input
                  type="number"
                  min="1"
                  value={form.intervalo_dias}
                  onChange={e => setForm(f => ({ ...f, intervalo_dias: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Primeira parcela</label>
              <input
                type="date"
                value={form.primeira_parcela}
                onChange={e => setForm(f => ({ ...f, primeira_parcela: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Observacoes</label>
              <textarea
                value={form.observacoes}
                onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                rows={2}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
              />
            </div>
          </div>

          {/* Preview */}
          {previewParcelas.length > 0 && (
            <div className="border rounded-lg p-3 bg-gray-50 space-y-1 max-h-40 overflow-y-auto">
              <div className="text-xs font-medium text-gray-500 mb-1">Preview das parcelas</div>
              {previewParcelas.map(p => (
                <div key={p.numero} className="flex justify-between text-xs text-gray-600">
                  <span>{p.numero}/{form.numero_parcelas} - {new Date(p.data + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                  <span>R$ {p.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
            <button
              onClick={handleSave}
              disabled={saving || !form.valor_total || !form.primeira_parcela}
              className="px-4 py-2 text-sm bg-brand text-white rounded-lg disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Registrar'}
            </button>
          </div>
        </div>
      </div>
    )
  }
}
