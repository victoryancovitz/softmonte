'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import BackButton from '@/components/BackButton'

export default function NovoFuncionarioPage() {
  const [funcoes, setFuncoes] = useState<any[]>([])
  const [form, setForm] = useState<any>({
    nome: '', matricula: '', cargo: '', funcao_id: '',
    turno: 'diurno', jornada_horas: 8, status: 'disponivel',
    re: '', cpf: '', pis: '', banco: '', agencia_conta: '', pix: '',
    vt_estrutura: '', tamanho_bota: '', tamanho_uniforme: '',
    admissao: '', tipo_vinculo: 'experiencia_45_45',
    salario_base: '', insalubridade_pct: '0', periculosidade_pct: '0',
    vt_mensal: '', vr_diario: '', va_mensal: '', plano_saude_mensal: '', outros_beneficios: '', horas_mes: '189',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.from('funcoes').select('*').eq('ativo', true).order('nome')
      .then(({ data }) => setFuncoes(data ?? []))
  }, [])

  function set(field: string, value: any) {
    setForm((f: any) => {
      const next = { ...f, [field]: value }
      // Auto-preencher custo quando seleciona função
      if (field === 'funcao_id' && value) {
        const fn = funcoes.find(fn => fn.id === value)
        if (fn) {
          next.cargo = fn.nome
          next.custo_hora = fn.custo_hora?.toString() ?? ''
          next.custo_hora_extra = fn.custo_hora && fn.multiplicador_extra
            ? (fn.custo_hora * fn.multiplicador_extra).toFixed(2) : ''
          next.custo_hora_noturno = fn.custo_hora && fn.multiplicador_noturno
            ? (fn.custo_hora * fn.multiplicador_noturno).toFixed(2) : ''
        }
      }
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.from('funcionarios').insert({
      nome: form.nome.trim().toUpperCase(),
      matricula: form.matricula.trim(),
      cargo: form.cargo.trim().toUpperCase() || form.cargo,
      funcao_id: form.funcao_id || null,
      turno: form.turno,
      jornada_horas: parseInt(form.jornada_horas) || 8,
      status: form.status,
      re: form.re || null, cpf: form.cpf || null, pis: form.pis || null,
      banco: form.banco || null, agencia_conta: form.agencia_conta || null, pix: form.pix || null,
      vt_estrutura: form.vt_estrutura || null,
      tamanho_bota: form.tamanho_bota || null, tamanho_uniforme: form.tamanho_uniforme || null,
      admissao: form.admissao || null,
      tipo_vinculo: form.tipo_vinculo || 'experiencia_45_45',
      salario_base: parseFloat(form.salario_base) || null,
      insalubridade_pct: parseFloat(form.insalubridade_pct) || 0,
      periculosidade_pct: parseFloat(form.periculosidade_pct) || 0,
      vt_mensal: parseFloat(form.vt_mensal) || 0,
      vr_diario: parseFloat(form.vr_diario) || 0,
      va_mensal: parseFloat(form.va_mensal) || 0,
      plano_saude_mensal: parseFloat(form.plano_saude_mensal) || 0,
      outros_beneficios: parseFloat(form.outros_beneficios) || 0,
      horas_mes: parseFloat(form.horas_mes) || 189,
      custo_hora: custoHora > 0 ? custoHora : null,
    })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/funcionarios')
  }

  // CLT cost calculations
  const salarioBase = parseFloat(form.salario_base) || 0
  const insalubridade = salarioBase * (parseFloat(form.insalubridade_pct) || 0) / 100
  const periculosidade = salarioBase * (parseFloat(form.periculosidade_pct) || 0) / 100
  const salarioTotal = salarioBase + insalubridade + periculosidade
  const encargos = salarioTotal * 0.374 // INSS 20% + FGTS 8% + RAT 3% + Sistema S 6.4%
  const provisoes = salarioTotal * 0.21 // 13º + Férias + 1/3 + FGTS sobre elas
  const vrMensal = (parseFloat(form.vr_diario) || 0) * 22
  const totalBeneficios = (parseFloat(form.vt_mensal) || 0) + vrMensal + (parseFloat(form.va_mensal) || 0) + (parseFloat(form.plano_saude_mensal) || 0) + (parseFloat(form.outros_beneficios) || 0)
  const custoTotal = salarioTotal + encargos + provisoes + totalBeneficios
  const horasMes = parseFloat(form.horas_mes) || 189
  const custoHora = horasMes > 0 ? Math.round(custoTotal / horasMes * 100) / 100 : 0
  const fmtR = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const inp = "w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand"
  const lbl = "block text-xs font-semibold text-gray-600 mb-1"

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/funcionarios" />
        <Link href="/funcionarios" className="text-gray-400 hover:text-gray-600">Funcionários</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium">Novo</span>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h1 className="text-lg font-bold font-display text-brand mb-6">Novo funcionário</h1>
        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Identificação */}
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">Identificação</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="col-span-1 sm:col-span-2"><label className={lbl}>Nome completo *</label>
                <input required type="text" value={form.nome} onChange={e => set('nome', e.target.value)} className={inp} placeholder="NOME SOBRENOME" style={{textTransform:'uppercase'}}/></div>
              <div><label className={lbl}>Matrícula *</label>
                <input required type="text" value={form.matricula} onChange={e => set('matricula', e.target.value)} className={inp}/></div>
              <div><label className={lbl}>RE</label>
                <input type="text" value={form.re} onChange={e => set('re', e.target.value)} className={inp}/></div>
              <div><label className={lbl}>CPF</label>
                <input type="text" value={form.cpf} onChange={e => set('cpf', e.target.value)} className={inp} placeholder="000.000.000-00"/></div>
              <div><label className={lbl}>PIS</label>
                <input type="text" value={form.pis} onChange={e => set('pis', e.target.value)} className={inp}/></div>
            </div>
          </section>

          {/* Função */}
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">Função</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="col-span-1 sm:col-span-2">
                <label className={lbl}>Função cadastrada</label>
                <select value={form.funcao_id} onChange={e => set('funcao_id', e.target.value)}
                  className={inp + ' bg-white'}>
                  <option value="">Selecione uma função...</option>
                  {funcoes.map(f => (
                    <option key={f.id} value={f.id}>{f.nome}</option>
                  ))}
                </select>
              </div>
              <div><label className={lbl}>Cargo (texto livre)</label>
                <input type="text" value={form.cargo} onChange={e => set('cargo', e.target.value)} className={inp}/></div>
              <div>
                <label className={lbl}>Turno</label>
                <select value={form.turno} onChange={e => set('turno', e.target.value)} className={inp + ' bg-white'}>
                  <option value="diurno">Diurno</option><option value="noturno">Noturno</option><option value="misto">Misto</option>
                </select>
              </div>
            </div>
          </section>

          {/* Remuneração CLT */}
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">Remuneração e Custo CLT</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={lbl}>Salário base (R$/mês) *</label>
                <input type="number" step="0.01" value={form.salario_base} onChange={e => set('salario_base', e.target.value)} className={inp} placeholder="0,00"/></div>
              <div><label className={lbl}>Horas/mês</label>
                <input type="number" step="0.5" value={form.horas_mes} onChange={e => set('horas_mes', e.target.value)} className={inp}/></div>
              <div><label className={lbl}>Insalubridade (%)</label>
                <select value={form.insalubridade_pct} onChange={e => set('insalubridade_pct', e.target.value)} className={inp + ' bg-white'}>
                  <option value="0">Nenhuma (0%)</option><option value="20">Grau médio (20%)</option><option value="40">Grau máximo (40%)</option>
                </select></div>
              <div><label className={lbl}>Periculosidade (%)</label>
                <select value={form.periculosidade_pct} onChange={e => set('periculosidade_pct', e.target.value)} className={inp + ' bg-white'}>
                  <option value="0">Nenhuma (0%)</option><option value="30">Sim (30%)</option>
                </select></div>
            </div>
            <h4 className="text-xs font-semibold text-gray-400 mt-4 mb-2">Benefícios</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={lbl}>VT mensal (R$)</label>
                <input type="number" step="0.01" value={form.vt_mensal} onChange={e => set('vt_mensal', e.target.value)} className={inp}/></div>
              <div><label className={lbl}>VR por dia (R$)</label>
                <input type="number" step="0.01" value={form.vr_diario} onChange={e => set('vr_diario', e.target.value)} className={inp}/></div>
              <div><label className={lbl}>VA mensal (R$)</label>
                <input type="number" step="0.01" value={form.va_mensal} onChange={e => set('va_mensal', e.target.value)} className={inp}/></div>
              <div><label className={lbl}>Plano de saúde (R$/mês)</label>
                <input type="number" step="0.01" value={form.plano_saude_mensal} onChange={e => set('plano_saude_mensal', e.target.value)} className={inp}/></div>
              <div><label className={lbl}>Outros benefícios (R$/mês)</label>
                <input type="number" step="0.01" value={form.outros_beneficios} onChange={e => set('outros_beneficios', e.target.value)} className={inp}/></div>
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

          {/* Contrato */}
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">Contrato</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={lbl}>Data de admissão *</label>
                <input type="date" required value={form.admissao} onChange={e => set('admissao', e.target.value)} className={inp}/></div>
              <div><label className={lbl}>Tipo de vínculo</label>
                <select value={form.tipo_vinculo} onChange={e => set('tipo_vinculo', e.target.value)} className={inp + ' bg-white'}>
                  <option value="experiencia_45_45">Experiência 45+45 dias</option>
                  <option value="experiencia_30_60">Experiência 30+60 dias</option>
                  <option value="experiencia_90">Experiência 90 dias</option>
                  <option value="determinado_6m">Determinado 6 meses</option>
                  <option value="determinado_12m">Determinado 12 meses</option>
                  <option value="indeterminado">Indeterminado (CLT)</option>
                  <option value="temporario">Temporário</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">Os prazos são calculados automaticamente a partir da admissão</p>
              </div>
              <div><label className={lbl}>VT Estrutura</label>
                <input type="text" value={form.vt_estrutura} onChange={e => set('vt_estrutura', e.target.value)} placeholder="10+7,25+7,25" className={inp}/></div>
              <div><label className={lbl}>Status inicial</label>
                <select value={form.status} onChange={e => set('status', e.target.value)} className={inp + ' bg-white'}>
                  <option value="disponivel">Disponível</option>
                  <option value="alocado">Alocado</option>
                </select>
              </div>
            </div>
          </section>

          {/* Banco */}
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">Dados bancários</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={lbl}>Banco</label>
                <input type="text" value={form.banco} onChange={e => set('banco', e.target.value)} className={inp}/></div>
              <div><label className={lbl}>Agência / Conta</label>
                <input type="text" value={form.agencia_conta} onChange={e => set('agencia_conta', e.target.value)} className={inp}/></div>
              <div className="col-span-1 sm:col-span-2"><label className={lbl}>PIX</label>
                <input type="text" value={form.pix} onChange={e => set('pix', e.target.value)} className={inp}/></div>
            </div>
          </section>

          {/* EPI */}
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">EPI</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={lbl}>Tamanho Bota</label>
                <input type="text" value={form.tamanho_bota} onChange={e => set('tamanho_bota', e.target.value)} placeholder="42" className={inp}/></div>
              <div><label className={lbl}>Tamanho Uniforme</label>
                <input type="text" value={form.tamanho_uniforme} onChange={e => set('tamanho_uniforme', e.target.value)} placeholder="G" className={inp}/></div>
            </div>
          </section>

          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button type="submit" disabled={loading}
              className="px-6 py-2.5 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50">
              {loading ? 'Salvando...' : 'Criar funcionário'}
            </button>
            <Link href="/funcionarios" className="px-6 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</Link>
          </div>
        </form>
      </div>
    </div>
  )
}
