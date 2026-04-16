'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { AlertTriangle, FileText, ExternalLink } from 'lucide-react'

type Ocorrencia = {
  obra_id: string
  obra: string
  diario_id: string
  data_rdo: string
  numero_rdo: number | null
  ocorrencia_id: string
  tipo: string
  descricao: string
  responsavel: string | null
  impacto_hh: number | null
  gera_claim: boolean
  claim_valor_hh: number | null
  status_ocorrencia: string
  acao_tomada: string | null
  evidencia_url: string | null
  registrado_em: string
  registrado_por_nome: string | null
}

const TIPO_LABEL: Record<string, string> = {
  obstrucao_contratante: 'Obstrução do Contratante',
  falha_contratada: 'Falha da Contratada',
  condicao_climatica: 'Condição Climática',
  acidente: 'Acidente',
  quase_acidente: 'Quase-Acidente',
  falta_material: 'Falta de Material',
  falta_equipamento: 'Falta de Equipamento',
  outro: 'Outro',
}

const STATUS_LABEL: Record<string, string> = {
  aberta: 'Aberta',
  em_tratamento: 'Em tratamento',
  resolvida: 'Resolvida',
}

const STATUS_BADGE: Record<string, string> = {
  aberta: 'bg-red-100 text-red-700',
  em_tratamento: 'bg-amber-100 text-amber-700',
  resolvida: 'bg-green-100 text-green-700',
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00').toLocaleDateString('pt-BR')
}

export default function OcorrenciasView({ obraId, onOpenRdo }: { obraId: string; onOpenRdo: (id: string) => void }) {
  const supabase = createClient()
  const toast = useToast()
  const [items, setItems] = useState<Ocorrencia[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroTipo, setFiltroTipo] = useState<string>('')
  const [filtroStatus, setFiltroStatus] = useState<string>('')
  const [filtroDe, setFiltroDe] = useState<string>('')
  const [filtroAte, setFiltroAte] = useState<string>('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('vw_ocorrencias_obra')
      .select('*')
      .eq('obra_id', obraId)
      .order('data_rdo', { ascending: false })
    if (error) toast.error('Erro ao carregar ocorrências', error.message)
    setItems((data ?? []) as Ocorrencia[])
    setLoading(false)
  }, [obraId, supabase, toast])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    return items.filter(o => {
      if (filtroTipo && o.tipo !== filtroTipo) return false
      if (filtroStatus && o.status_ocorrencia !== filtroStatus) return false
      if (filtroDe && o.data_rdo < filtroDe) return false
      if (filtroAte && o.data_rdo > filtroAte) return false
      return true
    })
  }, [items, filtroTipo, filtroStatus, filtroDe, filtroAte])

  const stats = useMemo(() => ({
    total: filtered.length,
    abertas: filtered.filter(o => o.status_ocorrencia === 'aberta').length,
    claims: filtered.filter(o => o.gera_claim).length,
    hhClaim: filtered.reduce((s, o) => s + (o.gera_claim ? Number(o.claim_valor_hh ?? 0) : 0), 0),
    hhImpacto: filtered.reduce((s, o) => s + Number(o.impacto_hh ?? 0), 0),
  }), [filtered])

  if (loading) return <div className="text-sm text-gray-400 py-8 text-center">Carregando...</div>

  return (
    <div>
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-gray-100 border-l-4 border-l-gray-300 p-3">
          <div className="text-[10px] font-bold text-gray-400 uppercase">Total</div>
          <div className="text-xl font-bold">{stats.total}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 border-l-4 border-l-red-500 p-3">
          <div className="text-[10px] font-bold text-gray-400 uppercase">Abertas</div>
          <div className="text-xl font-bold text-red-700">{stats.abertas}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 border-l-4 border-l-amber-500 p-3">
          <div className="text-[10px] font-bold text-gray-400 uppercase">Claims</div>
          <div className="text-xl font-bold text-amber-700">{stats.claims}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 border-l-4 border-l-blue-500 p-3">
          <div className="text-[10px] font-bold text-gray-400 uppercase">HH Claim</div>
          <div className="text-xl font-bold text-blue-700">{stats.hhClaim.toFixed(1)}h</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 border-l-4 border-l-violet-500 p-3">
          <div className="text-[10px] font-bold text-gray-400 uppercase">HH Impacto</div>
          <div className="text-xl font-bold text-violet-700">{stats.hhImpacto.toFixed(1)}h</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-100 p-3 mb-4 flex flex-wrap gap-2 items-end">
        <div className="min-w-[160px]">
          <label className="block text-[10px] text-gray-500 font-semibold mb-0.5 uppercase">Tipo</label>
          <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs">
            <option value="">Todos</option>
            {Object.entries(TIPO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="min-w-[120px]">
          <label className="block text-[10px] text-gray-500 font-semibold mb-0.5 uppercase">Status</label>
          <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs">
            <option value="">Todos</option>
            {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-gray-500 font-semibold mb-0.5 uppercase">De</label>
          <input type="date" value={filtroDe} onChange={e => setFiltroDe(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs" />
        </div>
        <div>
          <label className="block text-[10px] text-gray-500 font-semibold mb-0.5 uppercase">Até</label>
          <input type="date" value={filtroAte} onChange={e => setFiltroAte(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs" />
        </div>
        {(filtroTipo || filtroStatus || filtroDe || filtroAte) && (
          <button onClick={() => { setFiltroTipo(''); setFiltroStatus(''); setFiltroDe(''); setFiltroAte('') }}
            className="text-xs text-gray-500 hover:text-brand underline">Limpar filtros</button>
        )}
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-10 text-center">
          <AlertTriangle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-700">Nenhuma ocorrência registrada</p>
          <p className="text-xs text-gray-500 mt-1">As ocorrências registradas nos RDOs aparecerão aqui.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Data', 'RDO', 'Tipo', 'Descrição', 'Responsável', 'Impacto HH', 'Claim', 'Status', ''].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => (
                <tr key={o.ocorrencia_id} className="border-b border-gray-50 hover:bg-gray-50/70">
                  <td className="px-3 py-2 whitespace-nowrap">{fmtDate(o.data_rdo)}</td>
                  <td className="px-3 py-2 font-mono text-xs">#{o.numero_rdo ?? '—'}</td>
                  <td className="px-3 py-2 text-xs">
                    <span className={`px-2 py-0.5 rounded font-semibold ${o.tipo === 'obstrucao_contratante' ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                      {TIPO_LABEL[o.tipo] ?? o.tipo}
                    </span>
                  </td>
                  <td className="px-3 py-2 max-w-xs truncate" title={o.descricao}>{o.descricao}</td>
                  <td className="px-3 py-2 text-xs text-gray-600">{o.responsavel ?? '—'}</td>
                  <td className="px-3 py-2 font-mono text-xs">{Number(o.impacto_hh ?? 0).toFixed(1)}h</td>
                  <td className="px-3 py-2 text-xs">
                    {o.gera_claim ? (
                      <span className="text-amber-700 font-semibold">⚠ {Number(o.claim_valor_hh ?? 0).toFixed(1)}h</span>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${STATUS_BADGE[o.status_ocorrencia] ?? 'bg-gray-100'}`}>
                      {STATUS_LABEL[o.status_ocorrencia] ?? o.status_ocorrencia}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => onOpenRdo(o.diario_id)} className="text-xs text-brand hover:underline flex items-center gap-0.5">
                      Ver RDO <ExternalLink className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
