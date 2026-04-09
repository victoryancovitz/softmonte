'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import BackButton from '@/components/BackButton'
import { useToast } from '@/components/Toast'
import QuickCreateSelect from '@/components/QuickCreateSelect'
import { Check, ChevronRight, ChevronLeft, Plus, Loader2, Trash2 } from 'lucide-react'

/**
 * Wizard unificado de criação de obra.
 * Sempre passa pelo mesmo caminho: Cliente → Contrato → Dados → Revisar.
 * Aceita query params pra pular etapas:
 *  - ?cliente_id=X   → pré-seleciona cliente e começa no passo 2
 *  - ?tipo_contrato_id=X → pré-seleciona contrato e começa no passo 3
 */

const MODELOS: { v: 'hh_diaria' | 'hh_hora_efetiva' | 'hh_220'; l: string; d: string }[] = [
  {
    v: 'hh_diaria',
    l: 'HH-Diária',
    d: 'Fatura 9h por colaborador por dia, independente das horas reais. Usado na Cesari.',
  },
  {
    v: 'hh_hora_efetiva',
    l: 'HH-Hora Efetiva',
    d: 'Fatura horas reais do ponto biométrico. Atrasos e almoço excedido descontam.',
  },
  {
    v: 'hh_220',
    l: 'HH-220 Horas',
    d: 'Base mensal 220h com DSR. Absenteísmo impacta direto o faturamento.',
  },
]

