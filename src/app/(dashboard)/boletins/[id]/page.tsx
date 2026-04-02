'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ConfirmButton from '@/components/ConfirmButton'

const STATUS_BADGE: Record<string, string> = {
  aberto: 'bg-blue-100 text-blue-700',
  fechado: 'bg-gray-100 text-gray-600',
  enviado: 'bg-amber-100 text-amber-700',
  aprovado: 'bg-green-100 text-green-700',
}
const TIPO_DIA_LABEL: Record<string, string> = {
  util: 'Úteis', sabado: 'Sábados', domingo_feriado: 'Dom/Fer'
}

export default function BMDetailPage({ params }: { params: { id: string } }) {
  const [bm, setBm] = useState<any>(null)
  const [resumo, setResumo] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [envioEmails, setEnvioEmails] = useState('')
  const [envioObs, setEnvioObs] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [revisaoTexto, setRevisaoTexto] = useState('')
  const [valorBM, setValorBM] = useState('')
  const [showCriarReceita, setShowCriarReceita] = useState(false)
  const [clienteData, setClienteData] = useState<any>(null)
  const [mailtoAberto, setMailtoAberto] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  const STATUS_ORDER = ['aberto','fechado','enviado','aprovado']

  useEffect(() => {
    loadBM()
  }, [params.id])

  async function loadBM() {
    const { data: bmData } = await supabase.from('boletins_medicao')
      .select('*, obras(id,nome,cliente,local)')
      .eq('id', params.id).single()
    setBm(bmData)

    if (bmData) {
      const { data: efetivo } = await supabase.from('efetivo_diario')
        .select('funcionario_id, data, tipo_dia, funcionarios(nome, cargo)')
        .eq('obra_id', bmData.obras.id)
        .gte('data', bmData.data_inicio)
        .lte('data', bmData.data_fim)
        .order('data')

      // Aggregate by cargo + tipo_dia
      const agg: Record<string, Record<string, Set<string>>> = {}
      ;(efetivo ?? []).forEach((e: any) => {
        const cargo = e.funcionarios?.cargo ?? 'OUTROS'
        if (!agg[cargo]) agg[cargo] = { util: new Set(), sabado: new Set(), domingo_feriado: new Set() }
        agg[cargo][e.tipo_dia].add(e.data)
      })

      const rows = Object.entries(agg).map(([cargo, dias]) => ({
        cargo,
        dias_util: dias.util.size,
        dias_sabado: dias.sabado.size,
        dias_domingo: dias.domingo_feriado.size,
        total_dias: dias.util.size + dias.sabado.size + dias.domingo_feriado.size
      })).sort((a, b) => a.cargo.localeCompare(b.cargo))

      setResumo(rows)

      // Fetch client contacts
      if (bmData.obras?.cliente) {
        const { data: cliente } = await supabase.from('clientes')
          .select('email_principal,email_medicao,email_fiscal,contatos')
          .ilike('nome', bmData.obras.cliente)
          .limit(1)
          .single()
        if (cliente) {
          setClienteData(cliente)
          // Pre-populate envioEmails if empty
          if (!envioEmails) {
            const mainEmail = cliente.email_medicao || cliente.email_principal || ''
            setEnvioEmails(mainEmail)
          }
        }
      }
    }
    setLoading(false)
  }

  async function updateStatus(status: string) {
    await supabase.from('boletins_medicao').update({ status }).eq('id', params.id)
    setBm((prev: any) => ({ ...prev, status }))
  }

  async function exportExcel() {
    setExporting(true)
    try {
      const response = await fetch('/api/boletins/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bm_id: params.id })
      })
      if (response.ok) {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `BM${String(bm.numero).padStart(2,'0')}_${bm.obras.nome.replace(/\s/g,'_')}.xlsx`
        a.click()
      }
    } catch (e) {
      console.error(e)
    }
    setExporting(false)
  }

  function handleAbrirMailto() {
    const emails = envioEmails.split(',').map(e => e.trim()).filter(Boolean)
    if (emails.length === 0) return

    const toEmail = emails[0]
    const ccEmails = emails.slice(1)

    // Build extra CC from client contacts
    const contatoEmails: string[] = []
    if (clienteData?.contatos) {
      (clienteData.contatos as any[]).forEach((c: any) => {
        if (c.email && !emails.includes(c.email)) contatoEmails.push(c.email)
      })
    }
    const allCc = [...ccEmails, ...contatoEmails]

    const mesInicio = new Date(bm.data_inicio + 'T12:00:00')
    const mesFim = new Date(bm.data_fim + 'T12:00:00')
    const periodo = `${mesInicio.toLocaleDateString('pt-BR')} a ${mesFim.toLocaleDateString('pt-BR')}`

    const subject = encodeURIComponent(
      `BM ${String(bm.numero).padStart(2,'0')} - ${bm.obras.nome} - ${periodo}`
    )

    const body = encodeURIComponent(
      `Prezados,\n\n` +
      `Segue em anexo o Boletim de Medição Nº ${String(bm.numero).padStart(2,'0')} referente à obra ${bm.obras.nome}, ` +
      `período de ${periodo}.\n\n` +
      `Total de pessoas-dia: ${totalDias}\n` +
      (envioObs ? `Observação: ${envioObs}\n\n` : '\n') +
      `Ficamos à disposição para quaisquer esclarecimentos.\n\n` +
      `Atenciosamente,\n` +
      `Tecnomonte Montagens Industriais`
    )

    const mailtoLink = `mailto:${toEmail}` +
      (allCc.length > 0 ? `?cc=${allCc.join(',')}` : '?') +
      `${allCc.length > 0 ? '&' : ''}subject=${subject}&body=${body}`

    window.open(mailtoLink, '_blank')

    // Log that mailto was opened
    supabase.from('email_logs').insert({
      tipo: 'envio_bm',
      destinatarios: emails,
      assunto: `BM ${String(bm.numero).padStart(2,'0')} - ${bm.obras.nome}`,
      status: 'mailto_aberto',
    }).catch(() => {})

    setMailtoAberto(true)
  }

  async function handleConfirmarEnvio() {
    setEnviando(true)
    const emails = envioEmails.split(',').map(e => e.trim()).filter(Boolean)
    await supabase.from('boletins_medicao').update({
      status: 'enviado',
      enviado_para: emails,
      enviado_em: new Date().toISOString(),
      observacao_envio: envioObs || null,
    }).eq('id', params.id)
    await supabase.from('email_logs').insert({
      tipo: 'envio_bm',
      destinatarios: emails,
      assunto: `BM ${String(bm.numero).padStart(2,'0')} - ${bm.obras.nome}`,
      status: 'enviado',
    }).catch(() => {})
    await loadBM()
    setEnviando(false)
    setMailtoAberto(false)
    setEnvioEmails('')
    setEnvioObs('')
  }

  async function handleRevisao() {
    const revisoes = [...(bm.revisoes_solicitadas || []), {
      data: new Date().toISOString(),
      descricao: revisaoTexto,
    }]
    await supabase.from('boletins_medicao').update({
      status: 'fechado',
      revisoes_solicitadas: revisoes,
    }).eq('id', params.id)
    await loadBM()
    setRevisaoTexto('')
  }

  async function handleAprovar() {
    const valor = parseFloat(valorBM)
    await supabase.from('boletins_medicao').update({
      status: 'aprovado',
      aprovado_em: new Date().toISOString(),
      valor_aprovado: valor || null,
    }).eq('id', params.id)
    // Create financial entry if valor provided
    if (valor > 0) {
      await supabase.from('financeiro_lancamentos').insert({
        obra_id: bm.obras.id,
        tipo: 'receita',
        nome: `BM ${String(bm.numero).padStart(2,'0')} — ${bm.obras.nome}`,
        categoria: 'Receita HH Homem-Hora',
        valor: valor,
        status: 'em_aberto',
        data_competencia: bm.data_fim,
        origem: 'bm_aprovado',
      })
    }
    await loadBM()
    setShowCriarReceita(false)
  }

  async function handleAprovarSemReceita() {
    await supabase.from('boletins_medicao').update({
      status: 'aprovado',
      aprovado_em: new Date().toISOString(),
    }).eq('id', params.id)
    await loadBM()
    setShowCriarReceita(false)
  }

  function buildHistorico() {
    const items: {data: string; texto: string; color: string; ts: number}[] = []
    if (bm.created_at) items.push({
      data: new Date(bm.created_at).toLocaleString('pt-BR'),
      texto: 'Boletim criado',
      color: 'bg-blue-500',
      ts: new Date(bm.created_at).getTime(),
    })
    if (bm.enviado_em) items.push({
      data: new Date(bm.enviado_em).toLocaleString('pt-BR'),
      texto: `Enviado para ${(bm.enviado_para || []).join(', ')}${bm.observacao_envio ? ` — ${bm.observacao_envio}` : ''}`,
      color: 'bg-amber-500',
      ts: new Date(bm.enviado_em).getTime(),
    })
    if (bm.revisoes_solicitadas) {
      bm.revisoes_solicitadas.forEach((r: any) => {
        items.push({
          data: new Date(r.data).toLocaleString('pt-BR'),
          texto: `Revisão solicitada: "${r.descricao}"`,
          color: 'bg-red-500',
          ts: new Date(r.data).getTime(),
        })
      })
    }
    if (bm.aprovado_em) items.push({
      data: new Date(bm.aprovado_em).toLocaleString('pt-BR'),
      texto: `Aprovado${bm.valor_aprovado ? ` — Receita de R$ ${Number(bm.valor_aprovado).toLocaleString('pt-BR', {minimumFractionDigits: 2})} criada` : ''}`,
      color: 'bg-green-500',
      ts: new Date(bm.aprovado_em).getTime(),
    })
    return items.sort((a, b) => a.ts - b.ts)
  }

  if (loading) return <div className="p-6 text-sm text-gray-400">Carregando...</div>
  if (!bm) return <div className="p-6 text-sm text-red-500">Boletim não encontrado.</div>

  const totalDias = resumo.reduce((s, r) => s + r.total_dias, 0)
  const dias = Math.ceil((new Date(bm.data_fim).getTime() - new Date(bm.data_inicio).getTime()) / 86400000) + 1

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/boletins" className="text-gray-400 hover:text-gray-600 text-sm">Boletins</Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-medium">BM {String(bm.numero).padStart(2,'0')} — {bm.obras.nome}</span>
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-semibold font-display">
                BM {String(bm.numero).padStart(2,'0')} — {bm.obras.nome}
              </h1>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_BADGE[bm.status]}`}>
                {bm.status}
              </span>
            </div>
            <p className="text-sm text-gray-500">{bm.obras.cliente} · {bm.obras.local}</p>
            <p className="text-sm text-gray-400 mt-1">
              {new Date(bm.data_inicio + 'T12:00:00').toLocaleDateString('pt-BR')} até {new Date(bm.data_fim + 'T12:00:00').toLocaleDateString('pt-BR')} · {dias} dias
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={exportExcel} disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-green-600">
                <rect x="1" y="1" width="14" height="14" rx="2" opacity=".2"/>
                <path d="M8 10V4M5 7l3 3 3-3M4 12h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
              </svg>
              {exporting ? 'Exportando...' : 'Exportar CSV'}
            </button>
            {bm.status === 'aberto' && (
              <>
                <button onClick={() => updateStatus('fechado')}
                  className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark">
                  Fechar BM
                </button>
                <ConfirmButton label="Excluir BM"
                  confirmLabel="Esta ação não pode ser desfeita. Confirmar?"
                  className="px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50"
                  confirmClassName="text-xs px-3 py-1.5 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700"
                  onConfirm={async () => {
                    await supabase.from('boletins_medicao').delete().eq('id', params.id)
                    router.push('/boletins')
                  }} />
              </>
            )}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Total pessoas-dia', value: totalDias },
          { label: 'Dias úteis', value: resumo.reduce((s, r) => s + r.dias_util, 0) },
          { label: 'Sábados', value: resumo.reduce((s, r) => s + r.dias_sabado, 0) },
          { label: 'Dom/Feriado', value: resumo.reduce((s, r) => s + r.dias_domingo, 0) },
        ].map(k => (
          <div key={k.label} className="bg-gray-100 rounded-xl p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{k.label}</div>
            <div className="text-2xl font-semibold">{k.value}</div>
          </div>
        ))}
      </div>

      {/* Resumo por função */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-5">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Resumo por Função</h2>
          <span className="text-xs text-gray-400">Carga horária: 07:00 às 17:00</span>
        </div>
        {resumo.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Função</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Dias Úteis</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Sábados</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Dom/Fer</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Total</th>
              </tr>
            </thead>
            <tbody>
              {resumo.map(r => (
                <tr key={r.cargo} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium">{r.cargo}</td>
                  <td className="px-4 py-3 text-center">{r.dias_util}</td>
                  <td className="px-4 py-3 text-center text-amber-600 font-medium">{r.dias_sabado || '-'}</td>
                  <td className="px-4 py-3 text-center text-red-600 font-medium">{r.dias_domingo || '-'}</td>
                  <td className="px-4 py-3 text-center font-semibold text-brand">{r.total_dias}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-gray-200 bg-gray-50">
                <td className="px-5 py-3 font-bold text-xs uppercase tracking-wide text-gray-600">Total</td>
                <td className="px-4 py-3 text-center font-bold">{resumo.reduce((s, r) => s + r.dias_util, 0)}</td>
                <td className="px-4 py-3 text-center font-bold text-amber-600">{resumo.reduce((s, r) => s + r.dias_sabado, 0) || '-'}</td>
                <td className="px-4 py-3 text-center font-bold text-red-600">{resumo.reduce((s, r) => s + r.dias_domingo, 0) || '-'}</td>
                <td className="px-4 py-3 text-center font-bold text-brand">{totalDias}</td>
              </tr>
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center text-gray-400 text-sm">
            Nenhum efetivo registrado para este período ainda.<br/>
            <Link href="/efetivo" className="text-brand hover:underline mt-1 inline-block">
              Registrar efetivo diário →
            </Link>
          </div>
        )}
      </div>

      {/* Timeline de Status */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <h2 className="text-sm font-semibold mb-4">Acompanhamento</h2>
        <div className="flex items-center gap-0">
          {(['aberto','fechado','enviado','aprovado'] as const).map((s, i) => {
            const reached = STATUS_ORDER.indexOf(bm.status) >= i
            const isCurrent = bm.status === s
            const LABELS: Record<string,string> = { aberto:'Aberto', fechado:'Fechado', enviado:'Enviado', aprovado:'Aprovado' }
            // Timestamps from bm fields
            const timestamps: Record<string,string|null> = {
              aberto: bm.created_at,
              fechado: null, // we don't track this separately
              enviado: bm.enviado_em,
              aprovado: bm.aprovado_em,
            }
            return (
              <div key={s} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                    reached ? 'bg-brand text-white border-brand' : 'bg-white text-gray-300 border-gray-200'
                  } ${isCurrent ? 'ring-4 ring-brand/20' : ''}`}>
                    {reached ? '✓' : i + 1}
                  </div>
                  <div className={`text-[10px] mt-1 font-semibold ${reached ? 'text-brand' : 'text-gray-300'}`}>{LABELS[s]}</div>
                  {timestamps[s] && (
                    <div className="text-[9px] text-gray-400">{new Date(timestamps[s]!).toLocaleDateString('pt-BR')}</div>
                  )}
                </div>
                {i < 3 && <div className={`flex-1 h-0.5 mx-2 ${reached && STATUS_ORDER.indexOf(bm.status) > i ? 'bg-brand' : 'bg-gray-200'}`} />}
              </div>
            )
          })}
        </div>
      </div>

      {/* Envio ao Cliente */}
      {bm.status === 'fechado' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
          <h2 className="text-sm font-semibold mb-4">Envio ao Cliente</h2>

          {/* Contatos do cliente detectados */}
          {clienteData && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
              <span className="font-semibold">Contatos encontrados:</span>{' '}
              {clienteData.email_medicao && <span className="inline-block bg-blue-100 px-2 py-0.5 rounded mr-1">{clienteData.email_medicao} (medição)</span>}
              {clienteData.email_principal && clienteData.email_principal !== clienteData.email_medicao && (
                <span className="inline-block bg-blue-100 px-2 py-0.5 rounded mr-1">{clienteData.email_principal} (principal)</span>
              )}
              {(clienteData.contatos as any[])?.map((c: any, i: number) => (
                c.email && <span key={i} className="inline-block bg-blue-100 px-2 py-0.5 rounded mr-1">{c.email} ({c.funcao || c.nome})</span>
              ))}
            </div>
          )}

          {!mailtoAberto ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Enviar para (emails separados por vírgula)</label>
                <input type="text" value={envioEmails} onChange={e => setEnvioEmails(e.target.value)}
                  placeholder="email@cliente.com, medicao@cliente.com"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Observação / Número NF (opcional)</label>
                <input type="text" value={envioObs} onChange={e => setEnvioObs(e.target.value)}
                  placeholder="NF 12345 ou observação"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
              <button onClick={handleAbrirMailto} disabled={!envioEmails.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-all">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="10" rx="2" stroke="white" strokeWidth="1.3"/><path d="M1 5l7 4 7-4" stroke="white" strokeWidth="1.3" strokeLinejoin="round"/></svg>
                Enviar BM por Email
              </button>
            </div>
          ) : (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
              <div className="flex items-center gap-2">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-amber-600 flex-shrink-0">
                  <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M10 6v5M10 13v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <p className="text-sm text-amber-800 font-medium">Email aberto no seu cliente de email!</p>
              </div>
              <p className="text-xs text-amber-700">Após enviar o email, confirme abaixo para registrar o envio no sistema.</p>
              <div className="flex gap-2">
                <button onClick={handleConfirmarEnvio} disabled={enviando}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-all">
                  {enviando ? 'Confirmando...' : '✓ Confirmar envio'}
                </button>
                <button onClick={handleAbrirMailto}
                  className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-all">
                  Reabrir email
                </button>
                <button onClick={() => setMailtoAberto(false)}
                  className="px-4 py-2 text-gray-400 text-sm hover:text-gray-600 transition-all">
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Retorno do Cliente */}
      {bm.status === 'enviado' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
          <h2 className="text-sm font-semibold mb-4">Retorno do Cliente</h2>

          {!showCriarReceita ? (
            <div className="flex gap-3">
              <button onClick={() => setShowCriarReceita(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                ✓ Aprovar BM
              </button>
              <div className="flex-1">
                <div className="flex gap-2">
                  <input type="text" value={revisaoTexto} onChange={e => setRevisaoTexto(e.target.value)}
                    placeholder="Motivo da revisão solicitada pelo cliente..."
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
                  <button onClick={handleRevisao} disabled={!revisaoTexto.trim()}
                    className="px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50 whitespace-nowrap">
                    ✗ Revisão
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 p-4 bg-green-50 rounded-xl border border-green-200">
              <p className="text-sm text-green-800 font-medium">Aprovar BM e criar receita financeira?</p>
              <div>
                <label className="block text-xs font-semibold text-green-700 mb-1">Valor do BM (R$)</label>
                <input type="number" step="0.01" value={valorBM} onChange={e => setValorBM(e.target.value)}
                  placeholder="0,00"
                  className="w-48 px-3 py-2 border border-green-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div className="flex gap-2">
                <button onClick={handleAprovar}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                  Confirmar Aprovação
                </button>
                <button onClick={handleAprovarSemReceita}
                  className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50">
                  Aprovar sem receita
                </button>
                <button onClick={() => setShowCriarReceita(false)}
                  className="px-4 py-2 text-gray-400 text-sm hover:text-gray-600">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Revisões anteriores */}
          {bm.revisoes_solicitadas && bm.revisoes_solicitadas.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 mb-2">Revisões solicitadas:</p>
              {bm.revisoes_solicitadas.map((r: any, i: number) => (
                <div key={i} className="text-xs text-gray-600 py-1 border-b border-gray-50 last:border-0">
                  <span className="text-gray-400">{new Date(r.data).toLocaleDateString('pt-BR')}</span> — {r.descricao}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Histórico */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold mb-4">Histórico</h2>
        <div className="space-y-2">
          {buildHistorico().map((h, i) => (
            <div key={i} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
              <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${h.color}`} />
              <div>
                <div className="text-xs text-gray-400">{h.data}</div>
                <div className="text-sm text-gray-700">{h.texto}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
