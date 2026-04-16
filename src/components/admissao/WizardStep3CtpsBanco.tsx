'use client'

import { useMemo } from 'react'

const UF_OPTIONS = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
  'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO',
]

const BANCOS_COMUNS = [
  'Banco do Brasil', 'Bradesco', 'Caixa Econômica Federal', 'Itaú Unibanco',
  'Santander', 'Nubank', 'Inter', 'Sicoob', 'Sicredi', 'C6 Bank',
  'PagBank', 'Mercado Pago', 'BTG Pactual', 'Safra', 'Original',
]

const PIX_TIPOS = [
  { value: 'cpf', label: 'CPF' },
  { value: 'email', label: 'E-mail' },
  { value: 'telefone', label: 'Telefone' },
  { value: 'aleatoria', label: 'Chave aleatória' },
]

interface Props {
  data: any
  onChange: (field: string, value: any) => void
  errors: Record<string, string>
}

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

// Mascaras condicionais para PIX
function maskPix(value: string, tipo: string): string {
  if (!value) return ''
  const digits = value.replace(/\D/g, '')
  if (tipo === 'cpf') {
    return digits
      .slice(0, 11)
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }
  if (tipo === 'telefone') {
    const d = digits.slice(0, 11)
    if (d.length <= 10) {
      return d.replace(/(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3').replace(/-$/, '')
    }
    return d.replace(/(\d{2})(\d{5})(\d{0,4}).*/, '($1) $2-$3').replace(/-$/, '')
  }
  // email e aleatoria: sem mascara
  return value
}

function pixPlaceholder(tipo: string): string {
  switch (tipo) {
    case 'cpf': return '000.000.000-00'
    case 'email': return 'exemplo@dominio.com'
    case 'telefone': return '(11) 98765-4321'
    case 'aleatoria': return 'Chave aleatória (UUID)'
    default: return 'Selecione o tipo primeiro'
  }
}

export default function WizardStep3CtpsBanco({ data, onChange, errors }: Props) {
  const temVt = data.tem_vt !== false // default true quando undefined

  const totalBeneficios = useMemo(() => {
    const vt = temVt ? (parseFloat(data.vt_mensal) || 0) : 0
    const vr = (parseFloat(data.vr_diario) || 0) * 21
    const va = parseFloat(data.va_mensal) || 0
    const ps = parseFloat(data.plano_saude_mensal) || 0
    return { vt, vrMensal: vr, va, ps, total: vt + vr + va + ps }
  }, [temVt, data.vt_mensal, data.vr_diario, data.va_mensal, data.plano_saude_mensal])

  // Calculos VT
  const vtCalc = useMemo(() => {
    const salario = parseFloat(data.salario_base) || 0
    const vtBruto = parseFloat(data.vt_mensal) || 0
    const descontoEmpregado = salario * 0.06
    // Desconto nao pode exceder VT bruto (regra CLT)
    const descontoEfetivo = Math.min(descontoEmpregado, vtBruto)
    const custoEmpresa = Math.max(0, vtBruto - descontoEfetivo)
    return { descontoEmpregado: descontoEfetivo, custoEmpresa, vtBruto }
  }, [data.salario_base, data.vt_mensal])

  const pixTipo = data.pix_tipo ?? ''

  function handlePixTipoChange(novoTipo: string) {
    onChange('pix_tipo', novoTipo)
    // Se CPF, pre-preencher com data.cpf
    if (novoTipo === 'cpf' && data.cpf) {
      onChange('pix', data.cpf)
    } else if (novoTipo !== pixTipo) {
      // Limpa ao trocar de tipo (exceto no primeiro set)
      onChange('pix', '')
    }
  }

  function handlePixChange(raw: string) {
    const masked = maskPix(raw, pixTipo)
    onChange('pix', masked)
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-0">
        {/* CTPS */}
        <section className="space-y-4">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">
            CTPS
          </h3>

          <Field label="Número da CTPS" required error={errors.ctps_numero}>
            <input
              type="text"
              value={data.ctps_numero ?? ''}
              onChange={e => onChange('ctps_numero', e.target.value)}
              className={inp}
            />
          </Field>

          <Field label="Série" required error={errors.ctps_serie}>
            <input
              type="text"
              value={data.ctps_serie ?? ''}
              onChange={e => onChange('ctps_serie', e.target.value)}
              className={inp}
            />
          </Field>

          <Field label="UF da CTPS" required error={errors.ctps_uf}>
            <select
              value={data.ctps_uf ?? ''}
              onChange={e => onChange('ctps_uf', e.target.value)}
              className={inp + ' bg-white'}
            >
              <option value="">Selecione...</option>
              {UF_OPTIONS.map(uf => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </select>
          </Field>
        </section>

        {/* Banco */}
        <section className="space-y-4">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">
            Dados Bancários
          </h3>

          <Field label="Banco" required error={errors.banco}>
            <input
              type="text"
              list="bancos-list"
              value={data.banco ?? ''}
              onChange={e => onChange('banco', e.target.value)}
              className={inp}
              placeholder="Digite ou selecione..."
            />
            <datalist id="bancos-list">
              {BANCOS_COMUNS.map(b => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </Field>

          <Field label="Agência / Conta" error={errors.agencia_conta}>
            <input
              type="text"
              value={data.agencia_conta ?? ''}
              onChange={e => onChange('agencia_conta', e.target.value)}
              className={inp}
              placeholder="0001 / 12345-6"
            />
          </Field>

          <Field label="Tipo de PIX" error={errors.pix_tipo}>
            <select
              value={pixTipo}
              onChange={e => handlePixTipoChange(e.target.value)}
              className={inp + ' bg-white'}
            >
              <option value="">Selecione...</option>
              {PIX_TIPOS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Chave PIX" error={errors.pix}>
            <input
              type={pixTipo === 'email' ? 'email' : 'text'}
              value={data.pix ?? ''}
              onChange={e => handlePixChange(e.target.value)}
              className={inp}
              placeholder={pixPlaceholder(pixTipo)}
              disabled={!pixTipo}
            />
          </Field>
        </section>
      </div>

      {/* Benefícios */}
      <section>
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">
          Benefícios
        </h3>

        {/* VT estruturado */}
        <div className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-700">Recebe VT (Vale-Transporte)?</p>
              <p className="text-xs text-gray-500">Desconto máximo de 6% sobre o salário base (CLT)</p>
            </div>
            <button
              type="button"
              onClick={() => onChange('tem_vt', !temVt)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                temVt ? 'bg-brand' : 'bg-gray-300'
              }`}
              aria-label="Recebe VT"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  temVt ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {temVt && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <Field label="Estrutura de linhas" error={errors.vt_estrutura}>
                <input
                  type="text"
                  value={data.vt_estrutura ?? ''}
                  onChange={e => onChange('vt_estrutura', e.target.value)}
                  className={inp}
                  placeholder="Ex: 10+7,25+7,25"
                />
              </Field>

              <Field label="Total bruto VT (R$)" error={errors.vt_mensal}>
                <input
                  type="number"
                  step="0.01"
                  value={data.vt_mensal ?? 198}
                  onChange={e => onChange('vt_mensal', e.target.value)}
                  className={inp}
                />
              </Field>

              <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="p-3 bg-white rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-500">Desconto empregado (6%)</p>
                  <p className="text-sm font-bold text-gray-700">{fmtR(vtCalc.descontoEmpregado)}</p>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                  <p className="text-xs text-purple-700">Custo empresa líquido</p>
                  <p className="text-sm font-bold text-purple-800">{fmtR(vtCalc.custoEmpresa)}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="VR por dia (R$)" error={errors.vr_diario}>
            <input
              type="number"
              step="0.01"
              value={data.vr_diario ?? 35}
              onChange={e => onChange('vr_diario', e.target.value)}
              className={inp}
            />
          </Field>

          <Field label="VA mensal (R$)" error={errors.va_mensal}>
            <input
              type="number"
              step="0.01"
              value={data.va_mensal ?? 400}
              onChange={e => onChange('va_mensal', e.target.value)}
              className={inp}
            />
          </Field>

          <Field label="Plano de saúde (R$/mês)" error={errors.plano_saude_mensal}>
            <input
              type="number"
              step="0.01"
              value={data.plano_saude_mensal ?? 0}
              onChange={e => onChange('plano_saude_mensal', e.target.value)}
              className={inp}
            />
          </Field>
        </div>

        {/* Benefits summary card */}
        <div className="mt-4 p-4 bg-purple-50 rounded-xl border border-purple-100">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Total Benefícios</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
            <div>
              <p className="text-xs text-gray-400">VT</p>
              <p className="text-sm font-bold text-gray-700">{fmtR(totalBeneficios.vt)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">VR (mensal)</p>
              <p className="text-sm font-bold text-gray-700">{fmtR(totalBeneficios.vrMensal)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">VA</p>
              <p className="text-sm font-bold text-gray-700">{fmtR(totalBeneficios.va)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Saúde</p>
              <p className="text-sm font-bold text-gray-700">{fmtR(totalBeneficios.ps)}</p>
            </div>
            <div className="bg-purple-100 rounded-lg p-2">
              <p className="text-xs text-purple-700">Total/mês</p>
              <p className="text-lg font-bold text-purple-800">{fmtR(totalBeneficios.total)}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
