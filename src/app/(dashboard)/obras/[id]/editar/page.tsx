'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import BackButton from '@/components/BackButton'
import DeleteEntityButton from '@/components/DeleteEntityButton'
import { useToast } from '@/components/Toast'

const STATUS_OPTIONS = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'pausado', label: 'Pausado' },
  { value: 'concluido', label: 'Concluído' },
  { value: 'cancelado', label: 'Cancelado' },
]

export default function EditarObraPage({ params }: { params: { id: string } }) {
  const [form, setForm] = useState<any>({
    nome: '', cliente: '', local: '', data_inicio: '', data_prev_fim: '', status: 'ativo',
    // Contrato
    numero_contrato: '', tipo_contrato: '', valor_contrato: '', valor_mensal_estimado: '',
    hh_contratados: '', pessoas_contratadas: '', margem_alvo: '',
    objeto_contrato: '', observacoes_contrato: '',
    // Pagamento
    forma_pagamento: '', prazo_pagamento_dias: '', banco_pagamento: '', agencia_pagamento: '', conta_pagamento: '',
    indice_reajuste: '', percentual_reajuste: '',
    // Horário
    horario_inicio: '', horario_fim: '', dias_uteis_mes: '', carga_horaria_dia: '',
    // Contatos
    contato_contratante_nome: '', contato_contratante_email: '', contato_contratante_tel: '',
    contato_contratada_nome: '', contato_contratada_email: '', contato_contratada_tel: '',
    // BM
    bm_dia_unico: false,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()

  useEffect(() => {
    supabase.from('obras').select('*').eq('id', params.id).single().then(({ data, error }) => {
      if (error) { setError(error.message); setLoading(false); return }
      if (data) {
        setForm({
          nome: data.nome ?? '',
          cliente: data.cliente ?? '',
          local: data.local ?? '',
          data_inicio: data.data_inicio ?? '',
          data_prev_fim: data.data_prev_fim ?? '',
          status: data.status ?? 'ativo',
          numero_contrato: data.numero_contrato ?? '',
          tipo_contrato: data.tipo_contrato ?? '',
          valor_contrato: data.valor_contrato ?? '',
          valor_mensal_estimado: data.valor_mensal_estimado ?? '',
          hh_contratados: data.hh_contratados ?? '',
          pessoas_contratadas: data.pessoas_contratadas ?? '',
          margem_alvo: data.margem_alvo ?? '',
          objeto_contrato: data.objeto_contrato ?? '',
          observacoes_contrato: data.observacoes_contrato ?? '',
          forma_pagamento: data.forma_pagamento ?? '',
          prazo_pagamento_dias: data.prazo_pagamento_dias ?? '',
          banco_pagamento: data.banco_pagamento ?? '',
          agencia_pagamento: data.agencia_pagamento ?? '',
          conta_pagamento: data.conta_pagamento ?? '',
          indice_reajuste: data.indice_reajuste ?? '',
          percentual_reajuste: data.percentual_reajuste ?? '',
          horario_inicio: data.horario_inicio ?? '',
          horario_fim: data.horario_fim ?? '',
          dias_uteis_mes: data.dias_uteis_mes ?? '',
          carga_horaria_dia: data.carga_horaria_dia ?? '',
          contato_contratante_nome: data.contato_contratante_nome ?? '',
          contato_contratante_email: data.contato_contratante_email ?? '',
          contato_contratante_tel: data.contato_contratante_tel ?? '',
          contato_contratada_nome: data.contato_contratada_nome ?? '',
          contato_contratada_email: data.contato_contratada_email ?? '',
          contato_contratada_tel: data.contato_contratada_tel ?? '',
          bm_dia_unico: data.bm_dia_unico ?? false,
        })
      }
      setLoading(false)
    })
  }, [params.id])

  function set(field: string, value: any) { setForm((f: any) => ({ ...f, [field]: value })) }

  // Helper to convert empty strings to null and numbers
  function n(v: any) { return v === '' || v == null ? null : v }
  function num(v: any) { return v === '' || v == null ? null : Number(v) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const payload: any = {
      nome: form.nome,
      cliente: n(form.cliente),
      local: n(form.local),
      data_inicio: n(form.data_inicio),
      data_prev_fim: n(form.data_prev_fim),
      status: form.status,
      numero_contrato: n(form.numero_contrato),
      tipo_contrato: n(form.tipo_contrato),
      valor_contrato: num(form.valor_contrato),
      valor_mensal_estimado: num(form.valor_mensal_estimado),
      hh_contratados: num(form.hh_contratados),
      pessoas_contratadas: num(form.pessoas_contratadas),
      margem_alvo: num(form.margem_alvo),
      objeto_contrato: n(form.objeto_contrato),
      observacoes_contrato: n(form.observacoes_contrato),
      forma_pagamento: n(form.forma_pagamento),
      prazo_pagamento_dias: num(form.prazo_pagamento_dias),
      banco_pagamento: n(form.banco_pagamento),
      agencia_pagamento: n(form.agencia_pagamento),
      conta_pagamento: n(form.conta_pagamento),
      indice_reajuste: n(form.indice_reajuste),
      percentual_reajuste: num(form.percentual_reajuste),
      horario_inicio: n(form.horario_inicio),
      horario_fim: n(form.horario_fim),
      dias_uteis_mes: num(form.dias_uteis_mes),
      carga_horaria_dia: num(form.carga_horaria_dia),
      contato_contratante_nome: n(form.contato_contratante_nome),
      contato_contratante_email: n(form.contato_contratante_email),
      contato_contratante_tel: n(form.contato_contratante_tel),
      contato_contratada_nome: n(form.contato_contratada_nome),
      contato_contratada_email: n(form.contato_contratada_email),
      contato_contratada_tel: n(form.contato_contratada_tel),
      bm_dia_unico: !!form.bm_dia_unico,
    }
    const { error: upErr } = await supabase.from('obras').update(payload).eq('id', params.id)
    if (upErr) { setError(upErr.message); setSaving(false); return }
    setSuccess(true)
    setTimeout(() => {
      router.push(`/obras/${params.id}`)
      router.refresh()
    }, 1200)
  }

  async function handleSalvarComoTemplate() {
    const nomeTemplate = prompt('Nome do template de contrato:', `Template ${form.cliente || form.nome}`)
    if (!nomeTemplate) return
    setSavingTemplate(true)

    // 1. Buscar a composição atual da obra
    const { data: composicao } = await supabase
      .from('contrato_composicao')
      .select('funcao_nome, custo_hora_contratado, custo_hora_extra_70, custo_hora_extra_100, quantidade_contratada, horas_mes, carga_horaria_dia')
      .eq('obra_id', params.id)
      .eq('ativo', true)

    // 2. Criar tipo_contrato
    const { data: tipo, error: tipoErr } = await supabase.from('tipos_contrato').insert({
      nome: nomeTemplate,
      codigo: nomeTemplate.toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 20),
      descricao: `Template criado a partir da obra ${form.nome}`,
      setor: 'Engenharia',
      carga_horaria_dia: form.carga_horaria_dia ? Number(form.carga_horaria_dia) : 9,
      horario_inicio: form.horario_inicio || null,
      horario_fim: form.horario_fim || null,
      dias_uteis_mes: form.dias_uteis_mes ? Number(form.dias_uteis_mes) : 22,
      forma_pagamento: form.forma_pagamento || null,
      prazo_pagamento_dias: form.prazo_pagamento_dias ? Number(form.prazo_pagamento_dias) : null,
      indice_reajuste: form.indice_reajuste || null,
      margem_alvo_min: form.margem_alvo ? Number(form.margem_alvo) - 5 : null,
      margem_alvo_max: form.margem_alvo ? Number(form.margem_alvo) + 5 : null,
      ativo: true,
    }).select().single()

    if (tipoErr || !tipo) {
      toast.error('Erro: ' + (tipoErr?.message ?? 'Falha ao criar template'))
      setSavingTemplate(false)
      return
    }

    // 3. Criar composição padrão
    if (composicao && composicao.length > 0) {
      const compositionRows = composicao.map((c: any, idx: number) => ({
        tipo_contrato_id: tipo.id,
        funcao_nome: c.funcao_nome,
        quantidade_padrao: c.quantidade_contratada ?? 1,
        horas_mes: c.horas_mes ?? 220,
        custo_hora_referencia: c.custo_hora_contratado ?? 0,
        custo_hora_venda_ref: c.custo_hora_contratado ?? 0,
        he_multiplicador_70: 1.7,
        he_multiplicador_100: 2.0,
        ordem: idx + 1,
      }))
      await supabase.from('tipos_contrato_composicao').insert(compositionRows)
    }

    setSavingTemplate(false)
    toast.success(`Template "${nomeTemplate}" criado com ${composicao?.length ?? 0} funções!`)
  }

  if (loading) return <div className="p-6 text-sm text-gray-400">Carregando...</div>

  const inp = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
  const lbl = "block text-xs font-semibold text-gray-600 mb-1"

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/obras" />
        <Link href="/obras" className="text-gray-400 hover:text-gray-600">Obras</Link>
        <span className="text-gray-300">/</span>
        <Link href={`/obras/${params.id}`} className="text-gray-400 hover:text-gray-600">{form.nome}</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700">Editar</span>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-semibold font-display text-brand">Editar obra</h1>
          <button type="button" onClick={handleSalvarComoTemplate} disabled={savingTemplate}
            className="text-xs px-3 py-1.5 border border-brand text-brand rounded-lg font-medium hover:bg-brand/5 disabled:opacity-50">
            {savingTemplate ? 'Salvando...' : '📋 Salvar como template de contrato'}
          </button>
        </div>

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl flex items-center gap-2">
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7"/><path d="M5 8l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none"/></svg>
            Obra atualizada! Redirecionando...
          </div>
        )}
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* === DADOS BÁSICOS === */}
          <section>
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">Dados Básicos</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className={lbl}>Nome da obra *</label>
                <input type="text" required value={form.nome} onChange={e => set('nome', e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>Cliente</label>
                <input type="text" value={form.cliente} onChange={e => set('cliente', e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>Local</label>
                <input type="text" value={form.local} onChange={e => set('local', e.target.value)} placeholder="Cidade/UF" className={inp} />
              </div>
              <div>
                <label className={lbl}>Data de início</label>
                <input type="date" value={form.data_inicio} onChange={e => set('data_inicio', e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>Previsão de término</label>
                <input type="date" value={form.data_prev_fim} onChange={e => set('data_prev_fim', e.target.value)} className={inp} />
              </div>
              <div className="sm:col-span-2">
                <label className={lbl}>Status</label>
                <select value={form.status} onChange={e => set('status', e.target.value)} className={inp + ' bg-white'}>
                  {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>
          </section>

          {/* === CONTRATO === */}
          <section>
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">Contrato</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={lbl}>Número do contrato</label>
                <input type="text" value={form.numero_contrato} onChange={e => set('numero_contrato', e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>Tipo de contrato</label>
                <input type="text" value={form.tipo_contrato} onChange={e => set('tipo_contrato', e.target.value)} placeholder="Ex: Apoio Operacional" className={inp} />
              </div>
              <div>
                <label className={lbl}>Valor total (R$)</label>
                <input type="number" step="0.01" value={form.valor_contrato} onChange={e => set('valor_contrato', e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>Valor mensal estimado (R$)</label>
                <input type="number" step="0.01" value={form.valor_mensal_estimado} onChange={e => set('valor_mensal_estimado', e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>HH contratados</label>
                <input type="number" value={form.hh_contratados} onChange={e => set('hh_contratados', e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>Pessoas contratadas</label>
                <input type="number" value={form.pessoas_contratadas} onChange={e => set('pessoas_contratadas', e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>Margem alvo (%)</label>
                <input type="number" step="0.1" value={form.margem_alvo} onChange={e => set('margem_alvo', e.target.value)} className={inp} />
              </div>
              <div className="sm:col-span-2 flex items-center gap-2 pt-5">
                <input type="checkbox" id="bm_dia_unico" checked={!!form.bm_dia_unico} onChange={e => set('bm_dia_unico', e.target.checked)}
                  className="w-4 h-4 rounded text-brand focus:ring-brand" />
                <label htmlFor="bm_dia_unico" className="text-xs text-gray-700">
                  <strong>Regra Cesari:</strong> BM cobra todos os dias presentes como hora normal × carga horária dia (sem distinguir HE 70%/100%)
                </label>
              </div>
              <div className="sm:col-span-3">
                <label className={lbl}>Objeto do contrato</label>
                <textarea value={form.objeto_contrato} onChange={e => set('objeto_contrato', e.target.value)} rows={2} className={inp + ' resize-none'} />
              </div>
              <div className="sm:col-span-3">
                <label className={lbl}>Observações</label>
                <textarea value={form.observacoes_contrato} onChange={e => set('observacoes_contrato', e.target.value)} rows={2} className={inp + ' resize-none'} />
              </div>
            </div>
          </section>

          {/* === PAGAMENTO === */}
          <section>
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">Pagamento e Reajuste</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={lbl}>Forma de pagamento</label>
                <input type="text" value={form.forma_pagamento} onChange={e => set('forma_pagamento', e.target.value)} placeholder="Boleto / TED" className={inp} />
              </div>
              <div>
                <label className={lbl}>Prazo (dias)</label>
                <input type="number" value={form.prazo_pagamento_dias} onChange={e => set('prazo_pagamento_dias', e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>Índice de reajuste</label>
                <input type="text" value={form.indice_reajuste} onChange={e => set('indice_reajuste', e.target.value)} placeholder="IPCA / IGP-M" className={inp} />
              </div>
              <div>
                <label className={lbl}>Banco</label>
                <input type="text" value={form.banco_pagamento} onChange={e => set('banco_pagamento', e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>Agência</label>
                <input type="text" value={form.agencia_pagamento} onChange={e => set('agencia_pagamento', e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>Conta</label>
                <input type="text" value={form.conta_pagamento} onChange={e => set('conta_pagamento', e.target.value)} className={inp} />
              </div>
            </div>
          </section>

          {/* === HORÁRIO === */}
          <section>
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">Horário e Jornada</h2>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className={lbl}>Horário início</label>
                <input type="time" value={form.horario_inicio} onChange={e => set('horario_inicio', e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>Horário fim</label>
                <input type="time" value={form.horario_fim} onChange={e => set('horario_fim', e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>Carga horária dia</label>
                <input type="number" step="0.5" value={form.carga_horaria_dia} onChange={e => set('carga_horaria_dia', e.target.value)} placeholder="9" className={inp} />
              </div>
              <div>
                <label className={lbl}>Dias úteis/mês</label>
                <input type="number" value={form.dias_uteis_mes} onChange={e => set('dias_uteis_mes', e.target.value)} placeholder="22" className={inp} />
              </div>
            </div>
          </section>

          {/* === CONTATOS === */}
          <section>
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">Contatos</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="border border-gray-200 rounded-lg p-3">
                <h3 className="text-xs font-bold text-gray-600 mb-2">Contratante (Cliente)</h3>
                <div className="space-y-2">
                  <input type="text" value={form.contato_contratante_nome} onChange={e => set('contato_contratante_nome', e.target.value)} placeholder="Nome do responsável" className={inp} />
                  <input type="email" value={form.contato_contratante_email} onChange={e => set('contato_contratante_email', e.target.value)} placeholder="Email" className={inp} />
                  <input type="text" value={form.contato_contratante_tel} onChange={e => set('contato_contratante_tel', e.target.value)} placeholder="Telefone" className={inp} />
                </div>
              </div>
              <div className="border border-gray-200 rounded-lg p-3">
                <h3 className="text-xs font-bold text-gray-600 mb-2">Contratada (Tecnomonte)</h3>
                <div className="space-y-2">
                  <input type="text" value={form.contato_contratada_nome} onChange={e => set('contato_contratada_nome', e.target.value)} placeholder="Nome do responsável" className={inp} />
                  <input type="email" value={form.contato_contratada_email} onChange={e => set('contato_contratada_email', e.target.value)} placeholder="Email" className={inp} />
                  <input type="text" value={form.contato_contratada_tel} onChange={e => set('contato_contratada_tel', e.target.value)} placeholder="Telefone" className={inp} />
                </div>
              </div>
            </div>
          </section>

          {/* === BOTÕES === */}
          <div className="flex gap-3 pt-2 items-center border-t border-gray-100">
            <button type="submit" disabled={saving || success}
              className="px-6 py-2.5 bg-brand text-white rounded-xl text-sm font-semibold hover:bg-brand-dark disabled:opacity-50 transition-colors">
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
            <Link href={`/obras/${params.id}`} className="px-6 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">
              Cancelar
            </Link>
            <div className="ml-auto">
              <DeleteEntityButton table="obras" id={params.id} entityName={form.nome ?? 'obra'} redirectTo="/obras" />
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
