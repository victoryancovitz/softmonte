'use client'

import { useMemo, useEffect, useState } from 'react'
import { calcularDescontosCLT } from '@/lib/clt'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { Plus, X } from 'lucide-react'

interface Props {
  data: any
  onChange: (field: string, value: any) => void
  errors: Record<string, string>
  funcoes: any[]
  obras?: any[]
  ccsAdm?: any[]
}

const TIPO_VINCULO_OPTIONS = [
  { value: 'indeterminado', label: 'CLT — Efetivo (Indeterminado)' },
  { value: 'experiencia_45_45', label: 'Experiência 45+45 dias' },
  { value: 'experiencia_30_60', label: 'Experiência 30+60 dias' },
  { value: 'experiencia_90', label: 'Experiência 90 dias' },
  { value: 'determinado_6m', label: 'Contrato determinado 6 meses' },
  { value: 'determinado_12m', label: 'Contrato determinado 12 meses' },
  { value: 'temporario', label: 'Temporário' },
  { value: 'estagio', label: 'Estagiário' },
  { value: 'pj', label: 'PJ' },
  { value: 'terceirizado', label: 'Terceirizado' },
]

function addDias(iso: string, dias: number): string {
  if (!iso) return ''
  const d = new Date(iso + 'T12:00')
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 10)
}

const TAMANHO_UNIFORME = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG']
const TAMANHO_BOTA = Array.from({ length: 11 }, (_, i) => String(36 + i))

const inp = 'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand'
const lbl = 'block text-xs font-semibold text-gray-700 mb-1'

