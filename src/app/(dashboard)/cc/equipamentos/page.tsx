'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import BackButton from '@/components/BackButton'
import { useToast } from '@/components/Toast'
import SearchInput from '@/components/SearchInput'
import EmptyState from '@/components/ui/EmptyState'
import { Package, ArrowRightLeft, X } from 'lucide-react'
import { fmt } from '@/lib/cores'

/* ═══ Types ═══ */

interface Equipamento {
  id: string
  patrimonio: string | null
  nome: string
  centro_custo_id: string | null
  cc_nome: string | null
  cc_codigo: string | null
  alocado_desde: string | null
  custo_dia: number | null
  status: string | null
}

interface CC {
  id: string
  codigo: string
  nome: string
}

const STATUS_BADGE: Record<string, string> = {
  em_uso:       'bg-blue-100 text-blue-700',
  disponivel:   'bg-green-100 text-green-700',
  manutencao:   'bg-amber-100 text-amber-700',
  inativo:      'bg-gray-100 text-gray-500',
}

const STATUS_LABEL: Record<string, string> = {
  em_uso: 'Em uso',
  disponivel: 'Disponível',
  manutencao: 'Manutenção',
  inativo: 'Inativo',
}

/* ═══ Component ═══ */

export default function EquipamentosPage() {
  const supabase = createClient()
  const toast = useToast()

  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([])
  const [ccList, setCcList] = useState<CC[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Transfer form
  const [selectedEquip, setSelectedEquip] = useState<Equipamento | null>(null)
  const [ccDestino, setCcDestino] = useState('')
  const [tipoTransf, setTipoTransf] = useState<'definitiva' | 'temporaria'>('definitiva')
  const [dtInicio, setDtInicio] = useState('')
  const [dtFim, setDtFim] = useState('')
  const [custoDia, setCustoDia] = useState('')
  const [obs, setObs] = useState('')

  async function load() {
    setLoading(true)
    try {
      // Tenta a view primeiro; se falhar, busca da tabela ativos_fixos
      const { data: vw, error: vwErr } = await supabase
        .from('vw_cc_equipamentos')
        .select('*')

      if (!vwErr && vw) {
        setEquipamentos(vw as Equipamento[])
      } else {
        // Fallback: ativos_fixos JOIN centros_custo
        const { data: af } = await supabase
          .from('ativos_fixos')
          .select('id, patrimonio, nome, centro_custo_id, status, custo_dia, alocado_desde, centros_custo(codigo, nome)')
          .is('deleted_at', null)
          .order('nome')

        const mapped: Equipamento[] = (af ?? []).map((r: any) => ({
          id: r.id,
          patrimonio: r.patrimonio,
          nome: r.nome,
          centro_custo_id: r.centro_custo_id,
          cc_nome: r.centros_custo?.nome ?? null,
          cc_codigo: r.centros_custo?.codigo ?? null,
          alocado_desde: r.alocado_desde,
          custo_dia: r.custo_dia,
          status: r.status,
        }))
        setEquipamentos(mapped)
      }

      const { data: ccs } = await supabase
        .from('centros_custo')
        .select('id, codigo, nome')
        .is('deleted_at', null)
        .eq('ativo', true)
        .order('codigo')
      setCcList(ccs ?? [])
    } catch {
      // silently handle
    }
    setLoading(false)
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    if (!busca) return equipamentos
    const q = busca.toLowerCase()
    return equipamentos.filter(e =>
      e.nome.toLowerCase().includes(q) ||
      (e.patrimonio ?? '').toLowerCase().includes(q) ||
      (e.cc_nome ?? '').toLowerCase().includes(q)
    )
  }, [equipamentos, busca])

  function openTransfer(eq: Equipamento) {
    setSelectedEquip(eq)
    setCcDestino('')
    setTipoTransf('definitiva')
    setDtInicio(new Date().toISOString().slice(0, 10))
    setDtFim('')
    setCustoDia(eq.custo_dia?.toString() ?? '')
    setObs('')
    setModalOpen(true)
  }

  function resetModal() {
    setSelectedEquip(null)
    setCcDestino('')
    setDtInicio('')
    setDtFim('')
    setCustoDia('')
    setObs('')
    setModalOpen(false)
  }

  async function handleTransfer() {
    if (!selectedEquip || !ccDestino || !dtInicio) {
      toast.warning('Preencha CC de destino e data de início.')
      return
    }
    setSaving(true)
    try {
      // INSERT alocação
      const { error: e1 } = await supabase.from('cc_equipamentos_alocacao').insert({
        ativo_id: selectedEquip.id,
        centro_custo_id: ccDestino,
        tipo: tipoTransf,
        data_inicio: dtInicio,
        data_fim: dtFim || null,
        custo_dia: custoDia ? parseFloat(custoDia) : null,
        observacao: obs.trim() || null,
      })
      if (e1) throw e1

      // UPDATE centro_custo_id no ativo
      const { error: e2 } = await supabase
        .from('ativos_fixos')
        .update({ centro_custo_id: ccDestino })
        .eq('id', selectedEquip.id)
      if (e2) throw e2

      toast.success('Transferência realizada com sucesso.')
      resetModal()
      load()
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao transferir equipamento.')
    } finally {
      setSaving(false)
    }
  }

  function formatDate(d: string | null): string {
    if (!d) return '—'
    return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <BackButton fallback="/cc" />
          <div>
            <h1 className="text-xl font-bold font-display text-brand">Equipamentos</h1>
            <p className="text-sm text-gray-500">{equipamentos.length} equipamento{equipamentos.length !== 1 ? 's' : ''} cadastrado{equipamentos.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      {/* Busca */}
      <div className="mb-4 max-w-sm">
        <SearchInput value={busca} onChange={setBusca} placeholder="Buscar por nome, patrimônio ou CC..." />
      </div>

      {/* Tabela */}
      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">Carregando...</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          titulo="Nenhum equipamento encontrado"
          descricao="Equipamentos cadastrados aparecerão aqui com sua alocação."
          icone={<Package className="w-12 h-12" />}
        />
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="px-4 py-3 font-medium">Patrimônio</th>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">CC Atual</th>
                <th className="px-4 py-3 font-medium">Alocado desde</th>
                <th className="px-4 py-3 font-medium text-right">Custo/dia</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(eq => (
                <tr key={eq.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{eq.patrimonio ?? '—'}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{eq.nome}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {eq.cc_codigo && <span className="text-xs font-mono text-gray-400 mr-1">{eq.cc_codigo}</span>}
                    {eq.cc_nome ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(eq.alocado_desde)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                    {eq.custo_dia ? fmt(eq.custo_dia) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {eq.status ? (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[eq.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {STATUS_LABEL[eq.status] ?? eq.status}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openTransfer(eq)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-brand hover:bg-brand/5 transition-colors"
                      title="Transferir"
                    >
                      <ArrowRightLeft className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Transferência */}
      {modalOpen && selectedEquip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-800">Transferir Equipamento</h2>
              <button onClick={resetModal} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Ativo (readonly) */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Ativo</label>
                <input
                  readOnly
                  value={`${selectedEquip.patrimonio ?? ''} — ${selectedEquip.nome}`}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 text-gray-500"
                />
              </div>

              {/* CC Destino */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Centro de Custo de destino *</label>
                <select
                  value={ccDestino}
                  onChange={e => setCcDestino(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-white"
                >
                  <option value="">Selecione...</option>
                  {ccList.map(c => (
                    <option key={c.id} value={c.id}>{c.codigo} — {c.nome}</option>
                  ))}
                </select>
              </div>

              {/* Tipo */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo de transferência</label>
                <select
                  value={tipoTransf}
                  onChange={e => setTipoTransf(e.target.value as 'definitiva' | 'temporaria')}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-white"
                >
                  <option value="definitiva">Definitiva</option>
                  <option value="temporaria">Temporária</option>
                </select>
              </div>

              {/* Data início */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Data de início *</label>
                <input
                  type="date"
                  value={dtInicio}
                  onChange={e => setDtInicio(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>

              {/* Data fim */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Data de fim (opcional)</label>
                <input
                  type="date"
                  value={dtFim}
                  onChange={e => setDtFim(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>

              {/* Custo/dia */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Custo por dia (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={custoDia}
                  onChange={e => setCustoDia(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder="0,00"
                />
              </div>

              {/* Observação */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Observação</label>
                <textarea
                  value={obs}
                  onChange={e => setObs(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none"
                  placeholder="Motivo da transferência..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 p-5 border-t border-gray-100">
              <button
                onClick={resetModal}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleTransfer}
                disabled={saving}
                className="px-5 py-2 bg-brand text-white rounded-xl text-sm font-semibold hover:bg-brand-dark disabled:opacity-50"
              >
                {saving ? 'Transferindo...' : 'Confirmar Transferência'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
