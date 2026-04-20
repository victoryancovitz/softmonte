'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { confirmDialog } from '@/components/ui/ConfirmDialog'

interface Props {
  funcionario: any
  data: string // YYYY-MM-DD
  obraId: string
  open: boolean
  onClose: () => void
  onSaved: () => void
  mesFechado: boolean
}

interface Marcacao {
  id: string
  funcionario_id: string
  data: string
  hora: string
  sequencia: number
  origem: string
  excluido_em: string | null
  excluido_por: string | null
  motivo_edicao: string | null
  created_at: string
}

interface Registro {
  id: string
  funcionario_id: string
  data: string
  entrada: string | null
  saida: string | null
  intervalo_min: number | null
  horas_trabalhadas: number | null
  tipo_dia: string | null
  observacao: string | null
  editado_em: string | null
  editado_por: string | null
  motivo_edicao: string | null
  origem: string | null
}

interface AuditEntry {
  id: string
  created_at: string
  usuario_nome: string | null
  acao: string
  tabela: string
  campos_alterados: string[] | null
  dados_antigos: any
  dados_novos: any
}

const TIPO_DIA_OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'feriado', label: 'Feriado' },
  { value: 'compensacao', label: 'Compensacao' },
  { value: 'folga', label: 'Folga' },
  { value: 'falta', label: 'Falta' },
  { value: 'atestado', label: 'Atestado' },
  { value: 'ferias', label: 'Ferias' },
]

function calcHorasTrabalhadas(entrada: string | null, saida: string | null, intervaloMin: number | null): number | null {
  if (!entrada || !saida) return null
  const [eh, em] = entrada.split(':').map(Number)
  const [sh, sm] = saida.split(':').map(Number)
  const totalMin = (sh * 60 + sm) - (eh * 60 + em) - (intervaloMin ?? 0)
  if (totalMin <= 0) return null
  return Math.round((totalMin / 60) * 100) / 100
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
}

