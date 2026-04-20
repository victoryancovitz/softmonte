'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import BackButton from '@/components/BackButton'
import { useToast } from '@/components/Toast'
import SearchInput from '@/components/SearchInput'
import EmptyState from '@/components/ui/EmptyState'
import { Landmark, Pencil, Plus, X } from 'lucide-react'
import EntityActions from '@/components/ui/EntityActions'
import { fmt } from '@/lib/cores'

/* ═══ Types ═══ */

interface CC {
  id: string
  codigo: string
  nome: string
  subtipo: string | null
  parent_id: string | null
  responsavel_id: string | null
  localizacao: string | null
  custo_mensal_estimado: number | null
  data_inicio: string | null
  data_fim: string | null
  ativo: boolean
}

const SUBTIPOS = [
  { value: 'escritorio', label: 'Escritório' },
  { value: 'juridico', label: 'Jurídico' },
  { value: 'ti', label: 'TI' },
  { value: 'seguros', label: 'Seguros' },
  { value: 'rh_dp', label: 'RH / DP' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'diretoria', label: 'Diretoria' },
  { value: 'outro_adm', label: 'Outro' },
]

const SUBTIPO_LABEL: Record<string, string> = Object.fromEntries(SUBTIPOS.map(s => [s.value, s.label]))

/* ═══ Component ═══ */

