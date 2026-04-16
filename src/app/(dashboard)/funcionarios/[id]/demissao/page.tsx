'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import BackButton from '@/components/BackButton'
import { useToast } from '@/components/Toast'
import { formatSupabaseError } from '@/lib/errors'

const DEVOLUCAO_ITEMS = [
  { key: 'epi_devolvido', label: 'EPI devolvido' },
  { key: 'ferramentas_devolvidas', label: 'Ferramentas devolvidas' },
  { key: 'cracha_devolvido', label: 'Cracha devolvido' },
]

const TIPO_LABELS: Record<string, string> = {
  sem_justa_causa: 'Sem Justa Causa',
  pedido: 'Pedido de Demissao',
  consensual: 'Acordo Consensual',
  justa_causa: 'Justa Causa',
}

// CLT Art. 482 — motivos legais de justa causa
const MOTIVOS_JUSTA_CAUSA = [
  { value: 'ato_improbidade', label: 'Ato de improbidade' },
  { value: 'incontinencia_conduta', label: 'Incontinência de conduta ou mau procedimento' },
  { value: 'negociacao_habitual', label: 'Negociação habitual sem permissão / concorrência' },
  { value: 'condenacao_criminal', label: 'Condenação criminal transitada em julgado' },
  { value: 'desidia', label: 'Desídia no desempenho das funções' },
  { value: 'embriaguez', label: 'Embriaguez habitual ou em serviço' },
  { value: 'violacao_segredo', label: 'Violação de segredo da empresa' },
  { value: 'indisciplina', label: 'Ato de indisciplina ou de insubordinação' },
  { value: 'abandono_emprego', label: 'Abandono de emprego (>30 dias sem justificativa)' },
  { value: 'ofensas_fisicas', label: 'Ato lesivo da honra/boa fama, ou ofensas físicas' },
  { value: 'jogos_azar', label: 'Prática constante de jogos de azar' },
  { value: 'ato_seguranca_nacional', label: 'Atos atentatórios à segurança nacional' },
  { value: 'outro', label: 'Outro motivo (descrever)' },
]

