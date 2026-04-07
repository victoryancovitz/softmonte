'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

interface StatusOption {
  value: string
  label: string
  desc: string
  tipo: string
  color: string
  precisa_doc?: boolean
}

const STATUS_OPTIONS: StatusOption[] = [
  { value: 'presente',           label: 'Presente',          desc: 'Funcionário trabalhou no dia',      tipo: 'efetivo',  color: 'green' },
  { value: 'falta_injustificada',label: 'Falta injustificada',desc: 'Não veio sem justificativa',       tipo: 'falta',    color: 'red' },
  { value: 'atestado_medico',    label: 'Atestado médico',   desc: 'Atestado médico apresentado',       tipo: 'falta',    color: 'blue', precisa_doc: true },
  { value: 'atestado_acidente',  label: 'Atestado acidente', desc: 'Acidente de trabalho',              tipo: 'falta',    color: 'red',  precisa_doc: true },
  { value: 'falta_justificada',  label: 'Falta justificada', desc: 'Justificativa aceita (acompanhante etc)', tipo: 'falta',  color: 'amber' },
  { value: 'folga_compensatoria',label: 'Folga / Abono',     desc: 'Folga compensatória ou abonado',    tipo: 'falta',    color: 'gray' },
  { value: 'licenca_maternidade',label: 'Licença maternidade',desc: '120 dias',                          tipo: 'falta',    color: 'pink' },
  { value: 'licenca_paternidade',label: 'Licença paternidade',desc: '5-20 dias',                         tipo: 'falta',    color: 'pink' },
  { value: 'suspensao',          label: 'Suspensão',         desc: 'Suspensão disciplinar',             tipo: 'falta',    color: 'red' },
  { value: 'pendente',           label: 'Pendente',          desc: 'Aguardando informação (sem registro)', tipo: 'pendente', color: 'gray' },
]

type StatusValue = string

interface CellState {
  status: StatusValue | null
  efetivo_id?: string
  falta_id?: string
  arquivo_url?: string | null
  arquivo_nome?: string | null
  observacao?: string | null
  horas_trabalhadas?: number | null
}

