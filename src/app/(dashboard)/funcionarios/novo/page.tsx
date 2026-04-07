'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Breadcrumb from '@/components/ui/Breadcrumb'
import Tooltip from '@/components/ui/Tooltip'
import { useToast } from '@/components/Toast'
import { formatSupabaseError } from '@/lib/errors'

export default function NovoFuncionarioPage() {
  const [form, setForm] = useState<any>({
    nome: '', nome_guerra: '', matricula: '', id_ponto: '', cpf: '', data_nascimento: '',
    funcao_id: '', cargo: '', turno: 'diurno', tipo_vinculo: 'experiencia_45_45',
    admissao: '', obra_id: '',
    salario_base: '', horas_mes: '220', insalubridade_pct: '0', periculosidade_pct: '0',
    vt_mensal: '', vr_diario: '', va_mensal: '', plano_saude_mensal: '', outros_beneficios: '',
    pis: '', banco: '', agencia_conta: '', pix: '', vt_estrutura: '',
    tamanho_bota: '', tamanho_uniforme: '', re: '',
  })
  const [cpfHistorico, setCpfHistorico] = useState<any | null>(null)
  const [cpfChecking, setCpfChecking] = useState(false)
  const [etapa, setEtapa] = useState(1)
  const [funcoes, setFuncoes] = useState<any[]>([])
  const [obras, setObras] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [showNovaFuncao, setShowNovaFuncao] = useState(false)
  const [novaFuncaoNome, setNovaFuncaoNome] = useState('')
  const [novaFuncaoCat, setNovaFuncaoCat] = useState('Montagem')
  const [criandoFuncao, setCriandoFuncao] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()

  const CATEGORIAS_FUNCAO = ['Montagem', 'Elétrica', 'Gestão', 'Qualidade', 'Suporte', 'Tubulação', 'Pintura', 'Mecânica', 'Equipamentos', 'Operacional', 'Administrativo', 'Engenharia']

  async function checkCpfHistorico(cpf: string) {
    if (!cpf || cpf.replace(/\D/g, '').length < 11) { setCpfHistorico(null); return }
    setCpfChecking(true)
    // Buscar funcionário soft-deleted com este CPF
    const { data: oldFunc } = await supabase.from('funcionarios')
      .select('id, nome, cpf, data_nascimento, pis, banco, pix, cargo, admissao, deleted_at')
      .eq('cpf', cpf)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Buscar vínculos anteriores
    const { data: vinculos } = await supabase.from('vinculos_funcionario')
      .select('*')
      .eq('cpf', cpf)
      .order('demissao', { ascending: false })
      .limit(1)

    const v = vinculos?.[0]
    if (oldFunc || v) {
      setCpfHistorico({
        nome: oldFunc?.nome ?? v?.cargo ?? '',
        admissao: oldFunc?.admissao ?? v?.admissao,
        demissao: oldFunc?.deleted_at ? oldFunc.deleted_at.split('T')[0] : v?.demissao,
        cargo: oldFunc?.cargo ?? v?.cargo,
      })
      // Pré-preencher dados se houver funcionário anterior
      if (oldFunc) {
        setForm((f: any) => ({
          ...f,
          nome: oldFunc.nome ?? f.nome,
          data_nascimento: oldFunc.data_nascimento ?? f.data_nascimento,
          pis: oldFunc.pis ?? f.pis,
          banco: oldFunc.banco ?? f.banco,
          pix: oldFunc.pix ?? f.pix,
        }))
      }
    } else {
      setCpfHistorico(null)
    }
    setCpfChecking(false)
  }

  async function handleCriarFuncaoInline() {
    if (!novaFuncaoNome.trim()) return
    setCriandoFuncao(true)
    const { data, error: fErr } = await supabase.from('funcoes').insert({
      nome: novaFuncaoNome.trim().toUpperCase(),
      categoria: novaFuncaoCat,
      multiplicador_extra: 1.7,
      multiplicador_noturno: 1.4,
      ativo: true,
    }).select().single()
    if (fErr) {
      toast.error('Erro ao criar função: ' + fErr.message)
    } else {
      toast.success(`Função "${data.nome}" criada!`)
      const { data: updated } = await supabase.from('funcoes').select('*').eq('ativo', true).order('nome')
      setFuncoes(updated ?? [])
      set('funcao_id', data.id)
      setShowNovaFuncao(false)
      setNovaFuncaoNome('')
    }
    setCriandoFuncao(false)
  }

  useEffect(() => {
    supabase.from('funcoes').select('*').eq('ativo', true).order('nome')
      .then(({ data }) => setFuncoes(data ?? []))
    supabase.from('obras').select('*').eq('status', 'ativo').order('nome')
      .then(({ data }) => setObras(data ?? []))
  }, [])

  function set(field: string, value: any) {
    setForm((f: any) => {
      const next = { ...f, [field]: value }
      if (field === 'funcao_id' && value) {
        const fn = funcoes.find(fn => fn.id === value)
        if (fn) {
          next.cargo = fn.nome
        }
      }
      return next
    })
  }

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

  function handleNext() {
    setError('')
    if (etapa === 1) {
      if (!form.nome.trim()) {
        setError('Nome é obrigatório.')
        return
      }
    }
    if (etapa === 2) {
      if (!form.cargo.trim() && !form.funcao_id) {
        setError('Selecione uma função ou preencha o cargo.')
        return
      }
      if (!form.admissao) {
        setError('Data de admissão é obrigatória.')
        return
      }
    }
    if (etapa === 3) {
      if (!form.salario_base || parseFloat(form.salario_base) <= 0) {
        setError('Salário base é obrigatório.')
        return
      }
    }
    setEtapa(etapa + 1)
  }

  async function handleSave() {
    setLoading(true)
    setError('')
    const { data, error: insertError } = await supabase.from('funcionarios').insert({
      nome: form.nome.trim().toUpperCase(),
      nome_guerra: form.nome_guerra?.trim() || null,
      matricula: form.matricula?.trim() || null,
      id_ponto: form.id_ponto?.trim() || null,
      cpf: form.cpf || null,
      data_nascimento: form.data_nascimento || null,
      funcao_id: form.funcao_id || null,
      cargo: form.cargo.trim().toUpperCase() || 'OUTROS',
      turno: form.turno,
      tipo_vinculo: form.tipo_vinculo || 'experiencia_45_45',
      admissao: form.admissao || null,
      salario_base: parseFloat(form.salario_base) || null,
      horas_mes: parseFloat(form.horas_mes) || 220,
      insalubridade_pct: parseFloat(form.insalubridade_pct) || 0,
      periculosidade_pct: parseFloat(form.periculosidade_pct) || 0,
      vt_mensal: parseFloat(form.vt_mensal) || 0,
      vr_diario: parseFloat(form.vr_diario) || 0,
      va_mensal: parseFloat(form.va_mensal) || 0,
      plano_saude_mensal: parseFloat(form.plano_saude_mensal) || 0,
      outros_beneficios: parseFloat(form.outros_beneficios) || 0,
      custo_hora: custoHora > 0 ? custoHora : null,
      pis: form.pis || null,
      banco: form.banco || null,
      agencia_conta: form.agencia_conta || null,
      pix: form.pix || null,
      vt_estrutura: form.vt_estrutura || null,
      tamanho_bota: form.tamanho_bota || null,
      tamanho_uniforme: form.tamanho_uniforme || null,
      re: form.re || null,
    }).select('id').single()

    if (insertError) {
      setError(formatSupabaseError(insertError))
      setLoading(false)
      return
    }

    if (form.obra_id && data?.id) {
      await supabase.from('alocacoes').insert({
        funcionario_id: data.id,
        obra_id: form.obra_id,
        data_inicio: form.admissao || new Date().toISOString().split('T')[0],
      })
    }

    toast.show('Funcionario cadastrado!')
    setSavedId(data?.id ?? null)
    setShowModal(true)
    setLoading(false)
  }

  const inp = "w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand"
  const lbl = "block text-xs font-semibold text-gray-600 mb-1"

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <Breadcrumb fallback="/funcionarios" items={[
        { label: 'Funcionarios', href: '/funcionarios' },
        { label: 'Novo funcionario' },
      ]} />

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h1 className="text-lg font-bold font-display text-brand mb-4">Novo Funcionário</h1>

        {/* Progress Bar */}
        <div className="flex items-center gap-2 mb-6">
          {[{n:1,label:'Identificação'},{n:2,label:'Cargo'},{n:3,label:'Remuneração'},{n:4,label:'Documentos'}].map(step => (
            <div key={step.n} className="flex-1">
              <div className={`h-1.5 rounded-full ${etapa > step.n ? 'bg-green-500' : etapa === step.n ? 'bg-brand' : 'bg-gray-200'}`} />
              <p className={`text-[10px] mt-1 font-medium ${etapa === step.n ? 'text-brand' : etapa > step.n ? 'text-green-600' : 'text-gray-400'}`}>
                {etapa > step.n ? '✓ ' : ''}{step.label}
              </p>
            </div>
          ))}
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200">{error}</div>}

        {/* Step 1 — Identificação */}
        {etapa === 1 && (
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">Identificação</h3>

            {cpfHistorico && (
              <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-start gap-2">
                  <span className="text-amber-500 text-lg flex-shrink-0">⚠</span>
                  <div className="text-sm">
                    <p className="font-bold text-amber-800">Este CPF já possui cadastro anterior na empresa.</p>
                    <p className="text-amber-700 mt-1">
                      <strong>{cpfHistorico.nome}</strong> — Admitido em{' '}
                      {cpfHistorico.admissao ? new Date(cpfHistorico.admissao + 'T12:00').toLocaleDateString('pt-BR') : '—'} | Demitido em{' '}
                      {cpfHistorico.demissao ? new Date(cpfHistorico.demissao + 'T12:00').toLocaleDateString('pt-BR') : '—'} | Cargo: {cpfHistorico.cargo ?? '—'}
                    </p>
                    <p className="text-xs text-amber-600 mt-2">
                      Este funcionário pode ser recontratado. O histórico anterior será preservado. Os dados pessoais foram pré-preenchidos.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="col-span-1 sm:col-span-2">
                <label className={lbl}>Nome completo *</label>
                <input type="text" value={form.nome} onChange={e => set('nome', e.target.value)} className={inp} placeholder="NOME SOBRENOME" style={{textTransform:'uppercase'}} />
              </div>
              <div className="col-span-1 sm:col-span-2">
                <label className={lbl}>Nome de Guerra / Apelido (opcional)</label>
                <input type="text" value={form.nome_guerra} onChange={e => set('nome_guerra', e.target.value)} className={inp} placeholder="Como é chamado no dia a dia" />
              </div>
              <div>
                <label className={lbl}>CPF</label>
                <input
                  type="text"
                  value={form.cpf}
                  onChange={e => set('cpf', e.target.value)}
                  onBlur={e => checkCpfHistorico(e.target.value)}
                  className={inp}
                  placeholder="000.000.000-00"
                />
                {cpfChecking && <p className="text-xs text-gray-400 mt-1">Verificando histórico...</p>}
              </div>
              <div>
                <label className={lbl}>Data de nascimento</label>
                <input type="date" value={form.data_nascimento} onChange={e => set('data_nascimento', e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>Matrícula (opcional)</label>
                <input type="text" value={form.matricula} onChange={e => set('matricula', e.target.value)} className={inp} placeholder="Matrícula interna" />
              </div>
              <div>
                <label className={lbl}>ID Ponto (Secullum)</label>
                <input type="text" inputMode="numeric" pattern="[0-9]*" value={form.id_ponto}
                  onChange={e => set('id_ponto', e.target.value.replace(/\D/g, ''))}
                  placeholder="Identificador do Secullum" className={inp} />
              </div>
            </div>
          </section>
        )}

        {/* Step 2 — Cargo e Contrato */}
        {etapa === 2 && (
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">Cargo e Contrato</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="col-span-1 sm:col-span-2">
                <label className={lbl}>Função cadastrada</label>
                <div className="flex gap-2">
                  <select value={form.funcao_id} onChange={e => set('funcao_id', e.target.value)} className={inp + ' bg-white flex-1'}>
                    <option value="">Selecione uma função...</option>
                    {funcoes.map(f => (
                      <option key={f.id} value={f.id}>{f.nome}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => setShowNovaFuncao(true)}
                    className="px-3 py-2 border border-gray-200 rounded-xl text-sm text-brand font-medium hover:bg-gray-50 whitespace-nowrap flex-shrink-0">
                    + Nova
                  </button>
                </div>
                {showNovaFuncao && (
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-blue-800">Criar nova função</span>
                      <button type="button" onClick={() => setShowNovaFuncao(false)} className="text-blue-400 hover:text-blue-600 text-xs">Cancelar</button>
                    </div>
                    <div className="flex gap-2">
                      <input type="text" value={novaFuncaoNome} onChange={e => setNovaFuncaoNome(e.target.value)}
                        placeholder="Ex: ENGENHEIRO CIVIL" className="flex-1 px-3 py-2 border border-blue-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand" />
                      <select value={novaFuncaoCat} onChange={e => setNovaFuncaoCat(e.target.value)}
                        className="px-2 py-2 border border-blue-200 rounded-lg text-sm bg-white">
                        {CATEGORIAS_FUNCAO.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <button type="button" onClick={handleCriarFuncaoInline} disabled={!novaFuncaoNome.trim() || criandoFuncao}
                        className="px-3 py-2 bg-brand text-white rounded-lg text-xs font-medium hover:bg-brand-dark disabled:opacity-50">
                        {criandoFuncao ? '...' : 'Criar'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className={lbl}>Cargo (texto livre)</label>
                <input type="text" value={form.cargo} onChange={e => set('cargo', e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>Turno</label>
                <select value={form.turno} onChange={e => set('turno', e.target.value)} className={inp + ' bg-white'}>
                  <option value="diurno">Diurno</option>
                  <option value="noturno">Noturno</option>
                  <option value="misto">Misto</option>
                </select>
              </div>
              <div>
                <label className={lbl}>
                  Tipo de vínculo
                  <Tooltip text="Tipo de contrato de trabalho. Na maioria dos casos é Experiência 45+45 dias." />
                </label>
                <select value={form.tipo_vinculo} onChange={e => set('tipo_vinculo', e.target.value)} className={inp + ' bg-white'}>
                  <option value="experiencia_45_45">Experiência 45+45 dias</option>
                  <option value="experiencia_30_60">Experiência 30+60 dias</option>
                  <option value="experiencia_90">Experiência 90 dias</option>
                  <option value="determinado_6m">Determinado 6 meses</option>
                  <option value="determinado_12m">Determinado 12 meses</option>
                  <option value="indeterminado">Indeterminado (CLT)</option>
                  <option value="temporario">Temporário</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Data de admissão *</label>
                <input type="date" value={form.admissao} onChange={e => set('admissao', e.target.value)} className={inp} />
              </div>
              <div className="col-span-1 sm:col-span-2">
                <label className={lbl}>Obra (opcional)</label>
                <select value={form.obra_id} onChange={e => set('obra_id', e.target.value)} className={inp + ' bg-white'}>
                  <option value="">Nenhuma obra selecionada</option>
                  {obras.map(o => (
                    <option key={o.id} value={o.id}>{o.nome}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>
        )}

        {/* Step 3 — Remuneração */}
        {etapa === 3 && (
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">Remuneração</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Salário base (R$/mês) *</label>
                <input type="number" step="0.01" value={form.salario_base} onChange={e => set('salario_base', e.target.value)} className={inp} placeholder="0,00" />
              </div>
              <div>
                <label className={lbl}>Horas/mês</label>
                <input type="number" step="0.5" value={form.horas_mes} onChange={e => set('horas_mes', e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>
                  Insalubridade (%)
                  <Tooltip text="Adicional de insalubridade calculado sobre o salário base. Grau médio 20%, grau máximo 40%." />
                </label>
                <select value={form.insalubridade_pct} onChange={e => set('insalubridade_pct', e.target.value)} className={inp + ' bg-white'}>
                  <option value="0">Nenhuma (0%)</option>
                  <option value="20">Grau médio (20%)</option>
                  <option value="40">Grau máximo (40%)</option>
                </select>
              </div>
              <div>
                <label className={lbl}>
                  Periculosidade (%)
                  <Tooltip text="Adicional de periculosidade de 30% sobre o salário base para atividades de risco." />
                </label>
                <select value={form.periculosidade_pct} onChange={e => set('periculosidade_pct', e.target.value)} className={inp + ' bg-white'}>
                  <option value="0">Nenhuma (0%)</option>
                  <option value="30">Sim (30%)</option>
                </select>
              </div>
            </div>

            <h4 className="text-xs font-semibold text-gray-400 mt-4 mb-2">Benefícios</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={lbl}>VT mensal (R$)</label>
                <input type="number" step="0.01" value={form.vt_mensal} onChange={e => set('vt_mensal', e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>VR por dia (R$)</label>
                <input type="number" step="0.01" value={form.vr_diario} onChange={e => set('vr_diario', e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>VA mensal (R$)</label>
                <input type="number" step="0.01" value={form.va_mensal} onChange={e => set('va_mensal', e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>Plano de saúde (R$/mês)</label>
                <input type="number" step="0.01" value={form.plano_saude_mensal} onChange={e => set('plano_saude_mensal', e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>Outros benefícios (R$/mês)</label>
                <input type="number" step="0.01" value={form.outros_beneficios} onChange={e => set('outros_beneficios', e.target.value)} className={inp} />
              </div>
            </div>

            {/* Preview de custo */}
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
        )}

        {/* Step 4 — Documentos */}
        {etapa === 4 && (
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">Documentos e Dados Complementares</h3>
            <p className="text-xs text-gray-400 mb-3">Estes campos são opcionais. Você pode preencher depois.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={lbl}>PIS</label>
                <input type="text" value={form.pis} onChange={e => set('pis', e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>Banco</label>
                <input type="text" value={form.banco} onChange={e => set('banco', e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>Agência / Conta</label>
                <input type="text" value={form.agencia_conta} onChange={e => set('agencia_conta', e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>PIX</label>
                <input type="text" value={form.pix} onChange={e => set('pix', e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>VT Estrutura</label>
                <input type="text" value={form.vt_estrutura} onChange={e => set('vt_estrutura', e.target.value)} placeholder="10+7,25+7,25" className={inp} />
              </div>
              <div>
                <label className={lbl}>Tamanho Bota</label>
                <input type="text" value={form.tamanho_bota} onChange={e => set('tamanho_bota', e.target.value)} placeholder="42" className={inp} />
              </div>
              <div>
                <label className={lbl}>Tamanho Uniforme</label>
                <input type="text" value={form.tamanho_uniforme} onChange={e => set('tamanho_uniforme', e.target.value)} placeholder="G" className={inp} />
              </div>
              <div>
                <label className={lbl}>RE</label>
                <input type="text" value={form.re} onChange={e => set('re', e.target.value)} className={inp} />
              </div>
            </div>
          </section>
        )}

        {/* Navigation buttons */}
        <div className="flex gap-3 pt-4 border-t border-gray-100">
          {etapa > 1 && (
            <button type="button" onClick={() => setEtapa(etapa - 1)} className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">
              Voltar
            </button>
          )}
          {etapa < 4 && (
            <button type="button" onClick={handleNext} className="px-5 py-2.5 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark">
              Próximo
            </button>
          )}
          {etapa === 4 && (
            <button type="button" onClick={handleSave} disabled={loading} className="px-5 py-2.5 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50">
              {loading ? 'Salvando...' : 'Salvar funcionário'}
            </button>
          )}
          {etapa === 4 && (
            <button type="button" onClick={handleSave} className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50">
              Pular por agora
            </button>
          )}
        </div>
      </div>

      {/* Completion Modal */}
      {showModal && savedId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-8 max-w-md w-full mx-4 animate-slide-up">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-brand/10 text-brand flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-black font-display">
                  {form.nome.trim().split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() || '??'}
                </span>
              </div>
              <h2 className="text-lg font-bold font-display text-brand">Funcionario cadastrado!</h2>
              <p className="text-sm text-gray-500 mt-1">{form.nome.trim().toUpperCase()} — {form.cargo || 'Sem cargo'}</p>
            </div>

            <div className="space-y-3 mb-6">
              <button
                onClick={() => router.push(`/rh/admissoes/novo?funcionario_id=${savedId}`)}
                className="w-full p-4 rounded-xl border-2 border-brand bg-brand/5 hover:bg-brand/10 transition-colors text-left group"
              >
                <p className="text-sm font-bold text-brand group-hover:underline">Iniciar processo de admissao agora</p>
                <p className="text-xs text-gray-500 mt-0.5">Documentos, exame admissional, EPI, eSocial...</p>
              </button>

              <button
                onClick={() => router.push(`/funcionarios/${savedId}`)}
                className="w-full p-4 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors text-left"
              >
                <p className="text-sm font-semibold text-gray-700">Ver perfil do funcionario</p>
                <p className="text-xs text-gray-400 mt-0.5">Visualizar dados cadastrados</p>
              </button>
            </div>

            <div className="text-center">
              <button onClick={() => router.push('/funcionarios')} className="text-xs text-gray-400 hover:text-gray-600 hover:underline">
                Fazer isso depois
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
