'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Breadcrumb from '@/components/ui/Breadcrumb'
import Tooltip from '@/components/ui/Tooltip'
import { formatSupabaseError } from '@/lib/errors'
import DeleteEntityButton from '@/components/DeleteEntityButton'
import AdmissaoStepPanel from '@/components/AdmissaoStepPanel'

export default function EditarFuncionarioPage({ params }: { params: { id: string } }) {
  const [form, setForm] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const highlightField = searchParams.get('field')
  const fromAdmissao = searchParams.get('from') === 'admissao'
  const admissaoWorkflowId = searchParams.get('workflow_id')
  const admissaoStep = searchParams.get('step')
  const supabase = createClient()

  useEffect(() => {
    ;(async () => {
      try {
        const { data, error } = await supabase.from('funcionarios').select('*').eq('id', params.id).single()
        if (error) throw error
        if (data) setForm(data)
      } catch (e: any) {
        setError('Erro ao carregar funcionário: ' + (e?.message || 'desconhecido'))
      } finally {
        setLoading(false)
      }
    })()
  }, [params.id])

  // Scroll to and highlight field when coming from admissao panel
  useEffect(() => {
    if (!loading && highlightField) {
      setTimeout(() => {
        const el = document.querySelector(`[data-field="${highlightField}"]`)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          el.classList.add('ring-2', 'ring-brand', 'ring-offset-2', 'rounded-xl')
          const input = el.querySelector('input, select') as HTMLElement | null
          if (input) input.focus()
          setTimeout(() => el.classList.remove('ring-2', 'ring-brand', 'ring-offset-2', 'rounded-xl'), 3000)
        }
      }, 300)
    }
  }, [loading, highlightField])

  function set(field: string, value: any) { setForm((f: any) => ({ ...f, [field]: value })) }

  // CLT cost calculations
  const salarioBase = parseFloat(form.salario_base) || 0
  const insalubridade = salarioBase * (parseFloat(form.insalubridade_pct) || 0) / 100
  const periculosidade = salarioBase * (parseFloat(form.periculosidade_pct) || 0) / 100
  const salarioTotal = salarioBase + insalubridade + periculosidade
  const encargos = salarioTotal * 0.374
  const provisoes = salarioTotal * 0.21
  const vrMensal = (parseFloat(form.vr_diario) || 0) * 21
  const totalBeneficios = (parseFloat(form.vt_mensal) || 0) + vrMensal + (parseFloat(form.va_mensal) || 0) + (parseFloat(form.plano_saude_mensal) || 0) + (parseFloat(form.outros_beneficios) || 0)
  const custoTotal = salarioTotal + encargos + provisoes + totalBeneficios
  const horasMes = parseFloat(form.horas_mes) || 220
  const custoHora = horasMes > 0 ? Math.round(custoTotal / horasMes * 100) / 100 : 0
  const fmtR = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    // Validações de regras de negócio
    if (form.prazo1 && form.admissao && form.prazo1 < form.admissao) {
      setError('O 1º prazo de experiência não pode ser anterior à data de admissão.')
      return
    }
    if (form.prazo2 && form.prazo1 && form.prazo2 < form.prazo1) {
      setError('O 2º prazo de experiência deve ser posterior ao 1º.')
      return
    }
    if (form.nao_renovar && !(form.observacao_renovacao ?? '').trim()) {
      setError('Ao marcar NÃO RENOVAR, informe o motivo no campo de observação.')
      return
    }

    setSaving(true)
    const { error } = await supabase.from('funcionarios').update({
      nome: form.nome, nome_guerra: form.nome_guerra || null,
      matricula: form.matricula || null, id_ponto: form.id_ponto || null,
      cargo: form.cargo,
      turno: form.turno, status: form.status,
      re: form.re || null, cpf: form.cpf || null, pis: form.pis || null,
      telefone: form.telefone || null,
      naturalidade: form.naturalidade || null,
      estado_civil: form.estado_civil || null,
      titulo_eleitor: form.titulo_eleitor || null,
      raca_cor: form.raca_cor || null,
      nome_pai: form.nome_pai || null,
      nome_mae: form.nome_mae || null,
      endereco: form.endereco || null,
      cidade_endereco: form.cidade_endereco || null,
      cep: form.cep || null,
      banco: form.banco || null, agencia_conta: form.agencia_conta || null, pix: form.pix || null,
      vt_estrutura: form.vt_estrutura || null,
      tamanho_bota: form.tamanho_bota || null, tamanho_uniforme: form.tamanho_uniforme || null,
      data_nascimento: form.data_nascimento || null,
      admissao: form.admissao || null,
      prazo1: form.prazo1 || null,
      prazo2: form.prazo2 || null,
      tipo_vinculo: form.tipo_vinculo || 'indeterminado',
      salario_base: parseFloat(form.salario_base) || null,
      insalubridade_pct: parseFloat(form.insalubridade_pct) || 0,
      periculosidade_pct: parseFloat(form.periculosidade_pct) || 0,
      vt_mensal: parseFloat(form.vt_mensal) || 0,
      vr_diario: parseFloat(form.vr_diario) || 0,
      va_mensal: parseFloat(form.va_mensal) || 0,
      plano_saude_mensal: parseFloat(form.plano_saude_mensal) || 0,
      outros_beneficios: parseFloat(form.outros_beneficios) || 0,
      horas_mes: parseFloat(form.horas_mes) || 220,
      custo_hora: custoHora > 0 ? custoHora : null,
      nao_renovar: !!form.nao_renovar,
      observacao_renovacao: form.observacao_renovacao || null,
    }).eq('id', params.id)
    if (error) { setError(formatSupabaseError(error)); setSaving(false); return }
    setSuccess(true)
    setTimeout(() => {
      const backUrl = fromAdmissao && admissaoWorkflowId && admissaoStep
        ? `/funcionarios/${params.id}?from=admissao&workflow_id=${admissaoWorkflowId}&step=${admissaoStep}`
        : `/funcionarios/${params.id}`
      router.push(backUrl)
      router.refresh()
    }, 1200)
  }

  if (loading) return <div className="p-4 sm:p-6 text-sm text-gray-400">Carregando...</div>

  const inp = "w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand"
  const lbl = "block text-xs font-semibold text-gray-700 mb-1"

  return (
    <div className={`p-4 sm:p-6 max-w-3xl mx-auto ${fromAdmissao ? 'md:mr-[280px]' : ''}`}>
      <Breadcrumb fallback="/funcionarios" items={[
        { label: 'Funcionarios', href: '/funcionarios' },
        { label: form.nome || '...', href: `/funcionarios/${params.id}` },
        { label: 'Editar' },
      ]} />

      {fromAdmissao && (
        <div className="mb-4 bg-blue-600 text-white rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm">
          <span>Preenchendo dados da admissao — salve para voltar ao checklist.</span>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h1 className="text-lg font-bold font-display text-brand mb-6">Editar funcionario</h1>
        {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl">Atualizado! Redirecionando...</div>}
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Identificação */}
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">Identificação</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="col-span-1 sm:col-span-2"><label className={lbl}>Nome completo *</label>
                <input required type="text" value={form.nome ?? ''} onChange={e => set('nome', e.target.value)} className={inp} style={{textTransform:'uppercase'}}/></div>
              <div><label className={lbl}>Nome de Guerra (opcional)</label>
                <input type="text" value={form.nome_guerra ?? ''} onChange={e => set('nome_guerra', e.target.value)} className={inp}/></div>
              <div data-field="matricula"><label className={lbl}>Matrícula (opcional)</label>
                <input type="text" value={form.matricula ?? ''} onChange={e => set('matricula', e.target.value)} className={inp}/></div>
              <div data-field="id_ponto"><label className={lbl}>ID Ponto (Secullum)</label>
                <input type="text" inputMode="numeric" pattern="[0-9]*" value={form.id_ponto ?? ''}
                  onChange={e => set('id_ponto', e.target.value.replace(/\D/g, ''))} className={inp}/></div>
              <div data-field="re"><label className={lbl}>RE</label>
                <input type="text" value={form.re ?? ''} onChange={e => set('re', e.target.value)} className={inp}/></div>
              <div data-field="cpf"><label className={lbl}>CPF</label>
                <input type="text" value={form.cpf ?? ''} onChange={e => set('cpf', e.target.value)} className={inp}/></div>
              <div data-field="pis"><label className={lbl}>PIS</label>
                <input type="text" value={form.pis ?? ''} onChange={e => set('pis', e.target.value)} className={inp}/></div>
              <div><label className={lbl}>Status</label>
                <select value={form.status ?? 'disponivel'} onChange={e => set('status', e.target.value)} className={inp + ' bg-white'}>
                  <option value="disponivel">Disponível</option><option value="alocado">Alocado</option>
                  <option value="afastado">Afastado</option><option value="inativo">Inativo</option>
                </select></div>
            </div>
          </section>

          {/* Função e Contrato */}
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">Função e Contrato</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={lbl}>Cargo *</label>
                <input required type="text" value={form.cargo ?? ''} onChange={e => set('cargo', e.target.value)} className={inp}/></div>
              <div><label className={lbl}>Turno</label>
                <select value={form.turno ?? 'diurno'} onChange={e => set('turno', e.target.value)} className={inp + ' bg-white'}>
                  <option value="diurno">Diurno</option><option value="noturno">Noturno</option><option value="misto">Misto</option>
                </select></div>
              <div data-field="data_nascimento"><label className={lbl}>Data de nascimento</label>
                <input type="date" value={form.data_nascimento ?? ''} onChange={e => set('data_nascimento', e.target.value)} className={inp}/></div>
              <div><label className={lbl}>Data de admissão</label>
                <input type="date" value={form.admissao ?? ''} onChange={e => set('admissao', e.target.value)} className={inp}/></div>
              <div><label className={lbl}>1º Prazo experiência (45d)</label>
                <input type="date" value={form.prazo1 ?? ''} min={form.admissao ?? undefined} onChange={e => set('prazo1', e.target.value)} className={inp}/></div>
              <div><label className={lbl}>2º Prazo experiência (90d)</label>
                <input type="date" value={form.prazo2 ?? ''} min={form.prazo1 ?? form.admissao ?? undefined} onChange={e => set('prazo2', e.target.value)} className={inp}/></div>
              <div><label className={lbl}>Tipo de vínculo</label>
                <select value={form.tipo_vinculo ?? 'indeterminado'} onChange={e => set('tipo_vinculo', e.target.value)} className={inp + ' bg-white'}>
                  <option value="experiencia_45_45">Experiência 45+45 dias</option>
                  <option value="experiencia_30_60">Experiência 30+60 dias</option>
                  <option value="experiencia_90">Experiência 90 dias</option>
                  <option value="determinado_6m">Determinado 6 meses</option>
                  <option value="determinado_12m">Determinado 12 meses</option>
                  <option value="indeterminado">Indeterminado (CLT)</option>
                  <option value="temporario">Temporário</option>
                </select></div>
            </div>
          </section>

          {/* Remuneração CLT */}
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">Remuneração e Custo CLT</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={lbl}>Salário base (R$/mês) *</label>
                <input type="number" step="0.01" value={form.salario_base ?? ''} onChange={e => set('salario_base', e.target.value)} className={inp} placeholder="0,00"/></div>
              <div><label className={lbl}>Horas/mês</label>
                <input type="number" step="0.5" value={form.horas_mes ?? 220} onChange={e => set('horas_mes', e.target.value)} className={inp}/></div>
              <div><label className={lbl}>Insalubridade (%) <Tooltip text="Adicional pago para quem trabalha em condições prejudiciais à saúde. Pergunte ao engenheiro de segurança." /></label>
                <select value={form.insalubridade_pct ?? 0} onChange={e => set('insalubridade_pct', e.target.value)} className={inp + ' bg-white'}>
                  <option value="0">Nenhuma (0%)</option>
                  <option value="10">Grau mínimo (10%)</option>
                  <option value="20">Grau médio (20%)</option>
                  <option value="30">Grau médio/máximo (30%)</option>
                  <option value="40">Grau máximo (40%)</option>
                </select></div>
              <div><label className={lbl}>Periculosidade (%) <Tooltip text="Adicional de 30% para atividades de risco de vida como trabalho com energia elétrica ou substâncias inflamáveis." /></label>
                <select value={form.periculosidade_pct ?? 0} onChange={e => set('periculosidade_pct', e.target.value)} className={inp + ' bg-white'}>
                  <option value="0">Nenhuma (0%)</option><option value="30">Sim (30%)</option>
                </select></div>
            </div>
            <h4 className="text-xs font-semibold text-gray-400 mt-4 mb-2">Benefícios</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={lbl}>VT mensal (R$)</label>
                <input type="number" step="0.01" value={form.vt_mensal ?? ''} onChange={e => set('vt_mensal', e.target.value)} className={inp}/></div>
              <div><label className={lbl}>VR por dia (R$)</label>
                <input type="number" step="0.01" value={form.vr_diario ?? ''} onChange={e => set('vr_diario', e.target.value)} className={inp}/></div>
              <div><label className={lbl}>VA mensal (R$)</label>
                <input type="number" step="0.01" value={form.va_mensal ?? ''} onChange={e => set('va_mensal', e.target.value)} className={inp}/></div>
              <div><label className={lbl}>Plano de saúde (R$/mês)</label>
                <input type="number" step="0.01" value={form.plano_saude_mensal ?? ''} onChange={e => set('plano_saude_mensal', e.target.value)} className={inp}/></div>
              <div><label className={lbl}>Outros benefícios (R$/mês)</label>
                <input type="number" step="0.01" value={form.outros_beneficios ?? ''} onChange={e => set('outros_beneficios', e.target.value)} className={inp}/></div>
              <div><label className={lbl}>VT Estrutura</label>
                <input type="text" value={form.vt_estrutura ?? ''} onChange={e => set('vt_estrutura', e.target.value)} placeholder="10+7,25+7,25" className={inp}/></div>
            </div>

            {salarioBase > 0 && (
              <div className="mt-4 p-4 bg-brand/5 rounded-xl border border-brand/10">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Preview de Custo CLT</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                  <div><p className="text-xs text-gray-400">Salário total</p><p className="font-bold text-gray-900">{fmtR(salarioTotal)}</p></div>
                  <div><p className="text-xs text-gray-400">Encargos (37,4%)</p><p className="font-bold text-red-600">{fmtR(encargos)}</p></div>
                  <div><p className="text-xs text-gray-400">Provisões (21%)</p><p className="font-bold text-amber-600">{fmtR(provisoes)}</p></div>
                  <div><p className="text-xs text-gray-400">Benefícios</p><p className="font-bold text-purple-600">{fmtR(totalBeneficios)}</p></div>
                  <div className="bg-brand/10 rounded-lg p-2"><p className="text-xs text-brand">Custo total/mês</p><p className="text-lg font-bold text-brand">{fmtR(custoTotal)}</p></div>
                  <div className="bg-brand/10 rounded-lg p-2"><p className="text-xs text-brand">Custo/hora real</p><p className="text-lg font-bold text-brand">{fmtR(custoHora)}/h</p></div>
                </div>
              </div>
            )}
          </section>

          {/* Dados pessoais complementares */}
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">Dados Pessoais</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div data-field="telefone"><label className={lbl}>Telefone</label>
                <input type="text" value={form.telefone ?? ''} onChange={e => set('telefone', e.target.value)} className={inp} /></div>
              <div data-field="naturalidade"><label className={lbl}>Naturalidade</label>
                <input type="text" value={form.naturalidade ?? ''} onChange={e => set('naturalidade', e.target.value)} className={inp} placeholder="Cidade-UF"/></div>
              <div data-field="estado_civil"><label className={lbl}>Estado civil</label>
                <select value={form.estado_civil ?? ''} onChange={e => set('estado_civil', e.target.value)} className={inp + ' bg-white'}>
                  <option value="">—</option>
                  <option>SOLTEIRO</option><option>CASADO</option><option>DIVORCIADO</option><option>VIUVO</option><option>UNIAO ESTAVEL</option>
                </select></div>
              <div data-field="raca_cor"><label className={lbl}>Raca/Cor</label>
                <select value={form.raca_cor ?? ''} onChange={e => set('raca_cor', e.target.value)} className={inp + ' bg-white'}>
                  <option value="">—</option>
                  <option>BRANCA</option><option>PRETA</option><option>PARDA</option><option>AMARELA</option><option>INDIGENA</option>
                </select></div>
              <div data-field="titulo_eleitor"><label className={lbl}>Titulo de Eleitor</label>
                <input type="text" value={form.titulo_eleitor ?? ''} onChange={e => set('titulo_eleitor', e.target.value)} className={inp}/></div>
              <div /> {/* spacer */}
              <div data-field="nome_pai"><label className={lbl}>Nome do Pai</label>
                <input type="text" value={form.nome_pai ?? ''} onChange={e => set('nome_pai', e.target.value)} className={inp}/></div>
              <div data-field="nome_mae"><label className={lbl}>Nome da Mae</label>
                <input type="text" value={form.nome_mae ?? ''} onChange={e => set('nome_mae', e.target.value)} className={inp}/></div>
              <div data-field="endereco" className="sm:col-span-2"><label className={lbl}>Endereco</label>
                <input type="text" value={form.endereco ?? ''} onChange={e => set('endereco', e.target.value)} className={inp}/></div>
              <div data-field="cidade_endereco"><label className={lbl}>Cidade</label>
                <input type="text" value={form.cidade_endereco ?? ''} onChange={e => set('cidade_endereco', e.target.value)} className={inp}/></div>
              <div data-field="cep"><label className={lbl}>CEP</label>
                <input type="text" value={form.cep ?? ''} onChange={e => set('cep', e.target.value)} className={inp}/></div>
            </div>
          </section>

          {/* Banco e EPIs */}
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">Dados bancários e EPI</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={lbl}>Banco</label>
                <input type="text" value={form.banco ?? ''} onChange={e => set('banco', e.target.value)} className={inp}/></div>
              <div><label className={lbl}>Agência / Conta</label>
                <input type="text" value={form.agencia_conta ?? ''} onChange={e => set('agencia_conta', e.target.value)} className={inp}/></div>
              <div><label className={lbl}>PIX</label>
                <input type="text" value={form.pix ?? ''} onChange={e => set('pix', e.target.value)} className={inp}/></div>
              <div data-field="tamanho_bota"><label className={lbl}>Tamanho Bota <span className="text-gray-400 font-normal">(Compras)</span></label>
                <input type="text" value={form.tamanho_bota ?? ''} onChange={e => set('tamanho_bota', e.target.value)} className={inp}/></div>
              <div data-field="tamanho_uniforme"><label className={lbl}>Tamanho Uniforme <span className="text-gray-400 font-normal">(Compras)</span></label>
                <input type="text" value={form.tamanho_uniforme ?? ''} onChange={e => set('tamanho_uniforme', e.target.value)} className={inp}/></div>
            </div>
          </section>

          {/* Renovação de contrato */}
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">Renovação de Contrato</h3>
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!form.nao_renovar} onChange={e => set('nao_renovar', e.target.checked)}
                  className="w-4 h-4 rounded text-red-600 focus:ring-red-500" />
                <span className="text-sm font-semibold text-red-700">⚠ NÃO RENOVAR contrato</span>
              </label>
              {form.nao_renovar && (
                <input type="text" value={form.observacao_renovacao ?? ''} onChange={e => set('observacao_renovacao', e.target.value)}
                  placeholder="Motivo / data limite (ex: Não renovar até 20.04)"
                  className={inp} />
              )}
            </div>
          </section>

          <div className="flex gap-3 pt-2 border-t border-gray-100 items-center">
            <button type="submit" disabled={saving || success}
              className="px-6 py-2.5 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50 transition-colors">
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
            <Link href={`/funcionarios/${params.id}`} className="px-6 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</Link>
            <div className="ml-auto">
              <DeleteEntityButton
                table="funcionarios" id={params.id} entityName={form.nome ?? 'funcionário'} redirectTo="/funcionarios"
                impactEntity="funcionario"
                impactTitle="Excluir funcionário"
                impactAction="Soft-delete. Histórico de ponto, folhas, BMs e documentos são preservados mas o funcionário some das listagens."
              />
            </div>
          </div>
        </form>
      </div>

      {fromAdmissao && admissaoWorkflowId && (
        <AdmissaoStepPanel
          funcionario={form}
          step={admissaoStep || 'docs_pessoais'}
          workflowId={admissaoWorkflowId}
        />
      )}
    </div>
  )
}
