'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Breadcrumb from '@/components/ui/Breadcrumb'
import { useToast } from '@/components/Toast'
import { formatSupabaseError } from '@/lib/errors'
import { UserPlus } from 'lucide-react'

interface Funcionario {
  id: string
  nome: string
  cargo: string
  status: string
}

interface Obra {
  id: string
  nome: string
}

const CHECKLIST_ITEMS = [
  { key: 'etapa_docs_pessoais', label: 'Documentos Pessoais' },
  { key: 'etapa_exame_admissional', label: 'Exame Admissional' },
  { key: 'etapa_ctps', label: 'CTPS' },
  { key: 'etapa_contrato_assinado', label: 'Contrato Assinado' },
  { key: 'etapa_dados_bancarios', label: 'Dados Bancarios' },
  { key: 'etapa_epi_entregue', label: 'EPI Entregue' },
  { key: 'etapa_nr_obrigatorias', label: 'Treinamentos NR' },
  { key: 'etapa_integracao', label: 'Integracao SST' },
  { key: 'etapa_uniforme', label: 'Uniforme' },
  { key: 'etapa_esocial', label: 'eSocial' },
] as const

export default function NovaAdmissaoPage() {
  const supabase = createClient()
  const router = useRouter()
  const params = useSearchParams()
  const toast = useToast()

  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [obras, setObras] = useState<Obra[]>([])
  const [funcId, setFuncId] = useState(params.get('funcionario_id') ?? '')
  const [obraId, setObraId] = useState('')
  const [dataPrevista, setDataPrevista] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const selectedFunc = funcionarios.find(f => f.id === funcId)

  useEffect(() => {
    Promise.all([
      supabase.from('funcionarios').select('id, nome, cargo, status').neq('status', 'inativo').is('deleted_at', null).order('nome'),
      supabase.from('obras').select('id, nome').eq('status', 'ativo').is('deleted_at', null).order('nome'),
    ]).then(([funcRes, obrasRes]) => {
      setFuncionarios(funcRes.data ?? [])
      setObras(obrasRes.data ?? [])
    })
  }, [])

  async function handleSubmit() {
    if (!funcId) { setError('Selecione um funcionario.'); return }
    if (!dataPrevista) { setError('Informe a data prevista.'); return }

    setSaving(true)
    setError('')

    // Check for existing active workflow
    const { data: existing } = await supabase
      .from('admissoes_workflow')
      .select('id')
      .eq('funcionario_id', funcId)
      .eq('status', 'em_andamento')
      .limit(1)

    if (existing && existing.length > 0) {
      setError('Este funcionario ja possui uma admissao em andamento.')
      setSaving(false)
      return
    }

    const insertData: Record<string, any> = {
      funcionario_id: funcId,
      obra_id: obraId || null,
      data_prevista_inicio: dataPrevista,
      status: 'em_andamento',
      responsavel_rh: responsavel || null,
      observacoes: observacoes || null,
    }

    // Initialize all etapas as JSONB with ok: false
    CHECKLIST_ITEMS.forEach(item => {
      insertData[item.key] = { ok: false }
    })

    const { error: insertErr } = await supabase.from('admissoes_workflow').insert(insertData)

    if (insertErr) {
      setError(formatSupabaseError(insertErr))
      setSaving(false)
      return
    }

    toast.success('Admissao criada!', `${selectedFunc?.nome ?? 'Funcionario'} — processo iniciado`)
    router.push('/rh/admissoes')
  }

  const initials = selectedFunc?.nome?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() ?? ''

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <Breadcrumb fallback="/rh/admissoes" items={[
        { label: 'RH', href: '/rh/admissoes' },
        { label: 'Admissoes', href: '/rh/admissoes' },
        { label: 'Nova admissao' },
      ]} />

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-6">
          <UserPlus className="w-5 h-5 text-brand" />
          <h1 className="text-lg font-bold font-display text-brand">Nova Admissao</h1>
        </div>

        {/* Selected employee preview */}
        {selectedFunc && (
          <div className="mb-6 p-4 rounded-xl bg-brand/5 border border-brand/10 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-brand/10 text-brand flex items-center justify-center flex-shrink-0">
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
            <label className="block text-xs font-semibold text-gray-600 mb-1">Funcionario *</label>
            <select value={funcId} onChange={e => setFuncId(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
              <option value="">Selecione...</option>
              {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome} — {f.cargo}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Obra</label>
              <select value={obraId} onChange={e => setObraId(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
                <option value="">Nenhuma</option>
                {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Data prevista *</label>
              <input type="date" value={dataPrevista} onChange={e => setDataPrevista(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Responsavel RH</label>
            <input type="text" value={responsavel} onChange={e => setResponsavel(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              placeholder="Nome do responsavel" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Observacoes</label>
            <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={3}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none"
              placeholder="Observacoes sobre a admissao..." />
          </div>

          {/* Checklist preview */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Etapas que serao criadas</p>
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
            className="px-5 py-2.5 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50">
            {saving ? 'Criando...' : 'Criar Admissao'}
          </button>
          <button onClick={() => router.push('/rh/admissoes')}
            className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