function Field({ label, required, error, children }: {
  label: string; required?: boolean; error?: string; children: React.ReactNode
}) {
  return (
    <div>
      <label className={lbl}>
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

function fmtR(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function WizardStep2Contrato({ data, onChange, errors, funcoes: funcoesProp, obras = [], ccsAdm = [] }: Props) {
  const supabase = createClient()
  const toast = useToast()
  const [tipoAlocacao, setTipoAlocacao] = useState<'obra' | 'adm'>(data.centro_custo_id && !data.obra_id ? 'adm' : 'obra')
  const [funcoesLocal, setFuncoesLocal] = useState<any[]>(funcoesProp || [])
  const [showModalFuncao, setShowModalFuncao] = useState(false)
  const [savingFuncao, setSavingFuncao] = useState(false)
  const [novaFuncao, setNovaFuncao] = useState({
    nome: '', salario_base: '', insalubridade: '0', periculosidade: '0',
    jornada_horas_mes: '220',
  })

  // Sincronizar lista de funções quando prop mudar
  useEffect(() => { setFuncoesLocal(funcoesProp || []) }, [funcoesProp])
  const funcoes = funcoesLocal

  async function criarFuncao() {
    if (!novaFuncao.nome.trim()) { toast.warning('Informe o nome da função'); return }
    setSavingFuncao(true)
    try {
      const payload: any = {
        nome: novaFuncao.nome.toUpperCase().trim(),
        salario_base: novaFuncao.salario_base ? Number(novaFuncao.salario_base) : null,
        insalubridade_pct_padrao: Number(novaFuncao.insalubridade) || 0,
        periculosidade_pct_padrao: Number(novaFuncao.periculosidade) || 0,
        jornada_horas_mes: Number(novaFuncao.jornada_horas_mes) || 220,
        ativo: true,
      }
      const { data: inserted, error } = await supabase
        .from('funcoes').insert(payload).select('*').single()
      if (error) throw error
      setFuncoesLocal(prev => [...prev, inserted].sort((a, b) => (a.nome ?? '').localeCompare(b.nome ?? '')))
      handleFuncaoChange(inserted.id)
      toast.success('Função criada', inserted.nome)
      setShowModalFuncao(false)
      setNovaFuncao({ nome: '', salario_base: '', insalubridade: '0', periculosidade: '0', jornada_horas_mes: '220' })
    } catch (e: any) {
      toast.error('Erro ao criar função', e?.message ?? '')
    } finally {
      setSavingFuncao(false)
    }
  }

  function handleFuncaoChange(funcaoId: string) {
    onChange('funcao_id', funcaoId)
    const funcao = funcoes.find((f: any) => f.id === funcaoId)
    if (funcao) {
      // Pré-preenche cargo com o nome da função
      if (funcao.nome && !data.cargo) onChange('cargo', funcao.nome)
      if (funcao.salario_base != null) onChange('salario_base', funcao.salario_base)
      if (funcao.insalubridade_pct_padrao != null) onChange('insalubridade_pct', funcao.insalubridade_pct_padrao)
      if (funcao.periculosidade_pct_padrao != null) onChange('periculosidade_pct', funcao.periculosidade_pct_padrao)
      if (funcao.jornada_horas_mes != null) onChange('horas_mes', funcao.jornada_horas_mes)
      if (funcao.vt_mensal_padrao != null) onChange('vt_mensal', funcao.vt_mensal_padrao)
      if (funcao.vr_diario_padrao != null) onChange('vr_diario', funcao.vr_diario_padrao)
      if (funcao.va_mensal_padrao != null) onChange('va_mensal', funcao.va_mensal_padrao)
    }
  }

  function handleTipoVinculoChange(tipo: string) {
    onChange('tipo_vinculo', tipo)
    // Auto-preenche prazos de experiência com base na data de admissão (P5)
    if (!data.admissao) return
    if (tipo === 'experiencia_45_45') {
      onChange('prazo1', addDias(data.admissao, 45))
      onChange('prazo2', addDias(data.admissao, 90))
    } else if (tipo === 'experiencia_30_60') {
      onChange('prazo1', addDias(data.admissao, 30))
      onChange('prazo2', addDias(data.admissao, 90))
    } else if (tipo === 'experiencia_90') {
      onChange('prazo1', addDias(data.admissao, 90))
    }
  }

  const today = new Date().toISOString().slice(0, 10)

  // Real-time cost summary com cálculo CLT real (INSS progressivo + IRRF)
  const summary = useMemo(() => {
    const salarioBase = parseFloat(data.salario_base) || 0
    const insalPct = parseFloat(data.insalubridade_pct) || 0
    const perPct = parseFloat(data.periculosidade_pct) || 0
    const horasMes = parseFloat(data.horas_mes) || 220

    const clt = calcularDescontosCLT({
      salarioBase,
      diasTrabalhados: 30,
      diasMes: 30,
      insalubridadePct: insalPct,
      periculosidadePct: perPct,
      vtMensal: 0,
      dependentes: 0,
    })

    const bruto = clt.total_proventos
    // Encargos empregador: INSS 20% + RAT ~3% + Sistema S ~3.3% + FGTS 8% = ~34.3%
    const encargos = bruto * 0.343
    const provisoes = bruto * 0.21 // 13º + férias + 1/3 + FGTS provisão
    const custoEmpresa = bruto + encargos + provisoes
    const custoHora = horasMes > 0 ? custoEmpresa / horasMes : 0

    return {
      bruto,
      custoEmpresa,
      custoHora,
      liquidoFuncionario: clt.valor_liquido,
      descontoINSS: clt.desconto_inss,
      descontoIRRF: clt.desconto_irrf,
    }
  }, [data.salario_base, data.insalubridade_pct, data.periculosidade_pct, data.horas_mes])

  return (
    <div className="space-y-6">
      {/* Alocação */}
      <section>
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">
          Alocação
        </h3>
        {/* Toggle obra vs adm */}
        <div className="flex border border-gray-200 rounded-xl overflow-hidden mb-4 w-fit">
          <button type="button" onClick={() => { setTipoAlocacao('obra'); onChange('centro_custo_id', ''); onChange('obra_id', '') }}
            className={`px-4 py-2 text-xs font-semibold transition-all ${tipoAlocacao === 'obra' ? 'bg-brand text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
            Obra de campo
          </button>
          <button type="button" onClick={() => { setTipoAlocacao('adm'); onChange('obra_id', '') }}
            className={`px-4 py-2 text-xs font-semibold transition-all ${tipoAlocacao === 'adm' ? 'bg-brand text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
            Administrativo
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {tipoAlocacao === 'obra' ? (
            <>
              <Field label="Obra" required error={errors.obra_id}>
                <select
                  value={data.obra_id ?? ''}
                  onChange={e => onChange('obra_id', e.target.value)}
                  className={inp + ' bg-white'}
                >
                  <option value="">Selecione a obra...</option>
                  {obras.map((o: any) => (
                    <option key={o.id} value={o.id}>{o.nome}</option>
                  ))}
                </select>
              </Field>
              <Field label="Data de inicio na obra">
                <input
                  type="date"
                  value={data.data_inicio_obra ?? data.admissao ?? today}
                  onChange={e => onChange('data_inicio_obra', e.target.value)}
                  className={inp}
                />
              </Field>
            </>
          ) : (
            <Field label="Centro de Custo Administrativo" required error={errors.centro_custo_id}>
              <select
                value={data.centro_custo_id ?? ''}
                onChange={e => onChange('centro_custo_id', e.target.value)}
                className={inp + ' bg-white'}
              >
                <option value="">Selecione o CC...</option>
                {ccsAdm.map((cc: any) => (
                  <option key={cc.id} value={cc.id}>{cc.codigo} — {cc.nome}</option>
                ))}
              </select>
            </Field>
          )}
        </div>
      </section>

      {/* Função e cargo */}
      <section>
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">
          Função e Cargo
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Função" required error={errors.funcao_id}>
            <div className="flex gap-2">
              <select
                value={data.funcao_id ?? ''}
                onChange={e => handleFuncaoChange(e.target.value)}
                className={inp + ' bg-white flex-1'}
              >
                <option value="">Selecione a função...</option>
                {funcoes.map((f: any) => (
                  <option key={f.id} value={f.id}>
                    {f.nome || f.cargo} {f.salario_base ? `— ${fmtR(f.salario_base)}` : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowModalFuncao(true)}
                title="Criar nova função"
                className="w-10 h-[42px] flex items-center justify-center border border-brand text-brand rounded-xl hover:bg-brand/5 flex-shrink-0"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </Field>

          <Field label="Cargo" error={errors.cargo}>
            <input
              type="text"
              value={data.cargo ?? ''}
              onChange={e => onChange('cargo', e.target.value)}
              className={inp}
            />
            <p className="text-[10px] text-gray-400 mt-1">
              ℹ️ O cargo aparece na CTPS e documentos. Pode ser diferente da função interna.
            </p>
          </Field>

          <Field label="Matrícula" error={errors.matricula}>
            <input
              type="text"
              value={data.matricula ?? ''}
              onChange={e => onChange('matricula', e.target.value)}
              className={inp}
            />
          </Field>

          <Field label="ID Ponto (Secullum)" error={errors.id_ponto}>
            <input
              type="text"
              inputMode="numeric"
              value={data.id_ponto ?? ''}
              onChange={e => onChange('id_ponto', e.target.value.replace(/\D/g, ''))}
              className={inp}
            />
          </Field>
        </div>
      </section>

      {/* Remuneração */}
      <section>
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">
          Remuneração
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Salário base (R$/mês)" error={errors.salario_base}>
            <input
              type="number"
              step="0.01"
              value={data.salario_base ?? ''}
              onChange={e => onChange('salario_base', e.target.value)}
              className={inp}
              placeholder="0,00"
            />
          </Field>

          <Field label="Insalubridade (%)" error={errors.insalubridade_pct}>
            <select
              value={data.insalubridade_pct ?? 0}
              onChange={e => onChange('insalubridade_pct', e.target.value)}
              className={inp + ' bg-white'}
            >
              <option value="0">Nenhuma (0%)</option>
              <option value="10">Grau mínimo (10%)</option>
              <option value="20">Grau médio (20%)</option>
              <option value="40">Grau máximo (40%)</option>
            </select>
          </Field>

          <Field label="Periculosidade (%)" error={errors.periculosidade_pct}>
            <select
              value={data.periculosidade_pct ?? 0}
              onChange={e => onChange('periculosidade_pct', e.target.value)}
              className={inp + ' bg-white'}
            >
              <option value="0">Nenhuma (0%)</option>
              <option value="30">Sim (30%)</option>
            </select>
          </Field>

          <Field label="Horas/mês" error={errors.horas_mes}>
            <input
              type="number"
              step="0.5"
              value={data.horas_mes ?? 220}
              onChange={e => onChange('horas_mes', e.target.value)}
              className={inp}
            />
          </Field>
        </div>

        {/* Summary card */}
        {summary.bruto > 0 && (
          <div className="mt-4 p-4 bg-brand/5 rounded-xl border border-brand/10">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Preview de Custo (cálculo CLT progressivo)</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div>
                <p className="text-xs text-gray-400">Bruto</p>
                <p className="font-bold text-gray-900">{fmtR(summary.bruto)}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-2">
                <p className="text-xs text-green-700">Líquido func.</p>
                <p className="font-bold text-green-800">{fmtR(summary.liquidoFuncionario)}</p>
              </div>
              <div className="bg-brand/10 rounded-lg p-2">
                <p className="text-xs text-brand">Custo empresa</p>
                <p className="text-lg font-bold text-brand">{fmtR(summary.custoEmpresa)}</p>
              </div>
              <div className="bg-brand/10 rounded-lg p-2">
                <p className="text-xs text-brand">Custo/hora</p>
                <p className="text-lg font-bold text-brand">{fmtR(summary.custoHora)}/h</p>
              </div>
            </div>
            <div className="mt-2 text-[10px] text-gray-500 text-center">
              INSS {fmtR(summary.descontoINSS)} · IRRF {fmtR(summary.descontoIRRF)}
            </div>
          </div>
        )}
      </section>

      {/* Vinculo */}
      <section>
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">
          Vínculo
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Tipo de vínculo" error={errors.tipo_vinculo}>
            <select
              value={data.tipo_vinculo ?? ''}
              onChange={e => handleTipoVinculoChange(e.target.value)}
              className={inp + ' bg-white'}
            >
              <option value="">Selecione...</option>
              {TIPO_VINCULO_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Data de admissão" required error={errors.admissao}>
            <input
              type="date"
              value={data.admissao ?? today}
              onChange={e => onChange('admissao', e.target.value)}
              className={inp}
            />
          </Field>

          <Field label="Tamanho uniforme" error={errors.tamanho_uniforme}>
            <select
              value={data.tamanho_uniforme ?? ''}
              onChange={e => onChange('tamanho_uniforme', e.target.value)}
              className={inp + ' bg-white'}
            >
              <option value="">Selecione...</option>
              {TAMANHO_UNIFORME.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>

          <Field label="Tamanho bota" error={errors.tamanho_bota}>
            <select
              value={data.tamanho_bota ?? ''}
              onChange={e => onChange('tamanho_bota', e.target.value)}
              className={inp + ' bg-white'}
            >
              <option value="">Selecione...</option>
              {TAMANHO_BOTA.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      {/* Contrato upload */}
      <section>
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">
          Contrato (opcional)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Arquivo do contrato" error={errors.contrato_arquivo}>
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={e => {
                const file = e.target.files?.[0] ?? null
                onChange('contrato_arquivo', file)
              }}
              className={inp + ' file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand/10 file:text-brand'}
            />
          </Field>

          <Field label="Data de assinatura" error={errors.contrato_data_assinatura}>
            <input
              type="date"
              value={data.contrato_data_assinatura ?? ''}
              onChange={e => onChange('contrato_data_assinatura', e.target.value)}
              className={inp}
            />
          </Field>
        </div>
      </section>

      {/* Modal — Criar nova função */}
      {showModalFuncao && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => !savingFuncao && setShowModalFuncao(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-brand">Nova Função</h3>
              <button onClick={() => setShowModalFuncao(false)} disabled={savingFuncao} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className={lbl}>Nome da função *</label>
                <input type="text" value={novaFuncao.nome}
                  onChange={e => setNovaFuncao(p => ({ ...p, nome: e.target.value }))}
                  placeholder="Ex: CALDEIREIRO OFFSHORE"
                  className={inp} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Salário base (R$)</label>
                  <input type="number" step="0.01" value={novaFuncao.salario_base}
                    onChange={e => setNovaFuncao(p => ({ ...p, salario_base: e.target.value }))}
                    placeholder="0,00"
                    className={inp} />
                </div>
                <div>
                  <label className={lbl}>Horas/mês</label>
                  <input type="number" value={novaFuncao.jornada_horas_mes}
                    onChange={e => setNovaFuncao(p => ({ ...p, jornada_horas_mes: e.target.value }))}
                    className={inp} />
                </div>
                <div>
                  <label className={lbl}>Insalubridade</label>
                  <select value={novaFuncao.insalubridade}
                    onChange={e => setNovaFuncao(p => ({ ...p, insalubridade: e.target.value }))}
                    className={inp + ' bg-white'}>
                    <option value="0">Nenhuma (0%)</option>
                    <option value="10">Grau mínimo (10%)</option>
                    <option value="20">Grau médio (20%)</option>
                    <option value="40">Grau máximo (40%)</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>Periculosidade</label>
                  <select value={novaFuncao.periculosidade}
                    onChange={e => setNovaFuncao(p => ({ ...p, periculosidade: e.target.value }))}
                    className={inp + ' bg-white'}>
                    <option value="0">Não</option>
                    <option value="30">Sim (30%)</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setShowModalFuncao(false)} disabled={savingFuncao}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={criarFuncao} disabled={savingFuncao || !novaFuncao.nome.trim()}
                className="px-5 py-2 bg-brand text-white text-sm font-bold rounded-lg hover:bg-brand-dark disabled:opacity-50">
                {savingFuncao ? 'Criando...' : 'Criar função'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
