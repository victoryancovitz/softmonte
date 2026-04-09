'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import BackButton from '@/components/BackButton'
import SearchInput from '@/components/SearchInput'
import { FileText, Clock, DollarSign, Calendar, ChevronDown, ChevronUp, Edit2, Check, X } from 'lucide-react'

export default function TiposContratoPage() {
  const [tipos, setTipos] = useState<any[]>([])
  const [composicoes, setComposicoes] = useState<Record<string, any[]>>({})
  const [loading, setLoading] = useState(true)
  const [expandido, setExpandido] = useState<string | null>(null)
  const [editando, setEditando] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [busca, setBusca] = useState('')
  const supabase = createClient()

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
    </div>
  )
}
