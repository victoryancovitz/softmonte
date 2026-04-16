'use client'

import { useMemo, useEffect } from 'react'

interface Props {
  data: any
  onChange: (field: string, value: any) => void
  errors: Record<string, string>
  funcoes: any[]
  obras?: any[]
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

export default function WizardStep2Contrato({ data, onChange, errors, funcoes, obras = [] }: Props) {
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

  // Real-time cost summary
  const summary = useMemo(() => {
    const salarioBase = parseFloat(data.salario_base) || 0
    const insalPct = parseFloat(data.insalubridade_pct) || 0
    const perPct = parseFloat(data.periculosidade_pct) || 0
    const horasMes = parseFloat(data.horas_mes) || 220

    const insalubridade = salarioBase * insalPct / 100
    const periculosidade = salarioBase * perPct / 100
    const bruto = salarioBase + insalubridade + periculosidade
    const encargos = bruto * 0.374
    const provisoes = bruto * 0.21
    const custoEmpresa = bruto + encargos + provisoes
    const custoHora = horasMes > 0 ? custoEmpresa / horasMes : 0

    return { bruto, custoEmpresa, custoHora }
  }, [data.salario_base, data.insalubridade_pct, data.periculosidade_pct, data.horas_mes])

  return (
    <div className="space-y-6">
      {/* Obra de alocação */}
      <section>
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">
          Obra de Alocação
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <Field label="Data de início na obra">
            <input
              type="date"
              value={data.data_inicio_obra ?? data.admissao ?? today}
              onChange={e => onChange('data_inicio_obra', e.target.value)}
              className={inp}
            />
          </Field>
        </div>
      </section>

      {/* Funcao e cargo */}
      <section>
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">
          Função e Cargo
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Função" required error={errors.funcao_id}>
            <select
              value={data.funcao_id ?? ''}
              onChange={e => handleFuncaoChange(e.target.value)}
              className={inp + ' bg-white'}
            >
              <option value="">Selecione a função...</option>
              {funcoes.map((f: any) => (
                <option key={f.id} value={f.id}>
                  {f.nome || f.cargo} {f.salario_base ? `— ${fmtR(f.salario_base)}` : ''}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Cargo" error={errors.cargo}>
            <input
              type="text"
              value={data.cargo ?? ''}
              onChange={e => onChange('cargo', e.target.value)}
              className={inp}
            />
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
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Preview de Custo</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xs text-gray-400">Bruto</p>
                <p className="font-bold text-gray-900">{fmtR(summary.bruto)}</p>
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
    </div>
  )
}