export default function EstruturaAdmPage() {
  const supabase = createClient()
  const toast = useToast()

  const [ccs, setCcs] = useState<CC[]>([])
  const [funcsPorCC, setFuncsPorCC] = useState<Record<string, any[]>>({})
  const [expandedCC, setExpandedCC] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [nome, setNome] = useState('')
  const [subtipo, setSubtipo] = useState('')
  const [parentId, setParentId] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [localizacao, setLocalizacao] = useState('')
  const [custoMensal, setCustoMensal] = useState('')
  const [dataInicio, setDataInicio] = useState('')

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('centros_custo')
      .select('id, codigo, nome, subtipo, parent_id, responsavel_id, localizacao, custo_mensal_estimado, data_inicio, data_fim, ativo')
      .eq('tipo', 'administrativo')
      .is('deleted_at', null)
      .order('codigo')
    setCcs(data ?? [])

    // Load funcionários alocados por CC
    if (data && data.length > 0) {
      const ccIds = data.map(c => c.id)
      const { data: funcs } = await supabase
        .from('funcionarios')
        .select('id, nome, cargo, centro_custo_id')
        .in('centro_custo_id', ccIds)
        .is('deleted_at', null)
        .order('nome')
      const map: Record<string, any[]> = {}
      for (const f of funcs ?? []) {
        if (!map[f.centro_custo_id]) map[f.centro_custo_id] = []
        map[f.centro_custo_id].push(f)
      }
      setFuncsPorCC(map)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function resetForm() {
    setNome('')
    setSubtipo('')
    setParentId('')
    setResponsavel('')
    setLocalizacao('')
    setCustoMensal('')
    setDataInicio('')
    setEditId(null)
  }

  function openCreate() {
    resetForm()
    setModalOpen(true)
  }

  function openEdit(cc: CC) {
    setEditId(cc.id)
    setNome(cc.nome)
    setSubtipo(cc.subtipo ?? '')
    setParentId(cc.parent_id ?? '')
    setResponsavel('')
    setLocalizacao(cc.localizacao ?? '')
    setCustoMensal(cc.custo_mensal_estimado?.toString() ?? '')
    setDataInicio(cc.data_inicio ?? '')
    setModalOpen(true)
  }

  async function handleSave() {
    if (!nome.trim() || !subtipo || !dataInicio) {
      toast.warning('Preencha os campos obrigatórios: Nome, Subtipo e Data de início.')
      return
    }
    setSaving(true)
    try {
      if (editId) {
        const { error } = await supabase
          .from('centros_custo')
          .update({
            nome: nome.trim(),
            subtipo,
            parent_id: parentId || null,
            localizacao: localizacao.trim() || null,
            custo_mensal_estimado: custoMensal ? parseFloat(custoMensal) : null,
            data_inicio: dataInicio,
          })
          .eq('id', editId)
        if (error) throw error
        toast.success('Centro de custo atualizado.')
      } else {
        // Gerar código
        const { data: codData, error: codErr } = await supabase.rpc('cc_gerar_codigo', { tipo: 'administrativo' })
        if (codErr) throw codErr
        const codigo = codData as string

        const { error } = await supabase
          .from('centros_custo')
          .insert({
            codigo,
            nome: nome.trim(),
            tipo: 'administrativo',
            subtipo,
            parent_id: parentId || null,
            localizacao: localizacao.trim() || null,
            custo_mensal_estimado: custoMensal ? parseFloat(custoMensal) : null,
            data_inicio: dataInicio,
            ativo: true,
          })
        if (error) throw error
        toast.success('Centro de custo criado com sucesso.')
      }
      setModalOpen(false)
      resetForm()
      load()
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao salvar centro de custo.')
    } finally {
      setSaving(false)
    }
  }

  const filtered = ccs.filter(c => {
    if (!busca) return true
    const q = busca.toLowerCase()
    return (
      c.nome.toLowerCase().includes(q) ||
      c.codigo.toLowerCase().includes(q) ||
      (c.subtipo && SUBTIPO_LABEL[c.subtipo]?.toLowerCase().includes(q))
    )
  })

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <BackButton fallback="/cc" />
          <div>
            <h1 className="text-xl font-bold font-display text-brand">Estrutura Administrativa</h1>
            <p className="text-sm text-gray-500">{ccs.length} centros de custo administrativos</p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2 bg-brand text-white rounded-xl text-sm font-semibold hover:bg-brand-dark"
        >
          <Plus className="w-4 h-4" /> Novo CC Administrativo
        </button>
      </div>

      {/* Busca */}
      <div className="mb-4 max-w-sm">
        <SearchInput value={busca} onChange={setBusca} placeholder="Buscar por nome, código ou subtipo..." />
      </div>

      {/* Lista */}
      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">Carregando...</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          titulo="Nenhum CC administrativo encontrado"
          descricao="Crie um centro de custo administrativo para organizar despesas fixas."
          icone={<Landmark className="w-12 h-12" />}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map(cc => {
            const funcsCC = funcsPorCC[cc.id] ?? []
            const isExpanded = expandedCC === cc.id
            return (
            <div key={cc.id} className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-gray-400">{cc.codigo}</span>
                    {cc.subtipo && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                        {SUBTIPO_LABEL[cc.subtipo] ?? cc.subtipo}
                      </span>
                    )}
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                      {funcsCC.length} func.
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-gray-800 truncate">{cc.nome}</h3>
                </div>
                <EntityActions entity="centro_custo" id={cc.id} nome={cc.nome} onRefresh={load} onEdit={() => openEdit(cc)} />
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                {cc.localizacao && <span>{cc.localizacao}</span>}
                {cc.custo_mensal_estimado ? (
                  <span className="font-medium text-violet-600">{fmt(cc.custo_mensal_estimado)}/mes</span>
                ) : null}
              </div>
              {/* Funcionários */}
              <button
                onClick={() => setExpandedCC(isExpanded ? null : cc.id)}
                className="mt-2 text-[11px] text-brand hover:underline font-semibold"
              >
                {isExpanded ? 'Ocultar funcionarios' : `Ver funcionarios (${funcsCC.length})`}
              </button>
              {isExpanded && (
                <div className="mt-2 pt-2 border-t border-gray-100 space-y-1.5">
                  {funcsCC.length > 0 ? funcsCC.map((func: any) => (
                    <a key={func.id} href={`/funcionarios/${func.id}`} className="flex items-center gap-2 py-1 hover:bg-gray-50 rounded-lg px-1 transition-colors">
                      <div className="w-6 h-6 rounded-full bg-brand/10 text-brand text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                        {func.nome?.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-gray-800 truncate">{func.nome}</div>
                        {func.cargo && <div className="text-[10px] text-gray-400">{func.cargo}</div>}
                      </div>
                    </a>
                  )) : (
                    <p className="text-xs text-gray-400 italic py-2">Nenhum funcionario neste departamento.</p>
                  )}
                </div>
              )}
            </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-800">
                {editId ? 'Editar Centro de Custo' : 'Novo Centro de Custo Administrativo'}
              </h2>
              <button onClick={() => { setModalOpen(false); resetForm() }} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Nome */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nome *</label>
                <input
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder="Ex: Escritório Central"
                />
              </div>

              {/* Subtipo */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Subtipo *</label>
                <select
                  value={subtipo}
                  onChange={e => setSubtipo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-white"
                >
                  <option value="">Selecione...</option>
                  {SUBTIPOS.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              {/* Parent */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">CC Superior (opcional)</label>
                <select
                  value={parentId}
                  onChange={e => setParentId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-white"
                >
                  <option value="">Nenhum (raiz)</option>
                  {ccs
                    .filter(c => c.id !== editId)
                    .map(c => (
                      <option key={c.id} value={c.id}>{c.codigo} — {c.nome}</option>
                    ))}
                </select>
              </div>

              {/* Responsável */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Responsável</label>
                <input
                  value={responsavel}
                  onChange={e => setResponsavel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder="Nome do responsável"
                />
              </div>

              {/* Localização */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Localização</label>
                <input
                  value={localizacao}
                  onChange={e => setLocalizacao(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder="Ex: Av. Paulista, 1000"
                />
              </div>

              {/* Custo Mensal */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Custo mensal estimado (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={custoMensal}
                  onChange={e => setCustoMensal(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder="0,00"
                />
              </div>

              {/* Data início */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Data de início *</label>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={e => setDataInicio(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 p-5 border-t border-gray-100">
              <button
                onClick={() => { setModalOpen(false); resetForm() }}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 bg-brand text-white rounded-xl text-sm font-semibold hover:bg-brand-dark disabled:opacity-50"
              >
                {saving ? 'Salvando...' : editId ? 'Salvar Alterações' : 'Criar Centro de Custo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