export default function NovaObraWizardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const toast = useToast()

  const [step, setStep] = useState(1)
  const [clientes, setClientes] = useState<any[]>([])
  const [tiposContrato, setTiposContrato] = useState<any[]>([])
  const [funcoesCadastradas, setFuncoesCadastradas] = useState<{ id: string; nome: string }[]>([])
  const [composicao, setComposicao] = useState<Array<{
    funcao_nome: string
    quantidade: number
    carga_horaria_dia: number
    valor_hh: number
    valor_hh_70: number
    valor_hh_100: number
  }>>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    // Passo 1: cliente
    cliente_id: '',
    cliente_nome: '',
    // Passo 2: tipo contrato (template)
    tipo_contrato_id: '',
    tipo_contrato_nome: '',
    // Passo 3: dados da obra
    nome: '',
    local: '',
    data_inicio: '',
    data_prev_fim: '',
    modelo_cobranca: 'hh_diaria' as 'hh_diaria' | 'hh_hora_efetiva' | 'hh_220',
    // Escala (com defaults)
    escala_entrada: '07:00',
    escala_saida_seg_qui: '17:00',
    escala_saida_sex: '16:00',
    escala_almoco_minutos: 60,
    escala_tolerancia_min: 10,
    he_pct_normal: 70,
    he_pct_domingo_feriado: 100,
    tem_adicional_noturno: false,
    adicional_noturno_pct: 30,
    observacoes: '',
  })

  function set(field: string, value: any) { setForm(f => ({ ...f, [field]: value })) }

  // Carrega listas + trata query params
  useEffect(() => {
    (async () => {
      const [{ data: cli }, { data: tpc }, { data: funcs }] = await Promise.all([
        supabase.from('clientes').select('id,nome,cnpj,cidade,estado').is('deleted_at', null).order('nome'),
        supabase.from('tipos_contrato').select('*').eq('ativo', true).order('nome'),
        supabase.from('funcoes').select('id,nome').is('deleted_at', null).order('nome'),
      ])
      setFuncoesCadastradas((funcs ?? []) as { id: string; nome: string }[])
      setClientes(cli || [])
      setTiposContrato(tpc || [])

      const urlCliente = searchParams.get('cliente_id')
      const urlTipo = searchParams.get('tipo_contrato_id')
      let startStep = 1

      if (urlCliente) {
        const c = (cli || []).find((x: any) => x.id === urlCliente)
        if (c) {
          setForm(f => ({ ...f, cliente_id: c.id, cliente_nome: c.nome }))
          startStep = 2
        }
      }
      if (urlTipo) {
        const t = (tpc || []).find((x: any) => x.id === urlTipo)
        if (t) {
          setForm(f => ({
            ...f,
            tipo_contrato_id: t.id,
            tipo_contrato_nome: t.nome,
            modelo_cobranca: inferModeloFromTipo(t) as any,
            escala_entrada: t.horario_inicio?.slice(0, 5) || f.escala_entrada,
            escala_saida_seg_qui: t.horario_fim?.slice(0, 5) || f.escala_saida_seg_qui,
          }))
          startStep = Math.max(startStep, 3)
        }
      }
      setStep(startStep)
      setLoading(false)
    })()
  }, [searchParams])

  function inferModeloFromTipo(tipo: any): string {
    if (!tipo?.codigo) return 'hh_diaria'
    if (tipo.codigo === 'HH_HORA_EFETIVA') return 'hh_hora_efetiva'
    if (tipo.codigo === 'HH_220') return 'hh_220'
    return 'hh_diaria'
  }

  // Validação por passo
  function canAdvance(): { ok: boolean; reason?: string } {
    if (step === 1 && !form.cliente_id) return { ok: false, reason: 'Selecione ou crie um cliente' }
    if (step === 2 && !form.tipo_contrato_id) return { ok: false, reason: 'Escolha um tipo de contrato' }
    if (step === 3) {
      if (!form.nome.trim()) return { ok: false, reason: 'Nome da obra é obrigatório' }
      if (!form.data_inicio) return { ok: false, reason: 'Data de início é obrigatória' }
      if (!['hh_diaria', 'hh_hora_efetiva', 'hh_220'].includes(form.modelo_cobranca)) {
        return { ok: false, reason: 'Modelo de faturamento inválido' }
      }
    }
    return { ok: true }
  }

  function next() {
    const check = canAdvance()
    if (!check.ok) { toast.error(check.reason!); return }
    setStep(s => Math.min(s + 1, 5))
  }
  function back() { setStep(s => Math.max(s - 1, 1)) }

  async function submit() {
    const check = canAdvance()
    if (!check.ok) { toast.error(check.reason!); return }
    setSaving(true)
    try {
      const payload = {
        nome: form.nome.trim(),
        cliente_id: form.cliente_id,
        cliente: form.cliente_nome || null,
        local: form.local.trim() || null,
        data_inicio: form.data_inicio || null,
        data_prev_fim: form.data_prev_fim || null,
        status: 'ativo',
        tipo_contrato: 'hh',
        modelo_cobranca: form.modelo_cobranca,
        escala_entrada: form.escala_entrada || null,
        escala_saida_seg_qui: form.escala_saida_seg_qui || null,
        escala_saida_sex: form.escala_saida_sex || null,
        escala_almoco_minutos: form.escala_almoco_minutos,
        escala_tolerancia_min: form.escala_tolerancia_min,
        he_pct_normal: form.he_pct_normal,
        he_pct_domingo_feriado: form.he_pct_domingo_feriado,
        tem_adicional_noturno: form.tem_adicional_noturno,
        adicional_noturno_pct: form.adicional_noturno_pct,
        observacoes_contrato: form.observacoes.trim() || null,
      }
      const { data: obra, error } = await supabase.from('obras').insert(payload).select().single()
      if (error) {
        console.error('[obras/nova] insert error:', error, 'payload:', payload)
        throw error
      }
      // Salvar composição de funções (se houver)
      if (composicao.length > 0) {
        const compRows = composicao
          .filter(c => c.funcao_nome.trim())
          .map(c => ({
            obra_id: obra.id,
            funcao_nome: c.funcao_nome.toUpperCase().trim(),
            quantidade_contratada: c.quantidade,
            carga_horaria_dia: c.carga_horaria_dia,
            custo_hora_contratado: c.valor_hh,
            custo_hora_extra_70: c.valor_hh_70,
            custo_hora_extra_100: c.valor_hh_100,
            ativo: true,
            origem: 'wizard',
          }))
        if (compRows.length > 0) {
          const { error: compErr } = await supabase.from('contrato_composicao').insert(compRows)
          if (compErr) console.error('[obras/nova] composicao error:', compErr)
        }
      }

      toast.success('Obra criada!', `${form.nome} pronta pra alocação`)
      router.push(`/obras/${obra.id}`)
    } catch (err: any) {
      const msg = err?.message || err?.details || err?.hint || String(err)
      toast.error('Erro ao criar obra: ' + msg)
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <p className="text-sm text-gray-400">Carregando...</p>
      </div>
    )
  }

  const STEPS = [
    { n: 1, l: 'Cliente' },
    { n: 2, l: 'Contrato' },
    { n: 3, l: 'Dados da obra' },
    { n: 4, l: 'Funções e Valores' },
    { n: 5, l: 'Revisar' },
  ]

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/obras" />
        <Link href="/obras" className="text-gray-400 hover:text-gray-600">Obras</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700">Nova obra</span>
      </div>

      {/* Progresso */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => {
            const done = step > s.n
            const active = step === s.n
            return (
              <div key={s.n} className="flex-1 flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  done ? 'bg-green-500 text-white' :
                  active ? 'bg-brand text-white' :
                  'bg-gray-200 text-gray-500'
                }`}>
                  {done ? <Check className="w-4 h-4" /> : s.n}
                </div>
                <span className={`text-xs font-semibold whitespace-nowrap ${active ? 'text-brand' : done ? 'text-gray-600' : 'text-gray-400'}`}>
                  {s.l}
                </span>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 ${done ? 'bg-green-500' : 'bg-gray-200'}`} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        {/* PASSO 1: CLIENTE */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold font-display text-brand mb-1">Cliente da obra</h2>
              <p className="text-xs text-gray-500">Escolha um cliente existente ou crie um novo.</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Cliente *</label>
              <QuickCreateSelect
                table="clientes"
                value={form.cliente_id}
                onChange={(id, rec) => {
                  set('cliente_id', id)
                  set('cliente_nome', rec?.nome || '')
                }}
                filter={{ deleted_at: null } as any}
                placeholder="Selecione o cliente..."
                buttonLabel="Novo cliente"
                createTitle="Criar novo cliente"
                createFields={[
                  { name: 'nome', label: 'Nome', required: true, placeholder: 'Ex: Cesari Engenharia' },
                  { name: 'razao_social', label: 'Razão social' },
                  { name: 'cnpj', label: 'CNPJ', placeholder: '00.000.000/0000-00' },
                  { name: 'email_principal', label: 'E-mail principal' },
                  { name: 'telefone', label: 'Telefone' },
                  { name: 'cidade', label: 'Cidade' },
                  { name: 'estado', label: 'UF', placeholder: 'SP' },
                ]}
              />
            </div>
            {form.cliente_id && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
                <Check className="inline w-4 h-4 text-green-600 mr-1" />
                <strong className="text-green-800">{form.cliente_nome}</strong>
                <span className="text-green-600 text-xs ml-2">selecionado</span>
              </div>
            )}
          </div>
        )}

        {/* PASSO 2: TIPO DE CONTRATO */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold font-display text-brand mb-1">Tipo de contrato</h2>
              <p className="text-xs text-gray-500">Cada tipo traz defaults diferentes de jornada e faturamento. Você pode ajustar depois.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {tiposContrato.map(t => {
                const sel = form.tipo_contrato_id === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      set('tipo_contrato_id', t.id)
                      set('tipo_contrato_nome', t.nome)
                      set('modelo_cobranca', inferModeloFromTipo(t))
                      if (t.horario_inicio) set('escala_entrada', t.horario_inicio.slice(0, 5))
                      if (t.horario_fim) set('escala_saida_seg_qui', t.horario_fim.slice(0, 5))
                    }}
                    className={`text-left p-4 rounded-xl border-2 transition-all ${
                      sel ? 'border-brand bg-brand/5' : 'border-gray-100 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <span className="text-sm font-bold text-gray-900">{t.nome}</span>
                      {sel && <Check className="w-4 h-4 text-brand" />}
                    </div>
                    <p className="text-[11px] text-gray-500 line-clamp-3">{t.descricao}</p>
                    {t.carga_horaria_dia && (
                      <div className="mt-2 text-[10px] text-gray-400">
                        {t.carga_horaria_dia}h/dia · {t.dias_uteis_mes || 22} dias úteis/mês
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* PASSO 3: DADOS DA OBRA + ESCALA */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold font-display text-brand mb-1">Dados da obra</h2>
              <p className="text-xs text-gray-500">Identificação e parâmetros operacionais.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nome da obra *</label>
                <input type="text" value={form.nome} onChange={e => set('nome', e.target.value)}
                  placeholder="Ex: Cesari — Caldeiraria Fev 2026"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Local</label>
                <input type="text" value={form.local} onChange={e => set('local', e.target.value)}
                  placeholder="Cidade/UF"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div />
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Data de início *</label>
                <input type="date" value={form.data_inicio} onChange={e => set('data_inicio', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Previsão de término</label>
                <input type="date" value={form.data_prev_fim} onChange={e => set('data_prev_fim', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
            </div>

            {/* Modelo de faturamento */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">Modelo de faturamento *</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {MODELOS.map(m => {
                  const sel = form.modelo_cobranca === m.v
                  return (
                    <button key={m.v} type="button" onClick={() => set('modelo_cobranca', m.v)}
                      className={`text-left p-3 rounded-lg border-2 transition-all ${
                        sel ? 'border-brand bg-brand/5' : 'border-gray-100 hover:border-gray-300'
                      }`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-gray-900">{m.l}</span>
                        {sel && <Check className="w-3 h-3 text-brand" />}
                      </div>
                      <p className="text-[10px] text-gray-500 leading-snug">{m.d}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Escala de trabalho */}
            <div className="pt-4 border-t border-gray-100">
              <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">Escala de trabalho</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 mb-1">Entrada</label>
                  <input type="time" value={form.escala_entrada} onChange={e => set('escala_entrada', e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-xs" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 mb-1">Saída seg-qui</label>
                  <input type="time" value={form.escala_saida_seg_qui} onChange={e => set('escala_saida_seg_qui', e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-xs" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 mb-1">Saída sexta</label>
                  <input type="time" value={form.escala_saida_sex} onChange={e => set('escala_saida_sex', e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-xs" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 mb-1">Almoço (min)</label>
                  <input type="number" value={form.escala_almoco_minutos} onChange={e => set('escala_almoco_minutos', Number(e.target.value))}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-xs" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 mb-1">Tolerância CLT (min)</label>
                  <input type="number" value={form.escala_tolerancia_min} onChange={e => set('escala_tolerancia_min', Number(e.target.value))}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-xs" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 mb-1">HE 70% / HE 100%</label>
                  <div className="flex gap-1">
                    <input type="number" value={form.he_pct_normal} onChange={e => set('he_pct_normal', Number(e.target.value))}
                      className="w-full px-2 py-1.5 border border-amber-200 rounded-md text-xs" />
                    <input type="number" value={form.he_pct_domingo_feriado} onChange={e => set('he_pct_domingo_feriado', Number(e.target.value))}
                      className="w-full px-2 py-1.5 border border-red-200 rounded-md text-xs" />
                  </div>
                </div>
              </div>
              <label className="flex items-center gap-2 mt-3 cursor-pointer">
                <input type="checkbox" checked={form.tem_adicional_noturno} onChange={e => set('tem_adicional_noturno', e.target.checked)}
                  className="rounded border-gray-300 text-brand w-4 h-4" />
                <span className="text-xs text-gray-700">Obra tem adicional noturno (22h-5h)</span>
                {form.tem_adicional_noturno && (
                  <input type="number" value={form.adicional_noturno_pct} onChange={e => set('adicional_noturno_pct', Number(e.target.value))}
                    className="w-20 px-2 py-1 border border-gray-200 rounded-md text-xs" />
                )}
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Observações (opcional)</label>
              <textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)} rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none" />
            </div>
          </div>
        )}

        {/* PASSO 4: COMPOSIÇÃO DE FUNÇÕES */}
        {step === 4 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold font-display text-brand mb-1">Composição de Funções e Valores</h2>
              <p className="text-xs text-gray-500">
                Cadastre as funções que serão cobradas nesta obra e o valor R$/HH de cada uma.
                As funções vêm do cadastro em Cadastros → Funções.
              </p>
            </div>

            {composicao.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-2 py-2 font-semibold text-gray-600">Função</th>
                      <th className="text-center px-2 py-2 font-semibold text-gray-600 w-16">Qtd</th>
                      <th className="text-center px-2 py-2 font-semibold text-gray-600 w-16">H/dia</th>
                      <th className="text-right px-2 py-2 font-semibold text-gray-600 w-24">R$/HH</th>
                      <th className="text-right px-2 py-2 font-semibold text-gray-600 w-24">R$/HH 70%</th>
                      <th className="text-right px-2 py-2 font-semibold text-gray-600 w-24">R$/HH 100%</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {composicao.map((c, idx) => (
                      <tr key={idx} className="border-b border-gray-50">
                        <td className="px-2 py-1.5">
                          <select value={c.funcao_nome}
                            onChange={e => {
                              const next = [...composicao]
                              next[idx] = { ...next[idx], funcao_nome: e.target.value }
                              setComposicao(next)
                            }}
                            className="w-full px-2 py-1 border border-gray-200 rounded text-xs">
                            <option value="">Selecione...</option>
                            {funcoesCadastradas.map(f => (
                              <option key={f.id} value={f.nome}>{f.nome}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <input type="number" min={1} value={c.quantidade}
                            onChange={e => {
                              const next = [...composicao]
                              next[idx] = { ...next[idx], quantidade: Number(e.target.value) }
                              setComposicao(next)
                            }}
                            className="w-14 px-1 py-1 border border-gray-200 rounded text-xs text-center" />
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <input type="number" min={1} max={24} step={0.5} value={c.carga_horaria_dia}
                            onChange={e => {
                              const next = [...composicao]
                              next[idx] = { ...next[idx], carga_horaria_dia: Number(e.target.value) }
                              setComposicao(next)
                            }}
                            className="w-14 px-1 py-1 border border-gray-200 rounded text-xs text-center" />
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <input type="number" min={0} step={0.01} value={c.valor_hh}
                            onChange={e => {
                              const base = Number(e.target.value) || 0
                              const next = [...composicao]
                              next[idx] = {
                                ...next[idx],
                                valor_hh: base,
                                valor_hh_70: Math.round(base * 1.7 * 100) / 100,
                                valor_hh_100: Math.round(base * 2.0 * 100) / 100,
                              }
                              setComposicao(next)
                            }}
                            className="w-20 px-1 py-1 border border-gray-200 rounded text-xs text-right" />
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <input type="number" min={0} step={0.01} value={c.valor_hh_70}
                            onChange={e => {
                              const next = [...composicao]
                              next[idx] = { ...next[idx], valor_hh_70: Number(e.target.value) }
                              setComposicao(next)
                            }}
                            className="w-20 px-1 py-1 border border-gray-200 rounded text-xs text-right" />
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <input type="number" min={0} step={0.01} value={c.valor_hh_100}
                            onChange={e => {
                              const next = [...composicao]
                              next[idx] = { ...next[idx], valor_hh_100: Number(e.target.value) }
                              setComposicao(next)
                            }}
                            className="w-20 px-1 py-1 border border-gray-200 rounded text-xs text-right" />
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <button type="button" onClick={() => setComposicao(composicao.filter((_, i) => i !== idx))}
                            className="text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <button type="button" onClick={() => setComposicao(prev => [...prev, {
              funcao_nome: '', quantidade: 1, carga_horaria_dia: 8,
              valor_hh: 0, valor_hh_70: 0, valor_hh_100: 0,
            }])}
              className="px-3 py-1.5 border border-brand text-brand rounded-lg text-xs font-bold hover:bg-brand/5 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Adicionar função
            </button>

            {composicao.length === 0 && (
              <div className="p-4 border border-dashed border-gray-200 rounded-lg text-center text-xs text-gray-400">
                Nenhuma função adicionada. Você pode pular este passo e cadastrar depois em Editar Obra.
              </div>
            )}
          </div>
        )}

        {/* PASSO 5: REVISAR */}
        {step === 5 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold font-display text-brand mb-1">Revisar e criar</h2>
              <p className="text-xs text-gray-500">Confira tudo antes de criar a obra.</p>
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-50">
                <dt className="text-xs text-gray-500">Cliente</dt>
                <dd className="font-semibold text-gray-900">{form.cliente_nome}</dd>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-50">
                <dt className="text-xs text-gray-500">Tipo de contrato</dt>
                <dd className="font-semibold text-gray-900">{form.tipo_contrato_nome}</dd>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-50">
                <dt className="text-xs text-gray-500">Nome da obra</dt>
                <dd className="font-semibold text-gray-900">{form.nome}</dd>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-50">
                <dt className="text-xs text-gray-500">Local</dt>
                <dd className="font-semibold text-gray-900">{form.local || '—'}</dd>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-50">
                <dt className="text-xs text-gray-500">Período</dt>
                <dd className="font-semibold text-gray-900">
                  {form.data_inicio ? new Date(form.data_inicio + 'T12:00').toLocaleDateString('pt-BR') : '—'}
                  {form.data_prev_fim && ' → ' + new Date(form.data_prev_fim + 'T12:00').toLocaleDateString('pt-BR')}
                </dd>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-50">
                <dt className="text-xs text-gray-500">Modelo de faturamento</dt>
                <dd className="font-semibold text-brand">{MODELOS.find(m => m.v === form.modelo_cobranca)?.l}</dd>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-50">
                <dt className="text-xs text-gray-500">Escala</dt>
                <dd className="text-xs text-gray-700 text-right">
                  {form.escala_entrada} → {form.escala_saida_seg_qui} (seg-qui)<br />
                  {form.escala_entrada} → {form.escala_saida_sex} (sex) · almoço {form.escala_almoco_minutos}min
                </dd>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-50">
                <dt className="text-xs text-gray-500">HE</dt>
                <dd className="text-xs text-gray-700">
                  {form.he_pct_normal}% dia útil/sábado · {form.he_pct_domingo_feriado}% domingo/feriado
                  {form.tem_adicional_noturno && ` · +${form.adicional_noturno_pct}% noturno`}
                </dd>
              </div>
            </dl>
            {composicao.length > 0 && (
              <div className="flex justify-between py-2 border-b border-gray-50">
                <dt className="text-xs text-gray-500">Composição</dt>
                <dd className="text-xs text-gray-700 text-right">
                  {composicao.map(c => `${c.funcao_nome} (${c.quantidade}× R$${c.valor_hh.toFixed(2)}/HH)`).join(', ')}
                </dd>
              </div>
            )}
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
              <strong>Próximos passos após criar a obra:</strong> alocar funcionários, importar ponto e gerar o primeiro BM.
            </div>
          </div>
        )}

        {/* Navegação */}
        <div className="flex items-center justify-between pt-5 mt-5 border-t border-gray-100">
          <button type="button" onClick={back} disabled={step === 1}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-30 flex items-center gap-1">
            <ChevronLeft className="w-4 h-4" /> Voltar
          </button>
          {step < 5 ? (
            <button type="button" onClick={next}
              className="px-6 py-2 bg-brand text-white rounded-lg text-sm font-bold hover:bg-brand-dark flex items-center gap-1">
              Avançar <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button type="button" onClick={submit} disabled={saving}
              className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {saving ? 'Criando...' : 'Criar obra'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
