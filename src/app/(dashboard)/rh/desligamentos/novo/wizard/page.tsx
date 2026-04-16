'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { formatSupabaseError } from '@/lib/errors'
import WizardStepperDesligamento from '@/components/desligamento/WizardStepperDesligamento'
import {
  X, ChevronLeft, ChevronRight, Save, Loader2, Upload, FileText,
  Calculator, Plus, Trash2, Calendar, CheckCircle2,
} from 'lucide-react'

const STEP_LABELS = ['', 'Aviso Prévio', 'Devolução EPI', 'Devolução Ferramentas', 'Exame Demissional', 'Baixa CTPS', 'Cálculo Rescisão', 'Homologação', 'eSocial S-2299']

const TIPOS_DESLIGAMENTO = [
  { value: 'sem_justa_causa', label: 'Sem Justa Causa' },
  { value: 'justa_causa', label: 'Justa Causa' },
  { value: 'pedido_demissao', label: 'Pedido de Demissão' },
  { value: 'termino_contrato', label: 'Término de Contrato' },
  { value: 'acordo', label: 'Acordo Mútuo' },
]

const LS_KEY_PREFIX = 'wizard_desligamento_draft_'

interface Funcionario {
  id: string
  nome: string
  cargo: string
  cpf?: string
  matricula?: string
  status: string
}

interface EPIItemDev {
  id: string
  nome: string
  ca: string
  qtd: number
  situacao: 'devolvido' | 'danificado' | 'perdido' | null
}

interface FerramentaDev {
  id: string
  descricao: string
  situacao: 'devolvido' | 'danificado' | 'perdido'
}

const inputCls = 'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500'
const labelCls = 'block text-xs font-semibold text-gray-600 mb-1'

