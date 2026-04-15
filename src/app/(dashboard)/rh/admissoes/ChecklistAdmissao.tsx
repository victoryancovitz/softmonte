'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { fmt } from '@/lib/cores'
import {
  ArrowRight, Check, X, Upload, AlertTriangle,
} from 'lucide-react'
import { etapaOk } from '@/lib/admissao-utils'

/* ─── Constants ─── */

const ETAPAS = [
  { key: 'etapa_docs_pessoais', label: 'Documentos Pessoais', num: 1 },
  { key: 'etapa_exame_admissional', label: 'Exame Admissional', num: 2 },
  { key: 'etapa_ctps', label: 'CTPS', num: 3 },
  { key: 'etapa_contrato_assinado', label: 'Contrato Assinado', num: 4 },
  { key: 'etapa_dados_bancarios', label: 'Dados Bancários', num: 5 },
  { key: 'etapa_epi_entregue', label: 'EPI Entregue', num: 6 },
  { key: 'etapa_nr_obrigatorias', label: 'Treinamentos NR', num: 7 },
  { key: 'etapa_integracao', label: 'Integração SST', num: 8 },
  { key: 'etapa_uniforme', label: 'Uniforme', num: 9 },
  { key: 'etapa_esocial', label: 'eSocial', num: 10 },
] as const

const UFS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
]

function fmtDate(d: string | null | undefined): string {
  if (!d) return ''
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}

/* ─── Modal Shell ─── */

