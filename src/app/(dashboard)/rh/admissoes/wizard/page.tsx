'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { formatSupabaseError } from '@/lib/errors'
import WizardStepper from '@/components/admissao/WizardStepper'
import WizardStep1Pessoal from '@/components/admissao/WizardStep1Pessoal'
import WizardStep2Contrato from '@/components/admissao/WizardStep2Contrato'
import WizardStep3CtpsBanco from '@/components/admissao/WizardStep3CtpsBanco'
import WizardStep4ASO from '@/components/admissao/WizardStep4ASO'
import WizardStep5NRs from '@/components/admissao/WizardStep5NRs'
import WizardStep6EPI from '@/components/admissao/WizardStep6EPI'
import WizardStep7Uniforme from '@/components/admissao/WizardStep7Uniforme'
import WizardStep8Integracao from '@/components/admissao/WizardStep8Integracao'
import { X, ChevronLeft, ChevronRight, Save } from 'lucide-react'

const STEP_LABELS = ['', 'Pessoal', 'Contrato', 'CTPS/Banco', 'ASO', 'NRs', 'EPI', 'Uniforme', 'Integração']

// Campos MÍNIMOS para avançar (P2)
const REQUIRED_FIELDS: Record<number, string[]> = {
  1: ['nome', 'cpf', 'data_nascimento'],
  2: ['funcao_id', 'admissao', 'obra_id'],
  3: [],
  4: [],
}

// Campos RECOMENDADOS (alerta amarelo, não bloqueia)
const RECOMMENDED_FIELDS: Record<number, string[]> = {
  1: ['endereco', 'cep', 'cidade_endereco', 'nome_mae', 'pis', 're'],
  2: ['cargo', 'matricula', 'id_ponto', 'salario_base', 'tipo_vinculo', 'tamanho_uniforme', 'tamanho_bota'],
  3: ['ctps_numero', 'banco'],
  4: ['aso_data_exame'],
}

const FIELD_LABELS: Record<string, string> = {
  nome: 'Nome completo', data_nascimento: 'Data de nascimento', cpf: 'CPF',
  nome_mae: 'Nome da mãe', telefone: 'Telefone', endereco: 'Endereço',
  cidade_endereco: 'Cidade', cep: 'CEP', funcao_id: 'Função',
  obra_id: 'Obra',
  cargo: 'Cargo', matricula: 'Matrícula', id_ponto: 'ID Ponto',
  salario_base: 'Salário base', tipo_vinculo: 'Tipo de vínculo',
  admissao: 'Data de admissão', tamanho_uniforme: 'Tamanho uniforme',
  tamanho_bota: 'Tamanho bota', ctps_numero: 'Número CTPS',
  ctps_serie: 'Série CTPS', ctps_uf: 'UF CTPS', banco: 'Banco',
  aso_data_exame: 'Data do exame', aso_data_vencimento: 'Data de vencimento',
  pis: 'PIS/NIS', re: 'RG',
}

const LS_KEY = 'wizard_admissao_draft'