export default function WizardDesligamentoPage() {
  const supabase = createClient()
  const router = useRouter()
  const params = useSearchParams()
  const toast = useToast()

  const funcionarioIdParam = params.get('funcionario_id') ?? ''

  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [completedSteps, setCompletedSteps] = useState<number[]>([])
  const [showConfirmFinal, setShowConfirmFinal] = useState(false)

  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [funcionarioId, setFuncionarioId] = useState(funcionarioIdParam)
  const [workflowId, setWorkflowId] = useState<string | null>(null)

  // Step 1 — Aviso Prévio
  const [tipo, setTipo] = useState('')
  const [dataAviso, setDataAviso] = useState('')
  const [dataPrevistaSaida, setDataPrevistaSaida] = useState('')
  const [motivo, setMotivo] = useState('')
  const [responsavelRh, setResponsavelRh] = useState('')
  const [observacoes, setObservacoes] = useState('')

  // Step 2 — EPI
  const [episDevolucao, setEpisDevolucao] = useState<EPIItemDev[]>([])
  const [loadingEpis, setLoadingEpis] = useState(false)

  // Step 3 — Ferramentas
  const [ferramentas, setFerramentas] = useState<FerramentaDev[]>([])

  // Step 4 — Exame Demissional
  const [exameData, setExameData] = useState('')
  const [exameMedico, setExameMedico] = useState('')
  const [exameClinica, setExameClinica] = useState('')
  const [exameResultado, setExameResultado] = useState<'apto' | 'inapto' | ''>('')
  const [exameAsoArquivo, setExameAsoArquivo] = useState<string | null>(null)
  const [exameAsoNome, setExameAsoNome] = useState<string | null>(null)
  const [uploadingAso, setUploadingAso] = useState(false)

  // Step 5 — Baixa CTPS
  const [ctpsData, setCtpsData] = useState('')
  const [ctpsResponsavel, setCtpsResponsavel] = useState('')
  const [ctpsArquivo, setCtpsArquivo] = useState<string | null>(null)
  const [ctpsNome, setCtpsNome] = useState<string | null>(null)
  const [uploadingCtps, setUploadingCtps] = useState(false)

  // Step 6 — Cálculo Rescisão
  const [calcResult, setCalcResult] = useState<any>(null)
  const [calcLoading, setCalcLoading] = useState(false)
  const [calcAvisoTipo, setCalcAvisoTipo] = useState<'indenizado' | 'trabalhado' | 'nao_aplicavel'>('indenizado')

  // Step 7 — Homologação
  const [homData, setHomData] = useState('')
  const [homLocal, setHomLocal] = useState('')
  const [homRepresentante, setHomRepresentante] = useState('')
  const [homArquivo, setHomArquivo] = useState<string | null>(null)
  const [homNome, setHomNome] = useState<string | null>(null)
  const [uploadingHom, setUploadingHom] = useState(false)

  // Step 8 — eSocial
  const [esDataEnvio, setEsDataEnvio] = useState('')
  const [esRecibo, setEsRecibo] = useState('')

  const selectedFunc = useMemo(
    () => funcionarios.find(f => f.id === funcionarioId),
    [funcionarios, funcionarioId]
  )

  const prazoEsocial = useMemo(() => {
    if (!dataPrevistaSaida) return ''
    const d = new Date(dataPrevistaSaida + 'T12:00:00')
    d.setDate(d.getDate() + 10)
    return d.toISOString().split('T')[0]
  }, [dataPrevistaSaida])

  const lsKey = funcionarioId ? `${LS_KEY_PREFIX}${funcionarioId}` : null

  /* ─── Load funcionarios ─── */
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('funcionarios')
        .select('id, nome, cargo, cpf, matricula, status')
        .is('deleted_at', null)
        .neq('status', 'inativo')
        .order('nome')
      setFuncionarios(data ?? [])
      setLoading(false)
    })()
  }, [])

  /* ─── Load existing workflow / draft ─── */
  useEffect(() => {
    if (!funcionarioId) return
    (async () => {
      setLoading(true)
      try {
        // Check for existing em_andamento workflow
        const { data: existing } = await supabase
          .from('desligamentos_workflow')
          .select('*')
          .eq('funcionario_id', funcionarioId)
          .eq('status', 'em_andamento')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (existing) {
          setWorkflowId(existing.id)
          setTipo(existing.tipo_desligamento ?? '')
          setDataAviso(existing.data_aviso ?? '')
          setDataPrevistaSaida(existing.data_prevista_saida ?? '')
          setMotivo(existing.motivo ?? '')
          setObservacoes(existing.observacoes ?? '')

          // Load step data from JSONB etapas
          const e1 = existing.etapa_aviso_previo
          if (e1 && typeof e1 === 'object') {
            setResponsavelRh(e1.responsavel_rh ?? '')
          }
          const e2 = existing.etapa_devolucao_epi
          if (e2 && typeof e2 === 'object' && Array.isArray(e2.itens)) {
            setEpisDevolucao(e2.itens)
          }
          const e3 = existing.etapa_devolucao_ferramentas
          if (e3 && typeof e3 === 'object' && Array.isArray(e3.itens)) {
            setFerramentas(e3.itens)
          }
          const e4 = existing.etapa_exame_demissional
          if (e4 && typeof e4 === 'object') {
            setExameData(e4.data ?? '')
            setExameMedico(e4.medico ?? '')
            setExameClinica(e4.clinica ?? '')
            setExameResultado(e4.resultado ?? '')
            setExameAsoArquivo(e4.arquivo ?? null)
            setExameAsoNome(e4.arquivo ? 'ASO anexado' : null)
          }
          const e5 = existing.etapa_baixa_ctps
          if (e5 && typeof e5 === 'object') {
            setCtpsData(e5.data ?? '')
            setCtpsResponsavel(e5.responsavel ?? '')
            setCtpsArquivo(e5.arquivo ?? null)
            setCtpsNome(e5.arquivo ? 'CTPS anexada' : null)
          }
          const e6 = existing.etapa_calculo_rescisao
          if (e6 && typeof e6 === 'object' && e6.calculo) {
            setCalcResult(e6.calculo)
            setCalcAvisoTipo(e6.aviso_tipo ?? 'indenizado')
          }
          const e7 = existing.etapa_homologacao
          if (e7 && typeof e7 === 'object') {
            setHomData(e7.data ?? '')
            setHomLocal(e7.local ?? '')
            setHomRepresentante(e7.representante ?? '')
            setHomArquivo(e7.arquivo ?? null)
            setHomNome(e7.arquivo ? 'Termo anexado' : null)
          }
          const e8 = existing.etapa_esocial
          if (e8 && typeof e8 === 'object') {
            setEsDataEnvio(e8.data_envio ?? '')
            setEsRecibo(e8.recibo ?? '')
          }

          // Determine completed steps
          const completed: number[] = []
          if (e1?.ok) completed.push(1)
          if (e2?.ok) completed.push(2)
          if (e3?.ok) completed.push(3)
          if (e4?.ok) completed.push(4)
          if (e5?.ok) completed.push(5)
          if (e6?.ok) completed.push(6)
          if (e7?.ok) completed.push(7)
          if (e8?.ok) completed.push(8)
          setCompletedSteps(completed)

          // Resume at first incomplete step
          const next = [1, 2, 3, 4, 5, 6, 7, 8].find(s => !completed.includes(s)) ?? 8
          setStep(next)
        } else {
          // Check localStorage draft
          const key = `${LS_KEY_PREFIX}${funcionarioId}`
          try {
            const saved = localStorage.getItem(key)
            if (saved) {
              const d = JSON.parse(saved)
              setTipo(d.tipo ?? '')
              setDataAviso(d.dataAviso ?? '')
              setDataPrevistaSaida(d.dataPrevistaSaida ?? '')
              setMotivo(d.motivo ?? '')
              setResponsavelRh(d.responsavelRh ?? '')
              setObservacoes(d.observacoes ?? '')
              if (Array.isArray(d.episDevolucao)) setEpisDevolucao(d.episDevolucao)
              if (Array.isArray(d.ferramentas)) setFerramentas(d.ferramentas)
              setExameData(d.exameData ?? '')
              setExameMedico(d.exameMedico ?? '')
              setExameClinica(d.exameClinica ?? '')
              setExameResultado(d.exameResultado ?? '')
              setCtpsData(d.ctpsData ?? '')
              setCtpsResponsavel(d.ctpsResponsavel ?? '')
              setHomData(d.homData ?? '')
              setHomLocal(d.homLocal ?? '')
              setHomRepresentante(d.homRepresentante ?? '')
              setEsDataEnvio(d.esDataEnvio ?? '')
              setEsRecibo(d.esRecibo ?? '')
            }
          } catch {}
        }
      } catch (err: any) {
        toast.error('Erro ao carregar dados', err?.message || '')
      } finally {
        setLoading(false)
      }
    })()
  }, [funcionarioId])

  /* ─── Load EPIs on step 2 entry ─── */
  useEffect(() => {
    if (step !== 2 || !funcionarioId || episDevolucao.length > 0) return
    (async () => {
      setLoadingEpis(true)
      try {
        const { data: fichas } = await supabase
          .from('fichas_epi')
          .select('id, itens, data_entrega')
          .eq('funcionario_id', funcionarioId)
          .is('deleted_at', null)
          .order('data_entrega', { ascending: false })

        // Flatten itens from all fichas (unique by nome+ca)
        const seen = new Set<string>()
        const itens: EPIItemDev[] = []
        let counter = 0
        for (const f of fichas ?? []) {
          const arr = Array.isArray(f.itens) ? f.itens : []
          for (const it of arr) {
            const key = `${it.nome ?? ''}__${it.ca ?? ''}`
            if (seen.has(key)) continue
            seen.add(key)
            itens.push({
              id: `epi_${++counter}`,
              nome: it.nome ?? '',
              ca: it.ca ?? '',
              qtd: Number(it.qtd) || 1,
              situacao: null,
            })
          }
        }
        setEpisDevolucao(itens)
      } finally {
        setLoadingEpis(false)
      }
    })()
  }, [step, funcionarioId])

  /* ─── Persist draft to localStorage ─── */
  useEffect(() => {
    if (!lsKey) return
    try {
      const draft = {
        tipo, dataAviso, dataPrevistaSaida, motivo, responsavelRh, observacoes,
        episDevolucao, ferramentas,
        exameData, exameMedico, exameClinica, exameResultado,
        ctpsData, ctpsResponsavel,
        homData, homLocal, homRepresentante,
        esDataEnvio, esRecibo,
      }
      localStorage.setItem(lsKey, JSON.stringify(draft))
    } catch {}
  }, [
    lsKey, tipo, dataAviso, dataPrevistaSaida, motivo, responsavelRh, observacoes,
    episDevolucao, ferramentas,
    exameData, exameMedico, exameClinica, exameResultado,
    ctpsData, ctpsResponsavel,
    homData, homLocal, homRepresentante,
    esDataEnvio, esRecibo,
  ])

  /* ─── Ensure workflow exists (lazy init) ─── */
  async function ensureWorkflow(): Promise<string | null> {
    if (workflowId) return workflowId
    if (!funcionarioId) {
      toast.error('Selecione o funcionário')
      return null
    }

    // Check again in DB to avoid duplicate
    const { data: existing } = await supabase
      .from('desligamentos_workflow')
      .select('id')
      .eq('funcionario_id', funcionarioId)
      .eq('status', 'em_andamento')
      .limit(1)
      .maybeSingle()

    if (existing?.id) {
      setWorkflowId(existing.id)
      return existing.id
    }

    // Get alocacao and banco horas
    const [{ data: alocacao }, { data: bancoHoras }] = await Promise.all([
      supabase.from('alocacoes').select('obra_id').eq('funcionario_id', funcionarioId).eq('ativo', true).limit(1).maybeSingle(),
      supabase.from('banco_horas').select('saldo_acumulado_final').eq('funcionario_id', funcionarioId).order('ano', { ascending: false }).order('mes', { ascending: false }).limit(1).maybeSingle(),
    ])

    const insertData: Record<string, any> = {
      funcionario_id: funcionarioId,
      obra_id: alocacao?.obra_id ?? null,
      tipo_desligamento: tipo || 'sem_justa_causa',
      motivo: motivo || null,
      data_aviso: dataAviso || null,
      data_prevista_saida: dataPrevistaSaida || new Date().toISOString().split('T')[0],
      status: 'em_andamento',
      saldo_banco_horas_saida: bancoHoras?.saldo_acumulado_final ?? 0,
      observacoes: observacoes || null,
      etapa_aviso_previo: { ok: false },
      etapa_devolucao_epi: { ok: false },
      etapa_devolucao_ferramentas: { ok: false },
      etapa_exame_demissional: { ok: false },
      etapa_baixa_ctps: { ok: false },
      etapa_calculo_rescisao: { ok: false },
      etapa_homologacao: { ok: false },
      etapa_esocial: { ok: false },
      etapa_acerto_banco_horas: { ok: false },
    }

    if (prazoEsocial) insertData.prazo_esocial_s2299 = prazoEsocial

    const { data: inserted, error } = await supabase
      .from('desligamentos_workflow')
      .insert(insertData)
      .select('id')
      .single()

    if (error) {
      toast.error('Erro ao criar workflow', formatSupabaseError(error))
      return null
    }

    setWorkflowId(inserted.id)
    return inserted.id
  }

  /* ─── Upload helper ─── */
  async function uploadFile(file: File, prefix: string): Promise<string | null> {
    const ext = file.name.split('.').pop()
    const path = `desligamento/${prefix}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from('documentos').upload(path, file)
    if (error) {
      toast.error('Erro ao enviar arquivo', error.message)
      return null
    }
    const { data } = supabase.storage.from('documentos').getPublicUrl(path)
    return data.publicUrl
  }

  /* ─── Validation per step ─── */
  function validateStep(s: number): string | null {
    if (s === 1) {
      if (!funcionarioId) return 'Selecione o funcionário'
      if (!tipo) return 'Selecione o tipo de desligamento'
      if (!dataPrevistaSaida) return 'Informe a data prevista de saída'
    }
    if (s === 4) {
      if (exameData && !exameResultado) return 'Informe o resultado do exame'
    }
    if (s === 6) {
      if (!calcResult) return 'Calcule a rescisão antes de avançar'
    }
    return null
  }

  /* ─── Save current step to workflow ─── */
  async function saveStep(s: number): Promise<boolean> {
    const wfId = await ensureWorkflow()
    if (!wfId) return false

    const update: Record<string, any> = {}

    if (s === 1) {
      update.tipo_desligamento = tipo
      update.motivo = motivo || null
      update.data_aviso = dataAviso || null
      update.data_prevista_saida = dataPrevistaSaida
      update.observacoes = observacoes || null
      update.prazo_esocial_s2299 = prazoEsocial || null
      update.etapa_aviso_previo = {
        ok: true,
        tipo,
        data_aviso: dataAviso || null,
        data_prevista_saida: dataPrevistaSaida,
        motivo: motivo || null,
        responsavel_rh: responsavelRh || null,
      }
    } else if (s === 2) {
      const allResolved = episDevolucao.length === 0 || episDevolucao.every(e => e.situacao !== null)
      update.etapa_devolucao_epi = {
        ok: allResolved,
        itens: episDevolucao,
        data: new Date().toISOString().split('T')[0],
      }
    } else if (s === 3) {
      update.etapa_devolucao_ferramentas = {
        ok: true,
        itens: ferramentas,
        data: new Date().toISOString().split('T')[0],
      }
    } else if (s === 4) {
      update.etapa_exame_demissional = {
        ok: !!(exameData && exameResultado),
        data: exameData || null,
        medico: exameMedico || null,
        clinica: exameClinica || null,
        resultado: exameResultado || null,
        arquivo: exameAsoArquivo,
      }
    } else if (s === 5) {
      update.etapa_baixa_ctps = {
        ok: !!ctpsData,
        data: ctpsData || null,
        responsavel: ctpsResponsavel || null,
        arquivo: ctpsArquivo,
      }
    } else if (s === 6) {
      update.etapa_calculo_rescisao = {
        ok: !!calcResult,
        aviso_tipo: calcAvisoTipo,
        calculo: calcResult,
        data: new Date().toISOString().split('T')[0],
      }
    } else if (s === 7) {
      update.etapa_homologacao = {
        ok: !!homData,
        data: homData || null,
        local: homLocal || null,
        representante: homRepresentante || null,
        arquivo: homArquivo,
      }
    } else if (s === 8) {
      update.etapa_esocial = {
        ok: !!esDataEnvio,
        data_envio: esDataEnvio || null,
        recibo: esRecibo || null,
        prazo: prazoEsocial || null,
      }
    }

    update.updated_at = new Date().toISOString()

    const { error } = await supabase.from('desligamentos_workflow').update(update).eq('id', wfId)
    if (error) {
      toast.error('Erro ao salvar etapa', formatSupabaseError(error))
      return false
    }
    return true
  }

  async function handleNext() {
    const err = validateStep(step)
    if (err) { toast.error(err); return }

    setSaving(true)
    try {
      const ok = await saveStep(step)
      if (!ok) return

      setCompletedSteps(prev => prev.includes(step) ? prev : [...prev, step])
      toast.success(`${STEP_LABELS[step]} salvo!`)

      if (step < 8) {
        setStep(step + 1)
      } else {
        // Step 8 done — finalize workflow
        await finalizarDesligamento()
      }
    } finally {
      setSaving(false)
    }
  }

  function finalizarDesligamento() {
    if (!workflowId || !funcionarioId) return
    setShowConfirmFinal(true)
  }

  async function executarFinalizacao() {
    if (!workflowId || !funcionarioId) return
    setShowConfirmFinal(false)
    const dataSaida = dataPrevistaSaida || new Date().toISOString().split('T')[0]

    const { error: e1 } = await supabase.from('desligamentos_workflow').update({
      status: 'concluido',
      concluido_em: new Date().toISOString(),
      data_real_saida: dataSaida,
    }).eq('id', workflowId)

    if (e1) { toast.error('Erro ao concluir', formatSupabaseError(e1)); return }

    await supabase.from('funcionarios').update({ status: 'inativo' }).eq('id', funcionarioId)
    await supabase.from('alocacoes').update({
      ativo: false,
      data_fim: dataSaida,
    }).eq('funcionario_id', funcionarioId).eq('ativo', true)

    // Clear draft
    if (lsKey) {
      try { localStorage.removeItem(lsKey) } catch {}
    }

    toast.success('Desligamento concluído!', `${selectedFunc?.nome ?? 'Funcionário'} — processo finalizado`)
    router.push('/rh/desligamentos')
  }

  async function handleSaveRascunho() {
    setSaving(true)
    try {
      const ok = await saveStep(step)
      if (ok) toast.success('Rascunho salvo!')
    } finally {
      setSaving(false)
    }
  }

  function handleClose() {
    // Auto-salva rascunho se tiver dados; localStorage já persiste tudo
    if (funcionarioId && (tipo || dataPrevistaSaida)) {
      handleSaveRascunho().then(() => router.push('/rh/desligamentos')).catch(() => router.push('/rh/desligamentos'))
    } else {
      router.push('/rh/desligamentos')
    }
  }

  function handleStepClick(s: number) {
    if (completedSteps.includes(s) || s === step) {
      setStep(s)
    }
  }

  /* ─── Step 6: Calcular rescisão ─── */
  async function calcularRescisao() {
    if (!funcionarioId) { toast.error('Selecione o funcionário'); return }
    if (!dataPrevistaSaida) { toast.error('Informe a data de saída na etapa 1'); return }

    const tipoMap: Record<string, string> = {
      sem_justa_causa: 'sem_justa_causa',
      justa_causa: 'justa_causa',
      pedido_demissao: 'pedido_demissao',
      termino_contrato: 'fim_contrato_determinado',
      acordo: 'comum_acordo',
    }
    const tipoRescisao = tipoMap[tipo] || 'sem_justa_causa'
    const avisoTipoReal = tipoRescisao === 'justa_causa' ? 'nao_aplicavel' : calcAvisoTipo

    setCalcLoading(true)
    const { data, error } = await supabase.rpc('calcular_rescisao', {
      p_funcionario_id: funcionarioId,
      p_data_desligamento: dataPrevistaSaida,
      p_tipo: tipoRescisao,
      p_aviso_tipo: avisoTipoReal,
    })
    setCalcLoading(false)

    if (error) {
      toast.error('Erro no cálculo', error.message)
      return
    }
    setCalcResult(data)
    toast.success('Rescisão calculada')
  }

  /* ─── Step 2: EPI handlers ─── */
  function setEpiSituacao(id: string, situacao: EPIItemDev['situacao']) {
    setEpisDevolucao(prev => prev.map(e => e.id === id ? { ...e, situacao } : e))
  }

  function addEpiManual() {
    setEpisDevolucao(prev => [
      ...prev,
      { id: `epi_manual_${Date.now()}`, nome: '', ca: '', qtd: 1, situacao: null },
    ])
  }

  function removeEpi(id: string) {
    setEpisDevolucao(prev => prev.filter(e => e.id !== id))
  }

  /* ─── Step 3: Ferramentas handlers ─── */
  function addFerramenta() {
    setFerramentas(prev => [
      ...prev,
      { id: `f_${Date.now()}`, descricao: '', situacao: 'devolvido' },
    ])
  }

  function removeFerramenta(id: string) {
    setFerramentas(prev => prev.filter(f => f.id !== id))
  }

  function updateFerramenta(id: string, field: 'descricao' | 'situacao', value: string) {
    setFerramentas(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f))
  }

  const fmt = (v: any) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const fmtDate = (d: string | null) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-50 z-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
          <p className="text-sm text-gray-500">Carregando...</p>
        </div>
      </div>
    )
  }

  const nome = selectedFunc?.nome ?? 'Funcionário'

  return (
    <div className="fixed inset-0 bg-gray-50 z-50 flex flex-col h-screen">
      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 bg-white border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black font-display text-red-600 tracking-wide">SOFTMONTE</span>
          <span className="text-gray-300">|</span>
          <span className="text-sm font-semibold text-gray-700 truncate max-w-[200px] sm:max-w-none">
            Desligamento de {nome}
          </span>
        </div>
        <button
          onClick={handleClose}
          className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
          title="Fechar wizard"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>
      </header>

      {/* Stepper */}
      <div className="bg-white border-b border-gray-100 flex-shrink-0">
        <WizardStepperDesligamento
          currentStep={step}
          completedSteps={completedSteps}
          onStepClick={handleStepClick}
        />
      </div>

      {/* Content */}
      <main className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-4 sm:p-6 pb-28">
          <h2 className="text-lg font-bold font-display text-red-600 mb-1">
            {step}. {STEP_LABELS[step]}
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            Preencha os dados abaixo e clique em &ldquo;Salvar e avançar&rdquo; para continuar.
          </p>

          {/* Step 1 — Aviso Prévio */}
          {step === 1 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <div>
                <label className={labelCls}>Funcionário *</label>
                <select
                  value={funcionarioId}
                  onChange={e => setFuncionarioId(e.target.value)}
                  className={inputCls}
                  disabled={!!workflowId}
                >
                  <option value="">Selecione...</option>
                  {funcionarios.map(f => (
                    <option key={f.id} value={f.id}>{f.nome} — {f.cargo}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelCls}>Tipo de desligamento *</label>
                <select value={tipo} onChange={e => setTipo(e.target.value)} className={inputCls}>
                  <option value="">Selecione...</option>
                  {TIPOS_DESLIGAMENTO.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Data do aviso</label>
                  <input type="date" value={dataAviso} onChange={e => setDataAviso(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Data prevista de saída *</label>
                  <input type="date" value={dataPrevistaSaida} onChange={e => setDataPrevistaSaida(e.target.value)} className={inputCls} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Motivo</label>
                <textarea
                  value={motivo}
                  onChange={e => setMotivo(e.target.value)}
                  rows={3}
                  className={`${inputCls} resize-none`}
                  placeholder="Descreva o motivo do desligamento..."
                />
              </div>

              <div>
                <label className={labelCls}>Responsável RH</label>
                <input
                  type="text"
                  value={responsavelRh}
                  onChange={e => setResponsavelRh(e.target.value)}
                  className={inputCls}
                  placeholder="Nome do responsável"
                />
              </div>

              <div>
                <label className={labelCls}>Observações</label>
                <textarea
                  value={observacoes}
                  onChange={e => setObservacoes(e.target.value)}
                  rows={2}
                  className={`${inputCls} resize-none`}
                />
              </div>

              {dataPrevistaSaida && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                  <p><span className="font-semibold">Prazo pagamento rescisão:</span> {fmtDate(prazoEsocial)} (10 dias)</p>
                  <p><span className="font-semibold">Prazo eSocial S-2299:</span> {fmtDate(prazoEsocial)}</p>
                </div>
              )}
            </div>
          )}

          {/* Step 2 — EPI */}
          {step === 2 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold text-gray-700">Devolução de EPIs</p>
                  <p className="text-xs text-gray-500 mt-0.5">Marque a situação de cada item entregue ao funcionário.</p>
                </div>
                <button
                  type="button"
                  onClick={addEpiManual}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium hover:bg-gray-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar item
                </button>
              </div>

              {loadingEpis ? (
                <div className="text-center py-8 text-sm text-gray-400">Carregando EPIs...</div>
              ) : episDevolucao.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl">
                  Nenhum EPI registrado para este funcionário.
                  <br />
                  <button
                    type="button"
                    onClick={addEpiManual}
                    className="mt-2 text-red-600 hover:underline font-medium"
                  >
                    Adicionar item manualmente
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {episDevolucao.map(epi => (
                    <div key={epi.id} className="p-3 border border-gray-200 rounded-xl bg-gray-50">
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="text"
                          value={epi.nome}
                          onChange={e => setEpisDevolucao(prev => prev.map(x => x.id === epi.id ? { ...x, nome: e.target.value } : x))}
                          placeholder="Nome do EPI"
                          className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-red-500"
                        />
                        <input
                          type="text"
                          value={epi.ca}
                          onChange={e => setEpisDevolucao(prev => prev.map(x => x.id === epi.id ? { ...x, ca: e.target.value } : x))}
                          placeholder="CA"
                          className="w-24 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-red-500"
                        />
                        <input
                          type="number"
                          value={epi.qtd}
                          onChange={e => setEpisDevolucao(prev => prev.map(x => x.id === epi.id ? { ...x, qtd: parseInt(e.target.value) || 1 } : x))}
                          min={1}
                          className="w-16 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-red-500"
                        />
                        <button
                          type="button"
                          onClick={() => removeEpi(epi.id)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex gap-2">
                        {(['devolvido', 'danificado', 'perdido'] as const).map(s => (
                          <label key={s} className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                            epi.situacao === s
                              ? s === 'devolvido' ? 'bg-green-50 border-green-300 text-green-700'
                                : s === 'danificado' ? 'bg-amber-50 border-amber-300 text-amber-700'
                                  : 'bg-red-50 border-red-300 text-red-700'
                              : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                          }`}>
                            <input
                              type="radio"
                              name={`epi-${epi.id}`}
                              checked={epi.situacao === s}
                              onChange={() => setEpiSituacao(epi.id, s)}
                              className="sr-only"
                            />
                            <span className="capitalize">{s}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3 — Ferramentas */}
          {step === 3 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold text-gray-700">Devolução de Ferramentas</p>
                  <p className="text-xs text-gray-500 mt-0.5">Liste as ferramentas entregues ao funcionário e marque a situação.</p>
                </div>
                <button
                  type="button"
                  onClick={addFerramenta}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium hover:bg-gray-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar
                </button>
              </div>

              {ferramentas.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl">
                  Nenhuma ferramenta registrada.
                  <br />
                  <button
                    type="button"
                    onClick={addFerramenta}
                    className="mt-2 text-red-600 hover:underline font-medium"
                  >
                    Adicionar ferramenta
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {ferramentas.map(f => (
                    <div key={f.id} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={f.descricao}
                        onChange={e => updateFerramenta(f.id, 'descricao', e.target.value)}
                        placeholder="Descrição da ferramenta"
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-red-500"
                      />
                      <select
                        value={f.situacao}
                        onChange={e => updateFerramenta(f.id, 'situacao', e.target.value)}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-red-500"
                      >
                        <option value="devolvido">Devolvida</option>
                        <option value="danificado">Danificada</option>
                        <option value="perdido">Perdida</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => removeFerramenta(f.id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 4 — Exame Demissional */}
          {step === 4 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Data do exame</label>
                  <input type="date" value={exameData} onChange={e => setExameData(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Resultado</label>
                  <select value={exameResultado} onChange={e => setExameResultado(e.target.value as any)} className={inputCls}>
                    <option value="">Selecione...</option>
                    <option value="apto">Apto</option>
                    <option value="inapto">Inapto</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Médico</label>
                  <input type="text" value={exameMedico} onChange={e => setExameMedico(e.target.value)} className={inputCls} placeholder="Nome do médico" />
                </div>
                <div>
                  <label className={labelCls}>Clínica</label>
                  <input type="text" value={exameClinica} onChange={e => setExameClinica(e.target.value)} className={inputCls} placeholder="Nome da clínica" />
                </div>
              </div>

              <div>
                <label className={labelCls}>Upload ASO</label>
                <label className="flex items-center gap-2 px-3 py-2.5 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 text-sm">
                  <Upload className="w-4 h-4 text-gray-400" />
                  <span className="flex-1 text-gray-600">
                    {uploadingAso ? 'Enviando...' : exameAsoNome ?? 'Escolher arquivo...'}
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    accept="application/pdf,image/*"
                    onChange={async e => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      setUploadingAso(true)
                      const url = await uploadFile(file, 'aso')
                      setUploadingAso(false)
                      if (url) {
                        setExameAsoArquivo(url)
                        setExameAsoNome(file.name)
                      }
                    }}
                  />
                </label>
                {exameAsoArquivo && (
                  <a href={exameAsoArquivo} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline mt-1">
                    <FileText className="w-3 h-3" /> Ver arquivo
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Step 5 — Baixa CTPS */}
          {step === 5 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Data da baixa</label>
                  <input type="date" value={ctpsData} onChange={e => setCtpsData(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Responsável que assinou</label>
                  <input type="text" value={ctpsResponsavel} onChange={e => setCtpsResponsavel(e.target.value)} className={inputCls} placeholder="Nome do responsável" />
                </div>
              </div>

              <div>
                <label className={labelCls}>Upload CTPS baixada</label>
                <label className="flex items-center gap-2 px-3 py-2.5 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 text-sm">
                  <Upload className="w-4 h-4 text-gray-400" />
                  <span className="flex-1 text-gray-600">
                    {uploadingCtps ? 'Enviando...' : ctpsNome ?? 'Escolher arquivo...'}
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    accept="application/pdf,image/*"
                    onChange={async e => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      setUploadingCtps(true)
                      const url = await uploadFile(file, 'ctps')
                      setUploadingCtps(false)
                      if (url) {
                        setCtpsArquivo(url)
                        setCtpsNome(file.name)
                      }
                    }}
                  />
                </label>
                {ctpsArquivo && (
                  <a href={ctpsArquivo} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline mt-1">
                    <FileText className="w-3 h-3" /> Ver arquivo
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Step 6 — Cálculo Rescisão */}
          {step === 6 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <div className="flex items-end gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <label className={labelCls}>Tipo de aviso prévio</label>
                  <select
                    value={calcAvisoTipo}
                    onChange={e => setCalcAvisoTipo(e.target.value as any)}
                    className={inputCls}
                  >
                    <option value="indenizado">Indenizado</option>
                    <option value="trabalhado">Trabalhado</option>
                    <option value="nao_aplicavel">Não aplicável</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={calcularRescisao}
                  disabled={calcLoading}
                  className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 disabled:opacity-50"
                >
                  <Calculator className="w-4 h-4" />
                  {calcLoading ? 'Calculando...' : calcResult ? 'Recalcular' : 'Calcular rescisão'}
                </button>
              </div>

              {calcResult && (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <p className="text-sm font-semibold text-gray-700 mb-3">Resultado do cálculo</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between p-2 bg-gray-50 rounded-lg">
                      <span className="text-gray-600">Saldo salário</span>
                      <span className="font-semibold">{fmt(calcResult.saldo_salario)}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-gray-50 rounded-lg">
                      <span className="text-gray-600">Aviso prévio</span>
                      <span className="font-semibold">{fmt(calcResult.aviso_previo_valor)}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-gray-50 rounded-lg">
                      <span className="text-gray-600">Férias vencidas</span>
                      <span className="font-semibold">{fmt(calcResult.ferias_vencidas)}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-gray-50 rounded-lg">
                      <span className="text-gray-600">Férias proporcionais</span>
                      <span className="font-semibold">{fmt(calcResult.ferias_proporcionais)}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-gray-50 rounded-lg">
                      <span className="text-gray-600">1/3 férias</span>
                      <span className="font-semibold">{fmt(calcResult.terco_ferias)}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-gray-50 rounded-lg">
                      <span className="text-gray-600">13° proporcional</span>
                      <span className="font-semibold">{fmt(calcResult.decimo_proporcional)}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-gray-50 rounded-lg">
                      <span className="text-gray-600">Multa FGTS 40%</span>
                      <span className="font-semibold">{fmt(calcResult.multa_fgts_40)}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-gray-50 rounded-lg">
                      <span className="text-gray-600">Desconto INSS</span>
                      <span className="font-semibold text-red-600">-{fmt(calcResult.desconto_inss)}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-gray-50 rounded-lg">
                      <span className="text-gray-600">Desconto IRRF</span>
                      <span className="font-semibold text-red-600">-{fmt(calcResult.desconto_irrf)}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-green-50 border border-green-200 rounded-lg sm:col-span-2">
                      <span className="font-semibold text-green-800">Valor líquido</span>
                      <span className="font-bold text-green-800">{fmt(calcResult.valor_liquido)}</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-3">
                    O cálculo detalhado fica registrado. Para editar valores, use a tela de rescisões em <span className="font-semibold">/rh/rescisoes</span>.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 7 — Homologação */}
          {step === 7 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Data da homologação</label>
                  <input type="date" value={homData} onChange={e => setHomData(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Local</label>
                  <input type="text" value={homLocal} onChange={e => setHomLocal(e.target.value)} className={inputCls} placeholder="Sindicato, MTE, empresa..." />
                </div>
              </div>

              <div>
                <label className={labelCls}>Representante sindical</label>
                <input type="text" value={homRepresentante} onChange={e => setHomRepresentante(e.target.value)} className={inputCls} placeholder="Nome do representante" />
              </div>

              <div>
                <label className={labelCls}>Upload termo de homologação</label>
                <label className="flex items-center gap-2 px-3 py-2.5 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 text-sm">
                  <Upload className="w-4 h-4 text-gray-400" />
                  <span className="flex-1 text-gray-600">
                    {uploadingHom ? 'Enviando...' : homNome ?? 'Escolher arquivo...'}
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    accept="application/pdf,image/*"
                    onChange={async e => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      setUploadingHom(true)
                      const url = await uploadFile(file, 'homologacao')
                      setUploadingHom(false)
                      if (url) {
                        setHomArquivo(url)
                        setHomNome(file.name)
                      }
                    }}
                  />
                </label>
                {homArquivo && (
                  <a href={homArquivo} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline mt-1">
                    <FileText className="w-3 h-3" /> Ver arquivo
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Step 8 — eSocial */}
          {step === 8 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              {prazoEsocial && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <p><span className="font-semibold">Prazo legal S-2299:</span> {fmtDate(prazoEsocial)} (10 dias após desligamento)</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Data de envio</label>
                  <input type="date" value={esDataEnvio} onChange={e => setEsDataEnvio(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Nº do recibo</label>
                  <input type="text" value={esRecibo} onChange={e => setEsRecibo(e.target.value)} className={inputCls} placeholder="Ex: 1.2.2024.12345" />
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">
                <p className="font-semibold mb-1">Ao concluir esta etapa:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>O funcionário será marcado como inativo</li>
                  <li>Alocações ativas serão encerradas</li>
                  <li>O desligamento será movido para a aba de concluídos</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between flex-shrink-0">
        <button
          type="button"
          onClick={() => step > 1 && setStep(step - 1)}
          disabled={step === 1 || saving}
          className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 disabled:opacity-30 disabled:cursor-default transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Voltar
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSaveRascunho}
            disabled={saving || !funcionarioId}
            className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4" />
            <span className="hidden sm:inline">Salvar rascunho</span>
          </button>

          <button
            type="button"
            onClick={handleNext}
            disabled={saving}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Salvando...' : step < 8 ? 'Salvar e avançar' : 'Concluir desligamento'}
            {step < 8 && <ChevronRight className="w-4 h-4" />}
            {step === 8 && <CheckCircle2 className="w-4 h-4" />}
          </button>
        </div>
      </footer>

      {showConfirmFinal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => setShowConfirmFinal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-5">
              <h3 className="text-base font-bold text-red-700 mb-2">⚠️ Concluir desligamento?</h3>
              <p className="text-sm text-gray-700 mb-2">
                <strong>{selectedFunc?.nome}</strong> será marcado como inativo e todas as alocações ativas serão encerradas.
              </p>
              <p className="text-xs text-gray-500">Esta ação pode ser revertida por um admin.</p>
            </div>
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setShowConfirmFinal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
              <button onClick={executarFinalizacao}
                className="px-5 py-2 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700">
                Concluir desligamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
