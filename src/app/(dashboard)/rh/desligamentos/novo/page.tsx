'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Breadcrumb from '@/components/ui/Breadcrumb'
import { useToast } from '@/components/Toast'
import { formatSupabaseError } from '@/lib/errors'
import { UserMinus } from 'lucide-react'

interface Funcionario {
  id: string
  nome: string
  cargo: string
  status: string
}

const TIPOS_DESLIGAMENTO = [
  { value: 'sem_justa_causa', label: 'Sem Justa Causa' },
  { value: 'justa_causa', label: 'Justa Causa' },
  { value: 'pedido_demissao', label: 'Pedido de Demissão' },
  { value: 'termino_contrato', label: 'Término de Contrato' },
  { value: 'acordo', label: 'Acordo' },
]

const CHECKLIST_ITEMS = [
  { key: 'etapa_aviso_previo', label: 'Aviso Prévio' },
  { key: 'etapa_devolucao_epi', label: 'Devolução de EPI' },
  { key: 'etapa_devolucao_ferramentas', label: 'Devolução de Ferramentas' },
  { key: 'etapa_exame_demissional', label: 'Exame Demissional' },
  { key: 'etapa_baixa_ctps', label: 'Baixa CTPS' },
  { key: 'etapa_calculo_rescisao', label: 'Cálculo de Rescisão' },
  { key: 'etapa_homologacao', label: 'Homologação' },
  { key: 'etapa_esocial', label: 'eSocial' },
  { key: 'etapa_acerto_banco_horas', label: 'Acerto Banco de Horas' },
] as const

export default function NovoDesligamentoPage() {
  const supabase = createClient()
  const router = useRouter()
  const params = useSearchParams()
  const toast = useToast()

  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [funcId, setFuncId] = useState(params.get('funcionario_id') ?? '')
  const [tipo, setTipo] = useState('')
  const [motivo, setMotivo] = useState('')
  const [dataAviso, setDataAviso] = useState('')
  const [dataSaida, setDataSaida] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const selectedFunc = funcionarios.find(f => f.id === funcId)

  useEffect(() => {
    supabase.from('funcionarios').select('id, nome, cargo, status').is('deleted_at', null)
      .neq('status', 'inativo').order('nome')
      .then(({ data }) => setFuncionarios(data ?? []))
  }, [])

  async function handleSubmit() {
    if (!funcId) { setError('Selecione um funcionario.'); return }
    if (!tipo) { setError('Selecione o tipo de desligamento.'); return }
    if (!dataSaida) { setError('Informe a data prevista de saída.'); return }

    setSaving(true)
    setError('')

    // Check for existing active workflow
    const { data: existing } = await supabase
      .from('desligamentos_workflow')
      .select('id')
      .eq('funcionario_id', funcId)
      .eq('status', 'em_andamento')
      .limit(1)

    if (existing && existing.length > 0) {
      setError('Este funcionario ja possui um desligamento em andamento.')
      setSaving(false)
      return
    }

    // Get current obra and banco de horas
    const [{ data: alocacao }, { data: bancoHoras }] = await Promise.all([
      supabase.from('alocacoes').select('obra_id').eq('funcionario_id', funcId).eq('ativo', true).limit(1).single(),
      supabase.from('banco_horas').select('saldo_acumulado_final').eq('funcionario_id', funcId).order('ano', { ascending: false }).order('mes', { ascending: false }).limit(1).single(),
    ])

    const insertData: Record<string, any> = {
      funcionario_id: funcId,
      obra_id: alocacao?.obra_id ?? null,
      tipo_desligamento: tipo,
      motivo: motivo || null,
      data_aviso: dataAviso || null,
      data_prevista_saida: dataSaida,
      status: 'em_andamento',
      saldo_banco_horas_saida: bancoHoras?.saldo_acumulado_final ?? 0,
      observacoes: observacoes || null,
    }

    // Initialize all etapas as JSONB
    CHECKLIST_ITEMS.forEach(item => {
      insertData[item.key] = { ok: false }
    })

    // Calculate eSocial deadline
    const prazo = new Date(dataSaida + 'T12:00:00')
    prazo.setDate(prazo.getDate() + 10)
    insertData.prazo_esocial_s2299 = prazo.toISOString().split('T')[0]

    const { error: insertErr } = await supabase.from('desligamentos_workflow').insert(insertData)

    if (insertErr) {
      setError(formatSupabaseError(insertErr))
      setSaving(false)
      return
    }

    toast.success('Desligamento criado!', `${selectedFunc?.nome ?? 'Funcionário'} — processo iniciado`)
    router.push('/rh/desligamentos')
  }

  const initials = selectedFunc?.nome?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() ?? ''

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <Breadcrumb fallback="/rh/desligamentos" items={[
        { label: 'RH', href: '/rh/desligamentos' },
        { label: 'Desligamentos', href: '/rh/desligamentos' },
        { label: 'Novo desligamento' },
      ]} />

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-6">
          <UserMinus className="w-5 h-5 text-red-600" />
          <h1 className="text-lg font-bold font-display text-red-600">Novo Desligamento</h1>
        </div>

        {/* Selected employee preview */}
        {selectedFunc && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-700 flex items-center justify-center flex-shrink-0">
              <span className="text-lg font-black font-display">{initials}</span>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">{selectedFunc.nome}</p>
              <p className="text-xs text-gray-500">{selectedFunc.cargo} — {selectedFunc.status}</p>
            </div>
          </div>
        )}

        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200">{error}</div>}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Funcionário *</label>
            <select value={funcId} onChange={e => setFuncId(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
              <option value="">Selecione...</option>
              {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome} — {f.cargo}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo de desligamento *</label>
            <select value={tipo} onChange={e => setTipo(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
              <option value="">Selecione...</option>
              {TIPOS_DESLIGAMENTO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Motivo</label>
            <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={3}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none"
              placeholder="Descreva o motivo do desligamento..." />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Data do aviso</label>
              <input type="date" value={dataAviso} onChange={e => setDataAviso(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Data prevista de saída *</label>
              <input type="date" value={dataSaida} onChange={e => setDataSaida(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
          </div>

          {dataSaida && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
              <p><span className="font-semibold">Prazo pagamento rescisão:</span> {(() => {
                const d = new Date(dataSaida + 'T12:00:00'); d.setDate(d.getDate() + 10)
                return d.toLocaleDateString('pt-BR')
              })()} (10 dias)</p>
              <p><span className="font-semibold">Prazo eSocial S-2299:</span> {(() => {
                const d = new Date(dataSaida + 'T12:00:00'); d.setDate(d.getDate() + 10)
                return d.toLocaleDateString('pt-BR')
              })()}</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Observações</label>
            <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none" />
          </div>

          {/* Checklist preview */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Etapas que serão criadas</p>
            <div className="grid grid-cols-2 gap-2">
              {CHECKLIST_ITEMS.map(item => (
                <div key={item.key} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                  <span className="w-4 h-4 rounded border border-gray-300 flex-shrink-0" />
                  <span className="text-xs text-gray-600">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-4 mt-4 border-t border-gray-100">
          <button onClick={handleSubmit} disabled={saving}
            className="px-5 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 disabled:opacity-50">
            {saving ? 'Criando...' : 'Criar Desligamento'}
          </button>
          <button onClick={() => router.push('/rh/desligamentos')}
            className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
