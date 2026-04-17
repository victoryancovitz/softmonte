'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import SearchInput from '@/components/SearchInput'
import EmptyState from '@/components/ui/EmptyState'
import {
  MessageSquare, Send, CheckCircle2, Clock, Eye, AlertTriangle,
  Plus, X, Upload, Inbox, FileText,
} from 'lucide-react'

/* ─── helpers ─── */

function fmtDate(d: string | null): string {
  if (!d) return '---'
  try {
    const date = new Date(d)
    if (isNaN(date.getTime())) return '---'
    return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  } catch { return '---' }
}

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  confirmado: { label: 'Confirmado', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  lido:       { label: 'Lido',       color: 'bg-blue-50 text-blue-700 border-blue-200' },
  entregue:   { label: 'Entregue',   color: 'bg-gray-100 text-gray-600 border-gray-200' },
  pendente:   { label: 'Pendente',   color: 'bg-amber-50 text-amber-700 border-amber-200' },
  enviado:    { label: 'Enviado',    color: 'bg-gray-100 text-gray-600 border-gray-200' },
  expirado:   { label: 'Expirado',   color: 'bg-red-50 text-red-600 border-red-200' },
  erro:       { label: 'Erro',       color: 'bg-red-50 text-red-600 border-red-200' },
}

const TIPO_DOC_OPTIONS = [
  { value: '', label: 'Todos os tipos' },
  { value: 'holerite', label: 'Holerite' },
  { value: 'informe_rendimentos', label: 'Informe de Rendimentos' },
  { value: 'ferias', label: 'Aviso de Férias' },
  { value: 'advertencia', label: 'Advertência' },
  { value: 'comunicado', label: 'Comunicado' },
  { value: 'outro', label: 'Outro' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'Todos os status' },
  { value: 'confirmado', label: 'Confirmado' },
  { value: 'lido', label: 'Lido' },
  { value: 'entregue', label: 'Entregue' },
  { value: 'pendente', label: 'Pendente' },
  { value: 'expirado', label: 'Expirado' },
  { value: 'erro', label: 'Erro' },
]

