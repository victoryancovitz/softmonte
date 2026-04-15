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
  horas_normais?: number | null
  horas_extras_50?: number | null
  horas_extras_100?: number | null
  horas_noturnas?: number | null
  entrada?: string | null
  saida_almoco?: string | null
  volta_almoco?: string | null
  saida?: string | null
}

export default function PontoCellEditor({
  funcionario,
  obraId,
  data,
  initial,
  onClose,
  onSaved,
  modeloCobranca,
  obraDataInicio,
  escala,
}: {
  funcionario: { id: string; nome: string; cargo?: string; admissao?: string; deleted_at?: string | null }
  obraId: string
  data: string  // YYYY-MM-DD
  initial: CellState
  onClose: () => void
  onSaved: () => void
  /** Modelo de cobrança da obra. hh_diaria = modo simples (horas manuais); outros = modo detalhado (pontos) */
  modeloCobranca?: 'hh_diaria' | 'hh_hora_efetiva' | 'hh_220'
  /** Data de início da obra — bloqueia lançamento antes */
  obraDataInicio?: string | null
  /** Escala da obra — usada quando modeloCobranca != hh_diaria */
  escala?: {
    escala_entrada?: string | null
    escala_saida_seg_qui?: string | null
    escala_saida_sex?: string | null
    escala_almoco_minutos?: number | null
    escala_tolerancia_min?: number | null
  }
}) {
  const isDetalhado = modeloCobranca && modeloCobranca !== 'hh_diaria'
  // Validação de período do vínculo
  const dataLimiteInicio = funcionario.admissao ?? null
  const dataLimiteFim = funcionario.deleted_at ? funcionario.deleted_at.split('T')[0] : null
  const foraDoVinculo: boolean = Boolean(
    (dataLimiteInicio && data < dataLimiteInicio) ||
    (dataLimiteFim && data > dataLimiteFim)
  )
  const antesInicioObra: boolean = Boolean(obraDataInicio && data < obraDataInicio)
  const [status, setStatus] = useState<StatusValue | null>(initial.status)
  const [observacao, setObservacao] = useState(initial.observacao ?? '')
  const [horasNormais, setHorasNormais] = useState<string>(
    initial.horas_normais != null ? String(initial.horas_normais) :
    (initial.horas_trabalhadas != null ? String(initial.horas_trabalhadas) : '')
  )
  const [he50, setHe50] = useState<string>(initial.horas_extras_50 != null ? String(initial.horas_extras_50) : '')
  const [he100, setHe100] = useState<string>(initial.horas_extras_100 != null ? String(initial.horas_extras_100) : '')
  const [hNoturna, setHNoturna] = useState<string>(initial.horas_noturnas != null ? String(initial.horas_noturnas) : '')
  const [file, setFile] = useState<File | null>(null)
  const totalHoras = (parseFloat(horasNormais) || 0) + (parseFloat(he50) || 0) + (parseFloat(he100) || 0)
  const [saving, setSaving] = useState(false)
  // Modo detalhado: pontos do relógio biométrico
  const [entrada, setEntrada] = useState<string>(initial.entrada?.slice(0, 5) || '')
  const [saidaAlmoco, setSaidaAlmoco] = useState<string>(initial.saida_almoco?.slice(0, 5) || '')
  const [voltaAlmoco, setVoltaAlmoco] = useState<string>(initial.volta_almoco?.slice(0, 5) || '')
  const [saidaPonto, setSaidaPonto] = useState<string>(initial.saida?.slice(0, 5) || '')
  const [preview, setPreview] = useState<any>(null)
  const [calculando, setCalculando] = useState(false)
  const supabase = createClient()
  const toast = useToast()

  // Dia da semana pra decidir escala saída (seg-qui vs sex)
  const diaSem = new Date(data + 'T12:00').getDay()  // 0=dom 6=sáb
  const escalaSaida = diaSem === 5 ? escala?.escala_saida_sex : escala?.escala_saida_seg_qui
  const tipoDia = diaSem === 6 ? 'sabado' : (diaSem === 0 ? 'domingo_feriado' : 'util')

  async function recalcular() {
    if (!isDetalhado) return
    setCalculando(true)
    try {
      const { data: calc, error } = await supabase.rpc('calcular_horas_ponto', {
        p_entrada: entrada || null,
        p_saida_almoco: saidaAlmoco || null,
        p_volta_almoco: voltaAlmoco || null,
        p_saida: saidaPonto || null,
        p_escala_entrada: escala?.escala_entrada || '07:00',
        p_escala_saida: escalaSaida || '17:00',
        p_almoco_minutos: escala?.escala_almoco_minutos || 60,
        p_tolerancia_min: escala?.escala_tolerancia_min || 10,
        p_tipo_dia: tipoDia,
      })
      if (error) { toast.error('Erro: ' + error.message); return }
      setPreview(calc)
      setHorasNormais(String(calc?.horas_normais ?? 0))
      setHe50(String(calc?.horas_extras_50 ?? 0))
      setHe100(String(calc?.horas_extras_100 ?? 0))
    } finally {
      setCalculando(false)
    }
  }

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
    if (antesInicioObra) {
      toast.error('Data anterior ao início da obra.')
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
      if (totalHoras > 24) {
        toast.error('Total de horas não pode passar de 24h.')
        setSaving(false)
        return
      }
      // determine tipo_dia by day of week
      const dt = new Date(data + 'T12:00')
      const dow = dt.getDay()
      const tipo_dia = dow === 6 ? 'sabado' : (dow === 0 ? 'domingo_feriado' : 'util')
      const hn = parseFloat(horasNormais); const h50 = parseFloat(he50); const h100 = parseFloat(he100); const hnot = parseFloat(hNoturna)
      const { error } = await supabase.from('efetivo_diario').insert({
        funcionario_id: funcionario.id,
        obra_id: obraId,
        data,
        tipo_dia,
        observacao: observacao || null,
        horas_normais:    isFinite(hn)   && hn   > 0 ? hn   : null,
        horas_extras_50:  isFinite(h50)  && h50  > 0 ? h50  : 0,
        horas_extras_100: isFinite(h100) && h100 > 0 ? h100 : 0,
        horas_noturnas:   isFinite(hnot) && hnot > 0 ? hnot : 0,
        horas_trabalhadas: totalHoras > 0 ? totalHoras : null,
        // Pontos do relógio (modo detalhado)
        entrada:       isDetalhado && entrada      ? entrada      : null,
        saida_almoco:  isDetalhado && saidaAlmoco  ? saidaAlmoco  : null,
        volta_almoco:  isDetalhado && voltaAlmoco  ? voltaAlmoco  : null,
        saida:         isDetalhado && saidaPonto   ? saidaPonto   : null,
        atraso_minutos: isDetalhado && preview?.atraso_minutos ? preview.atraso_minutos : 0,
        horas_previstas: isDetalhado && preview?.escala_minutos ? preview.escala_minutos / 60 : null,
        origem_registro: isDetalhado ? 'manual' : 'manual',
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
        {antesInicioObra && !foraDoVinculo && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            <strong>⚠ Data anterior ao início da obra:</strong> A obra iniciou em {new Date(obraDataInicio! + 'T12:00').toLocaleDateString('pt-BR')}. Não é possível lançar ponto para esta data.
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

        {status === 'presente' && isDetalhado && (
          <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-blue-800">Pontos do relógio biométrico</label>
              <span className="text-[10px] text-blue-600">
                Escala: {escala?.escala_entrada || '07:00'} → {escalaSaida || '17:00'}
                {tipoDia !== 'util' && ` (${tipoDia})`}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 mb-1">Entrada</label>
                <input type="time" value={entrada} onChange={e => setEntrada(e.target.value)}
                  className="w-full px-2 py-1.5 border border-blue-200 rounded-md text-sm bg-white" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 mb-1">Saída almoço</label>
                <input type="time" value={saidaAlmoco} onChange={e => setSaidaAlmoco(e.target.value)}
                  className="w-full px-2 py-1.5 border border-blue-200 rounded-md text-sm bg-white" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 mb-1">Volta almoço</label>
                <input type="time" value={voltaAlmoco} onChange={e => setVoltaAlmoco(e.target.value)}
                  className="w-full px-2 py-1.5 border border-blue-200 rounded-md text-sm bg-white" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 mb-1">Saída</label>
                <input type="time" value={saidaPonto} onChange={e => setSaidaPonto(e.target.value)}
                  className="w-full px-2 py-1.5 border border-blue-200 rounded-md text-sm bg-white" />
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <button type="button" onClick={recalcular} disabled={calculando}
                className="text-[11px] px-3 py-1 bg-blue-600 text-white rounded-md font-bold hover:bg-blue-700 disabled:opacity-50">
                {calculando ? 'Calculando...' : 'Calcular horas'}
              </button>
              {preview && (
                <div className="text-[11px] text-blue-800 font-semibold">
                  Normais: {Number(preview.horas_normais).toFixed(2)}h · HE 70%: {Number(preview.horas_extras_50).toFixed(2)}h · HE 100%: {Number(preview.horas_extras_100).toFixed(2)}h
                  {preview.atraso_minutos > 0 && <span className="text-red-600"> · Atraso: {preview.atraso_minutos}min</span>}
                </div>
              )}
            </div>
          </div>
        )}

        {status === 'presente' && !isDetalhado && (
          <div className="mb-3 p-3 bg-gray-50 border border-gray-100 rounded-lg">
            <label className="block text-xs font-semibold text-gray-700 mb-2">Horas do dia</label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 mb-1">Normais</label>
                <input type="number" step="0.5" min="0" max="24"
                  value={horasNormais} onChange={e => setHorasNormais(e.target.value)}
                  placeholder="9"
                  className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-amber-600 mb-1">HE 50%/70% <span className="text-gray-400 font-normal">(dia útil)</span></label>
                <input type="number" step="0.5" min="0" max="12"
                  value={he50} onChange={e => setHe50(e.target.value)}
                  placeholder="0"
                  className="w-full px-2 py-1.5 border border-amber-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-red-600 mb-1">HE 100% <span className="text-gray-400 font-normal">(domingo/feriado)</span></label>
                <input type="number" step="0.5" min="0" max="24"
                  value={he100} onChange={e => setHe100(e.target.value)}
                  placeholder="0"
                  className="w-full px-2 py-1.5 border border-red-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-violet-600 mb-1">Noturno <span className="text-gray-400 font-normal">(22h-5h)</span></label>
                <input type="number" step="0.5" min="0" max="10"
                  value={hNoturna} onChange={e => setHNoturna(e.target.value)}
                  placeholder="0"
                  className="w-full px-2 py-1.5 border border-violet-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
              </div>
            </div>
            <div className={`mt-2 text-[11px] font-semibold flex items-center justify-between ${totalHoras > 24 ? 'text-red-600' : 'text-gray-600'}`}>
              <span>Total: {totalHoras.toFixed(1)}h {totalHoras > 24 && '— EXCEDE 24h'}</span>
              <span className="text-gray-400 font-normal">Deixe vazio para usar carga padrão do contrato</span>
            </div>
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
          <button onClick={handleSave} disabled={saving || !status || foraDoVinculo || antesInicioObra}
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