function formatDate(d: string | null): string {
  if (!d) return ''
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export default function DemissaoWizardPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()

  const [etapa, setEtapa] = useState(1)
  const [func, setFunc] = useState<any>(null)
  const [workflowId, setWorkflowId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Step 1 — Tipo e motivo
  const [tipoMotivo, setTipoMotivo] = useState({
    tipo_desligamento: 'sem_justa_causa',
    motivo: '',
    motivo_justa_causa_codigo: '',
    motivo_justa_causa_detalhe: '',
    data_aviso: '',
    data_prevista_saida: '',
  })

  // Step 2 — Checklist de devolucao
  const [devolucao, setDevolucao] = useState<Record<string, { ok: boolean; obs: string }>>(
    Object.fromEntries(DEVOLUCAO_ITEMS.map(d => [d.key, { ok: false, obs: '' }]))
  )

  // Step 3 — Exame demissional
  const [exameDem, setExameDem] = useState({
    data_exame: '', medico: '', laudo_url: '', laudo_nome: '',
  })
  const [laudoFile, setLaudoFile] = useState<File | null>(null)

  // Step 4 — Acerto financeiro
  const [acerto, setAcerto] = useState({
    saldo_banco_horas: 0, saldo_ferias: 0, valor_rescisao: '',
    prazo_pagamento: '',
  })

  // Step 5 — eSocial S-2299
  const [esocial, setEsocial] = useState({
    s2299_enviado: false, s2299_recibo: '', s2299_data: '',
    prazo_legal: '',
  })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [funcRes, wfRes, bhRes, feriasRes, alocRes] = await Promise.all([
      supabase.from('funcionarios').select('*').eq('id', id).single(),
      supabase.from('desligamentos_workflow').select('*').eq('funcionario_id', id).eq('status', 'em_andamento').order('created_at', { ascending: false }).limit(1),
      supabase.from('banco_horas').select('saldo_acumulado_final').eq('funcionario_id', id).order('ano', { ascending: false }).order('mes', { ascending: false }).limit(1),
      supabase.from('ferias').select('*').eq('funcionario_id', id).order('created_at', { ascending: false }).limit(1),
      supabase.from('alocacoes').select('obra_id').eq('funcionario_id', id).eq('ativo', true).limit(1),
    ])

    const f = funcRes.data
    if (!f) { router.push('/funcionarios'); return }
    if (f.deleted_at) {
      alert('Este funcionário já foi desligado. Não é possível abrir nova demissão.')
      router.push(`/funcionarios/${id}`)
      return
    }
    setFunc(f)

    const saldoBH = bhRes.data?.[0]?.saldo_acumulado_final ?? 0
    // Calculate proportional vacation days
    const admissao = f.admissao ? new Date(f.admissao + 'T12:00:00') : null
    const now = new Date()
    let diasFerias = 0
    if (admissao) {
      const mesesTrabalhados = (now.getFullYear() - admissao.getFullYear()) * 12 + (now.getMonth() - admissao.getMonth())
      diasFerias = Math.min(30, Math.round((mesesTrabalhados % 12) * 2.5))
    }

    setAcerto(a => ({ ...a, saldo_banco_horas: saldoBH, saldo_ferias: diasFerias }))

    // Load existing workflow
    const wf = wfRes.data?.[0]
    if (wf) {
      setWorkflowId(wf.id)
      setTipoMotivo({
        tipo_desligamento: wf.tipo_desligamento ?? 'sem_justa_causa',
        motivo: wf.motivo ?? '',
        motivo_justa_causa_codigo: '',
        motivo_justa_causa_detalhe: '',
        data_aviso: wf.data_aviso ?? '',
        data_prevista_saida: wf.data_prevista_saida ?? '',
      })

      const dev = wf.etapa_devolucao_epi ?? {}
      if (dev.itens) setDevolucao(dev.itens)

      const ex = wf.etapa_exame_demissional ?? {}
      if (ex.data_exame) setExameDem({
        data_exame: ex.data_exame ?? '', medico: ex.medico ?? '',
        laudo_url: ex.laudo_url ?? '', laudo_nome: ex.laudo_nome ?? '',
      })

      if (wf.saldo_banco_horas_saida) setAcerto(a => ({ ...a, saldo_banco_horas: wf.saldo_banco_horas_saida }))
      if (wf.saldo_ferias_saida) setAcerto(a => ({ ...a, saldo_ferias: wf.saldo_ferias_saida }))

      const calc = wf.etapa_calculo_rescisao ?? {}
      if (calc.valor_rescisao) setAcerto(a => ({ ...a, valor_rescisao: calc.valor_rescisao }))

      if (wf.esocial_s2299_enviado || wf.esocial_s2299_recibo) {
        setEsocial({
          s2299_enviado: wf.esocial_s2299_enviado ?? false,
          s2299_recibo: wf.esocial_s2299_recibo ?? '',
          s2299_data: wf.esocial_s2299_data ?? '',
          prazo_legal: wf.prazo_esocial_s2299 ?? '',
        })
      }

      // Jump to next incomplete step
      if (wf.tipo_desligamento && wf.data_prevista_saida) {
        if (!(wf.etapa_devolucao_epi?.ok)) setEtapa(2)
        else if (!(wf.etapa_exame_demissional?.ok)) setEtapa(3)
        else if (!(wf.etapa_calculo_rescisao?.ok)) setEtapa(4)
        else setEtapa(5)
      }
    }

    setLoading(false)
  }

  async function saveStep(step: number) {
    setSaving(true)
    setError('')
    try {
      let wfId = workflowId
      const obraRes = await supabase.from('alocacoes').select('obra_id').eq('funcionario_id', id).eq('ativo', true).limit(1).single()

      if (!wfId) {
        const { data: created, error: createErr } = await supabase
          .from('desligamentos_workflow')
          .insert({
            funcionario_id: id,
            obra_id: obraRes.data?.obra_id ?? null,
            tipo_desligamento: tipoMotivo.tipo_desligamento,
            data_aviso: tipoMotivo.data_aviso || null,
            data_prevista_saida: tipoMotivo.data_prevista_saida || null,
            motivo: tipoMotivo.motivo || null,
            status: 'em_andamento',
            saldo_banco_horas_saida: acerto.saldo_banco_horas,
            saldo_ferias_saida: acerto.saldo_ferias,
          })
          .select('id')
          .single()
        if (createErr) { setError(formatSupabaseError(createErr)); setSaving(false); return false }
        wfId = created.id
        setWorkflowId(wfId)
      }

      const updates: Record<string, any> = { updated_at: new Date().toISOString() }

      if (step === 1) {
        updates.tipo_desligamento = tipoMotivo.tipo_desligamento
        updates.motivo = tipoMotivo.motivo || null
        updates.data_aviso = tipoMotivo.data_aviso || null
        updates.data_prevista_saida = tipoMotivo.data_prevista_saida || null
        updates.etapa_aviso_previo = { ok: true, data: tipoMotivo.data_aviso }
        // Calculate eSocial deadline
        if (tipoMotivo.data_prevista_saida) {
          const prazo = addDays(tipoMotivo.data_prevista_saida, 10)
          updates.prazo_esocial_s2299 = prazo
          setEsocial(e => ({ ...e, prazo_legal: prazo }))
          setAcerto(a => ({ ...a, prazo_pagamento: prazo }))
        }
      }

      if (step === 2) {
        const allDone = DEVOLUCAO_ITEMS.every(d => devolucao[d.key]?.ok)
        updates.etapa_devolucao_epi = { ok: allDone, itens: devolucao }
        updates.etapa_devolucao_ferramentas = { ok: devolucao.ferramentas_devolvidas?.ok ?? false }
      }

      if (step === 3) {
        let laudo_url = exameDem.laudo_url
        let laudo_nome = exameDem.laudo_nome
        if (laudoFile) {
          const ext = laudoFile.name.split('.').pop()
          const path = `documentos/${id}/DEMISSIONAL_${Date.now()}.${ext}`
          const { error: upErr } = await supabase.storage.from('softmonte').upload(path, laudoFile)
          if (upErr) { setError('Erro no upload: ' + upErr.message); setSaving(false); return false }
          const { data: urlData } = supabase.storage.from('softmonte').getPublicUrl(path)
          laudo_url = urlData.publicUrl
          laudo_nome = laudoFile.name
        }
        updates.etapa_exame_demissional = {
          ok: true, data_exame: exameDem.data_exame, medico: exameDem.medico,
          laudo_url, laudo_nome,
        }
      }

      if (step === 4) {
        updates.saldo_banco_horas_saida = acerto.saldo_banco_horas
        updates.saldo_ferias_saida = acerto.saldo_ferias
        updates.etapa_calculo_rescisao = { ok: true, valor_rescisao: acerto.valor_rescisao }
        updates.etapa_acerto_banco_horas = { ok: true }
      }

      if (step === 5) {
        updates.esocial_s2299_enviado = esocial.s2299_enviado
        updates.esocial_s2299_data = esocial.s2299_data || null
        updates.esocial_s2299_recibo = esocial.s2299_recibo || null
        updates.etapa_esocial = { ok: esocial.s2299_enviado }
      }

      const { error: updateErr } = await supabase.from('desligamentos_workflow').update(updates).eq('id', wfId)
      if (updateErr) { setError(formatSupabaseError(updateErr)); setSaving(false); return false }

      toast.show('Etapa salva!')
      setSaving(false)
      return true
    } catch (err: any) {
      setError(err.message)
      setSaving(false)
      return false
    }
  }

  async function handleNext() {
    setError('')
    if (etapa === 1) {
      if (!tipoMotivo.data_prevista_saida) {
        setError('Data prevista de saida e obrigatoria.')
        return
      }
      if (tipoMotivo.tipo_desligamento === 'justa_causa') {
        if (!tipoMotivo.motivo_justa_causa_codigo) {
          setError('Selecione o enquadramento legal da justa causa (CLT Art. 482).')
          return
        }
        if (tipoMotivo.motivo_justa_causa_codigo === 'outro' && !tipoMotivo.motivo_justa_causa_detalhe.trim()) {
          setError('Detalhamento é obrigatório quando motivo é "Outro".')
          return
        }
      }
    }
    const ok = await saveStep(etapa)
    if (ok !== false) setEtapa(etapa + 1)
  }

  // Map tipo_desligamento → motivo_saida (texto livre que vai para funcionarios.motivo_saida)
  function getMotivoSaida(): string {
    const TIPO_TO_MOTIVO: Record<string, string> = {
      sem_justa_causa: 'Sem justa causa (iniciativa empresa)',
      pedido: 'Pedido de demissão',
      consensual: 'Acordo consensual',
      justa_causa: 'JUSTA CAUSA',
    }
    return TIPO_TO_MOTIVO[tipoMotivo.tipo_desligamento] ?? tipoMotivo.tipo_desligamento
  }

  function getMotivoJustaCausaText(): string | null {
    if (tipoMotivo.tipo_desligamento !== 'justa_causa') return null
    const m = MOTIVOS_JUSTA_CAUSA.find(x => x.value === tipoMotivo.motivo_justa_causa_codigo)
    const label = m?.label ?? tipoMotivo.motivo_justa_causa_codigo
    const det = tipoMotivo.motivo_justa_causa_detalhe.trim()
    return det ? `${label} — ${det}` : label
  }

  async function handleFinalizar() {
    setError('')
    const ok = await saveStep(5)
    if (ok === false) return

    setSaving(true)
    // Mark workflow done
    await supabase.from('desligamentos_workflow').update({
      status: 'concluido',
      concluido_em: new Date().toISOString(),
      data_real_saida: tipoMotivo.data_prevista_saida || new Date().toISOString().split('T')[0],
    }).eq('id', workflowId)

    // Inactivate employee + save motivo_saida and motivo_justa_causa for traceability
    await supabase.from('funcionarios').update({
      status: 'inativo',
      motivo_saida: getMotivoSaida(),
      motivo_justa_causa: getMotivoJustaCausaText(),
    }).eq('id', id)

    // End active allocations
    await supabase.from('alocacoes').update({
      ativo: false,
      data_fim: tipoMotivo.data_prevista_saida || new Date().toISOString().split('T')[0],
    }).eq('funcionario_id', id).eq('ativo', true)

    toast.show('Desligamento concluido!')
    router.push(`/funcionarios/${id}`)
  }

  const inp = "w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand"
  const lbl = "block text-xs font-semibold text-gray-600 mb-1"

  const STEPS = [
    { n: 1, label: 'Tipo/Motivo' },
    { n: 2, label: 'Devolução' },
    { n: 3, label: 'Exame' },
    { n: 4, label: 'Acerto' },
    { n: 5, label: 'eSocial' },
  ]

  const fmtR = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  if (loading) return <div className="p-6 text-center text-gray-400">Carregando...</div>

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback={`/funcionarios/${id}`} />
        <Link href="/funcionarios" className="text-gray-400 hover:text-gray-600">Funcionários</Link>
        <span className="text-gray-300">/</span>
        <Link href={`/funcionarios/${id}`} className="text-gray-400 hover:text-gray-600">{func?.nome}</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium">Demissao</span>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h1 className="text-lg font-bold font-display text-red-600 mb-1">Wizard de Demissao</h1>
        <p className="text-sm text-gray-500 mb-4">{func?.nome} — {func?.cargo}</p>

        {/* Progress Bar */}
        <div className="flex items-center gap-2 mb-6">
          {STEPS.map(step => (
            <div key={step.n} className="flex-1">
              <div className={`h-1.5 rounded-full ${etapa > step.n ? 'bg-green-500' : etapa === step.n ? 'bg-red-500' : 'bg-gray-200'}`} />
              <p className={`text-[10px] mt-1 font-medium ${etapa === step.n ? 'text-red-600' : etapa > step.n ? 'text-green-600' : 'text-gray-400'}`}>
                {etapa > step.n ? '✓ ' : ''}{step.label}
              </p>
            </div>
          ))}
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200">{error}</div>}

        {/* Step 1 — Tipo e motivo */}
        {etapa === 1 && (
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">Tipo e Motivo do Desligamento</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="col-span-1 sm:col-span-2">
                <label className={lbl}>Tipo de desligamento *</label>
                <select value={tipoMotivo.tipo_desligamento} onChange={e => setTipoMotivo(t => ({ ...t, tipo_desligamento: e.target.value }))} className={inp + ' bg-white'}>
                  <option value="sem_justa_causa">Sem Justa Causa</option>
                  <option value="pedido">Pedido de Demissao</option>
                  <option value="consensual">Acordo Consensual</option>
                  <option value="justa_causa">Justa Causa</option>
                </select>
              </div>
              {tipoMotivo.tipo_desligamento === 'justa_causa' && (
                <div className="col-span-1 sm:col-span-2 p-3 bg-red-50 border border-red-200 rounded-xl space-y-3">
                  <p className="text-xs font-bold text-red-700">⚠ Justa Causa — CLT Art. 482</p>
                  <div>
                    <label className={lbl}>Motivo legal *</label>
                    <select
                      value={tipoMotivo.motivo_justa_causa_codigo}
                      onChange={e => setTipoMotivo(t => ({ ...t, motivo_justa_causa_codigo: e.target.value }))}
                      className={inp + ' bg-white'}
                    >
                      <option value="">Selecione o enquadramento legal...</option>
                      {MOTIVOS_JUSTA_CAUSA.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>
                      Detalhamento {tipoMotivo.motivo_justa_causa_codigo === 'outro' && '*'}
                    </label>
                    <textarea
                      value={tipoMotivo.motivo_justa_causa_detalhe}
                      onChange={e => setTipoMotivo(t => ({ ...t, motivo_justa_causa_detalhe: e.target.value }))}
                      rows={3}
                      placeholder="Descreva detalhadamente os fatos que justificam a justa causa, com datas, testemunhas e documentos quando aplicável..."
                      className={inp + ' resize-none bg-white'}
                    />
                  </div>
                </div>
              )}
              <div className="col-span-1 sm:col-span-2">
                <label className={lbl}>{tipoMotivo.tipo_desligamento === 'justa_causa' ? 'Observações adicionais' : 'Motivo'}</label>
                <textarea value={tipoMotivo.motivo} onChange={e => setTipoMotivo(t => ({ ...t, motivo: e.target.value }))}
                  rows={3} className={inp + ' resize-none'} placeholder="Descreva o motivo do desligamento..." />
              </div>
              <div>
                <label className={lbl}>Data do aviso</label>
                <input type="date" value={tipoMotivo.data_aviso} onChange={e => setTipoMotivo(t => ({ ...t, data_aviso: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className={lbl}>Data prevista saida *</label>
                <input type="date" value={tipoMotivo.data_prevista_saida} onChange={e => setTipoMotivo(t => ({ ...t, data_prevista_saida: e.target.value }))} className={inp} />
              </div>
            </div>
            {tipoMotivo.data_prevista_saida && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 space-y-1">
                <p><span className="font-semibold">Prazo pagamento rescisao:</span> {formatDate(addDays(tipoMotivo.data_prevista_saida, 10))} (10 dias uteis)</p>
                <p><span className="font-semibold">Prazo eSocial S-2299:</span> {formatDate(addDays(tipoMotivo.data_prevista_saida, 10))}</p>
              </div>
            )}
          </section>
        )}

        {/* Step 2 — Checklist de devolucao */}
        {etapa === 2 && (
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">Checklist de Devolução</h3>
            <div className="space-y-2">
              {DEVOLUCAO_ITEMS.map(item => (
                <div key={item.key} className={`flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl border ${devolucao[item.key]?.ok ? 'bg-green-50/50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                  <label className="flex items-center gap-3 min-w-[200px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={devolucao[item.key]?.ok ?? false}
                      onChange={() => setDevolucao(d => ({ ...d, [item.key]: { ...d[item.key], ok: !d[item.key]?.ok } }))}
                      className="rounded border-gray-300 text-brand focus:ring-brand/30 w-5 h-5"
                    />
                    <span className={`text-sm font-medium ${devolucao[item.key]?.ok ? 'text-green-700 line-through' : 'text-gray-800'}`}>
                      {item.label}
                    </span>
                  </label>
                  <input
                    type="text"
                    placeholder="Observação..."
                    value={devolucao[item.key]?.obs ?? ''}
                    onChange={e => setDevolucao(d => ({ ...d, [item.key]: { ...d[item.key], obs: e.target.value } }))}
                    className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand/30"
                  />
                </div>
              ))}
            </div>
            <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
              <p className="text-xs text-gray-500">
                <span className="font-semibold">{DEVOLUCAO_ITEMS.filter(d => devolucao[d.key]?.ok).length}</span> de {DEVOLUCAO_ITEMS.length} itens devolvidos
              </p>
            </div>
          </section>
        )}

        {/* Step 3 — Exame demissional */}
        {etapa === 3 && (
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">Exame Demissional</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Data do exame</label>
                <input type="date" value={exameDem.data_exame} onChange={e => setExameDem(ex => ({ ...ex, data_exame: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className={lbl}>Médico</label>
                <input type="text" value={exameDem.medico} onChange={e => setExameDem(ex => ({ ...ex, medico: e.target.value }))} className={inp} />
              </div>
              <div className="col-span-1 sm:col-span-2">
                <label className={lbl}>Upload laudo</label>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setLaudoFile(e.target.files?.[0] ?? null)}
                  className="w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-brand file:text-white hover:file:bg-brand-dark" />
                {exameDem.laudo_url && (
                  <a href={exameDem.laudo_url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand mt-1 inline-block hover:underline">
                    Arquivo atual: {exameDem.laudo_nome}
                  </a>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Step 4 — Acerto financeiro */}
        {etapa === 4 && (
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">Acerto Financeiro</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="text-xs text-blue-600 font-semibold mb-1">Saldo Banco de Horas</p>
                <p className="text-xl font-bold text-blue-800">
                  {acerto.saldo_banco_horas >= 0 ? '+' : ''}{acerto.saldo_banco_horas}h
                </p>
                <p className="text-[10px] text-blue-500 mt-1">Calculado automaticamente</p>
              </div>
              <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                <p className="text-xs text-green-600 font-semibold mb-1">Ferias Proporcionais</p>
                <p className="text-xl font-bold text-green-800">{acerto.saldo_ferias} dia(s)</p>
                <p className="text-[10px] text-green-500 mt-1">
                  {func?.admissao ? `Admissão: ${formatDate(func.admissao)}` : 'Sem data de admissão'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Valor rescisao (R$)</label>
                <input type="number" step="0.01" value={acerto.valor_rescisao} onChange={e => setAcerto(a => ({ ...a, valor_rescisao: e.target.value }))} className={inp} placeholder="0,00" />
              </div>
              <div>
                <label className={lbl}>Prazo de pagamento</label>
                <input type="date" value={acerto.prazo_pagamento || (tipoMotivo.data_prevista_saida ? addDays(tipoMotivo.data_prevista_saida, 10) : '')} readOnly className={inp + ' bg-gray-50'} />
                <p className="text-[10px] text-gray-400 mt-1">10 dias corridos a partir da data de saida</p>
              </div>
            </div>

            {acerto.valor_rescisao && (
              <div className="mt-3 p-3 bg-brand/5 rounded-xl border border-brand/10">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Resumo</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-gray-500">Valor rescisao:</span>
                  <span className="font-bold text-gray-900">{fmtR(parseFloat(acerto.valor_rescisao) || 0)}</span>
                  <span className="text-gray-500">Banco horas:</span>
                  <span className={`font-bold ${acerto.saldo_banco_horas >= 0 ? 'text-green-600' : 'text-red-600'}`}>{acerto.saldo_banco_horas}h</span>
                  <span className="text-gray-500">Ferias proporcionais:</span>
                  <span className="font-bold text-gray-900">{acerto.saldo_ferias} dia(s)</span>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Step 5 — eSocial S-2299 */}
        {etapa === 5 && (
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">eSocial — S-2299</h3>

            {(esocial.prazo_legal || tipoMotivo.data_prevista_saida) && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                <span className="font-semibold">Prazo legal S-2299:</span>{' '}
                {formatDate(esocial.prazo_legal || addDays(tipoMotivo.data_prevista_saida, 10))}
                {' '}(10 dias apos desligamento)
                {(() => {
                  const prazo = esocial.prazo_legal || addDays(tipoMotivo.data_prevista_saida, 10)
                  const diasRestantes = Math.round((new Date(prazo + 'T12:00:00').getTime() - Date.now()) / 86400000)
                  if (diasRestantes < 0) return <span className="ml-2 text-red-700 font-bold">VENCIDO</span>
                  if (diasRestantes <= 3) return <span className="ml-2 text-red-600 font-bold">{diasRestantes} dia(s) restante(s)</span>
                  return <span className="ml-2 text-green-600">{diasRestantes} dia(s) restante(s)</span>
                })()}
              </div>
            )}

            <div className="space-y-3">
              <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer ${esocial.s2299_enviado ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                <input
                  type="checkbox"
                  checked={esocial.s2299_enviado}
                  onChange={() => setEsocial(e => ({ ...e, s2299_enviado: !e.s2299_enviado }))}
                  className="rounded border-gray-300 text-brand focus:ring-brand/30 w-5 h-5"
                />
                <span className={`text-sm font-medium ${esocial.s2299_enviado ? 'text-green-700' : 'text-gray-800'}`}>
                  S-2299 enviado ao eSocial
                </span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Data de envio</label>
                  <input type="date" value={esocial.s2299_data} onChange={e => setEsocial(es => ({ ...es, s2299_data: e.target.value }))} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Numero do recibo</label>
                  <input type="text" value={esocial.s2299_recibo} onChange={e => setEsocial(es => ({ ...es, s2299_recibo: e.target.value }))} className={inp} placeholder="Ex: 1.2.0000000000.000000000000" />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Navigation buttons */}
        <div className="flex gap-3 pt-4 mt-4 border-t border-gray-100">
          {etapa > 1 && (
            <button type="button" onClick={() => setEtapa(etapa - 1)} className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">
              Voltar
            </button>
          )}
          {etapa < 5 && (
            <button type="button" onClick={handleNext} disabled={saving} className="px-5 py-2.5 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar e Proximo'}
            </button>
          )}
          {etapa === 5 && (
            <button type="button" onClick={handleFinalizar} disabled={saving} className="px-5 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 disabled:opacity-50">
              {saving ? 'Finalizando...' : 'Concluir Desligamento'}
            </button>
          )}
          <button type="button" onClick={() => saveStep(etapa)} disabled={saving} className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-50">
            {saving ? 'Salvando...' : 'Salvar rascunho'}
          </button>
        </div>
      </div>
    </div>
  )
}
