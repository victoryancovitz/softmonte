'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { formatSupabaseError } from '@/lib/errors'
import { validarCPF } from '@/lib/validators'
import WizardStepper from '@/components/admissao/WizardStepper'
import WizardStep1Pessoal from '@/components/admissao/WizardStep1Pessoal'
import WizardStep2Contrato from '@/components/admissao/WizardStep2Contrato'
import WizardStep3CtpsBanco from '@/components/admissao/WizardStep3CtpsBanco'
import WizardStep4ASO from '@/components/admissao/WizardStep4ASO'
import WizardStep5NRs from '@/components/admissao/WizardStep5NRs'
import WizardStep6EPI from '@/components/admissao/WizardStep6EPI'
import WizardStep7Uniforme from '@/components/admissao/WizardStep7Uniforme'
import WizardStep8Integracao from '@/components/admissao/WizardStep8Integracao'
import { X, ChevronLeft, ChevronRight, Save, Loader2 } from 'lucide-react'
import { etapaOk } from '@/lib/admissao-utils'

const STEP_LABELS = ['', 'Pessoal', 'Contrato', 'CTPS/Banco', 'ASO', 'NRs', 'EPI', 'Uniforme', 'Integracao']

const REQUIRED_FIELDS: Record<number, string[]> = {
  1: ['nome', 'data_nascimento', 'cpf', 'nome_mae', 'telefone', 'endereco', 'cidade_endereco', 'cep'],
  2: ['funcao_id', 'cargo', 'matricula', 'id_ponto', 'salario_base', 'tipo_vinculo', 'admissao', 'tamanho_uniforme', 'tamanho_bota'],
  3: ['ctps_numero', 'ctps_serie', 'ctps_uf', 'banco'],
  4: ['aso_data_exame', 'aso_data_vencimento'],
}

const FIELD_LABELS: Record<string, string> = {
  nome: 'Nome completo', data_nascimento: 'Data de nascimento', cpf: 'CPF',
  nome_mae: 'Nome da mãe', telefone: 'Telefone', endereco: 'Endereço',
  cidade_endereco: 'Cidade', cep: 'CEP', funcao_id: 'Função',
  cargo: 'Cargo', matricula: 'Matrícula', id_ponto: 'ID Ponto',
  salario_base: 'Salário base', tipo_vinculo: 'Tipo de vínculo',
  admissao: 'Data de admissão', tamanho_uniforme: 'Tamanho uniforme',
  tamanho_bota: 'Tamanho bota', ctps_numero: 'Número CTPS',
  ctps_serie: 'Série CTPS', ctps_uf: 'UF CTPS', banco: 'Banco',
  aso_data_exame: 'Data do exame', aso_data_vencimento: 'Data de vencimento',
}

