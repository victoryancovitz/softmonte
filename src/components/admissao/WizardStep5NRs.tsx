'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import {
  ChevronDown, ChevronRight, Check, Upload, Shield, AlertTriangle,
} from 'lucide-react'

/* ─── Types ─── */

interface NR {
  id: string
  nr_codigo: string
  nr_nome: string
  requer_anuencia: boolean
  ordem: number
}

interface NRFormData {
  data_conclusao: string
  data_vencimento: string
  carga_horaria: string
  entidade: string
  certificado_url: string | null
  anuencia_url: string | null
}

interface Props {
  funcionario: any
  workflowId: string
  onComplete: () => void
}

const inputCls = 'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand'

function emptyForm(): NRFormData {
  return { data_conclusao: '', data_vencimento: '', carga_horaria: '', entidade: '', certificado_url: null, anuencia_url: null }
}

function isFilled(d: NRFormData, requerAnuencia: boolean): boolean {
  if (!d.data_conclusao || !d.data_vencimento) return false
  if (requerAnuencia && !d.anuencia_url) return false
  return true
}

export default function WizardStep5NRs({ funcionario, workflowId, onComplete }: Props) {
  const supabase = createClient()
  const toast = useToast()

  const [nrs, setNrs] = useState<NR[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [nrData, setNrData] = useState<Record<string, NRFormData>>({})
  const [uploading, setUploading] = useState<Record<string, boolean>>({})

  useEffect(() => {
    loadNRs()
  }, [funcionario.funcao_id])

  async function loadNRs() {
    setLoading(true)
    const { data } = await supabase
      .from('nr_obrigatorias_funcao')
      .select('*')
      .or(`funcao_id.eq.${funcionario.funcao_id},obrigatoria_todas.eq.true`)
      .eq('ativo', true)
      .order('ordem')

    const list: NR[] = (data ?? []).map((r: any) => ({
      id: r.id,
      nr_codigo: r.nr_codigo || '',
      nr_nome: r.nr_nome || '',
      requer_anuencia: !!r.requer_anuencia,
      ordem: r.ordem ?? 0,
    }))
    setNrs(list)

    // Init form data for each NR
    const init: Record<string, NRFormData> = {}
    list.forEach(nr => { init[nr.id] = emptyForm() })
    setNrData(init)
    setLoading(false)
  }

  function updateField(nrId: string, field: keyof NRFormData, value: string | null) {
    setNrData(prev => {
      const curr = prev[nrId] ?? emptyForm()
      const next = { ...curr, [field]: value }
      // Auto-fill vencimento = conclusao + 1 year
      if (field === 'data_conclusao' && value) {
        try {
          const d = new Date(value + 'T12:00:00')
          d.setFullYear(d.getFullYear() + 1)
          next.data_vencimento = d.toISOString().split('T')[0]
        } catch { /* ignore */ }
      }
      return { ...prev, [nrId]: next }
    })
  }

  async function handleUpload(nrId: string, field: 'certificado_url' | 'anuencia_url', file: File) {
    setUploading(prev => ({ ...prev, [`${nrId}_${field}`]: true }))
    try {
      const ext = file.name.split('.').pop() || 'pdf'
      const path = `${funcionario.id}/nrs/${nrId}_${field}_${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('documentos').upload(path, file, { upsert: true })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('documentos').getPublicUrl(path)
      updateField(nrId, field, publicUrl)
      toast.success('Arquivo enviado')
    } catch {
      toast.error('Erro ao enviar arquivo')
    } finally {
      setUploading(prev => ({ ...prev, [`${nrId}_${field}`]: false }))
    }
  }

  const filledCount = nrs.filter(nr => {
    const d = nrData[nr.id]
    return d && isFilled(d, nr.requer_anuencia)
  }).length
  const totalCount = nrs.length
  const allFilled = totalCount > 0 && filledCount === totalCount
  const pct = totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 0

  async function handleSave() {
    if (!allFilled) {
      toast.warning('Preencha todas as NRs obrigatorias antes de continuar.')
      return
    }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const email = user?.email ?? 'sistema'

      for (const nr of nrs) {
        const d = nrData[nr.id]
        if (!d) continue

        // Insert treinamento
        await supabase.from('treinamentos_funcionarios').insert({
          funcionario_id: funcionario.id,
          nr_codigo: nr.nr_codigo,
          nr_nome: nr.nr_nome,
          data_conclusao: d.data_conclusao,
          data_vencimento: d.data_vencimento,
          carga_horaria: d.carga_horaria ? Number(d.carga_horaria) : null,
          entidade: d.entidade || null,
          certificado_url: d.certificado_url,
          anuencia_url: d.anuencia_url,
          workflow_id: workflowId,
          created_by: user?.id,
        })

        // Insert documento for certificado
        if (d.certificado_url) {
          await supabase.from('documentos').insert({
            funcionario_id: funcionario.id,
            tipo: 'certificado_nr',
            descricao: `Certificado ${nr.nr_codigo} - ${nr.nr_nome}`,
            url: d.certificado_url,
            created_by: user?.id,
          })
        }
        // Insert documento for anuencia
        if (d.anuencia_url) {
          await supabase.from('documentos').insert({
            funcionario_id: funcionario.id,
            tipo: 'anuencia_nr',
            descricao: `Anuencia ${nr.nr_codigo} - ${nr.nr_nome}`,
            url: d.anuencia_url,
            created_by: user?.id,
          })
        }
      }

      // Update workflow
      await supabase.from('admissoes_workflow').update({
        etapa_nr_obrigatorias: {
          ok: true,
          data: new Date().toISOString().split('T')[0],
          por: email,
          total: totalCount,
        },
        updated_at: new Date().toISOString(),
      }).eq('id', workflowId)

      toast.success('Treinamentos NR registrados!')
      onComplete()
    } catch {
      toast.error('Erro ao salvar treinamentos NR')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="py-12 text-center text-sm text-gray-400">Carregando NRs obrigatorias...</div>
  }

  if (nrs.length === 0) {
    return (
      <div className="space-y-4">
        <div className="p-6 rounded-xl bg-gray-50 border border-gray-200 text-center">
          <Shield className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Nenhuma NR obrigatoria encontrada para esta funcao.</p>
        </div>
        <button
          onClick={async () => {
            setSaving(true)
            const { data: { user } } = await supabase.auth.getUser()
            await supabase.from('admissoes_workflow').update({
              etapa_nr_obrigatorias: { ok: true, data: new Date().toISOString().split('T')[0], por: user?.email ?? 'sistema', total: 0 },
              updated_at: new Date().toISOString(),
            }).eq('id', workflowId)
            setSaving(false)
            onComplete()
          }}
          disabled={saving}
          className="w-full px-5 py-2.5 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50"
        >
          {saving ? 'Salvando...' : 'Pular etapa e continuar'}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-semibold text-gray-700">{filledCount} de {totalCount} NRs preenchidas</span>
            <span className="text-xs font-bold text-gray-500">{pct}%</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${allFilled ? 'bg-green-500' : 'bg-brand'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* NR List */}
      <div className="space-y-2">
        {nrs.map(nr => {
          const d = nrData[nr.id] ?? emptyForm()
          const filled = isFilled(d, nr.requer_anuencia)
          const isOpen = expanded === nr.id

          return (
            <div key={nr.id} className={`rounded-xl border ${filled ? 'border-green-200 bg-green-50/30' : 'border-gray-200 bg-white'} overflow-hidden`}>
              {/* Row header */}
              <button
                onClick={() => setExpanded(isOpen ? null : nr.id)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                  <div className="text-left">
                    <span className="text-sm font-semibold text-gray-800">{nr.nr_codigo}</span>
                    <span className="text-sm text-gray-600 ml-2">{nr.nr_nome}</span>
                  </div>
                  {nr.requer_anuencia && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 uppercase tracking-wide">
                      Carta de Anuencia obrigatoria
                    </span>
                  )}
                </div>
                <span className={`flex items-center gap-1 text-xs font-medium ${filled ? 'text-green-600' : 'text-gray-400'}`}>
                  {filled ? <><Check className="w-3.5 h-3.5" /> Preenchida</> : 'Pendente'}
                </span>
              </button>

              {/* Expandable form */}
              {isOpen && (
                <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Data de conclusao *</label>
                      <input
                        type="date"
                        value={d.data_conclusao}
                        onChange={e => updateField(nr.id, 'data_conclusao', e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Data de vencimento *</label>
                      <input
                        type="date"
                        value={d.data_vencimento}
                        onChange={e => updateField(nr.id, 'data_vencimento', e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Carga horaria (horas)</label>
                      <input
                        type="number"
                        min={0}
                        value={d.carga_horaria}
                        onChange={e => updateField(nr.id, 'carga_horaria', e.target.value)}
                        className={inputCls}
                        placeholder="Ex: 8"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Entidade</label>
                      <input
                        type="text"
                        value={d.entidade}
                        onChange={e => updateField(nr.id, 'entidade', e.target.value)}
                        className={inputCls}
                        placeholder="Ex: SENAI, SEST/SENAT"
                      />
                    </div>
                  </div>

                  {/* Upload certificado */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Certificado</label>
                    {d.certificado_url ? (
                      <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">
                        <Check className="w-4 h-4" />
                        <span className="truncate flex-1">Arquivo enviado</span>
                        <button onClick={() => updateField(nr.id, 'certificado_url', null)} className="text-xs text-red-500 hover:underline">Remover</button>
                      </div>
                    ) : (
                      <label className="flex items-center gap-2 px-3 py-2.5 border border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-brand hover:bg-brand/5 transition-colors">
                        <Upload className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-500">
                          {uploading[`${nr.id}_certificado_url`] ? 'Enviando...' : 'Enviar certificado'}
                        </span>
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          className="hidden"
                          onChange={e => { if (e.target.files?.[0]) handleUpload(nr.id, 'certificado_url', e.target.files[0]) }}
                        />
                      </label>
                    )}
                  </div>

                  {/* Upload anuencia (if required) */}
                  {nr.requer_anuencia && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Carta de Anuencia *
                      </label>
                      {d.anuencia_url ? (
                        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">
                          <Check className="w-4 h-4" />
                          <span className="truncate flex-1">Arquivo enviado</span>
                          <button onClick={() => updateField(nr.id, 'anuencia_url', null)} className="text-xs text-red-500 hover:underline">Remover</button>
                        </div>
                      ) : (
                        <label className="flex items-center gap-2 px-3 py-2.5 border border-dashed border-amber-300 rounded-xl cursor-pointer hover:border-amber-500 hover:bg-amber-50 transition-colors">
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                          <span className="text-sm text-amber-600">
                            {uploading[`${nr.id}_anuencia_url`] ? 'Enviando...' : 'Enviar carta de anuencia (obrigatoria)'}
                          </span>
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            className="hidden"
                            onChange={e => { if (e.target.files?.[0]) handleUpload(nr.id, 'anuencia_url', e.target.files[0]) }}
                          />
                        </label>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Submit */}
      <button
        onClick={handleSave}
        disabled={!allFilled || saving}
        className="w-full px-5 py-2.5 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50 transition-colors"
      >
        {saving ? 'Salvando...' : `Confirmar ${totalCount} treinamentos`}
      </button>
    </div>
  )
}
