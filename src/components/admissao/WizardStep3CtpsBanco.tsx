'use client'

import { useMemo } from 'react'

const UF_OPTIONS = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
  'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO',
]

const BANCOS_COMUNS = [
  'Banco do Brasil', 'Bradesco', 'Caixa Economica Federal', 'Itau Unibanco',
  'Santander', 'Nubank', 'Inter', 'Sicoob', 'Sicredi', 'C6 Bank',
  'PagBank', 'Mercado Pago', 'BTG Pactual', 'Safra', 'Original',
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

export default function WizardStep3CtpsBanco({ data, onChange, errors }: Props) {
  const totalBeneficios = useMemo(() => {
    const vt = parseFloat(data.vt_mensal) || 0
    const vr = (parseFloat(data.vr_diario) || 0) * 21
    const va = parseFloat(data.va_mensal) || 0
    const ps = parseFloat(data.plano_saude_mensal) || 0
    return { vt, vrMensal: vr, va, ps, total: vt + vr + va + ps }
  }, [data.vt_mensal, data.vr_diario, data.va_mensal, data.plano_saude_mensal])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-0">
        {/* CTPS */}
        <section className="space-y-4">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">
            CTPS
          </h3>

          <Field label="Numero da CTPS" required error={errors.ctps_numero}>
            <input
              type="text"
              value={data.ctps_numero ?? ''}
              onChange={e => onChange('ctps_numero', e.target.value)}
              className={inp}
            />
          </Field>

          <Field label="Serie" required error={errors.ctps_serie}>
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
            Dados Bancarios
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

          <Field label="Agencia / Conta" error={errors.agencia_conta}>
            <input
              type="text"
              value={data.agencia_conta ?? ''}
              onChange={e => onChange('agencia_conta', e.target.value)}
              className={inp}
              placeholder="0001 / 12345-6"
            />
          </Field>

          <Field label="PIX" error={errors.pix}>
            <input
              type="text"
              value={data.pix ?? ''}
              onChange={e => onChange('pix', e.target.value)}
              className={inp}
              placeholder="CPF, telefone, e-mail ou chave aleatoria"
            />
          </Field>
        </section>
      </div>

      {/* Beneficios */}
      <section>
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">
          Beneficios
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="VT mensal (R$)" error={errors.vt_mensal}>
            <input
              type="number"
              step="0.01"
              value={data.vt_mensal ?? 198}
              onChange={e => onChange('vt_mensal', e.target.value)}
              className={inp}
            />
          </Field>

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

          <Field label="Plano de saude (R$/mes)" error={errors.plano_saude_mensal}>
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
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Total Beneficios</p>
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
              <p className="text-xs text-gray-400">Saude</p>
              <p className="text-sm font-bold text-gray-700">{fmtR(totalBeneficios.ps)}</p>
            </div>
            <div className="bg-purple-100 rounded-lg p-2">
              <p className="text-xs text-purple-700">Total/mes</p>
              <p className="text-lg font-bold text-purple-800">{fmtR(totalBeneficios.total)}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