export default function ResumeWizardPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const router = useRouter()
  const toast = useToast()

  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [funcoes, setFuncoes] = useState<any[]>([])
  const [obras, setObras] = useState<any[]>([])
  const [funcionarioId, setFuncionarioId] = useState<string | null>(null)
  const [workflowId] = useState<string>(params.id)
  const [completedSteps, setCompletedSteps] = useState<number[]>([])

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [{ data: workflow }, { data: funcoesData }] = await Promise.all([
        supabase
          .from('admissoes_workflow')
          .select('*, funcionarios(*)')
          .eq('id', params.id)
          .single(),
        supabase
          .from('funcoes')
          .select('id, nome, cargo, salario_base, insalubridade_pct')
          .is('deleted_at', null)
          .order('nome'),
      ])

      if (!workflow) {
        toast.error('Workflow nao encontrado')
        router.push('/rh/admissoes')
        return
      }

      setFuncoes(funcoesData ?? [])
      const { data: obrasData } = await supabase.from('obras').select('id, nome').eq('status', 'ativo').is('deleted_at', null).order('nome')
      setObras(obrasData ?? [])
      setFuncionarioId(workflow.funcionario_id)

      // Pre-fill form from funcionario data
      const func = workflow.funcionarios ?? {}
      const data: Record<string, any> = {
        nome: func.nome ?? '',
        data_nascimento: func.data_nascimento ?? '',
        cpf: func.cpf ?? '',
        re: func.re ?? '',
        pis: func.pis ?? '',
        naturalidade: func.naturalidade ?? '',
        estado_civil: func.estado_civil ?? '',
        raca_cor: func.raca_cor ?? '',
        nome_mae: func.nome_mae ?? '',
        nome_pai: func.nome_pai ?? '',
        titulo_eleitor: func.titulo_eleitor ?? '',
        telefone: func.telefone ?? '',
        telefone_celular: func.telefone_celular ?? '',
        email: func.email ?? '',
        endereco: func.endereco ?? '',
        cidade_endereco: func.cidade_endereco ?? '',
        cep: func.cep ?? '',
        funcao_id: func.funcao_id ?? '',
        cargo: func.cargo ?? '',
        matricula: func.matricula ?? '',
        id_ponto: func.id_ponto ?? '',
        salario_base: func.salario_base ?? '',
        insalubridade_pct: func.insalubridade_pct ?? 0,
        periculosidade_pct: func.periculosidade_pct ?? 0,
        horas_mes: func.horas_mes ?? 220,
        tipo_vinculo: func.tipo_vinculo ?? '',
        admissao: func.admissao ?? '',
        tamanho_uniforme: func.tamanho_uniforme ?? '',
        tamanho_bota: func.tamanho_bota ?? '',
        ctps_numero: func.ctps_numero ?? '',
        ctps_serie: func.ctps_serie ?? '',
        ctps_uf: func.ctps_uf ?? '',
        banco: func.banco ?? '',
        agencia_conta: func.agencia_conta ?? '',
        pix: func.pix ?? '',
        vt_mensal: func.vt_mensal ?? 198,
        vr_diario: func.vr_diario ?? 35,
        va_mensal: func.va_mensal ?? 400,
        plano_saude_mensal: func.plano_saude_mensal ?? 0,
      }

      // Extract ASO data from workflow if available
      const aso = workflow.etapa_exame_admissional
      if (typeof aso === 'object' && aso !== null) {
        data.aso_data_exame = aso.data_exame ?? ''
        data.aso_data_vencimento = aso.data_vencimento ?? ''
        data.aso_medico = aso.medico ?? ''
        data.aso_cid = aso.cid ?? ''
        data.aso_custo = aso.custo ?? ''
        data.aso_arquivo = aso.arquivo ?? null
        data.aso_arquivo_nome = aso.arquivo ? 'ASO anexado' : null
      }

      setFormData(data)

      // Determine completed steps from workflow etapas
      const completed: number[] = []
      if (etapaOk(workflow.etapa_docs_pessoais)) completed.push(1)
      if (func.cargo && func.cargo !== 'PENDENTE' && func.salario_base) completed.push(2)
      if (etapaOk(workflow.etapa_ctps) && etapaOk(workflow.etapa_dados_bancarios)) completed.push(3)
      if (etapaOk(workflow.etapa_exame_admissional)) completed.push(4)
      if (etapaOk(workflow.etapa_nr_obrigatorias)) completed.push(5)
      if (etapaOk(workflow.etapa_epi_entregue)) completed.push(6)
      if (etapaOk(workflow.etapa_uniforme)) completed.push(7)
      if (etapaOk(workflow.etapa_integracao)) completed.push(8)
      setCompletedSteps(completed)

      // Resume at saved step
      const savedStep = workflow.wizard_passo_atual ?? 1
      // Go to the step after the last completed, or the saved step
      const nextIncomplete = [1, 2, 3, 4, 5, 6, 7, 8].find(s => !completed.includes(s)) ?? 8
      setStep(Math.max(savedStep, nextIncomplete > savedStep ? nextIncomplete : savedStep))
    } catch (err: any) {
      toast.error('Erro ao carregar dados', err?.message || '')
      router.push('/rh/admissoes')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = useCallback((field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setErrors(prev => {
      if (prev[field]) {
        const next = { ...prev }
        delete next[field]
        return next
      }
      return prev
    })
  }, [])

  function validate(stepNum: number): boolean {
    const required = REQUIRED_FIELDS[stepNum] ?? []
    const errs: Record<string, string> = {}
    for (const field of required) {
      const val = formData[field]
      if (val === undefined || val === null || val === '') {
        errs[field] = `${FIELD_LABELS[field] || field} e obrigatorio`
      }
    }
    // CPF digit validation on step 1
    if (stepNum === 1 && formData.cpf && !errs.cpf) {
      if (!validarCPF(formData.cpf)) {
        errs.cpf = 'CPF invalido — verifique os digitos'
      }
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleFileUpload(file: File): Promise<string | null> {
    const ext = file.name.split('.').pop()
    const path = `aso/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from('documentos').upload(path, file)
    if (error) {
      toast.error('Erro ao enviar arquivo', error.message)
      return null
    }
    const { data } = supabase.storage.from('documentos').getPublicUrl(path)
    return data.publicUrl
  }

  async function saveCurrentStep(): Promise<boolean> {
    if (!validate(step)) return false
    if (!funcionarioId) { toast.error('Funcionario nao encontrado'); return false }

    setSaving(true)
    try {
      const update: Record<string, any> = {}

      if (step === 1) {
        update.nome = formData.nome
        update.data_nascimento = formData.data_nascimento || null
        update.cpf = formData.cpf || null
        update.re = formData.re || null
        update.pis = formData.pis || null
        update.naturalidade = formData.naturalidade || null
        update.estado_civil = formData.estado_civil || null
        update.raca_cor = formData.raca_cor || null
        update.nome_mae = formData.nome_mae || null
        update.nome_pai = formData.nome_pai || null
        update.titulo_eleitor = formData.titulo_eleitor || null
        update.telefone = formData.telefone || null
        update.telefone_celular = formData.telefone_celular || null
        update.email = formData.email || null
        update.endereco = formData.endereco || null
        update.cidade_endereco = formData.cidade_endereco || null
        update.cep = formData.cep || null
      } else if (step === 2) {
        update.funcao_id = formData.funcao_id || null
        update.cargo = formData.cargo
        update.matricula = formData.matricula || null
        update.id_ponto = formData.id_ponto || null
        update.salario_base = parseFloat(formData.salario_base) || null
        update.insalubridade_pct = parseFloat(formData.insalubridade_pct) || 0
        update.periculosidade_pct = parseFloat(formData.periculosidade_pct) || 0
        update.horas_mes = parseFloat(formData.horas_mes) || 220
        update.tipo_vinculo = formData.tipo_vinculo || 'indeterminado'
        update.admissao = formData.admissao || null
        update.tamanho_uniforme = formData.tamanho_uniforme || null
        update.tamanho_bota = formData.tamanho_bota || null
        const sal = parseFloat(formData.salario_base) || 0
        const ins = sal * (parseFloat(formData.insalubridade_pct) || 0) / 100
        const per = sal * (parseFloat(formData.periculosidade_pct) || 0) / 100
        const bruto = sal + ins + per
        const custoEmp = bruto + bruto * 0.374 + bruto * 0.21
        const hm = parseFloat(formData.horas_mes) || 220
        update.custo_hora = hm > 0 ? Math.round(custoEmp / hm * 100) / 100 : null
      } else if (step === 3) {
        update.ctps_numero = formData.ctps_numero || null
        update.ctps_serie = formData.ctps_serie || null
        update.ctps_uf = formData.ctps_uf || null
        update.banco = formData.banco || null
        update.agencia_conta = formData.agencia_conta || null
        update.pix = formData.pix || null
        update.vt_mensal = parseFloat(formData.vt_mensal) || 0
        update.vr_diario = parseFloat(formData.vr_diario) || 0
        update.va_mensal = parseFloat(formData.va_mensal) || 0
        update.plano_saude_mensal = parseFloat(formData.plano_saude_mensal) || 0
      }

      // Update funcionario
      if (Object.keys(update).length > 0) {
        const { error } = await supabase.from('funcionarios').update(update).eq('id', funcionarioId)
        if (error) { toast.error('Erro ao salvar', formatSupabaseError(error)); return false }
      }

      // Update workflow
      const wfUpdate: Record<string, any> = {
        wizard_passo_atual: step,
      }
      if (step === 1) {
        wfUpdate.etapa_docs_pessoais = { ok: true }
      } else if (step === 2) {
        wfUpdate.etapa_contrato_assinado = formData.contrato_arquivo ? { ok: true } : { ok: false }
      } else if (step === 3) {
        wfUpdate.etapa_ctps = { ok: true }
        wfUpdate.etapa_dados_bancarios = { ok: true }
      } else if (step === 4) {
        wfUpdate.etapa_exame_admissional = {
          ok: true,
          data_exame: formData.aso_data_exame,
          data_vencimento: formData.aso_data_vencimento,
          medico: formData.aso_medico || null,
          cid: formData.aso_cid || null,
          custo: parseFloat(formData.aso_custo) || null,
          arquivo: formData.aso_arquivo || null,
        }
      }
      await supabase.from('admissoes_workflow').update(wfUpdate).eq('id', workflowId)

      return true
    } catch (err: any) {
      toast.error('Erro inesperado', err?.message || '')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function handleNext() {
    let success = false
    if (step >= 1 && step <= 4) {
      success = await saveCurrentStep()
    } else {
      success = true
    }

    if (success) {
      setCompletedSteps(prev => prev.includes(step) ? prev : [...prev, step])
      if (step < 8) {
        setStep(step + 1)
        toast.success(`${STEP_LABELS[step]} salvo!`)
      } else {
        toast.success('Admissão concluída!')
        router.push('/rh/admissoes')
      }
    }
  }

  async function handleSaveRascunho() {
    setSaving(true)
    try {
      if (funcionarioId) {
        const fields: Record<string, any> = {}
        if (formData.nome) fields.nome = formData.nome
        if (formData.cpf) fields.cpf = formData.cpf
        if (formData.telefone) fields.telefone = formData.telefone
        if (formData.cargo && formData.cargo !== 'PENDENTE') fields.cargo = formData.cargo
        if (Object.keys(fields).length > 0) {
          await supabase.from('funcionarios').update(fields).eq('id', funcionarioId)
        }
      }
      await supabase.from('admissoes_workflow').update({ wizard_passo_atual: step }).eq('id', workflowId)
      toast.success('Rascunho salvo!')
    } catch {
      toast.error('Erro ao salvar rascunho')
    } finally {
      setSaving(false)
    }
  }

  function handleClose() {
    if (formData.nome || funcionarioId) {
      if (!confirm('Deseja salvar o rascunho antes de sair?')) {
        router.push('/rh/admissoes')
        return
      }
      handleSaveRascunho().then(() => router.push('/rh/admissoes'))
    } else {
      router.push('/rh/admissoes')
    }
  }

  function handleStepClick(s: number) {
    if (completedSteps.includes(s)) {
      setStep(s)
    }
  }

  function renderStep() {
    switch (step) {
      case 1:
        return <WizardStep1Pessoal data={formData} onChange={handleChange} errors={errors} />
      case 2:
        return <WizardStep2Contrato data={formData} onChange={handleChange} errors={errors} funcoes={funcoes} />
      case 3:
        return <WizardStep3CtpsBanco data={formData} onChange={handleChange} errors={errors} />
      case 4:
        return <WizardStep4ASO data={formData} onChange={handleChange} errors={errors} onFileUpload={handleFileUpload} />
      case 5:
        return funcionarioId ? <WizardStep5NRs funcionario={{ id: funcionarioId, funcao_id: formData.funcao_id, nome: formData.nome, cargo: formData.cargo }} workflowId={workflowId} onComplete={() => { setCompletedSteps(s => Array.from(new Set([...s, 5]))); setStep(6) }} /> : null
      case 6:
        return funcionarioId ? <WizardStep6EPI funcionario={{ id: funcionarioId, funcao_id: formData.funcao_id, nome: formData.nome, cargo: formData.cargo, matricula: formData.matricula }} workflowId={workflowId} onComplete={() => { setCompletedSteps(s => Array.from(new Set([...s, 6]))); setStep(7) }} /> : null
      case 7:
        return funcionarioId ? <WizardStep7Uniforme funcionario={{ id: funcionarioId, funcao_id: formData.funcao_id, nome: formData.nome, tamanho_uniforme: formData.tamanho_uniforme, tamanho_bota: formData.tamanho_bota, matricula: formData.matricula }} workflowId={workflowId} onComplete={() => { setCompletedSteps(s => Array.from(new Set([...s, 7]))); setStep(8) }} /> : null
      case 8:
        return funcionarioId ? <WizardStep8Integracao funcionario={{ id: funcionarioId, nome: formData.nome, cargo: formData.cargo }} workflowId={workflowId} obras={obras} onComplete={() => { router.push(`/funcionarios/${funcionarioId}`) }} /> : null
      default:
        return (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <p className="text-lg font-semibold">Etapa {step}: {STEP_LABELS[step]}</p>
            <p className="text-sm mt-2">Em breve</p>
          </div>
        )
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-50 z-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-brand animate-spin" />
          <p className="text-sm text-gray-500">Carregando admissão...</p>
        </div>
      </div>
    )
  }

  const nome = formData.nome || 'Funcionario'

  return (
    <div className="fixed inset-0 bg-gray-50 z-50 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 bg-white border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black font-display text-brand tracking-wide">SOFTMONTE</span>
          <span className="text-gray-300">|</span>
          <span className="text-sm font-semibold text-gray-700 truncate max-w-[200px] sm:max-w-none">
            Admissão de {nome}
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
        <WizardStepper
          currentStep={step}
          completedSteps={completedSteps}
          onStepClick={handleStepClick}
        />
      </div>

      {/* Content area */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-4 sm:p-6 pb-28">
          <h2 className="text-lg font-bold font-display text-brand mb-1">
            {step}. {STEP_LABELS[step]}
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            Preencha os dados abaixo e clique em "Salvar e avancar" para continuar.
          </p>
          {renderStep()}
        </div>
      </main>

      {/* Fixed footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between z-10">
        <button
          type="button"
          onClick={() => step > 1 && setStep(step - 1)}
          disabled={step === 1}
          className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 disabled:opacity-30 disabled:cursor-default transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Voltar
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSaveRascunho}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4" />
            <span className="hidden sm:inline">Salvar rascunho</span>
          </button>

          <button
            type="button"
            onClick={handleNext}
            disabled={saving}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50 transition-colors"
          >
            {saving ? 'Salvando...' : step < 8 ? 'Salvar e avancar' : 'Concluir admissao'}
            {step < 8 && <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </footer>
    </div>
  )
}