export default function WizardAdmissaoPage() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const toast = useToast()
  const preFuncId = searchParams.get('funcionario_id')

  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState<Record<string, any>>(() => {
    // Restaurar draft do localStorage se existir (P1)
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(LS_KEY)
        if (saved) return JSON.parse(saved)
      } catch {}
    }
    return {
      horas_mes: 220,
      vt_mensal: 198,
      vr_diario: 35,
      va_mensal: 400,
      plano_saude_mensal: 0,
      admissao: new Date().toISOString().slice(0, 10),
    }
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [funcoes, setFuncoes] = useState<any[]>([])
  const [obras, setObras] = useState<any[]>([])
  const [funcionarioId, setFuncionarioId] = useState<string | null>(preFuncId)
  const [workflowId, setWorkflowId] = useState<string | null>(null)
  const [completedSteps, setCompletedSteps] = useState<number[]>([])

  useEffect(() => {
    // funcoes tem categoria (não cargo) e insalubridade_pct_padrao (não insalubridade_pct)
    supabase
      .from('funcoes')
      .select('id, nome, categoria, salario_base, insalubridade_pct_padrao, periculosidade_pct_padrao, jornada_horas_mes, vt_mensal_padrao, vr_diario_padrao, va_mensal_padrao')
      .eq('ativo', true)
      .is('deleted_at', null)
      .order('nome')
      .then(({ data }) => setFuncoes(data ?? []))
    supabase.from('obras').select('id, nome').eq('status', 'ativo').is('deleted_at', null).order('nome')
      .then(({ data }) => setObras(data ?? []))
  }, [])

  // Carrega dados do funcionário se veio da URL (P17)
  useEffect(() => {
    if (!preFuncId) return
    (async () => {
      const { data: f } = await supabase.from('funcionarios').select('*').eq('id', preFuncId).maybeSingle()
      if (f) {
        setFormData((prev: Record<string, any>) => ({ ...prev, ...f }))
        // Buscar workflow em andamento
        const { data: wf } = await supabase.from('admissoes_workflow')
          .select('id').eq('funcionario_id', preFuncId)
          .in('status', ['em_andamento', 'pendente'])
          .order('created_at', { ascending: false }).limit(1).maybeSingle()
        if (wf?.id) setWorkflowId(wf.id)
      }
    })()
  }, [preFuncId])

  // Persiste draft no localStorage (P1)
  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(formData)) } catch {}
  }, [formData])

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
    const recommended = RECOMMENDED_FIELDS[stepNum] ?? []
    const errs: Record<string, string> = {}
    for (const field of required) {
      const val = formData[field]
      if (val === undefined || val === null || val === '') {
        errs[field] = `${FIELD_LABELS[field] || field} é obrigatório`
      }
    }
    setErrors(errs)
    if (Object.keys(errs).length > 0) return false

    // Avisa sobre recomendados mas permite avançar
    const faltando = recommended.filter(f => !formData[f])
    if (faltando.length > 0) {
      const labels = faltando.map(f => FIELD_LABELS[f] || f).join(', ')
      toast.warning('Dados incompletos', `Complete depois no perfil: ${labels}`)
    }
    return true
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

  async function saveStep1() {
    if (!validate(1)) return false

    setSaving(true)
    try {
      // Build the funcionario record from step 1 fields
      const funcRecord: Record<string, any> = {
        nome: formData.nome,
        data_nascimento: formData.data_nascimento || null,
        cpf: formData.cpf ? formData.cpf.replace(/\D/g, '') : null,
        re: formData.re || null,
        pis: formData.pis || null,
        naturalidade: formData.naturalidade || null,
        estado_civil: formData.estado_civil || null,
        raca_cor: formData.raca_cor || null,
        nome_mae: formData.nome_mae || null,
        nome_pai: formData.nome_pai || null,
        titulo_eleitor: formData.titulo_eleitor || null,
        telefone: formData.telefone || null,
        email: formData.email || null,
        endereco: formData.endereco || null,
        cidade_endereco: formData.cidade_endereco || null,
        cep: formData.cep || null,
        cargo: 'PENDENTE',
        status: 'em_admissao',
      }

      if (funcionarioId) {
        // Update existing
        const { error } = await supabase.from('funcionarios').update(funcRecord).eq('id', funcionarioId)
        if (error) { toast.error('Erro ao salvar', formatSupabaseError(error)); return false }
      } else {
        // Insert new
        const { data, error } = await supabase.from('funcionarios').insert(funcRecord).select('id').single()
        if (error) { toast.error('Erro ao salvar', formatSupabaseError(error)); return false }
        setFuncionarioId(data.id)

        // Create workflow
        const wfData: Record<string, any> = {
          funcionario_id: data.id,
          status: 'em_andamento',
          data_prevista_inicio: formData.admissao || new Date().toISOString().slice(0, 10),
          wizard_passo_atual: 1,
          etapa_docs_pessoais: { ok: false },
          etapa_exame_admissional: { ok: false },
          etapa_ctps: { ok: false },
          etapa_contrato_assinado: { ok: false },
          etapa_dados_bancarios: { ok: false },
          etapa_epi_entregue: { ok: false },
          etapa_nr_obrigatorias: { ok: false },
          etapa_integracao: { ok: false },
          etapa_uniforme: { ok: false },
          etapa_esocial: { ok: false },
        }
        const { data: wf, error: wfErr } = await supabase.from('admissoes_workflow').insert(wfData).select('id').single()
        if (wfErr) { toast.error('Erro ao criar workflow', formatSupabaseError(wfErr)); return false }
        setWorkflowId(wf.id)
      }
      return true
    } catch (err: any) {
      toast.error('Erro inesperado', err?.message || '')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function saveStep2to4() {
    if (!validate(step)) return false
    if (!funcionarioId) { toast.error('Funcionario nao encontrado'); return false }

    setSaving(true)
    try {
      // Build update object based on current step
      const update: Record<string, any> = {}

      if (step === 2) {
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
        // Calculate custo_hora
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
      } else if (step === 4) {
        // ASO data stored separately — update workflow
      }

      // Update funcionario
      if (Object.keys(update).length > 0) {
        const { error } = await supabase.from('funcionarios').update(update).eq('id', funcionarioId)
        if (error) { toast.error('Erro ao salvar', formatSupabaseError(error)); return false }
      }

      // Update workflow etapa + passo
      if (workflowId) {
        const wfUpdate: Record<string, any> = {
          wizard_passo_atual: step,
        }
        if (step === 2) {
          wfUpdate.etapa_docs_pessoais = { ok: true }
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
      }

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
    if (step === 1) {
      success = await saveStep1()
    } else if (step >= 2 && step <= 4) {
      success = await saveStep2to4()
    } else {
      // Steps 5-8: placeholder — just advance
      success = true
    }

    if (success) {
      setCompletedSteps(prev => prev.includes(step) ? prev : [...prev, step])
      if (step < 8) {
        setStep(step + 1)
        toast.success(`${STEP_LABELS[step]} salvo!`)
      } else {
        await concluirAdmissao()
      }
    }
  }

  async function concluirAdmissao() {
    if (!funcionarioId) { toast.error('Funcionário não encontrado'); return }
    setSaving(true)
    try {
      const obraId = formData.obra_id || null
      const dataInicio = formData.data_inicio_obra || formData.admissao || new Date().toISOString().slice(0, 10)

      // 1. Status: alocado se tem obra, senão disponivel
      const novoStatus = obraId ? 'alocado' : 'disponivel'
      await supabase.from('funcionarios').update({ status: novoStatus }).eq('id', funcionarioId)

      // 2. Criar alocação se tiver obra
      if (obraId) {
        const { data: existing } = await supabase.from('alocacoes')
          .select('id').eq('funcionario_id', funcionarioId).eq('obra_id', obraId).eq('ativo', true).maybeSingle()
        if (!existing) {
          await supabase.from('alocacoes').insert({
            funcionario_id: funcionarioId,
            obra_id: obraId,
            data_inicio: dataInicio,
            ativo: true,
          })
        }
      }

      // 3. Fechar workflow
      if (workflowId) {
        await supabase.from('admissoes_workflow').update({
          status: 'concluida',
          concluida_em: new Date().toISOString(),
        }).eq('id', workflowId)
      }

      // 4. Notificar diretoria
      try {
        const obraNome = obras.find((o: any) => o.id === obraId)?.nome
        const titulo = obraNome
          ? `✅ ${formData.nome} admitido em ${obraNome}`
          : `✅ ${formData.nome} admitido`
        // Busca usuários de diretoria/admin pra notificar
        const { data: destinatarios } = await supabase.from('profiles')
          .select('user_id').in('role', ['admin', 'diretoria'])
        for (const d of destinatarios ?? []) {
          if ((d as any).user_id) {
            await supabase.from('notificacoes').insert({
              destinatario_id: (d as any).user_id,
              tipo: 'info',
              titulo,
              mensagem: `Admissão concluída por meio do wizard`,
              ref_tabela: 'funcionarios',
              ref_id: funcionarioId,
              lida: false,
            })
          }
        }
      } catch { /* notificação não é crítica */ }

      // 5. Limpa draft
      try { localStorage.removeItem(LS_KEY) } catch {}

      toast.success('Admissão concluída!', 'Funcionário cadastrado com sucesso.')
      router.push(`/funcionarios/${funcionarioId}`)
    } catch (e: any) {
      toast.error('Erro ao concluir admissão', e?.message ?? '')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveRascunho() {
    setSaving(true)
    try {
      // Save without validation
      if (funcionarioId) {
        const fields: Record<string, any> = {}
        // Save whatever we have
        if (formData.nome) fields.nome = formData.nome
        if (formData.cpf) fields.cpf = formData.cpf
        if (formData.telefone) fields.telefone = formData.telefone
        if (formData.cargo && formData.cargo !== 'PENDENTE') fields.cargo = formData.cargo

        if (Object.keys(fields).length > 0) {
          await supabase.from('funcionarios').update(fields).eq('id', funcionarioId)
        }
      }
      if (workflowId) {
        await supabase.from('admissoes_workflow').update({ wizard_passo_atual: step }).eq('id', workflowId)
      }
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
    // Permite navegar pra qualquer etapa já completada ou pra etapa anterior à atual (P16)
    if (completedSteps.includes(s) || s < step) {
      setStep(s)
    }
  }

  function renderStep() {
    switch (step) {
      case 1:
        return <WizardStep1Pessoal data={formData} onChange={handleChange} errors={errors} />
      case 2:
        return <WizardStep2Contrato data={formData} onChange={handleChange} errors={errors} funcoes={funcoes} obras={obras} />
      case 3:
        return <WizardStep3CtpsBanco data={formData} onChange={handleChange} errors={errors} />
      case 4:
        return <WizardStep4ASO data={formData} onChange={handleChange} errors={errors} onFileUpload={handleFileUpload} />
      case 5:
        return funcionarioId ? <WizardStep5NRs funcionario={{ id: funcionarioId, funcao_id: formData.funcao_id, nome: formData.nome, cargo: formData.cargo }} workflowId={workflowId!} onComplete={() => { setCompletedSteps(s => Array.from(new Set([...s, 5]))); setStep(6) }} /> : null
      case 6:
        return funcionarioId ? <WizardStep6EPI funcionario={{ id: funcionarioId, funcao_id: formData.funcao_id, nome: formData.nome, cargo: formData.cargo, matricula: formData.matricula }} workflowId={workflowId!} onComplete={() => { setCompletedSteps(s => Array.from(new Set([...s, 6]))); setStep(7) }} /> : null
      case 7:
        return funcionarioId ? <WizardStep7Uniforme funcionario={{ id: funcionarioId, funcao_id: formData.funcao_id, nome: formData.nome, tamanho_uniforme: formData.tamanho_uniforme, tamanho_bota: formData.tamanho_bota, matricula: formData.matricula }} workflowId={workflowId!} onComplete={() => { setCompletedSteps(s => Array.from(new Set([...s, 7]))); setStep(8) }} /> : null
      case 8:
        return funcionarioId ? <WizardStep8Integracao funcionario={{ id: funcionarioId, nome: formData.nome, cargo: formData.cargo }} workflowId={workflowId!} obras={obras} onComplete={() => { router.push(`/funcionarios/${funcionarioId}`) }} /> : null
      default:
        return (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <p className="text-lg font-semibold">Etapa {step}: {STEP_LABELS[step]}</p>
            <p className="text-sm mt-2">Em breve</p>
          </div>
        )
    }
  }

  const nome = formData.nome || 'Novo Funcionário'

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 sm:p-6 md:p-8">
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-2 bg-white border-b border-gray-200 flex-shrink-0">
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
      <main className="flex-1 overflow-y-auto min-h-0">
        <div className="max-w-4xl mx-auto p-4 sm:p-6">
          <h2 className="text-lg font-bold font-display text-brand mb-1">
            {step}. {STEP_LABELS[step]}
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            Preencha os dados abaixo e clique em &quot;Salvar e avançar&quot; para continuar.
          </p>
          {renderStep()}
        </div>
      </main>

      {/* Footer (in flex flow) */}
      <footer className="flex-shrink-0 bg-white border-t border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between">
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
            {saving ? 'Salvando...' : step < 8 ? 'Salvar e avançar' : 'Concluir admissão'}
            {step < 8 && <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </footer>
      </div>
    </div>
  )
}