function ModalShell({ title, open, onClose, children }: {
  title: string; open: boolean; onClose: () => void; children: React.ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-brand">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-5 py-4 space-y-4">{children}</div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand'

/* ─── Main Component ─── */

export default function ChecklistAdmissao({
  workflow,
  funcionario,
  onUpdate,
}: {
  workflow: any
  funcionario: any
  onUpdate: () => void
}) {
  const supabase = createClient()
  const toast = useToast()

  const [activeModal, setActiveModal] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Count completed
  const doneCount = ETAPAS.filter(e => etapaOk(workflow[e.key])).length

  /* ─── helpers ─── */

  async function getUserEmail(): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser()
    return user?.email ?? 'sistema'
  }

  async function updateEtapa(key: string, extra?: Record<string, any>) {
    const email = await getUserEmail()
    const etapaVal = { ok: true, data: new Date().toISOString().split('T')[0], por: email }
    const updatePayload: Record<string, any> = {
      [key]: etapaVal,
      updated_at: new Date().toISOString(),
      ...extra,
    }
    await supabase.from('admissoes_workflow').update(updatePayload).eq('id', workflow.id)
  }

  async function checkCompletion() {
    // Re-fetch workflow to check
    const { data: wf } = await supabase.from('admissoes_workflow').select('*').eq('id', workflow.id).single()
    if (!wf) return
    const allDone = ETAPAS.every(e => etapaOk(wf[e.key]))
    if (allDone) {
      await supabase.from('admissoes_workflow').update({
        status: 'concluida',
        concluida_em: new Date().toISOString(),
      }).eq('id', workflow.id)
      await supabase.from('funcionarios').update({ status: 'disponivel' }).eq('id', funcionario.id)
      // Auto-close any active emergency override
      await supabase.from('admissao_overrides').update({
        regularizado: true,
        regularizado_em: new Date().toISOString(),
      }).eq('funcionario_id', funcionario.id).eq('regularizado', false)
      toast.success('Admissao concluida!')
    }
  }

  async function uploadFile(file: File, path: string): Promise<string | null> {
    const filePath = `${funcionario.id}/${path}/${Date.now()}_${file.name}`
    const { error } = await supabase.storage.from('documentos').upload(filePath, file, { upsert: true })
    if (error) { toast.error('Erro no upload: ' + error.message); return null }
    const { data: { publicUrl } } = supabase.storage.from('documentos').getPublicUrl(filePath)
    return publicUrl
  }

  function handleRowClick(etapa: typeof ETAPAS[number]) {
    if (etapaOk(workflow[etapa.key])) return // already done, no action

    // Navigation steps (no modal)
    if (etapa.key === 'etapa_docs_pessoais') {
      window.location.href = `/funcionarios/${funcionario.id}?from=admissao&workflow_id=${workflow.id}&step=docs_pessoais`
      return
    }
    if (etapa.key === 'etapa_nr_obrigatorias') {
      window.location.href = `/funcionarios/${funcionario.id}?from=admissao&workflow_id=${workflow.id}&step=treinamentos&tab=treinamentos`
      return
    }
    // Modal steps
    setActiveModal(etapa.key)
  }

  /* ─── Progress Bar ─── */

  const pct = Math.round((doneCount / ETAPAS.length) * 100)

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-400' : 'bg-brand'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs font-bold text-gray-600 whitespace-nowrap">{doneCount}/10</span>
      </div>

      {/* Checklist rows */}
      <div className="space-y-2">
        {ETAPAS.map(etapa => {
          const val = workflow[etapa.key] ?? {}
          const done = etapaOk(val)
          return (
            <button
              key={etapa.key}
              onClick={() => handleRowClick(etapa)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-left ${
                done
                  ? 'bg-green-50/60 border-green-200 cursor-default'
                  : 'bg-gray-50 border-gray-200 hover:bg-gray-100 cursor-pointer'
              }`}
            >
              {/* Left: step number + name */}
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                done ? 'bg-green-500 text-white' : 'bg-gray-300 text-white'
              }`}>
                {etapa.num}
              </span>
              <span className={`text-sm font-medium flex-1 ${done ? 'text-green-700' : 'text-gray-800'}`}>
                {etapa.label}
              </span>

              {/* Center: badge */}
              {done ? (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                  Concluido {fmtDate(val.data)}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                  Pendente
                </span>
              )}

              {/* Right: icon */}
              {done ? (
                <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
              ) : (
                <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
              )}
            </button>
          )
        })}
      </div>

      {/* ─── MODALS ─── */}

      <ExameAdmissionalModal
        open={activeModal === 'etapa_exame_admissional'}
        onClose={() => setActiveModal(null)}
        saving={saving}
        onSave={async (form, file) => {
          setSaving(true)
          let arquivo_url: string | null = null
          let arquivo_nome: string | null = null
          if (file) {
            const url = await uploadFile(file, 'ASO')
            if (!url) { setSaving(false); return }
            arquivo_url = url
            arquivo_nome = file.name
          }
          // Insert document
          await supabase.from('documentos').insert({
            funcionario_id: funcionario.id,
            tipo: 'ASO',
            emissao: form.data_exame || null,
            vencimento: form.data_vencimento || null,
            observacao: `Medico: ${form.medico || '-'}`,
            arquivo_url,
            arquivo_nome,
          })
          // Update custo
          if (form.custo) {
            await supabase.from('funcionarios').update({ custo_aso_admissional: Number(form.custo) }).eq('id', funcionario.id)
          }
          await updateEtapa('etapa_exame_admissional')
          await checkCompletion()
          setSaving(false)
          setActiveModal(null)
          onUpdate()
          toast.success('Exame admissional registrado!')
        }}
      />

      <CTPSModal
        open={activeModal === 'etapa_ctps'}
        onClose={() => setActiveModal(null)}
        saving={saving}
        funcionario={funcionario}
        onSave={async (form) => {
          setSaving(true)
          await supabase.from('funcionarios').update({
            ctps_numero: form.ctps_numero || null,
            ctps_serie: form.ctps_serie || null,
            ctps_uf: form.ctps_uf || null,
            pis: form.pis || null,
          }).eq('id', funcionario.id)
          await updateEtapa('etapa_ctps')
          await checkCompletion()
          setSaving(false)
          setActiveModal(null)
          onUpdate()
          toast.success('CTPS atualizada!')
        }}
      />

      <ContratoModal
        open={activeModal === 'etapa_contrato_assinado'}
        onClose={() => setActiveModal(null)}
        saving={saving}
        onSave={async (form, file) => {
          setSaving(true)
          let arquivo_url: string | null = null
          let arquivo_nome: string | null = null
          if (file) {
            const url = await uploadFile(file, 'admissao')
            if (!url) { setSaving(false); return }
            arquivo_url = url
            arquivo_nome = file.name
          }
          await supabase.from('documentos').insert({
            funcionario_id: funcionario.id,
            tipo: 'admissao',
            emissao: form.data_assinatura || null,
            observacao: form.observacao || null,
            arquivo_url,
            arquivo_nome,
          })
          await updateEtapa('etapa_contrato_assinado')
          await checkCompletion()
          setSaving(false)
          setActiveModal(null)
          onUpdate()
          toast.success('Contrato registrado!')
        }}
      />

      <DadosBancariosModal
        open={activeModal === 'etapa_dados_bancarios'}
        onClose={() => setActiveModal(null)}
        saving={saving}
        funcionario={funcionario}
        onSave={async (form) => {
          setSaving(true)
          await supabase.from('funcionarios').update({
            banco: form.banco || null,
            agencia_conta: form.agencia_conta || null,
            pix: form.pix || null,
            vt_estrutura: form.vt_estrutura || null,
          }).eq('id', funcionario.id)
          await updateEtapa('etapa_dados_bancarios')
          await checkCompletion()
          setSaving(false)
          setActiveModal(null)
          onUpdate()
          toast.success('Dados bancarios atualizados!')
        }}
      />

      <EPIUniformeModal
        open={activeModal === 'etapa_epi_entregue'}
        onClose={() => setActiveModal(null)}
        saving={saving}
        categoria="EPI"
        titulo="EPI Entregue"
        funcionarioId={funcionario.id}
        workflowId={workflow.id}
        custoField="custo_epi"
        etapaKey="etapa_epi_entregue"
        onDone={async () => {
          await updateEtapa('etapa_epi_entregue')
          await checkCompletion()
          setActiveModal(null)
          onUpdate()
          toast.success('EPI registrado!')
        }}
      />

      <IntegracaoSSTModal
        open={activeModal === 'etapa_integracao'}
        onClose={() => setActiveModal(null)}
        saving={saving}
        onSave={async (form) => {
          setSaving(true)
          await supabase.from('funcionarios').update({
            data_inicio_ponto: form.data_integracao || null,
            admissao: form.data_integracao || null,
          }).eq('id', funcionario.id)
          await updateEtapa('etapa_integracao')
          await checkCompletion()
          setSaving(false)
          setActiveModal(null)
          onUpdate()
          toast.success('Integracao SST registrada!')
        }}
      />

      <EPIUniformeModal
        open={activeModal === 'etapa_uniforme'}
        onClose={() => setActiveModal(null)}
        saving={saving}
        categoria="uniforme"
        titulo="Uniforme Entregue"
        funcionarioId={funcionario.id}
        workflowId={workflow.id}
        custoField="custo_uniforme"
        etapaKey="etapa_uniforme"
        onDone={async () => {
          await updateEtapa('etapa_uniforme')
          await checkCompletion()
          setActiveModal(null)
          onUpdate()
          toast.success('Uniforme registrado!')
        }}
      />

      <ESocialModal
        open={activeModal === 'etapa_esocial'}
        onClose={() => setActiveModal(null)}
        saving={saving}
        onSave={async (form) => {
          setSaving(true)
          await updateEtapa('etapa_esocial', {
            esocial_s2200_enviado: true,
            esocial_s2200_data: form.data_envio || null,
            esocial_s2200_recibo: form.recibo_esocial || null,
          })
          await checkCompletion()
          setSaving(false)
          setActiveModal(null)
          onUpdate()
          toast.success('eSocial registrado!')
        }}
      />
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   SUB-COMPONENT MODALS
   ═══════════════════════════════════════════════════════════ */

/* ─── 2. Exame Admissional ─── */

function ExameAdmissionalModal({ open, onClose, saving, onSave }: {
  open: boolean; onClose: () => void; saving: boolean
  onSave: (form: any, file: File | null) => void
}) {
  const [form, setForm] = useState({ data_exame: '', data_vencimento: '', medico: '', custo: '' })
  const [file, setFile] = useState<File | null>(null)

  useEffect(() => {
    if (open) { setForm({ data_exame: '', data_vencimento: '', medico: '', custo: '' }); setFile(null) }
  }, [open])

  function handleDataExame(v: string) {
    setForm(prev => {
      const next = { ...prev, data_exame: v }
      if (v) {
        const d = new Date(v + 'T12:00:00')
        d.setFullYear(d.getFullYear() + 1)
        next.data_vencimento = d.toISOString().split('T')[0]
      }
      return next
    })
  }

  return (
    <ModalShell title="Exame Admissional" open={open} onClose={onClose}>
      <Field label="Data do exame">
        <input type="date" value={form.data_exame} onChange={e => handleDataExame(e.target.value)} className={inputCls} />
      </Field>
      <Field label="Data de vencimento">
        <input type="date" value={form.data_vencimento} onChange={e => setForm({ ...form, data_vencimento: e.target.value })} className={inputCls} />
      </Field>
      <Field label="Medico">
        <input type="text" value={form.medico} onChange={e => setForm({ ...form, medico: e.target.value })} className={inputCls} placeholder="Nome do medico" />
      </Field>
      <Field label="Custo (R$)">
        <input type="number" step="0.01" value={form.custo} onChange={e => setForm({ ...form, custo: e.target.value })} className={inputCls} placeholder="0,00" />
      </Field>
      <Field label="Upload ASO (PDF)">
        <input type="file" accept=".pdf" onChange={e => setFile(e.target.files?.[0] ?? null)}
          className="text-sm text-gray-600 file:mr-3 file:px-3 file:py-2 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-brand/10 file:text-brand hover:file:bg-brand/20" />
      </Field>
      <div className="flex gap-3 pt-2 border-t border-gray-100">
        <button onClick={() => onSave(form, file)} disabled={saving}
          className="px-5 py-2.5 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50">
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
        <button onClick={onClose} className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</button>
      </div>
    </ModalShell>
  )
}

/* ─── 3. CTPS ─── */

function CTPSModal({ open, onClose, saving, funcionario, onSave }: {
  open: boolean; onClose: () => void; saving: boolean; funcionario: any
  onSave: (form: any) => void
}) {
  const [form, setForm] = useState({ ctps_numero: '', ctps_serie: '', ctps_uf: '', pis: '' })

  useEffect(() => {
    if (open) {
      setForm({
        ctps_numero: funcionario.ctps_numero ?? '',
        ctps_serie: funcionario.ctps_serie ?? '',
        ctps_uf: funcionario.ctps_uf ?? '',
        pis: funcionario.pis ?? '',
      })
    }
  }, [open, funcionario])

  return (
    <ModalShell title="CTPS" open={open} onClose={onClose}>
      <Field label="Numero CTPS">
        <input type="text" value={form.ctps_numero} onChange={e => setForm({ ...form, ctps_numero: e.target.value })} className={inputCls} />
      </Field>
      <Field label="Serie">
        <input type="text" value={form.ctps_serie} onChange={e => setForm({ ...form, ctps_serie: e.target.value })} className={inputCls} />
      </Field>
      <Field label="UF">
        <select value={form.ctps_uf} onChange={e => setForm({ ...form, ctps_uf: e.target.value })} className={inputCls}>
          <option value="">Selecione...</option>
          {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
        </select>
      </Field>
      <Field label="PIS">
        <input type="text" value={form.pis} onChange={e => setForm({ ...form, pis: e.target.value })} className={inputCls} />
      </Field>
      <div className="flex gap-3 pt-2 border-t border-gray-100">
        <button onClick={() => onSave(form)} disabled={saving}
          className="px-5 py-2.5 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50">
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
        <button onClick={onClose} className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</button>
      </div>
    </ModalShell>
  )
}

/* ─── 4. Contrato Assinado ─── */

function ContratoModal({ open, onClose, saving, onSave }: {
  open: boolean; onClose: () => void; saving: boolean
  onSave: (form: any, file: File | null) => void
}) {
  const [form, setForm] = useState({ data_assinatura: '', observacao: '' })
  const [file, setFile] = useState<File | null>(null)

  useEffect(() => {
    if (open) { setForm({ data_assinatura: '', observacao: '' }); setFile(null) }
  }, [open])

  return (
    <ModalShell title="Contrato Assinado" open={open} onClose={onClose}>
      <Field label="Data da assinatura">
        <input type="date" value={form.data_assinatura} onChange={e => setForm({ ...form, data_assinatura: e.target.value })} className={inputCls} />
      </Field>
      <Field label="Upload PDF">
        <input type="file" accept=".pdf" onChange={e => setFile(e.target.files?.[0] ?? null)}
          className="text-sm text-gray-600 file:mr-3 file:px-3 file:py-2 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-brand/10 file:text-brand hover:file:bg-brand/20" />
      </Field>
      <Field label="Observacao">
        <textarea value={form.observacao} onChange={e => setForm({ ...form, observacao: e.target.value })} rows={3}
          className={inputCls + ' resize-none'} placeholder="Observacoes sobre o contrato..." />
      </Field>
      <div className="flex gap-3 pt-2 border-t border-gray-100">
        <button onClick={() => onSave(form, file)} disabled={saving}
          className="px-5 py-2.5 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50">
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
        <button onClick={onClose} className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</button>
      </div>
    </ModalShell>
  )
}

/* ─── 5. Dados Bancarios ─── */

function DadosBancariosModal({ open, onClose, saving, funcionario, onSave }: {
  open: boolean; onClose: () => void; saving: boolean; funcionario: any
  onSave: (form: any) => void
}) {
  const [form, setForm] = useState({ banco: '', agencia_conta: '', pix: '', vt_estrutura: '' })

  useEffect(() => {
    if (open) {
      setForm({
        banco: funcionario.banco ?? '',
        agencia_conta: funcionario.agencia_conta ?? '',
        pix: funcionario.pix ?? '',
        vt_estrutura: funcionario.vt_estrutura ?? '',
      })
    }
  }, [open, funcionario])

  return (
    <ModalShell title="Dados Bancarios" open={open} onClose={onClose}>
      <Field label="Banco">
        <input type="text" value={form.banco} onChange={e => setForm({ ...form, banco: e.target.value })} className={inputCls} placeholder="Ex: Bradesco, Itau..." />
      </Field>
      <Field label="Agencia / Conta">
        <input type="text" value={form.agencia_conta} onChange={e => setForm({ ...form, agencia_conta: e.target.value })} className={inputCls} placeholder="0001 / 12345-6" />
      </Field>
      <Field label="Chave PIX">
        <input type="text" value={form.pix} onChange={e => setForm({ ...form, pix: e.target.value })} className={inputCls} placeholder="CPF, email, telefone ou chave aleatoria" />
      </Field>
      <Field label="Estrutura VT">
        <input type="text" value={form.vt_estrutura} onChange={e => setForm({ ...form, vt_estrutura: e.target.value })} className={inputCls} placeholder="Ex: 2 onibus/dia" />
      </Field>
      <div className="flex gap-3 pt-2 border-t border-gray-100">
        <button onClick={() => onSave(form)} disabled={saving}
          className="px-5 py-2.5 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50">
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
        <button onClick={onClose} className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</button>
      </div>
    </ModalShell>
  )
}

/* ─── 6 & 9. EPI / Uniforme (shared) ─── */

function EPIUniformeModal({ open, onClose, saving: _saving, categoria, titulo, funcionarioId, workflowId, custoField, etapaKey, onDone }: {
  open: boolean; onClose: () => void; saving: boolean
  categoria: string; titulo: string; funcionarioId: string; workflowId: string
  custoField: string; etapaKey: string
  onDone: () => void
}) {
  const supabase = createClient()
  const toast = useToast()
  const [itens, setItens] = useState<any[]>([])
  const [qtds, setQtds] = useState<Record<string, number>>({})
  const [dataEntrega, setDataEntrega] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setQtds({})
    setDataEntrega(new Date().toISOString().split('T')[0])
    setResponsavel('')
    supabase.from('estoque_itens')
      .select('id, nome, quantidade, custo_medio_atual')
      .ilike('categoria', categoria)
      .is('deleted_at', null)
      .order('nome')
      .then(({ data }) => setItens(data ?? []))
  }, [open, categoria])

  async function handleSave() {
    const selected = Object.entries(qtds).filter(([, q]) => q > 0)
    if (selected.length === 0) { toast.error('Selecione pelo menos um item.'); return }

    setSaving(true)

    // Calculate total cost
    let custoTotal = 0
    for (const [itemId, qty] of selected) {
      const item = itens.find(i => i.id === itemId)
      custoTotal += (Number(item?.custo_medio_atual) || 0) * qty
    }

    // Generate numero
    const { count } = await supabase.from('estoque_requisicoes').select('*', { count: 'exact', head: true })
    const numero = `REQ-${String((count || 0) + 1).padStart(5, '0')}`

    const { data: { user } } = await supabase.auth.getUser()

    // Create requisicao
    const { data: req } = await supabase.from('estoque_requisicoes').insert({
      funcionario_id: funcionarioId,
      data_requisicao: dataEntrega || new Date().toISOString().split('T')[0],
      status: 'entregue',
      custo_total: Math.round(custoTotal * 100) / 100,
      observacao: `${titulo} - Admissao`,
      numero,
      created_by: user?.id,
    }).select().single()

    if (req) {
      for (const [itemId, qty] of selected) {
        const item = itens.find(i => i.id === itemId)
        const custoUnit = Number(item?.custo_medio_atual) || 0
        await supabase.from('estoque_requisicao_itens').insert({
          requisicao_id: req.id,
          item_id: itemId,
          quantidade: qty,
          custo_unitario: custoUnit,
          custo_total: Math.round(custoUnit * qty * 100) / 100,
        })
        // Update stock qty
        const novaQtd = Math.max(0, Number(item?.quantidade || 0) - qty)
        await supabase.from('estoque_itens').update({ quantidade: novaQtd }).eq('id', itemId)
      }
    }

    // Update funcionario custo
    await supabase.from('funcionarios').update({
      [custoField]: Math.round(custoTotal * 100) / 100,
    }).eq('id', funcionarioId)

    setSaving(false)
    onDone()
  }

  return (
    <ModalShell title={titulo} open={open} onClose={onClose}>
      <Field label="Data de entrega">
        <input type="date" value={dataEntrega} onChange={e => setDataEntrega(e.target.value)} className={inputCls} />
      </Field>
      <Field label="Responsavel">
        <input type="text" value={responsavel} onChange={e => setResponsavel(e.target.value)} className={inputCls} placeholder="Nome do responsavel" />
      </Field>

      {itens.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">Nenhum item de {categoria} cadastrado no estoque.</p>
      ) : (
        <div className="space-y-2 max-h-60 overflow-y-auto">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Itens disponiveis</p>
          {itens.map(item => (
            <div key={item.id} className="flex items-center justify-between gap-3 p-2 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{item.nome}</p>
                <p className="text-xs text-gray-400">Estoque: {item.quantidade} &middot; {fmt(Number(item.custo_medio_atual || 0))}/un</p>
              </div>
              <input
                type="number"
                min={0}
                max={item.quantidade}
                value={qtds[item.id] || ''}
                onChange={e => setQtds(prev => ({ ...prev, [item.id]: Number(e.target.value) || 0 }))}
                className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand"
                placeholder="0"
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3 pt-2 border-t border-gray-100">
        <button onClick={handleSave} disabled={saving}
          className="px-5 py-2.5 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50">
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
        <button onClick={onClose} className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</button>
      </div>
    </ModalShell>
  )
}

/* ─── 8. Integracao SST ─── */

function IntegracaoSSTModal({ open, onClose, saving, onSave }: {
  open: boolean; onClose: () => void; saving: boolean
  onSave: (form: any) => void
}) {
  const [form, setForm] = useState({ data_integracao: '', responsavel: '', local: '', observacoes: '' })

  useEffect(() => {
    if (open) setForm({ data_integracao: '', responsavel: '', local: '', observacoes: '' })
  }, [open])

  return (
    <ModalShell title="Integracao SST" open={open} onClose={onClose}>
      <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800 font-medium">A data sera o primeiro dia valido de ponto.</p>
      </div>
      <Field label="Data da integracao">
        <input type="date" value={form.data_integracao} onChange={e => setForm({ ...form, data_integracao: e.target.value })} className={inputCls} />
      </Field>
      <Field label="Responsavel">
        <input type="text" value={form.responsavel} onChange={e => setForm({ ...form, responsavel: e.target.value })} className={inputCls} />
      </Field>
      <Field label="Local">
        <input type="text" value={form.local} onChange={e => setForm({ ...form, local: e.target.value })} className={inputCls} />
      </Field>
      <Field label="Observacoes">
        <textarea value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} rows={3}
          className={inputCls + ' resize-none'} />
      </Field>
      <div className="flex gap-3 pt-2 border-t border-gray-100">
        <button onClick={() => onSave(form)} disabled={saving}
          className="px-5 py-2.5 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50">
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
        <button onClick={onClose} className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</button>
      </div>
    </ModalShell>
  )
}

/* ─── 10. eSocial ─── */

function ESocialModal({ open, onClose, saving, onSave }: {
  open: boolean; onClose: () => void; saving: boolean
  onSave: (form: any) => void
}) {
  const [form, setForm] = useState({ data_envio: '', recibo_esocial: '', observacoes: '' })

  useEffect(() => {
    if (open) setForm({ data_envio: '', recibo_esocial: '', observacoes: '' })
  }, [open])

  return (
    <ModalShell title="eSocial — S-2200" open={open} onClose={onClose}>
      <Field label="Data de envio">
        <input type="date" value={form.data_envio} onChange={e => setForm({ ...form, data_envio: e.target.value })} className={inputCls} />
      </Field>
      <Field label="Recibo eSocial">
        <input type="text" value={form.recibo_esocial} onChange={e => setForm({ ...form, recibo_esocial: e.target.value })} className={inputCls} placeholder="Numero do recibo S-2200" />
      </Field>
      <Field label="Observacoes">
        <textarea value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} rows={3}
          className={inputCls + ' resize-none'} />
      </Field>
      <div className="flex gap-3 pt-2 border-t border-gray-100">
        <button onClick={() => onSave(form)} disabled={saving}
          className="px-5 py-2.5 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50">
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
        <button onClick={onClose} className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</button>
      </div>
    </ModalShell>
  )
}
