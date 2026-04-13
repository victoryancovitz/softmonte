'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import BackButton from '@/components/BackButton'
import SearchInput from '@/components/SearchInput'
import { useToast } from '@/components/Toast'
import { FileText, Clock, DollarSign, Calendar, ChevronDown, ChevronUp, Edit2, Check, X, Plus } from 'lucide-react'

export default function TiposContratoPage() {
  const [tipos, setTipos] = useState<any[]>([])
  const [composicoes, setComposicoes] = useState<Record<string, any[]>>({})
  const [loading, setLoading] = useState(true)
  const [expandido, setExpandido] = useState<string | null>(null)
  const [editando, setEditando] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [busca, setBusca] = useState('')
  const [modalAberto, setModalAberto] = useState(false)
  const [passo, setPasso] = useState(1)
  const [salvando, setSalvando] = useState(false)
  const formVazio = {
    nome: '', codigo: '', descricao: '', setor: 'industrial',
    carga_horaria_dia: 9, horario_inicio: '07:00', horario_fim: '17:00',
    dias_uteis_mes: 22, trabalha_sabado: false, trabalha_domingo: false,
    prazo_minimo_meses: 1, prazo_desmobilizacao_dias: 30, prazo_aviso_alteracao_dias: 15,
    prazo_pagamento_dias: 5, forma_pagamento: 'deposito_bancario', indice_reajuste: 'INPC',
    margem_alvo_min: 20, margem_alvo_max: 30, alerta_prazo_dias: 30, alerta_margem_critica: 10,
  }
  const [form, setFormState] = useState(formVazio)
  const setForm = (patch: Partial<typeof formVazio>) => setFormState(prev => ({ ...prev, ...patch }))
  const linhaVazia = { funcao_nome: '', quantidade_padrao: 1, horas_mes: 220, custo_hora_referencia: 0, custo_hora_venda_min: 0, custo_hora_venda_ref: 0, he_multiplicador_70: 1.70, he_multiplicador_100: 2.00, _key: 0 }
  const [linhas, setLinhas] = useState([{ ...linhaVazia, _key: Date.now() }])
  const addLinha = () => setLinhas(l => [...l, { ...linhaVazia, _key: Date.now() + Math.random() }])
  const removeLinha = (key: number) => setLinhas(l => l.filter(x => x._key !== key))
  const updateLinha = (key: number, patch: any) => setLinhas(l => l.map(x => x._key === key ? { ...x, ...patch } : x))
  function resetModal() { setFormState(formVazio); setLinhas([{ ...linhaVazia, _key: Date.now() }]); setPasso(1); setModalAberto(false) }

  const supabase = createClient()
  const toast = useToast()

  useEffect(() => { load() }, [])

  async function load() {
    const { data: t } = await supabase.from('tipos_contrato').select('*').eq('ativo', true).order('nome')
    setTipos(t || [])
    if (t && t.length > 0) {
      const { data: c } = await supabase.from('tipos_contrato_composicao').select('*').order('ordem')
      const byTipo: Record<string, any[]> = {}
      ;(c || []).forEach((comp: any) => {
        if (!byTipo[comp.tipo_contrato_id]) byTipo[comp.tipo_contrato_id] = []
        byTipo[comp.tipo_contrato_id].push(comp)
      })
      setComposicoes(byTipo)
    }
    setLoading(false)
  }

  async function salvarTipoContrato() {
    if (!form.nome.trim()) { toast.error('Informe o nome'); return }
    setSalvando(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: novo, error: tcErr } = await supabase.from('tipos_contrato').insert({
        nome: form.nome.trim(), codigo: form.codigo || form.nome.toUpperCase().replace(/\s+/g, '_').slice(0, 20),
        descricao: form.descricao || null, setor: form.setor, carga_horaria_dia: form.carga_horaria_dia,
        horario_inicio: form.horario_inicio, horario_fim: form.horario_fim, dias_uteis_mes: form.dias_uteis_mes,
        trabalha_sabado: form.trabalha_sabado, trabalha_domingo: form.trabalha_domingo,
        prazo_minimo_meses: form.prazo_minimo_meses, prazo_desmobilizacao_dias: form.prazo_desmobilizacao_dias,
        prazo_aviso_alteracao_dias: form.prazo_aviso_alteracao_dias, prazo_pagamento_dias: form.prazo_pagamento_dias,
        forma_pagamento: form.forma_pagamento, indice_reajuste: form.indice_reajuste,
        margem_alvo_min: form.margem_alvo_min, margem_alvo_max: form.margem_alvo_max,
        alerta_prazo_dias: form.alerta_prazo_dias, alerta_margem_critica: form.alerta_margem_critica,
        ativo: true, criado_por: user?.email ?? 'sistema',
      }).select().single()
      if (tcErr) throw tcErr
      const composFiltradas = linhas.filter(l => l.funcao_nome.trim()).map((l, i) => ({
        tipo_contrato_id: novo.id, funcao_nome: l.funcao_nome.trim(), quantidade_padrao: l.quantidade_padrao,
        horas_mes: l.horas_mes, custo_hora_referencia: l.custo_hora_referencia || 0,
        custo_hora_venda_min: l.custo_hora_venda_min || 0, custo_hora_venda_ref: l.custo_hora_venda_ref,
        he_multiplicador_70: l.he_multiplicador_70, he_multiplicador_100: l.he_multiplicador_100, ordem: i + 1,
      }))
      if (composFiltradas.length > 0) {
        const { error: compErr } = await supabase.from('tipos_contrato_composicao').insert(composFiltradas)
        if (compErr) throw compErr
      }
      toast.success(`Tipo "${form.nome}" criado com sucesso`)
      resetModal()
      await load()
    } catch (err: any) { toast.error('Erro: ' + (err.message || err)) }
    finally { setSalvando(false) }
  }

  function toggleExpand(id: string) {
    setExpandido(expandido === id ? null : id)
    setEditando(null)
  }

  function startEdit(comp: any) {
    setEditando(comp.id)
    setEditForm({ ...comp })
  }

  async function saveEdit() {
    if (!editando) return
    await supabase.from('tipos_contrato_composicao').update({
      funcao_nome: editForm.funcao_nome,
      quantidade_padrao: editForm.quantidade_padrao,
      horas_mes: editForm.horas_mes,
      custo_hora_venda_ref: editForm.custo_hora_venda_ref,
      he_multiplicador_70: editForm.he_multiplicador_70,
      he_multiplicador_100: editForm.he_multiplicador_100,
    }).eq('id', editando)
    setEditando(null)
    await load()
  }

  const fmt = (v: number) => v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? '—'

  const filteredTipos = useMemo(() => {
    if (!busca.trim()) return tipos
    const q = busca.toLowerCase()
    return tipos.filter(t =>
      t.nome?.toLowerCase().includes(q) ||
      t.codigo?.toLowerCase().includes(q) ||
      t.descricao?.toLowerCase().includes(q)
    )
  }, [tipos, busca])

  if (loading) return <div className="p-4 sm:p-6 text-gray-400 text-sm">Carregando...</div>

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/cadastros" />
        <span className="font-medium text-gray-700">Tipos de Contrato</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold font-display text-brand">Tipos de Contrato</h1>
          <p className="text-sm text-gray-500 mt-0.5">{tipos.length} tipos cadastrados</p>
        </div>
        <button onClick={() => setModalAberto(true)} className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg text-sm font-semibold hover:bg-brand-dark transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Tipo de Contrato
        </button>
      </div>

      <div className="mb-4">
        <SearchInput value={busca} onChange={setBusca} placeholder="Buscar tipo de contrato..." />
      </div>

      {filteredTipos.length > 0 ? (
        <div className="space-y-4">
          {filteredTipos.map(tipo => {
            const isOpen = expandido === tipo.id
            const comps = composicoes[tipo.id] || []
            return (
              <div key={tipo.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Card header */}
                <button onClick={() => toggleExpand(tipo.id)} className="w-full p-5 text-left flex items-start gap-4 hover:bg-gray-50/50 transition-colors">
                  <div className="w-12 h-12 rounded-xl bg-brand/10 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-6 h-6 text-brand" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900">{tipo.nome}</span>
                      {tipo.codigo && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{tipo.codigo}</span>}
                    </div>
                    {tipo.descricao && <p className="text-xs text-gray-500 mb-2">{tipo.descricao}</p>}
                    <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                      {tipo.margem_alvo_min != null && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          Margem: {tipo.margem_alvo_min}%–{tipo.margem_alvo_max}%
                        </span>
                      )}
                      {tipo.prazo_minimo_meses && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Min. {tipo.prazo_minimo_meses} meses
                        </span>
                      )}
                      {tipo.prazo_pagamento_dias && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Pgto: {tipo.prazo_pagamento_dias}d
                        </span>
                      )}
                      {tipo.dias_uteis_mes && <span>{tipo.dias_uteis_mes} dias úteis/mês</span>}
                      {tipo.trabalha_sabado && <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Sábado</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Link href={`/obras/nova?tipo_id=${tipo.id}`} onClick={e => e.stopPropagation()}
                      className="text-xs px-3 py-1.5 bg-brand text-white rounded-lg hover:bg-brand-dark transition-colors">
                      Usar este tipo
                    </Link>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </button>

                {/* Composição expandida */}
                {isOpen && (
                  <div className="border-t border-gray-100 p-5 bg-gray-50/50">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Composição Padrão ({comps.length} funções)</h3>
                    {comps.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200">
                              {['Função', 'Qtd', 'Horas/Mês', 'R$/h Venda', 'HE 70%', 'HE 100%', ''].map(h => (
                                <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {comps.map(c => (
                              <tr key={c.id} className="border-b border-gray-100">
                                {editando === c.id ? (
                                  <>
                                    <td className="px-3 py-2"><input value={editForm.funcao_nome} onChange={e => setEditForm({ ...editForm, funcao_nome: e.target.value })} className="w-full px-2 py-1 border rounded text-sm" /></td>
                                    <td className="px-3 py-2"><input type="number" value={editForm.quantidade_padrao} onChange={e => setEditForm({ ...editForm, quantidade_padrao: e.target.value })} className="w-16 px-2 py-1 border rounded text-sm" /></td>
                                    <td className="px-3 py-2"><input type="number" value={editForm.horas_mes} onChange={e => setEditForm({ ...editForm, horas_mes: e.target.value })} className="w-16 px-2 py-1 border rounded text-sm" /></td>
                                    <td className="px-3 py-2"><input type="number" step="0.01" value={editForm.custo_hora_venda_ref} onChange={e => setEditForm({ ...editForm, custo_hora_venda_ref: e.target.value })} className="w-20 px-2 py-1 border rounded text-sm" /></td>
                                    <td className="px-3 py-2"><input type="number" step="0.01" value={editForm.he_multiplicador_70} onChange={e => setEditForm({ ...editForm, he_multiplicador_70: e.target.value })} className="w-16 px-2 py-1 border rounded text-sm" /></td>
                                    <td className="px-3 py-2"><input type="number" step="0.01" value={editForm.he_multiplicador_100} onChange={e => setEditForm({ ...editForm, he_multiplicador_100: e.target.value })} className="w-16 px-2 py-1 border rounded text-sm" /></td>
                                    <td className="px-3 py-2">
                                      <div className="flex gap-1">
                                        <button onClick={saveEdit} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check className="w-4 h-4" /></button>
                                        <button onClick={() => setEditando(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
                                      </div>
                                    </td>
                                  </>
                                ) : (
                                  <>
                                    <td className="px-3 py-2 font-medium">{c.funcao_nome}</td>
                                    <td className="px-3 py-2">{c.quantidade_padrao}</td>
                                    <td className="px-3 py-2">{c.horas_mes}h</td>
                                    <td className="px-3 py-2 font-semibold text-brand">{fmt(Number(c.custo_hora_venda_ref))}</td>
                                    <td className="px-3 py-2 text-amber-600">×{Number(c.he_multiplicador_70).toFixed(2)}</td>
                                    <td className="px-3 py-2 text-red-600">×{Number(c.he_multiplicador_100).toFixed(2)}</td>
                                    <td className="px-3 py-2">
                                      <button onClick={() => startEdit(c)} className="p-1 text-gray-400 hover:text-brand hover:bg-gray-100 rounded"><Edit2 className="w-3.5 h-3.5" /></button>
                                    </td>
                                  </>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">Nenhuma composição definida.</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-10 text-center">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Nenhum tipo de contrato cadastrado.</p>
        </div>
      )}
      {/* Modal criar tipo de contrato */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div><h2 className="text-lg font-bold text-gray-900">Novo Tipo de Contrato</h2><p className="text-xs text-gray-400 mt-0.5">Passo {passo} de 3</p></div>
              <button onClick={resetModal} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            {/* Stepper */}
            <div className="flex items-center gap-0 px-6 pt-4 pb-2">
              {[{ n: 1, label: 'Identificação' }, { n: 2, label: 'Prazos e Financeiro' }, { n: 3, label: 'Composição' }].map((s, i) => (
                <div key={s.n} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${passo >= s.n ? 'bg-brand text-white' : 'bg-gray-100 text-gray-400'}`}>
                      {passo > s.n ? <Check className="w-4 h-4" /> : s.n}
                    </div>
                    <span className={`text-[10px] mt-1 font-medium ${passo >= s.n ? 'text-brand' : 'text-gray-400'}`}>{s.label}</span>
                  </div>
                  {i < 2 && <div className={`flex-1 h-0.5 mb-5 mx-1 transition-colors ${passo > s.n ? 'bg-brand' : 'bg-gray-200'}`} />}
                </div>
              ))}
            </div>
            {/* Conteúdo */}
            <div className="flex-1 overflow-y-auto px-6 pb-4">
              {/* Passo 1 */}
              {passo === 1 && (
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2"><label className="block text-xs font-semibold text-gray-600 mb-1">Nome do tipo *</label><input value={form.nome} onChange={e => setForm({ nome: e.target.value })} placeholder="Ex: HH-220 Horas, Parada Programada..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" /></div>
                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">Código único *</label><input value={form.codigo} onChange={e => setForm({ codigo: e.target.value.toUpperCase().replace(/\s/g, '_') })} placeholder="HH_220..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand" /><p className="text-[10px] text-gray-400 mt-1">Maiúsculas e underline.</p></div>
                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">Setor</label><select value={form.setor} onChange={e => setForm({ setor: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand">{['industrial', 'petroquimico', 'mineracao', 'papel_celulose', 'energia', 'alimentos', 'geral'].map(s => <option key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}</select></div>
                    <div className="col-span-2"><label className="block text-xs font-semibold text-gray-600 mb-1">Descrição</label><textarea value={form.descricao} onChange={e => setForm({ descricao: e.target.value })} placeholder="Características e quando usar este tipo..." rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none" /></div>
                  </div>
                  <div className="border border-gray-100 rounded-xl p-4">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Jornada de Trabalho</h3>
                    <div className="grid grid-cols-3 gap-3">
                      <div><label className="block text-xs text-gray-600 mb-1">Carga horária/dia</label><div className="flex items-center gap-1"><input type="number" value={form.carga_horaria_dia} onChange={e => setForm({ carga_horaria_dia: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /><span className="text-xs text-gray-400">h</span></div></div>
                      <div><label className="block text-xs text-gray-600 mb-1">Horário início</label><input type="time" value={form.horario_inicio} onChange={e => setForm({ horario_inicio: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
                      <div><label className="block text-xs text-gray-600 mb-1">Horário fim</label><input type="time" value={form.horario_fim} onChange={e => setForm({ horario_fim: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
                      <div><label className="block text-xs text-gray-600 mb-1">Dias úteis/mês</label><input type="number" value={form.dias_uteis_mes} onChange={e => setForm({ dias_uteis_mes: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
                      <div className="flex items-end gap-4 col-span-2 pb-1">
                        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.trabalha_sabado} onChange={e => setForm({ trabalha_sabado: e.target.checked })} className="rounded text-brand" /><span className="text-sm text-gray-700">Sábado</span></label>
                        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.trabalha_domingo} onChange={e => setForm({ trabalha_domingo: e.target.checked })} className="rounded text-brand" /><span className="text-sm text-gray-700">Domingo</span></label>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {/* Passo 2 */}
              {passo === 2 && (
                <div className="space-y-4 pt-2">
                  <div className="border border-gray-100 rounded-xl p-4">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Prazos Contratuais</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {[{ key: 'prazo_minimo_meses', label: 'Prazo mínimo', unit: 'meses' }, { key: 'prazo_desmobilizacao_dias', label: 'Desmobilização', unit: 'dias' }, { key: 'prazo_aviso_alteracao_dias', label: 'Aviso alteração', unit: 'dias' }, { key: 'prazo_pagamento_dias', label: 'Prazo pagamento', unit: 'dias' }, { key: 'alerta_prazo_dias', label: 'Alertar antes', unit: 'dias' }].map(({ key, label, unit }) => (
                        <div key={key}><label className="block text-xs text-gray-600 mb-1">{label}</label><div className="flex items-center gap-1"><input type="number" value={(form as any)[key]} onChange={e => setForm({ [key]: Number(e.target.value) } as any)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /><span className="text-xs text-gray-400 whitespace-nowrap">{unit}</span></div></div>
                      ))}
                    </div>
                  </div>
                  <div className="border border-gray-100 rounded-xl p-4">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Condições Financeiras</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="block text-xs text-gray-600 mb-1">Forma de pagamento</label><select value={form.forma_pagamento} onChange={e => setForm({ forma_pagamento: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">{['deposito_bancario', 'boleto', 'pix', 'cheque', 'nota_promissoria'].map(o => <option key={o} value={o}>{o.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}</select></div>
                      <div><label className="block text-xs text-gray-600 mb-1">Índice de reajuste</label><select value={form.indice_reajuste} onChange={e => setForm({ indice_reajuste: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">{['INPC', 'IPCA', 'IGP-M', 'SINAPI', 'fixo', 'negociado'].map(o => <option key={o} value={o}>{o}</option>)}</select></div>
                      <div><label className="block text-xs text-gray-600 mb-1">Margem alvo mínima</label><div className="flex items-center gap-1"><input type="number" value={form.margem_alvo_min} onChange={e => setForm({ margem_alvo_min: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /><span className="text-xs text-gray-400">%</span></div></div>
                      <div><label className="block text-xs text-gray-600 mb-1">Margem alvo máxima</label><div className="flex items-center gap-1"><input type="number" value={form.margem_alvo_max} onChange={e => setForm({ margem_alvo_max: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /><span className="text-xs text-gray-400">%</span></div></div>
                      <div className="col-span-2"><label className="block text-xs text-gray-600 mb-1">Alertar margem abaixo de</label><div className="flex items-center gap-1"><input type="number" value={form.alerta_margem_critica} onChange={e => setForm({ alerta_margem_critica: Number(e.target.value) })} className="w-32 px-3 py-2 border border-gray-200 rounded-lg text-sm" /><span className="text-xs text-gray-400">%</span></div></div>
                    </div>
                  </div>
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800">
                    <p className="font-semibold mb-2 text-xs uppercase tracking-wide">Resumo</p>
                    <div className="grid grid-cols-2 gap-1 text-xs"><span>Pagamento: {form.prazo_pagamento_dias} dias</span><span>Reajuste: {form.indice_reajuste}</span><span>Margem: {form.margem_alvo_min}%–{form.margem_alvo_max}%</span><span>Alerta: {form.alerta_prazo_dias} dias antes</span></div>
                  </div>
                </div>
              )}
              {/* Passo 3 */}
              {passo === 3 && (
                <div className="pt-2">
                  <p className="text-xs text-gray-500 mb-3">Defina as funções que compõem este tipo. Valores padrão — ajustáveis por obra.</p>
                  <div className="space-y-2">
                    {linhas.map(l => (
                      <div key={l._key} className="border border-gray-200 rounded-xl p-3 bg-gray-50/50">
                        <div className="flex gap-2 mb-2">
                          <div className="flex-1"><label className="block text-[10px] text-gray-500 mb-1">Função / Cargo</label><input value={l.funcao_nome} onChange={e => updateLinha(l._key, { funcao_nome: e.target.value })} placeholder="Soldador ER, Eletricista..." className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm" /></div>
                          <div className="w-20"><label className="block text-[10px] text-gray-500 mb-1">Qtd</label><input type="number" min="1" value={l.quantidade_padrao} onChange={e => updateLinha(l._key, { quantidade_padrao: Number(e.target.value) })} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center" /></div>
                          <div className="w-20"><label className="block text-[10px] text-gray-500 mb-1">Horas/mês</label><input type="number" value={l.horas_mes} onChange={e => updateLinha(l._key, { horas_mes: Number(e.target.value) })} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center" /></div>
                        </div>
                        <div className="flex gap-2 items-end">
                          <div className="flex-1"><label className="block text-[10px] text-gray-500 mb-1">R$/h venda (ref)</label><input type="number" step="0.01" value={l.custo_hora_venda_ref} onChange={e => updateLinha(l._key, { custo_hora_venda_ref: Number(e.target.value) })} placeholder="0,00" className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm" /></div>
                          <div className="w-24"><label className="block text-[10px] text-gray-500 mb-1">HE 70%</label><input type="number" step="0.01" value={l.he_multiplicador_70} onChange={e => updateLinha(l._key, { he_multiplicador_70: Number(e.target.value) })} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center" /></div>
                          <div className="w-24"><label className="block text-[10px] text-gray-500 mb-1">HE 100%</label><input type="number" step="0.01" value={l.he_multiplicador_100} onChange={e => updateLinha(l._key, { he_multiplicador_100: Number(e.target.value) })} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center" /></div>
                          {linhas.length > 1 && <button onClick={() => removeLinha(l._key)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg mb-0.5"><X className="w-4 h-4" /></button>}
                        </div>
                        {l.custo_hora_venda_ref > 0 && <div className="mt-2 pt-2 border-t border-gray-200 text-[10px] text-gray-500">{l.quantidade_padrao}× × {l.horas_mes}h × R${Number(l.custo_hora_venda_ref).toFixed(2)} = <strong className="text-brand">R${(l.quantidade_padrao * l.horas_mes * l.custo_hora_venda_ref).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês</strong></div>}
                      </div>
                    ))}
                  </div>
                  <button onClick={addLinha} className="mt-3 w-full py-2 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-brand hover:text-brand transition-colors flex items-center justify-center gap-2"><Plus className="w-4 h-4" /> Adicionar função</button>
                  {linhas.some(l => l.custo_hora_venda_ref > 0) && (
                    <div className="mt-3 p-3 bg-green-50 border border-green-100 rounded-xl text-sm">
                      <div className="flex justify-between items-center"><span className="text-green-700 font-medium">Potencial faturamento mensal</span><span className="text-green-800 font-bold text-base">R${linhas.reduce((s, l) => s + l.quantidade_padrao * l.horas_mes * l.custo_hora_venda_ref, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                      <p className="text-[10px] text-green-600 mt-0.5">{linhas.reduce((s, l) => s + l.quantidade_padrao, 0)} profissionais × {Math.round(linhas.reduce((s, l) => s + l.horas_mes, 0) / linhas.length)} h/mês média</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
              <button onClick={() => passo > 1 ? setPasso(p => p - 1) : resetModal()} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-white">{passo === 1 ? 'Cancelar' : '← Voltar'}</button>
              {passo < 3 ? (
                <button onClick={() => { if (passo === 1 && !form.nome.trim()) { toast.error('Informe o nome'); return }; setPasso(p => p + 1) }} className="px-5 py-2 bg-brand text-white rounded-lg text-sm font-semibold hover:bg-brand-dark">Próximo →</button>
              ) : (
                <button onClick={salvarTipoContrato} disabled={salvando} className="px-5 py-2 bg-brand text-white rounded-lg text-sm font-semibold hover:bg-brand-dark disabled:opacity-50">{salvando ? 'Salvando...' : 'Criar tipo de contrato'}</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
