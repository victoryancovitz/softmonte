'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import BackButton from '@/components/BackButton'
import { useToast } from '@/components/Toast'
import { formatSupabaseError } from '@/lib/errors'

const EPI_PADRAO = [
  'Capacete', 'Óculos de proteção', 'Protetor auricular', 'Luvas',
  'Botina de segurança', 'Cinto de segurança (NR-35)', 'Uniforme',
  'Máscara/Respirador', 'Protetor facial',
]

const DOCS_CHECKLIST = [
  { key: 'ctps', label: 'CTPS' },
  { key: 'rg', label: 'RG' },
  { key: 'cpf', label: 'CPF' },
  { key: 'pis', label: 'PIS' },
  { key: 'reservista', label: 'Reservista' },
  { key: 'conta_salario', label: 'Conta Salário' },
  { key: 'foto', label: 'Foto 3x4' },
]

function formatDate(d: string | null): string {
  if (!d) return ''
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}

export default function AdmissaoWizardPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()

  const [etapa, setEtapa] = useState(1)
  const [func, setFunc] = useState<any>(null)
  const [funcoes, setFuncoes] = useState<any[]>([])
  const [nrTipos, setNrTipos] = useState<any[]>([])
  const [workflowId, setWorkflowId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Step 1 — Dados do contrato
  const [contrato, setContrato] = useState({
    funcao_id: '', cargo: '', salario_base: '', admissao: '',
    tipo_vinculo: 'experiencia_45_45', turno: 'diurno',
  })

  // Step 2 — Documentação
  const [docs, setDocs] = useState<Record<string, { recebido: boolean; obs: string }>>(
    Object.fromEntries(DOCS_CHECKLIST.map(d => [d.key, { recebido: false, obs: '' }]))
  )

  // Step 3 — Exame admissional
  const [exame, setExame] = useState({
    data_exame: '', medico: '', laudo: 'apto' as string,
    aso_vencimento: '', aso_url: '', aso_nome: '',
  })
  const [asoFile, setAsoFile] = useState<File | null>(null)

  // Step 4 — EPI e treinamentos
  const [epis, setEpis] = useState<Record<string, boolean>>(
    Object.fromEntries(EPI_PADRAO.map(e => [e, false]))
  )
  const [nrs, setNrs] = useState<Record<string, { data_realizacao: string; certificado_url: string; certificado_nome: string }>>({})
  const [nrFiles, setNrFiles] = useState<Record<string, File | null>>({})

  // Step 5 — eSocial
  const [esocial, setEsocial] = useState({
    s2200_enviado: false, s2200_recibo: '', s2200_data: '',
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const [funcRes, funcoesRes, nrRes, wfRes] = await Promise.all([
      supabase.from('funcionarios').select('*').eq('id', id).single(),
      supabase.from('funcoes').select('*').eq('ativo', true).order('nome'),
      supabase.from('treinamentos_tipos').select('*').eq('ativo', true).order('codigo'),
      supabase.from('admissoes_workflow').select('*').eq('funcionario_id', id).eq('status', 'em_andamento').order('created_at', { ascending: false }).limit(1),
    ])

    const f = funcRes.data
    if (!f) { router.push('/funcionarios'); return }
    setFunc(f)
    setFuncoes(funcoesRes.data ?? [])
    setNrTipos(nrRes.data ?? [])

    // Init NR state
    const nrInit: Record<string, { data_realizacao: string; certificado_url: string; certificado_nome: string }> = {}
    ;(nrRes.data ?? []).forEach((nr: any) => {
      nrInit[nr.id] = { data_realizacao: '', certificado_url: '', certificado_nome: '' }
    })
    setNrs(nrInit)

    // Pre-fill contract from employee data
    setContrato({
      funcao_id: f.funcao_id ?? '',
      cargo: f.cargo ?? '',
      salario_base: f.salario_base?.toString() ?? '',
      admissao: f.admissao ?? '',
      tipo_vinculo: f.tipo_vinculo ?? 'experiencia_45_45',
      turno: f.turno ?? 'diurno',
    })

    // Load existing workflow if any
    const wf = wfRes.data?.[0]
    if (wf) {
      setWorkflowId(wf.id)
      // Restore saved steps
      const dp = wf.etapa_docs_pessoais ?? {}
      if (dp.itens) setDocs(dp.itens)
      if (dp.ok) setEtapa(Math.max(2, findNextIncompleteStep(wf)))

      const ea = wf.etapa_exame_admissional ?? {}
      if (ea.data_exame) setExame({
        data_exame: ea.data_exame ?? '', medico: ea.medico ?? '',
        laudo: ea.laudo ?? 'apto', aso_vencimento: ea.aso_vencimento ?? '',
        aso_url: ea.aso_url ?? '', aso_nome: ea.aso_nome ?? '',
      })

      const ep = wf.etapa_epi_entregue ?? {}
      if (ep.itens) setEpis(ep.itens)

      const nr = wf.etapa_nr_obrigatorias ?? {}
      if (nr.itens) setNrs(prev => ({ ...prev, ...nr.itens }))

      if (wf.esocial_s2200_enviado || wf.esocial_s2200_recibo || wf.esocial_s2200_data) {
        setEsocial({
          s2200_enviado: wf.esocial_s2200_enviado ?? false,
          s2200_recibo: wf.esocial_s2200_recibo ?? '',
          s2200_data: wf.esocial_s2200_data ?? '',
        })
      }
    }

    setLoading(false)
  }

  function findNextIncompleteStep(wf: any): number {
    if (!wf.etapa_docs_pessoais?.ok) return 2
    if (!wf.etapa_exame_admissional?.ok) return 3
    if (!wf.etapa_epi_entregue?.ok || !wf.etapa_nr_obrigatorias?.ok) return 4
    if (!wf.esocial_s2200_enviado) return 5
    return 5
  }

  // Auto-calculate ASO vencimento based on funcao
  function calcAsoVencimento(dataExame: string) {
    if (!dataExame) return ''
    const d = new Date(dataExame + 'T12:00:00')
    // ASO padrão: 1 ano para funções comuns, pode ser 6 meses para insalubres
    const meses = func?.insalubridade_pct > 0 || func?.periculosidade_pct > 0 ? 6 : 12
    d.setMonth(d.getMonth() + meses)
    return d.toISOString().split('T')[0]
  }

  async function saveStep(step: number) {
    setSaving(true)
    setError('')

    try {
      // Ensure workflow exists
      let wfId = workflowId
      if (!wfId) {
        const { data: created, error: createErr } = await supabase
          .from('admissoes_workflow')
          .insert({
            funcionario_id: id,
            obra_id: null,
            data_prevista_inicio: contrato.admissao || null,
            status: 'em_andamento',
          })
          .select('id')
          .single()
        if (createErr) { setError(formatSupabaseError(createErr)); setSaving(false); return }
        wfId = created.id
        setWorkflowId(wfId)
      }

      const updates: Record<string, any> = { updated_at: new Date().toISOString() }

      if (step === 1) {
        // Update employee contract data
        await supabase.from('funcionarios').update({
          funcao_id: contrato.funcao_id || null,
          cargo: contrato.cargo.trim().toUpperCase() || null,
          salario_base: parseFloat(contrato.salario_base) || null,
          admissao: contrato.admissao || null,
          tipo_vinculo: contrato.tipo_vinculo,
          turno: contrato.turno,
        }).eq('id', id)
        updates.data_prevista_inicio = contrato.admissao || null
        updates.etapa_contrato_assinado = { ok: true, data: new Date().toISOString().split('T')[0] }
      }

      if (step === 2) {
        const allDone = DOCS_CHECKLIST.every(d => docs[d.key]?.recebido)
        updates.etapa_docs_pessoais = { ok: allDone, itens: docs }
        updates.etapa_ctps = { ok: docs.ctps?.recebido ?? false }
        updates.etapa_dados_bancarios = { ok: docs.conta_salario?.recebido ?? false }
      }

      if (step === 3) {
        // Upload ASO file if provided
        let aso_url = exame.aso_url
        let aso_nome = exame.aso_nome
        if (asoFile) {
          const ext = asoFile.name.split('.').pop()
          const path = `documentos/${id}/ASO_admissao_${Date.now()}.${ext}`
          const { error: upErr } = await supabase.storage.from('softmonte').upload(path, asoFile)
          if (upErr) { setError('Erro no upload: ' + upErr.message); setSaving(false); return }
          const { data: urlData } = supabase.storage.from('softmonte').getPublicUrl(path)
          aso_url = urlData.publicUrl
          aso_nome = asoFile.name
        }

        const exameData = {
          ...exame, aso_url, aso_nome,
          ok: exame.laudo === 'apto' || exame.laudo === 'apto_restricoes',
        }
        updates.etapa_exame_admissional = exameData

        // Also create a document record for the ASO
        if (aso_url && exame.data_exame) {
          await supabase.from('documentos').upsert({
            funcionario_id: id,
            tipo: 'ASO',
            emissao: exame.data_exame,
            vencimento: exame.aso_vencimento || null,
            observacao: `Admissional — Laudo: ${exame.laudo}, Médico: ${exame.medico}`,
            arquivo_url: aso_url,
            arquivo_nome: aso_nome,
          }, { onConflict: 'funcionario_id,tipo' }).select()
        }
      }

      if (step === 4) {
        updates.etapa_epi_entregue = { ok: true, itens: epis, data: new Date().toISOString().split('T')[0] }

        // Upload NR certificates
        const nrFinal = { ...nrs }
        for (const [tipoId, file] of Object.entries(nrFiles)) {
          if (file) {
            const ext = file.name.split('.').pop()
            const path = `documentos/${id}/NR_${tipoId}_${Date.now()}.${ext}`
            const { error: upErr } = await supabase.storage.from('softmonte').upload(path, file)
            if (!upErr) {
              const { data: urlData } = supabase.storage.from('softmonte').getPublicUrl(path)
              nrFinal[tipoId] = { ...nrFinal[tipoId], certificado_url: urlData.publicUrl, certificado_nome: file.name }
            }
          }
        }
        setNrs(nrFinal)
        updates.etapa_nr_obrigatorias = { ok: true, itens: nrFinal }
        updates.etapa_integracao = { ok: true }
        updates.etapa_uniforme = { ok: true }

        // Create treinamentos_funcionarios records
        for (const [tipoId, data] of Object.entries(nrFinal)) {
          if (data.data_realizacao) {
            const tipo = nrTipos.find(t => t.id === tipoId)
            const venc = new Date(data.data_realizacao + 'T12:00:00')
            venc.setMonth(venc.getMonth() + (tipo?.validade_meses ?? 12))
            await supabase.from('treinamentos_funcionarios').upsert({
              funcionario_id: id,
              tipo_id: tipoId,
              data_realizacao: data.data_realizacao,
              data_vencimento: venc.toISOString().split('T')[0],
              numero_certificado: null,
            }, { onConflict: 'funcionario_id,tipo_id' })
          }
        }
      }

      if (step === 5) {
        updates.esocial_s2200_enviado = esocial.s2200_enviado
        updates.esocial_s2200_data = esocial.s2200_data || null
        updates.esocial_s2200_recibo = esocial.s2200_recibo || null
        updates.etapa_esocial = { ok: esocial.s2200_enviado }
      }

      const { error: updateErr } = await supabase.from('admissoes_workflow').update(updates).eq('id', wfId)
      if (updateErr) { setError(formatSupabaseError(updateErr)); setSaving(false); return }

      toast.show('Etapa salva!')
      setSaving(false)
      return true
    } catch (err: any) {
      setError(err.message)
      setSaving(false)
      return false
    }
  }

  async function handleNext() {
    setError('')
    if (etapa === 1 && (!contrato.admissao || !contrato.cargo)) {
      setError('Data de admissao e cargo sao obrigatorios.')
      return
    }
    if (etapa === 3 && exame.laudo === 'inapto') {
      setError('Funcionario inapto nao pode prosseguir com a admissao.')
      return
    }
    const ok = await saveStep(etapa)
    if (ok !== false) setEtapa(etapa + 1)
  }

  async function handleFinalizar() {
    setError('')
    const ok = await saveStep(5)
    if (ok === false) return

    setSaving(true)
    // Mark workflow as concluida
    await supabase.from('admissoes_workflow').update({
      status: 'concluida',
      concluida_em: new Date().toISOString(),
    }).eq('id', workflowId)

    // Update employee status
    await supabase.from('funcionarios').update({ status: 'disponivel' }).eq('id', id)

    toast.show('Admissao concluida!')
    router.push(`/funcionarios/${id}`)
  }

  const inp = "w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand"
  const lbl = "block text-xs font-semibold text-gray-600 mb-1"

  const STEPS = [
    { n: 1, label: 'Contrato' },
    { n: 2, label: 'Documentacao' },
    { n: 3, label: 'Exame' },
    { n: 4, label: 'EPI & NR' },
    { n: 5, label: 'eSocial' },
  ]

  if (loading) return <div className="p-6 text-center text-gray-400">Carregando...</div>

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback={`/funcionarios/${id}`} />
        <Link href="/funcionarios" className="text-gray-400 hover:text-gray-600">Funcionarios</Link>
        <span className="text-gray-300">/</span>
        <Link href={`/funcionarios/${id}`} className="text-gray-400 hover:text-gray-600">{func?.nome}</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium">Admissao</span>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h1 className="text-lg font-bold font-display text-brand mb-1">Wizard de Admissao</h1>
        <p className="text-sm text-gray-500 mb-4">{func?.nome} — {func?.cargo}</p>

        {/* Progress Bar */}
        <div className="flex items-center gap-2 mb-6">
          {STEPS.map(step => (
            <div key={step.n} className="flex-1">
              <div className={`h-1.5 rounded-full ${etapa > step.n ? 'bg-green-500' : etapa === step.n ? 'bg-brand' : 'bg-gray-200'}`} />
              <p className={`text-[10px] mt-1 font-medium ${etapa === step.n ? 'text-brand' : etapa > step.n ? 'text-green-600' : 'text-gray-400'}`}>
                {etapa > step.n ? '✓ ' : ''}{step.label}
              </p>
            </div>
          ))}
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200">{error}</div>}

        {/* Step 1 — Dados do contrato */}
        {etapa === 1 && (
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">Dados do Contrato</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="col-span-1 sm:col-span-2">
                <label className={lbl}>Funcao</label>
                <select value={contrato.funcao_id} onChange={e => {
                  const fn = funcoes.find(f => f.id === e.target.value)
                  setContrato(c => ({ ...c, funcao_id: e.target.value, cargo: fn?.nome ?? c.cargo }))
                }} className={inp + ' bg-white'}>
                  <option value="">Selecione...</option>
                  {funcoes.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Cargo *</label>
                <input type="text" value={contrato.cargo} onChange={e => setContrato(c => ({ ...c, cargo: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className={lbl}>Salario base (R$/mes)</label>
                <input type="number" step="0.01" value={contrato.salario_base} onChange={e => setContrato(c => ({ ...c, salario_base: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className={lbl}>Data de admissao *</label>
                <input type="date" value={contrato.admissao} onChange={e => setContrato(c => ({ ...c, admissao: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className={lbl}>Tipo de vinculo</label>
                <select value={contrato.tipo_vinculo} onChange={e => setContrato(c => ({ ...c, tipo_vinculo: e.target.value }))} className={inp + ' bg-white'}>
                  <option value="experiencia_45_45">Experiencia 45+45 dias</option>
                  <option value="experiencia_30_60">Experiencia 30+60 dias</option>
                  <option value="experiencia_90">Experiencia 90 dias</option>
                  <option value="determinado_6m">Determinado 6 meses</option>
                  <option value="determinado_12m">Determinado 12 meses</option>
                  <option value="indeterminado">Indeterminado (CLT)</option>
                  <option value="temporario">Temporario</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Turno</label>
                <select value={contrato.turno} onChange={e => setContrato(c => ({ ...c, turno: e.target.value }))} className={inp + ' bg-white'}>
                  <option value="diurno">Diurno</option>
                  <option value="noturno">Noturno</option>
                  <option value="misto">Misto</option>
                </select>
              </div>
            </div>
            {contrato.admissao && contrato.tipo_vinculo.startsWith('experiencia') && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
                <span className="font-semibold">Prazo calculado:</span>{' '}
                {(() => {
                  const d = new Date(contrato.admissao + 'T12:00:00')
                  const dias = contrato.tipo_vinculo === 'experiencia_45_45' ? 45 : contrato.tipo_vinculo === 'experiencia_30_60' ? 30 : 90
                  d.setDate(d.getDate() + dias)
                  return `1o prazo: ${d.toLocaleDateString('pt-BR')}`
                })()}
              </div>
            )}
          </section>
        )}

        {/* Step 2 — Documentacao */}
        {etapa === 2 && (
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">Documentacao Pessoal</h3>
            <p className="text-xs text-gray-400 mb-3">Marque os documentos recebidos e adicione observacoes se necessario.</p>
            <div className="space-y-2">
              {DOCS_CHECKLIST.map(doc => (
                <div key={doc.key} className={`flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl border ${docs[doc.key]?.recebido ? 'bg-green-50/50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                  <label className="flex items-center gap-3 min-w-[180px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={docs[doc.key]?.recebido ?? false}
                      onChange={() => setDocs(d => ({ ...d, [doc.key]: { ...d[doc.key], recebido: !d[doc.key]?.recebido } }))}
                      className="rounded border-gray-300 text-brand focus:ring-brand/30 w-5 h-5"
                    />
                    <span className={`text-sm font-medium ${docs[doc.key]?.recebido ? 'text-green-700 line-through' : 'text-gray-800'}`}>
                      {doc.label}
                    </span>
                  </label>
                  <input
                    type="text"
                    placeholder="Observacao..."
                    value={docs[doc.key]?.obs ?? ''}
                    onChange={e => setDocs(d => ({ ...d, [doc.key]: { ...d[doc.key], obs: e.target.value } }))}
                    className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand/30"
                  />
                </div>
              ))}
            </div>
            <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
              <p className="text-xs text-gray-500">
                <span className="font-semibold">{DOCS_CHECKLIST.filter(d => docs[d.key]?.recebido).length}</span> de {DOCS_CHECKLIST.length} documentos recebidos
              </p>
            </div>
          </section>
        )}

        {/* Step 3 — Exame admissional */}
        {etapa === 3 && (
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">Exame Admissional</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Data do exame</label>
                <input type="date" value={exame.data_exame} onChange={e => {
                  const v = e.target.value
                  setExame(ex => ({ ...ex, data_exame: v, aso_vencimento: calcAsoVencimento(v) }))
                }} className={inp} />
              </div>
              <div>
                <label className={lbl}>Medico</label>
                <input type="text" value={exame.medico} onChange={e => setExame(ex => ({ ...ex, medico: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className={lbl}>Laudo</label>
                <select value={exame.laudo} onChange={e => setExame(ex => ({ ...ex, laudo: e.target.value }))} className={inp + ' bg-white'}>
                  <option value="apto">Apto</option>
                  <option value="apto_restricoes">Apto com restricoes</option>
                  <option value="inapto">Inapto</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Vencimento ASO (calculado)</label>
                <input type="date" value={exame.aso_vencimento} onChange={e => setExame(ex => ({ ...ex, aso_vencimento: e.target.value }))} className={inp} />
                {exame.aso_vencimento && (
                  <p className="text-[10px] text-gray-400 mt-1">
                    Vencimento: {formatDate(exame.aso_vencimento)}
                    {func?.insalubridade_pct > 0 || func?.periculosidade_pct > 0 ? ' (6 meses — insalubridade/periculosidade)' : ' (12 meses — padrao)'}
                  </p>
                )}
              </div>
              <div className="col-span-1 sm:col-span-2">
                <label className={lbl}>Upload ASO</label>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setAsoFile(e.target.files?.[0] ?? null)}
                  className="w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-brand file:text-white hover:file:bg-brand-dark" />
                {exame.aso_url && (
                  <a href={exame.aso_url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand mt-1 inline-block hover:underline">
                    Arquivo atual: {exame.aso_nome}
                  </a>
                )}
              </div>
            </div>
            {exame.laudo === 'inapto' && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                Funcionario considerado inapto. A admissao nao podera ser concluida.
              </div>
            )}
            {exame.laudo === 'apto_restricoes' && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                Funcionario apto com restricoes. Verifique se as restricoes sao compativeis com a funcao.
              </div>
            )}
          </section>
        )}

        {/* Step 4 — EPI e treinamentos */}
        {etapa === 4 && (
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">EPI Obrigatorios</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
              {EPI_PADRAO.map(epi => (
                <label key={epi} className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer ${epis[epi] ? 'bg-green-50/50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                  <input
                    type="checkbox"
                    checked={epis[epi] ?? false}
                    onChange={() => setEpis(e => ({ ...e, [epi]: !e[epi] }))}
                    className="rounded border-gray-300 text-brand focus:ring-brand/30 w-5 h-5"
                  />
                  <span className={`text-sm font-medium ${epis[epi] ? 'text-green-700' : 'text-gray-800'}`}>{epi}</span>
                </label>
              ))}
            </div>

            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">Treinamentos NR Obrigatorios</h3>
            <div className="space-y-2">
              {nrTipos.map(nr => (
                <div key={nr.id} className="p-3 rounded-xl border border-gray-200 bg-gray-50">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-brand bg-brand/10 px-2 py-0.5 rounded">{nr.codigo}</span>
                    <span className="text-sm font-medium text-gray-700">{nr.nome}</span>
                    <span className="text-[10px] text-gray-400">Validade: {nr.validade_meses} meses</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500">Data realizacao</label>
                      <input type="date" value={nrs[nr.id]?.data_realizacao ?? ''} onChange={e => setNrs(n => ({
                        ...n, [nr.id]: { ...n[nr.id], data_realizacao: e.target.value }
                      }))} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand/30" />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500">Certificado</label>
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setNrFiles(f => ({ ...f, [nr.id]: e.target.files?.[0] ?? null }))}
                        className="w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand file:text-white" />
                      {nrs[nr.id]?.certificado_url && (
                        <a href={nrs[nr.id].certificado_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-brand hover:underline">
                          {nrs[nr.id].certificado_nome}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Step 5 — eSocial */}
        {etapa === 5 && (
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">eSocial — S-2200</h3>
            <p className="text-xs text-gray-400 mb-4">Registro de admissao no eSocial. Prazo legal: ate o dia anterior ao inicio das atividades.</p>

            {contrato.admissao && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
                <span className="font-semibold">Prazo legal S-2200:</span>{' '}
                {(() => {
                  const d = new Date(contrato.admissao + 'T12:00:00')
                  d.setDate(d.getDate() - 1)
                  return d.toLocaleDateString('pt-BR')
                })()}
                {' '}(vespera da admissao)
              </div>
            )}

            <div className="space-y-3">
              <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer ${esocial.s2200_enviado ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                <input
                  type="checkbox"
                  checked={esocial.s2200_enviado}
                  onChange={() => setEsocial(e => ({ ...e, s2200_enviado: !e.s2200_enviado }))}
                  className="rounded border-gray-300 text-brand focus:ring-brand/30 w-5 h-5"
                />
                <span className={`text-sm font-medium ${esocial.s2200_enviado ? 'text-green-700' : 'text-gray-800'}`}>
                  S-2200 enviado ao eSocial
                </span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Data de envio</label>
                  <input type="date" value={esocial.s2200_data} onChange={e => setEsocial(es => ({ ...es, s2200_data: e.target.value }))} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Numero do recibo</label>
                  <input type="text" value={esocial.s2200_recibo} onChange={e => setEsocial(es => ({ ...es, s2200_recibo: e.target.value }))} className={inp} placeholder="Ex: 1.2.0000000000.000000000000" />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Navigation buttons */}
        <div className="flex gap-3 pt-4 mt-4 border-t border-gray-100">
          {etapa > 1 && (
            <button type="button" onClick={() => setEtapa(etapa - 1)} className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">
              Voltar
            </button>
          )}
          {etapa < 5 && (
            <button type="button" onClick={handleNext} disabled={saving} className="px-5 py-2.5 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar e Proximo'}
            </button>
          )}
          {etapa === 5 && (
            <button type="button" onClick={handleFinalizar} disabled={saving} className="px-5 py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 disabled:opacity-50">
              {saving ? 'Finalizando...' : 'Finalizar Admissao'}
            </button>
          )}
          <button type="button" onClick={() => saveStep(etapa)} disabled={saving} className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-50">
            {saving ? 'Salvando...' : 'Salvar rascunho'}
          </button>
        </div>
      </div>
    </div>
  )
}