export default function ModalEdicaoPonto({ funcionario, data, obraId, open, onClose, onSaved, mesFechado }: Props) {
  const supabase = createClient()
  const toast = useToast()

  const [tab, setTab] = useState<'batidas' | 'resumo' | 'historico'>('batidas')

  // Section A — Batidas
  const [marcacoes, setMarcacoes] = useState<Marcacao[]>([])
  const [loadingMarcacoes, setLoadingMarcacoes] = useState(false)
  const [editingMarcacao, setEditingMarcacao] = useState<string | null>(null)
  const [editHora, setEditHora] = useState('')
  const [editMotivo, setEditMotivo] = useState('')
  const [addingMarcacao, setAddingMarcacao] = useState(false)
  const [newHora, setNewHora] = useState('')
  const [newMotivo, setNewMotivo] = useState('')
  const [deletingMarcacao, setDeletingMarcacao] = useState<string | null>(null)
  const [deleteMotivo, setDeleteMotivo] = useState('')
  const [saving, setSaving] = useState(false)

  // Section B — Resumo
  const [registro, setRegistro] = useState<Registro | null>(null)
  const [loadingRegistro, setLoadingRegistro] = useState(false)
  const [regEntrada, setRegEntrada] = useState('')
  const [regSaida, setRegSaida] = useState('')
  const [regIntervalo, setRegIntervalo] = useState<number>(60)
  const [regTipoDia, setRegTipoDia] = useState('normal')
  const [regObservacao, setRegObservacao] = useState('')
  const [regMotivo, setRegMotivo] = useState('')
  const [regDirty, setRegDirty] = useState(false)

  // Section C — Historico
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])
  const [loadingAudit, setLoadingAudit] = useState(false)

  const readonly = mesFechado

  const loadMarcacoes = useCallback(async () => {
    setLoadingMarcacoes(true)
    const { data: rows } = await supabase
      .from('ponto_marcacoes')
      .select('*')
      .eq('funcionario_id', funcionario.id)
      .eq('data', data)
      .order('sequencia')
    // Show all (including deleted) so we can display deleted in strikethrough
    setMarcacoes(rows ?? [])
    setLoadingMarcacoes(false)
  }, [funcionario.id, data])

  const loadRegistro = useCallback(async () => {
    setLoadingRegistro(true)
    const { data: row } = await supabase
      .from('ponto_registros')
      .select('*')
      .eq('funcionario_id', funcionario.id)
      .eq('data', data)
      .maybeSingle()
    setRegistro(row as Registro | null)
    if (row) {
      setRegEntrada((row as any).entrada ?? '')
      setRegSaida((row as any).saida ?? '')
      setRegIntervalo((row as any).intervalo_min ?? 60)
      setRegTipoDia((row as any).tipo_dia ?? 'normal')
      setRegObservacao((row as any).observacao ?? '')
    } else {
      setRegEntrada('')
      setRegSaida('')
      setRegIntervalo(60)
      setRegTipoDia('normal')
      setRegObservacao('')
    }
    setRegMotivo('')
    setRegDirty(false)
    setLoadingRegistro(false)
  }, [funcionario.id, data])

  const loadAudit = useCallback(async () => {
    setLoadingAudit(true)
    const { data: rows } = await supabase
      .from('audit_log')
      .select('*')
      .in('tabela', ['ponto_marcacoes', 'ponto_registros'])
      .order('created_at', { ascending: false })
      .limit(200)
    // Filter client-side for this funcionario + data (audit_log may not have these columns directly)
    const filtered = (rows ?? []).filter((r: any) => {
      const dados = r.dados_novos ?? r.dados_antigos ?? {}
      return dados.funcionario_id === funcionario.id && dados.data === data
    })
    setAuditLog(filtered as AuditEntry[])
    setLoadingAudit(false)
  }, [funcionario.id, data])

  useEffect(() => {
    if (!open) return
    loadMarcacoes()
    loadRegistro()
  }, [open, loadMarcacoes, loadRegistro])

  useEffect(() => {
    if (tab === 'historico' && auditLog.length === 0 && !loadingAudit) {
      loadAudit()
    }
  }, [tab])

  // Auto-calc horas
  const horasCalc = calcHorasTrabalhadas(regEntrada || null, regSaida || null, regIntervalo)

  // --- Marcacoes handlers ---
  async function handleEditMarcacao(id: string) {
    if (!editMotivo.trim()) { toast.warning('Motivo da edicao e obrigatorio'); return }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('ponto_marcacoes').update({
      hora: editHora,
      motivo_edicao: editMotivo,
      editado_em: new Date().toISOString(),
      editado_por: user?.id,
    }).eq('id', id)
    setSaving(false)
    if (error) { toast.error('Erro ao editar batida: ' + error.message); return }
    toast.success('Batida editada')
    setEditingMarcacao(null)
    setEditHora('')
    setEditMotivo('')
    loadMarcacoes()
    onSaved()
  }

  async function handleDeleteMarcacao(id: string) {
    if (!deleteMotivo.trim()) { toast.warning('Motivo da exclusao e obrigatorio'); return }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('ponto_marcacoes').update({
      excluido_em: new Date().toISOString(),
      excluido_por: user?.id,
      motivo_edicao: deleteMotivo,
    }).eq('id', id)
    setSaving(false)
    if (error) { toast.error('Erro ao excluir batida: ' + error.message); return }
    toast.success('Batida excluida')
    setDeletingMarcacao(null)
    setDeleteMotivo('')
    loadMarcacoes()
    onSaved()
  }

  async function handleAddMarcacao() {
    if (!newHora) { toast.warning('Informe o horario'); return }
    if (!newMotivo.trim()) { toast.warning('Motivo e obrigatorio'); return }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const activeMarcacoes = marcacoes.filter(m => !m.excluido_em)
    const maxSeq = activeMarcacoes.length > 0 ? Math.max(...activeMarcacoes.map(m => m.sequencia)) : 0
    const { error } = await supabase.from('ponto_marcacoes').insert({
      funcionario_id: funcionario.id,
      data,
      hora: newHora,
      sequencia: maxSeq + 1,
      origem: 'manual',
      motivo_edicao: newMotivo,
      criado_por: user?.id,
    })
    setSaving(false)
    if (error) { toast.error('Erro ao adicionar batida: ' + error.message); return }
    toast.success('Batida adicionada')
    setAddingMarcacao(false)
    setNewHora('')
    setNewMotivo('')
    loadMarcacoes()
    onSaved()
  }

  // --- Registro handlers ---
  async function handleSaveRegistro() {
    if (!regMotivo.trim()) { toast.warning('Motivo da edicao e obrigatorio'); return }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      entrada: regEntrada || null,
      saida: regSaida || null,
      intervalo_min: regIntervalo,
      horas_trabalhadas: horasCalc,
      tipo_dia: regTipoDia,
      observacao: regObservacao || null,
      editado_em: new Date().toISOString(),
      editado_por: user?.id,
      motivo_edicao: regMotivo,
      origem: 'correcao',
    }

    let error: any = null
    if (registro) {
      const res = await supabase.from('ponto_registros').update(payload).eq('id', registro.id)
      error = res.error
    } else {
      const res = await supabase.from('ponto_registros').insert({
        ...payload,
        funcionario_id: funcionario.id,
        data,
      })
      error = res.error
    }
    setSaving(false)
    if (error) { toast.error('Erro ao salvar registro: ' + error.message); return }
    toast.success(registro ? 'Registro atualizado' : 'Registro criado')
    setRegMotivo('')
    setRegDirty(false)
    loadRegistro()
    onSaved()
  }

  async function handleDeleteRegistro() {
    if (!registro) return
    if (!await confirmDialog({ title: 'Excluir registro?', message: 'Deseja realmente excluir o registro deste dia? Essa ação não pode ser desfeita.', variant: 'danger', confirmLabel: 'Excluir' })) return
    setSaving(true)
    const { error } = await supabase.from('ponto_registros').delete().eq('id', registro.id)
    setSaving(false)
    if (error) { toast.error('Erro ao excluir registro: ' + error.message); return }
    toast.success('Registro excluido')
    loadRegistro()
    onSaved()
  }

  if (!open) return null

  const activeMarcacoes = marcacoes.filter(m => !m.excluido_em)
  const deletedMarcacoes = marcacoes.filter(m => !!m.excluido_em)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-brand">{funcionario.nome_guerra ?? funcionario.nome}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{formatDate(data)} {funcionario.cargo ? `- ${funcionario.cargo}` : ''}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        {/* Mes fechado banner */}
        {readonly && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center gap-2">
            <span className="text-lg">🔒</span>
            <span className="text-xs font-bold text-amber-800">Mes fechado — somente leitura</span>
          </div>
        )}

        {/* Tabs */}
        <div className="px-6 pt-3 flex gap-1 border-b border-gray-100">
          {(['batidas', 'resumo', 'historico'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors ${tab === t ? 'bg-brand/10 text-brand border-b-2 border-brand' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
              {t === 'batidas' ? 'Batidas' : t === 'resumo' ? 'Resumo do Dia' : 'Histórico'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* ===== TAB: BATIDAS ===== */}
          {tab === 'batidas' && (
            <div>
              {loadingMarcacoes ? (
                <p className="text-xs text-gray-400">Carregando batidas...</p>
              ) : (
                <>
                  {activeMarcacoes.length === 0 && deletedMarcacoes.length === 0 ? (
                    <p className="text-xs text-gray-400 mb-4">Nenhuma batida registrada para este dia.</p>
                  ) : (
                    <table className="w-full text-xs mb-4">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left px-2 py-2 text-gray-500 font-semibold w-12">Seq</th>
                          <th className="text-left px-2 py-2 text-gray-500 font-semibold">Hora</th>
                          <th className="text-left px-2 py-2 text-gray-500 font-semibold">Origem</th>
                          <th className="text-right px-2 py-2 text-gray-500 font-semibold w-28">Acoes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeMarcacoes.map(m => (
                          <tr key={m.id} className="border-b border-gray-50">
                            {editingMarcacao === m.id ? (
                              <>
                                <td className="px-2 py-2 text-gray-600">{m.sequencia}</td>
                                <td className="px-2 py-2" colSpan={2}>
                                  <div className="flex flex-col gap-2">
                                    <input type="time" value={editHora} onChange={e => setEditHora(e.target.value)}
                                      className="px-2 py-1 border border-gray-200 rounded text-xs w-28" />
                                    <input type="text" value={editMotivo} onChange={e => setEditMotivo(e.target.value)}
                                      placeholder="Motivo da edicao (obrigatorio)"
                                      className="px-2 py-1 border border-gray-200 rounded text-xs" />
                                  </div>
                                </td>
                                <td className="px-2 py-2 text-right">
                                  <div className="flex gap-1 justify-end">
                                    <button onClick={() => handleEditMarcacao(m.id)} disabled={saving}
                                      className="px-2 py-1 bg-brand text-white rounded text-[10px] font-bold disabled:opacity-50">Salvar</button>
                                    <button onClick={() => { setEditingMarcacao(null); setEditMotivo('') }}
                                      className="px-2 py-1 border border-gray-200 rounded text-[10px]">Cancelar</button>
                                  </div>
                                </td>
                              </>
                            ) : deletingMarcacao === m.id ? (
                              <>
                                <td className="px-2 py-2 text-gray-600">{m.sequencia}</td>
                                <td className="px-2 py-2" colSpan={2}>
                                  <p className="text-red-600 font-semibold mb-1">Confirmar exclusao da batida {m.hora}?</p>
                                  <input type="text" value={deleteMotivo} onChange={e => setDeleteMotivo(e.target.value)}
                                    placeholder="Motivo da exclusao (obrigatorio)"
                                    className="px-2 py-1 border border-gray-200 rounded text-xs w-full" />
                                </td>
                                <td className="px-2 py-2 text-right">
                                  <div className="flex gap-1 justify-end">
                                    <button onClick={() => handleDeleteMarcacao(m.id)} disabled={saving}
                                      className="px-2 py-1 bg-red-600 text-white rounded text-[10px] font-bold disabled:opacity-50">Excluir</button>
                                    <button onClick={() => { setDeletingMarcacao(null); setDeleteMotivo('') }}
                                      className="px-2 py-1 border border-gray-200 rounded text-[10px]">Cancelar</button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="px-2 py-2 text-gray-600">{m.sequencia}</td>
                                <td className="px-2 py-2 font-mono font-semibold text-gray-800">{m.hora}</td>
                                <td className="px-2 py-2">
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${m.origem === 'manual' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                                    {m.origem}
                                  </span>
                                  {m.motivo_edicao && <span className="text-gray-400 ml-2" title={m.motivo_edicao}>📝</span>}
                                </td>
                                <td className="px-2 py-2 text-right">
                                  {!readonly && (
                                    <div className="flex gap-1 justify-end">
                                      <button onClick={() => { setEditingMarcacao(m.id); setEditHora(m.hora); setEditMotivo('') }}
                                        className="px-2 py-1 border border-gray-200 rounded text-[10px] hover:bg-gray-50">Editar</button>
                                      <button onClick={() => { setDeletingMarcacao(m.id); setDeleteMotivo('') }}
                                        className="px-2 py-1 border border-red-200 text-red-600 rounded text-[10px] hover:bg-red-50">Excluir</button>
                                    </div>
                                  )}
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                        {/* Deleted marcacoes in strikethrough */}
                        {deletedMarcacoes.map(m => (
                          <tr key={m.id} className="border-b border-gray-50 opacity-50">
                            <td className="px-2 py-2 text-gray-400 line-through">{m.sequencia}</td>
                            <td className="px-2 py-2 font-mono text-gray-400 line-through">{m.hora}</td>
                            <td className="px-2 py-2 text-gray-400 line-through">{m.origem}</td>
                            <td className="px-2 py-2 text-right text-[10px] text-gray-400">
                              Excluida{m.motivo_edicao ? `: ${m.motivo_edicao}` : ''}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {/* Add marcacao */}
                  {!readonly && (
                    addingMarcacao ? (
                      <div className="border border-gray-200 rounded-xl p-3 bg-gray-50">
                        <p className="text-xs font-semibold text-gray-700 mb-2">Nova batida</p>
                        <div className="flex flex-col gap-2">
                          <input type="time" value={newHora} onChange={e => setNewHora(e.target.value)}
                            className="px-2 py-1.5 border border-gray-200 rounded text-xs w-32" />
                          <input type="text" value={newMotivo} onChange={e => setNewMotivo(e.target.value)}
                            placeholder="Motivo (obrigatorio)"
                            className="px-2 py-1.5 border border-gray-200 rounded text-xs" />
                          <div className="flex gap-2">
                            <button onClick={handleAddMarcacao} disabled={saving}
                              className="px-3 py-1.5 bg-brand text-white rounded text-xs font-bold disabled:opacity-50">Adicionar</button>
                            <button onClick={() => { setAddingMarcacao(false); setNewHora(''); setNewMotivo('') }}
                              className="px-3 py-1.5 border border-gray-200 rounded text-xs">Cancelar</button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setAddingMarcacao(true)}
                        className="px-3 py-2 border border-dashed border-gray-300 rounded-xl text-xs text-gray-500 hover:border-brand hover:text-brand w-full">
                        + Adicionar batida
                      </button>
                    )
                  )}
                </>
              )}
            </div>
          )}

          {/* ===== TAB: RESUMO ===== */}
          {tab === 'resumo' && (
            <div>
              {loadingRegistro ? (
                <p className="text-xs text-gray-400">Carregando registro...</p>
              ) : (
                <>
                  {!registro && !readonly && (
                    <div className="text-center py-6">
                      <p className="text-xs text-gray-400 mb-3">Nenhum registro encontrado para este dia.</p>
                      <button onClick={handleSaveRegistro} disabled={saving || !regMotivo.trim()}
                        className="px-4 py-2 bg-brand text-white rounded-xl text-xs font-bold disabled:opacity-50">
                        Criar registro
                      </button>
                      <input type="text" value={regMotivo} onChange={e => { setRegMotivo(e.target.value); setRegDirty(true) }}
                        placeholder="Motivo (obrigatorio para criar)"
                        className="mt-2 px-3 py-1.5 border border-gray-200 rounded-xl text-xs w-full max-w-xs mx-auto block" />
                    </div>
                  )}

                  {(registro || regDirty) && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Entrada</label>
                          <input type="time" value={regEntrada} disabled={readonly}
                            onChange={e => { setRegEntrada(e.target.value); setRegDirty(true) }}
                            className="px-3 py-2 border border-gray-200 rounded-xl text-sm w-full disabled:bg-gray-50 disabled:text-gray-400" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Saida</label>
                          <input type="time" value={regSaida} disabled={readonly}
                            onChange={e => { setRegSaida(e.target.value); setRegDirty(true) }}
                            className="px-3 py-2 border border-gray-200 rounded-xl text-sm w-full disabled:bg-gray-50 disabled:text-gray-400" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Intervalo (min)</label>
                          <input type="number" value={regIntervalo} disabled={readonly} min={0} max={240}
                            onChange={e => { setRegIntervalo(Number(e.target.value)); setRegDirty(true) }}
                            className="px-3 py-2 border border-gray-200 rounded-xl text-sm w-full disabled:bg-gray-50 disabled:text-gray-400" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo do dia</label>
                          <select value={regTipoDia} disabled={readonly}
                            onChange={e => { setRegTipoDia(e.target.value); setRegDirty(true) }}
                            className="px-3 py-2 border border-gray-200 rounded-xl text-sm w-full disabled:bg-gray-50 disabled:text-gray-400">
                            {TIPO_DIA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </div>
                      </div>

                      {/* Auto-calc display */}
                      <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
                        <span className="text-xs text-gray-500">Horas trabalhadas (calculado)</span>
                        <span className="text-sm font-bold text-brand">
                          {horasCalc !== null ? `${horasCalc}h` : '--'}
                        </span>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Observação</label>
                        <textarea value={regObservacao} disabled={readonly} rows={2}
                          onChange={e => { setRegObservacao(e.target.value); setRegDirty(true) }}
                          className="px-3 py-2 border border-gray-200 rounded-xl text-sm w-full disabled:bg-gray-50 disabled:text-gray-400 resize-none" />
                      </div>

                      {/* Registro metadata */}
                      {registro && (
                        <div className="text-[10px] text-gray-400 space-y-0.5">
                          {registro.origem && <p>Origem: {registro.origem}</p>}
                          {registro.editado_em && <p>Ultima edicao: {new Date(registro.editado_em).toLocaleString('pt-BR')}</p>}
                          {registro.motivo_edicao && <p>Motivo: {registro.motivo_edicao}</p>}
                        </div>
                      )}

                      {!readonly && registro && (
                        <>
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Motivo da edicao (obrigatorio)</label>
                            <input type="text" value={regMotivo} onChange={e => setRegMotivo(e.target.value)}
                              placeholder="Ex: correcao de horario conforme cartao ponto"
                              className="px-3 py-2 border border-gray-200 rounded-xl text-sm w-full" />
                          </div>

                          <div className="flex gap-2">
                            <button onClick={handleSaveRegistro} disabled={saving || !regMotivo.trim() || !regDirty}
                              className="px-4 py-2 bg-brand text-white rounded-xl text-xs font-bold disabled:opacity-50">
                              {saving ? 'Salvando...' : 'Salvar alteracoes'}
                            </button>
                            <button onClick={handleDeleteRegistro} disabled={saving}
                              className="px-4 py-2 border border-red-200 text-red-600 rounded-xl text-xs font-semibold hover:bg-red-50 disabled:opacity-50">
                              Excluir dia
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ===== TAB: HISTORICO ===== */}
          {tab === 'historico' && (
            <div>
              {loadingAudit ? (
                <p className="text-xs text-gray-400">Carregando historico...</p>
              ) : auditLog.length === 0 ? (
                <p className="text-xs text-gray-400">Nenhuma alteracao registrada para este dia.</p>
              ) : (
                <div className="space-y-3">
                  {auditLog.map(entry => {
                    const cor = entry.acao === 'INSERT' ? 'border-green-300 bg-green-50' : entry.acao === 'DELETE' ? 'border-red-300 bg-red-50' : 'border-blue-300 bg-blue-50'
                    const label = entry.acao === 'INSERT' ? 'Criado' : entry.acao === 'DELETE' ? 'Excluido' : 'Alterado'
                    return (
                      <div key={entry.id} className={`border-l-4 rounded-r-xl p-3 ${cor}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-gray-700">{label} em {entry.tabela.replace('ponto_', '')}</span>
                          <span className="text-[10px] text-gray-400">
                            {new Date(entry.created_at).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        {entry.usuario_nome && <p className="text-[10px] text-gray-500">Por: {entry.usuario_nome}</p>}
                        {entry.campos_alterados && entry.campos_alterados.length > 0 && (
                          <p className="text-[10px] text-gray-500 mt-1">Campos: {entry.campos_alterados.join(', ')}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