const INTENCAO_BADGE: Record<string, { label: string; color: string }> = {
  duvida_holerite:  { label: 'Dúvida holerite',  color: 'bg-blue-50 text-blue-700 border-blue-200' },
  solicitar_ferias: { label: 'Solicitar férias',  color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  reclamacao:       { label: 'Reclamação',        color: 'bg-red-50 text-red-600 border-red-200' },
  informacao:       { label: 'Informação',        color: 'bg-gray-100 text-gray-600 border-gray-200' },
  outro:            { label: 'Outro',             color: 'bg-amber-50 text-amber-700 border-amber-200' },
}

/* ─── component ─── */

export default function WhatsAppRHPage() {
  const supabase = createClient()
  const toast = useToast()

  const [envios, setEnvios] = useState<any[]>([])
  const [recebidas, setRecebidas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroData, setFiltroData] = useState('')
  const [tab, setTab] = useState<'envios' | 'caixa'>('envios')

  // Modal enviar
  const [modalAberto, setModalAberto] = useState(false)
  const [funcionarios, setFuncionarios] = useState<any[]>([])
  const [enviando, setEnviando] = useState(false)
  const [formEnvio, setFormEnvio] = useState({ funcionario_id: '', tipo_documento: 'holerite', mensagem_texto: '', arquivo: null as File | null })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: e }, { data: r }] = await Promise.all([
      supabase.from('vw_whatsapp_painel').select('*').order('enviado_em', { ascending: false }),
      supabase.from('whatsapp_mensagens_recebidas').select('*').order('received_at', { ascending: false }),
    ])
    setEnvios(e || [])
    setRecebidas(r || [])
    setLoading(false)
  }

  async function abrirModal() {
    const { data } = await supabase.from('funcionarios').select('id, nome, cargo').eq('ativo', true).is('deleted_at', null).order('nome')
    setFuncionarios(data || [])
    setFormEnvio({ funcionario_id: data?.[0]?.id || '', tipo_documento: 'holerite', mensagem_texto: '', arquivo: null })
    setModalAberto(true)
  }

  async function enviarDocumento() {
    if (!formEnvio.funcionario_id) { toast.error('Selecione o funcionário'); return }
    setEnviando(true)
    try {
      let arquivo_url = null
      if (formEnvio.arquivo) {
        const ext = formEnvio.arquivo.name.split('.').pop()
        const path = `whatsapp/${formEnvio.funcionario_id}/${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from('documentos').upload(path, formEnvio.arquivo)
        if (upErr) throw upErr
        const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(path)
        arquivo_url = urlData.publicUrl
      }

      const { error } = await supabase.from('whatsapp_envios').insert({
        funcionario_id: formEnvio.funcionario_id,
        tipo_documento: formEnvio.tipo_documento,
        mensagem_texto: formEnvio.mensagem_texto || null,
        arquivo_url,
        status: 'pendente',
      })
      if (error) throw error

      toast.success('Documento enviado com sucesso!')
      setModalAberto(false)
      loadData()
    } catch (err: any) {
      toast.error('Erro ao enviar: ' + (err?.message || 'desconhecido'))
    } finally {
      setEnviando(false)
    }
  }

  /* ─── KPIs ─── */
  const hoje = new Date().toISOString().slice(0, 10)
  const enviadosHoje = envios.filter(e => e.enviado_em?.slice(0, 10) === hoje).length
  const confirmados = envios.filter(e => e.status === 'confirmado').length
  const pendentes = envios.filter(e => e.status === 'pendente' || e.status === 'enviado' || e.status === 'entregue').length
  const taxa = envios.length > 0 ? Math.round((confirmados / envios.length) * 100) : 0

  /* ─── filtros envios ─── */
  const enviosFiltrados = useMemo(() => {
    let items = envios
    if (busca) {
      const q = busca.toLowerCase()
      items = items.filter(e => e.funcionario_nome?.toLowerCase().includes(q) || e.nome_destinatario?.toLowerCase().includes(q) || e.numero_telefone?.includes(q))
    }
    if (filtroTipo) items = items.filter(e => e.tipo_documento === filtroTipo)
    if (filtroStatus) items = items.filter(e => e.status === filtroStatus)
    if (filtroData) items = items.filter(e => e.enviado_em?.slice(0, 10) === filtroData)
    return items
  }, [envios, busca, filtroTipo, filtroStatus, filtroData])

  /* ─── filtros recebidas ─── */
  const recebidasFiltradas = useMemo(() => {
    if (!busca) return recebidas
    const q = busca.toLowerCase()
    return recebidas.filter(r => r.conteudo_texto?.toLowerCase().includes(q) || r.numero_telefone?.includes(q))
  }, [recebidas, busca])

  const kpis = [
    { label: 'Enviados hoje', value: enviadosHoje, icon: <Send size={18} />, color: 'text-brand' },
    { label: 'Confirmados', value: confirmados, icon: <CheckCircle2 size={18} />, color: 'text-emerald-600' },
    { label: 'Pendentes', value: pendentes, icon: <Clock size={18} />, color: 'text-amber-600' },
    { label: 'Taxa confirmação', value: `${taxa}%`, icon: <Eye size={18} />, color: 'text-blue-600' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">WhatsApp RH</h1>
          <p className="text-xs text-gray-500 mt-0.5">Envio e acompanhamento de documentos via WhatsApp</p>
        </div>
        <button onClick={abrirModal}
          className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark transition-colors shadow-sm">
          <Plus size={16} /> Enviar documento
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className={k.color}>{k.icon}</span>
              <span className="text-xs text-gray-500 font-medium">{k.label}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        <button onClick={() => setTab('envios')}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${tab === 'envios' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          <span className="flex items-center gap-1.5"><Send size={14} /> Envios</span>
        </button>
        <button onClick={() => setTab('caixa')}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${tab === 'caixa' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          <span className="flex items-center gap-1.5"><Inbox size={14} /> Caixa de entrada {recebidas.length > 0 && <span className="bg-brand text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">{recebidas.length}</span>}</span>
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={busca} onChange={setBusca} placeholder="Buscar funcionário ou telefone..." />
        {tab === 'envios' && (
          <>
            <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
              className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand/20">
              {TIPO_DOC_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
              className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand/20">
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <input type="date" value={filtroData} onChange={e => setFiltroData(e.target.value)}
              className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand/20" />
          </>
        )}
      </div>

      {/* Conteúdo */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand mx-auto" />
          <p className="text-xs text-gray-400 mt-3">Carregando...</p>
        </div>
      ) : tab === 'envios' ? (
        enviosFiltrados.length === 0 ? (
          <EmptyState
            titulo="Nenhum envio encontrado"
            descricao="Envie documentos via WhatsApp para seus funcionários."
            icone={<MessageSquare size={40} />}
          />
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Funcionário</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tipo</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Enviado</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Confirmado</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {enviosFiltrados.map(env => {
                    const badge = STATUS_BADGE[env.status] || STATUS_BADGE.pendente
                    const tipoLabel = TIPO_DOC_OPTIONS.find(t => t.value === env.tipo_documento)?.label || env.tipo_documento || '---'
                    return (
                      <tr key={env.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{env.funcionario_nome || env.nome_destinatario || '---'}</p>
                          {env.funcionario_cargo && <p className="text-xs text-gray-400">{env.funcionario_cargo}</p>}
                          {env.obra_nome && <p className="text-[11px] text-gray-400">{env.obra_nome}</p>}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{tipoLabel}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${badge.color}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{fmtDate(env.enviado_em)}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{fmtDate(env.confirmado_em)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {env.arquivo_url && (
                              <a href={env.arquivo_url} target="_blank" rel="noopener noreferrer"
                                className="text-brand hover:text-brand-dark transition-colors" title="Ver arquivo">
                                <FileText size={16} />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        /* Caixa de entrada */
        recebidasFiltradas.length === 0 ? (
          <EmptyState
            titulo="Nenhuma mensagem recebida"
            descricao="Mensagens enviadas pelos funcionários aparecerão aqui."
            icone={<Inbox size={40} />}
          />
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Telefone</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Mensagem</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Intenção</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Recebido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {recebidasFiltradas.map(msg => {
                    const intBadge = INTENCAO_BADGE[msg.intencao] || INTENCAO_BADGE.outro || { label: msg.intencao || '---', color: 'bg-gray-100 text-gray-600 border-gray-200' }
                    return (
                      <tr key={msg.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3 text-gray-900 font-medium">{msg.numero_telefone || '---'}</td>
                        <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{msg.conteudo_texto || '---'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${intBadge.color}`}>
                            {intBadge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${msg.status === 'atendido' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                            {msg.status === 'atendido' ? 'Atendido' : 'Pendente'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{fmtDate(msg.received_at)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* Modal Enviar Documento */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setModalAberto(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-gray-900">Enviar documento via WhatsApp</h2>
              <button onClick={() => setModalAberto(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Funcionário</label>
                <select value={formEnvio.funcionario_id} onChange={e => setFormEnvio(f => ({ ...f, funcionario_id: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand/20">
                  {funcionarios.map(f => (
                    <option key={f.id} value={f.id}>{f.nome}{f.cargo ? ` — ${f.cargo}` : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo de documento</label>
                <select value={formEnvio.tipo_documento} onChange={e => setFormEnvio(f => ({ ...f, tipo_documento: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand/20">
                  {TIPO_DOC_OPTIONS.filter(t => t.value).map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Mensagem (opcional)</label>
                <textarea value={formEnvio.mensagem_texto} onChange={e => setFormEnvio(f => ({ ...f, mensagem_texto: e.target.value }))}
                  rows={3} placeholder="Mensagem personalizada para o funcionário..."
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 resize-none" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Arquivo</label>
                <label className="flex items-center justify-center gap-2 w-full border-2 border-dashed border-gray-200 rounded-xl px-3 py-4 bg-gray-50 cursor-pointer hover:border-brand/40 transition-colors">
                  <Upload size={18} className="text-gray-400" />
                  <span className="text-sm text-gray-500">
                    {formEnvio.arquivo ? formEnvio.arquivo.name : 'Clique para selecionar arquivo'}
                  </span>
                  <input type="file" className="hidden" onChange={e => {
                    const file = e.target.files?.[0] || null
                    setFormEnvio(f => ({ ...f, arquivo: file }))
                  }} />
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setModalAberto(false)}
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800 transition-colors">
                Cancelar
              </button>
              <button onClick={enviarDocumento} disabled={enviando}
                className="flex items-center gap-2 px-5 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark transition-colors shadow-sm disabled:opacity-50">
                {enviando ? 'Enviando...' : <><Send size={14} /> Enviar</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
