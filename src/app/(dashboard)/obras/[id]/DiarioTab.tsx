'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { FileText, Plus, Upload, FileDown } from 'lucide-react'
import RdoForm from './diario/RdoForm'
import RdoImportModal from './diario/RdoImportModal'

type RdoSummary = {
  id: string
  data: string
  numero_rdo: number | null
  status: 'rascunho' | 'enviado' | 'aprovado' | string
  formato: string | null
  horas_trabalhadas: number | null
  engenheiro_resp: string | null
}

const STATUS_BADGE: Record<string, string> = {
  rascunho: 'bg-gray-100 text-gray-600',
  enviado: 'bg-blue-100 text-blue-700',
  aprovado: 'bg-green-100 text-green-700',
}

const STATUS_LABEL: Record<string, string> = {
  rascunho: 'Rascunho',
  enviado: 'Enviado',
  aprovado: 'Aprovado',
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00').toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export default function DiarioTab({ obraId }: { obraId: string }) {
  const supabase = createClient()
  const toast = useToast()

  const [registros, setRegistros] = useState<RdoSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [counts, setCounts] = useState<Record<string, { ef: number; hh: number; cli: number }>>({})

  const fetchRegistros = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('diario_obra')
      .select('id, data, numero_rdo, status, formato, horas_trabalhadas, engenheiro_resp')
      .eq('obra_id', obraId)
      .order('data', { ascending: false })
    if (error) toast.error('Erro ao carregar diário', error.message)
    const rows = (data ?? []) as RdoSummary[]
    setRegistros(rows)

    // Agrega efetivo/clima por RDO
    if (rows.length > 0) {
      const ids = rows.map(r => r.id)
      const [{ data: efs }, { data: cls }] = await Promise.all([
        supabase.from('diario_efetivo').select('diario_id, quantidade, horas_trabalhadas').in('diario_id', ids),
        supabase.from('diario_clima').select('diario_id, condicao').in('diario_id', ids),
      ])
      const agg: Record<string, { ef: number; hh: number; cli: number }> = {}
      ;(efs ?? []).forEach((e: any) => {
        agg[e.diario_id] = agg[e.diario_id] || { ef: 0, hh: 0, cli: 0 }
        agg[e.diario_id].ef += Number(e.quantidade ?? 0)
        agg[e.diario_id].hh += Number(e.horas_trabalhadas ?? 0) * Number(e.quantidade ?? 1)
      })
      ;(cls ?? []).forEach((c: any) => {
        agg[c.diario_id] = agg[c.diario_id] || { ef: 0, hh: 0, cli: 0 }
        if (c.condicao === 'chuvoso' || c.condicao === 'impraticavel' || c.condicao === 'restrito') {
          agg[c.diario_id].cli++
        }
      })
      setCounts(agg)
    }
    setLoading(false)
  }, [obraId, supabase, toast])

  useEffect(() => { fetchRegistros() }, [fetchRegistros])

  const openNew = () => { setEditingId(null); setShowForm(true) }
  const openEdit = (id: string) => { setEditingId(id); setShowForm(true) }

  if (showForm) {
    return (
      <RdoForm
        obraId={obraId}
        rdoId={editingId}
        onClose={() => { setShowForm(false); setEditingId(null); fetchRegistros() }}
      />
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <h2 className="text-sm font-semibold text-gray-700">Diário de Obra (RDO)</h2>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)}
            className="px-3 py-2 border border-brand text-brand text-xs font-semibold rounded-lg hover:bg-brand/5 flex items-center gap-1.5">
            <Upload className="w-3.5 h-3.5" /> Importar Excel
          </button>
          <button onClick={openNew}
            className="px-3 py-2 bg-brand text-white text-xs font-semibold rounded-lg hover:bg-brand/90 flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Novo RDO
          </button>
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="text-sm text-gray-400 py-8 text-center">Carregando...</div>
      ) : registros.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-10 text-center">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-700">Nenhum RDO registrado</p>
          <p className="text-xs text-gray-500 mt-1">Registre o dia-a-dia da obra ou importe um Excel existente.</p>
          <div className="flex gap-2 justify-center mt-4">
            <button onClick={openNew} className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand/90">
              + Novo RDO
            </button>
            <button onClick={() => setShowImport(true)} className="px-4 py-2 border border-brand text-brand text-sm font-medium rounded-lg hover:bg-brand/5">
              Importar Excel
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Data', 'Nº RDO', 'Efetivo', 'HH Total', 'Clima', 'Formato', 'Status', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {registros.map(r => {
                const c = counts[r.id] ?? { ef: 0, hh: 0, cli: 0 }
                return (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/60 cursor-pointer" onClick={() => openEdit(r.id)}>
                    <td className="px-4 py-3 font-medium">{fmtDate(r.data)}</td>
                    <td className="px-4 py-3 text-gray-600">#{r.numero_rdo ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{c.ef || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{c.hh > 0 ? c.hh.toFixed(1) + 'h' : '—'}</td>
                    <td className="px-4 py-3 text-xs">
                      {c.cli > 0 ? <span className="text-amber-700">⚠ {c.cli} faixas</span> : <span className="text-green-700">OK</span>}
                    </td>
                    <td className="px-4 py-3 text-[10px] uppercase text-gray-400">{r.formato ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${STATUS_BADGE[r.status] ?? 'bg-gray-100'}`}>
                        {STATUS_LABEL[r.status] ?? r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button className="text-[11px] text-brand hover:underline">Abrir →</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showImport && (
        <RdoImportModal
          obraId={obraId}
          onClose={() => setShowImport(false)}
          onImported={() => { setShowImport(false); fetchRegistros() }}
        />
      )}
    </div>
  )
}
