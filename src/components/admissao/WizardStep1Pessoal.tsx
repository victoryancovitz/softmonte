'use client'

const UF_OPTIONS = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
  'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO',
]

interface Props {
  data: any
  onChange: (field: string, value: any) => void
  errors: Record<string, string>
}

function maskCPF(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return d.slice(0, 3) + '.' + d.slice(3)
  if (d.length <= 9) return d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6)
  return d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-' + d.slice(9)
}

function maskCEP(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 8)
  if (d.length <= 5) return d
  return d.slice(0, 5) + '-' + d.slice(5)
}

function maskTelefone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d.length ? '(' + d : ''
  if (d.length <= 7) return '(' + d.slice(0, 2) + ') ' + d.slice(2)
  return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7)
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

export default function WizardStep1Pessoal({ data, onChange, errors }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
      {/* Left column */}
      <div className="space-y-4">
        <Field label="Nome completo" required error={errors.nome}>
          <input
            type="text"
            value={data.nome ?? ''}
            onChange={e => onChange('nome', e.target.value.toUpperCase())}
            className={inp}
            placeholder="NOME COMPLETO"
          />
        </Field>

        <Field label="Data de nascimento" required error={errors.data_nascimento}>
          <input
            type="date"
            value={data.data_nascimento ?? ''}
            onChange={e => onChange('data_nascimento', e.target.value)}
            className={inp}
          />
        </Field>

        <Field label="CPF" required error={errors.cpf}>
          <input
            type="text"
            inputMode="numeric"
            value={data.cpf ?? ''}
            onChange={e => onChange('cpf', maskCPF(e.target.value))}
            className={inp}
            placeholder="000.000.000-00"
          />
        </Field>

        <Field label="RG" error={errors.re}>
          <input
            type="text"
            value={data.re ?? ''}
            onChange={e => onChange('re', e.target.value)}
            className={inp}
          />
        </Field>

        <Field label="PIS / NIS" error={errors.pis}>
          <input
            type="text"
            value={data.pis ?? ''}
            onChange={e => onChange('pis', e.target.value)}
            className={inp}
          />
        </Field>

        <Field label="Naturalidade" error={errors.naturalidade}>
          <input
            type="text"
            value={data.naturalidade ?? ''}
            onChange={e => onChange('naturalidade', e.target.value)}
            className={inp}
            placeholder="Cidade-UF"
          />
        </Field>

        <Field label="Estado civil" error={errors.estado_civil}>
          <select
            value={data.estado_civil ?? ''}
            onChange={e => onChange('estado_civil', e.target.value)}
            className={inp + ' bg-white'}
          >
            <option value="">Selecione...</option>
            <option value="SOLTEIRO">Solteiro(a)</option>
            <option value="CASADO">Casado(a)</option>
            <option value="DIVORCIADO">Divorciado(a)</option>
            <option value="VIUVO">Viuvo(a)</option>
            <option value="UNIAO ESTAVEL">Uniao Estavel</option>
          </select>
        </Field>

        <Field label="Raca / Cor" error={errors.raca_cor}>
          <select
            value={data.raca_cor ?? ''}
            onChange={e => onChange('raca_cor', e.target.value)}
            className={inp + ' bg-white'}
          >
            <option value="">Selecione...</option>
            <option value="BRANCA">Branca</option>
            <option value="PARDA">Parda</option>
            <option value="PRETA">Preta</option>
            <option value="AMARELA">Amarela</option>
            <option value="INDIGENA">Indigena</option>
          </select>
        </Field>

        <Field label="Nome da mãe" error={errors.nome_mae}>
          <input
            type="text"
            value={data.nome_mae ?? ''}
            onChange={e => onChange('nome_mae', e.target.value.toUpperCase())}
            className={inp}
          />
        </Field>

        <Field label="Nome do pai" error={errors.nome_pai}>
          <input
            type="text"
            value={data.nome_pai ?? ''}
            onChange={e => onChange('nome_pai', e.target.value.toUpperCase())}
            className={inp}
          />
        </Field>

        <Field label="Titulo de eleitor" error={errors.titulo_eleitor}>
          <input
            type="text"
            value={data.titulo_eleitor ?? ''}
            onChange={e => onChange('titulo_eleitor', e.target.value)}
            className={inp}
          />
        </Field>
      </div>

      {/* Right column */}
      <div className="space-y-4">
        <Field label="Telefone" error={errors.telefone}>
          <input
            type="text"
            inputMode="tel"
            value={data.telefone ?? ''}
            onChange={e => onChange('telefone', maskTelefone(e.target.value))}
            className={inp}
            placeholder="(00) 00000-0000"
          />
        </Field>

        <Field label="E-mail" error={errors.email}>
          <input
            type="email"
            value={data.email ?? ''}
            onChange={e => onChange('email', e.target.value)}
            className={inp}
            placeholder="email@exemplo.com"
          />
        </Field>

        <Field label="Endereço" error={errors.endereco}>
          <input
            type="text"
            value={data.endereco ?? ''}
            onChange={e => onChange('endereco', e.target.value)}
            className={inp}
            placeholder="Rua, numero, bairro"
          />
        </Field>

        <Field label="Cidade" error={errors.cidade_endereco}>
          <input
            type="text"
            value={data.cidade_endereco ?? ''}
            onChange={e => onChange('cidade_endereco', e.target.value)}
            className={inp}
          />
        </Field>

        <Field label="UF" error={errors.uf}>
          <select
            value={data.uf ?? ''}
            onChange={e => onChange('uf', e.target.value)}
            className={inp + ' bg-white'}
          >
            <option value="">Selecione...</option>
            {UF_OPTIONS.map(uf => (
              <option key={uf} value={uf}>{uf}</option>
            ))}
          </select>
        </Field>

        <Field label="CEP" error={errors.cep}>
          <input
            type="text"
            inputMode="numeric"
            value={data.cep ?? ''}
            onChange={e => onChange('cep', maskCEP(e.target.value))}
            onBlur={async e => {
              const cep = e.target.value.replace(/\D/g, '')
              if (cep.length !== 8) return
              try {
                const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
                const j = await res.json()
                if (j.erro) return
                if (j.logradouro || j.bairro) {
                  const endereco = [j.logradouro, j.bairro].filter(Boolean).join(', ')
                  if (endereco) onChange('endereco', endereco)
                }
                if (j.localidade) onChange('cidade_endereco', j.localidade)
                if (j.uf) onChange('uf', j.uf)
              } catch { /* silent */ }
            }}
            className={inp}
            placeholder="00000-000"
          />
        </Field>
      </div>
    </div>
  )
}