export default function PontoCellEditor({
  funcionario,
  obraId,
  data,
  initial,
  onClose,
  onSaved,
}: {
  funcionario: { id: string; nome: string; cargo?: string; admissao?: string; deleted_at?: string | null }
  obraId: string
  data: string  // YYYY-MM-DD
  initial: CellState
  onClose: () => void
  onSaved: () => void
}) {
  // Validação de período do vínculo
  const dataLimiteInicio = funcionario.admissao ?? null
  const dataLimiteFim = funcionario.deleted_at ? funcionario.deleted_at.split('T')[0] : null
  const foraDoVinculo =
    (dataLimiteInicio && data < dataLimiteInicio) ||
    (dataLimiteFim && data > dataLimiteFim)
  const [status, setStatus] = useState<StatusValue | null>(initial.status)
  const [observacao, setObservacao] = useState(initial.observacao ?? '')
  const [horasTrabalhadas, setHorasTrabalhadas] = useState<string>(
    initial.horas_trabalhadas != null ? String(initial.horas_trabalhadas) : ''
  )
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()
  const toast = useToast()

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const selectedOption = STATUS_OPTIONS.find(o => o.value === status)
  const precisaDoc = selectedOption?.precisa_doc

  async function handleSave() {
    if (foraDoVinculo) {
      toast.error('Data fora do período de vínculo do funcionário.')
      return
    }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()

    // 1) Remove existing efetivo and falta for this date
    if (initial.efetivo_id) {
      await supabase.from('efetivo_diario').delete().eq('id', initial.efetivo_id)
    }
    if (initial.falta_id) {
      await supabase.from('faltas').delete().eq('id', initial.falta_id)
    }

    // 2) Insert new based on selected status
    if (status === 'presente') {
      // determine tipo_dia by day of week
      const dt = new Date(data + 'T12:00')
      const dow = dt.getDay()
      const tipo_dia = dow === 6 ? 'sabado' : (dow === 0 ? 'domingo_feriado' : 'util')
      const horas = parseFloat(horasTrabalhadas)
      const { error } = await supabase.from('efetivo_diario').insert({
        funcionario_id: funcionario.id,
        obra_id: obraId,
        data,
        tipo_dia,
        observacao: observacao || null,
        horas_trabalhadas: isFinite(horas) && horas > 0 ? horas : null,
        registrado_por: user?.id ?? null,
      })
      if (error) { toast.error('Erro: ' + error.message); setSaving(false); return }
    } else if (status && status !== 'pendente') {
      // upload file if provided
      let arquivo_url: string | null = null
      let arquivo_nome: string | null = null
      if (file) {
        const filePath = `faltas/${funcionario.id}/${data}_${Date.now()}_${file.name}`
        const { error: upErr } = await supabase.storage.from('documentos').upload(filePath, file, { upsert: true })
        if (upErr) {
          toast.error('Erro no upload: ' + upErr.message)
          setSaving(false)
          return
        }
        const { data: { publicUrl } } = supabase.storage.from('documentos').getPublicUrl(filePath)
        arquivo_url = publicUrl
        arquivo_nome = file.name
      }

      const { error } = await supabase.from('faltas').insert({
        funcionario_id: funcionario.id,
        obra_id: obraId,
        data,
        tipo: status,
        observacao: observacao || null,
        arquivo_url,
        arquivo_nome,
        registrado_por: user?.id ?? null,
      })
      if (error) { toast.error('Erro: ' + error.message); setSaving(false); return }
    }
    // if pendente, leave both empty (just deleted)

    toast.success('Ponto atualizado!')
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-brand">{funcionario.nome}</h3>
            <p className="text-xs text-gray-500">{funcionario.cargo}</p>
            <p className="text-sm font-medium text-gray-700 mt-1">
              {new Date(data + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        {foraDoVinculo && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            <strong>⚠ Data fora do vínculo:</strong> Este funcionário
            {dataLimiteInicio && data < dataLimiteInicio && <> foi admitido em {new Date(dataLimiteInicio + 'T12:00').toLocaleDateString('pt-BR')}</>}
            {dataLimiteFim && data > dataLimiteFim && <> foi desligado em {new Date(dataLimiteFim + 'T12:00').toLocaleDateString('pt-BR')}</>}
            . Não é possível lançar ponto para esta data.
          </div>
        )}

        <div className="space-y-2 mb-4">
          <p className="text-xs font-semibold text-gray-600">Status do dia</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {STATUS_OPTIONS.map(opt => {
              const active = status === opt.value
              return (
                <button key={opt.value} type="button" onClick={() => setStatus(opt.value)}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    active ? 'border-brand bg-brand/5' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full bg-${opt.color}-500`} />
                    <span className="text-xs font-bold text-gray-800">{opt.label}</span>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-0.5">{opt.desc}</p>
                </button>
              )
            })}
          </div>
        </div>

        {status === 'presente' && (
          <div className="mb-3">
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Horas trabalhadas <span className="text-gray-400 font-normal">(opcional — deixe em branco para usar a carga padrão do contrato)</span>
            </label>
            <input
              type="number" step="0.5" min="0" max="24"
              value={horasTrabalhadas}
              onChange={e => setHorasTrabalhadas(e.target.value)}
              placeholder="Ex: 9"
              className="w-32 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Para contratos cobrados por hora real. Contratos dia-pessoa usam a carga horária fixa do contrato.
            </p>
          </div>
        )}

        {precisaDoc && (
          <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <label className="block text-xs font-semibold text-blue-700 mb-1">
              Anexar atestado (PDF/imagem) — opcional mas recomendado
            </label>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-xs text-gray-600 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border file:border-blue-200 file:bg-white file:text-xs file:font-medium" />
            {initial.arquivo_nome && !file && (
              <p className="text-[10px] text-blue-600 mt-1">Arquivo atual: {initial.arquivo_nome}</p>
            )}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-600 mb-1">Observação</label>
          <textarea value={observacao} onChange={e => setObservacao(e.target.value)} rows={2}
            placeholder="Anotação opcional..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none" />
        </div>

        <div className="flex gap-2 justify-end pt-3 border-t border-gray-100">
          <button onClick={onClose} disabled={saving}
            className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !status || foraDoVinculo}
            className="px-4 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50">
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>

        <p className="text-[10px] text-gray-400 mt-3 text-center">
          Toda alteração é registrada com auditoria (usuário + data/hora).
        </p>
      </div>
    </div>
  )
}
