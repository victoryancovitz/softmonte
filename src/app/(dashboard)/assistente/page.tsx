'use client'
import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  fileName?: string
}

const SUGESTOES = [
  'Mostre um resumo da obra Cesari',
  'Quais funcionários têm contrato vencendo?',
  'Qual é o resultado financeiro atual?',
  'Quantas horas foram registradas no último BM?',
  'Me dê um relatório de efetivo da semana',
]

export default function AssistentePage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Olá! Sou o Assistente Softmonte, desenvolvido com inteligência artificial para te ajudar a gerenciar as obras da Tecnomonte.\n\nPosso consultar dados em tempo real, analisar documentos que você enviar e responder perguntas sobre funcionários, HH, financeiro e muito mais.\n\nComo posso ajudar?',
      timestamp: new Date(),
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [context, setContext] = useState<string>('')
  const fileRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Carrega contexto do banco ao iniciar
  useEffect(() => {
    loadContext()
  }, [])

  async function loadContext() {
    const [obras, funcs, bms, fin] = await Promise.all([
      supabase.from('obras').select('nome, cliente, local, status').eq('status', 'ativo'),
      supabase.from('funcionarios').select('nome, cargo, status, prazo1, prazo2').order('nome'),
      supabase.from('boletins_medicao').select('numero, status, data_inicio, data_fim, obras(nome)').order('created_at', { ascending: false }).limit(5),
      supabase.from('financeiro_lancamentos').select('tipo, categoria, valor, status, data_competencia').order('data_competencia', { ascending: false }).limit(20),
    ])

    const ctx = `
CONTEXTO ATUAL DO SOFTMONTE — TECNOMONTE (atualizado em ${new Date().toLocaleString('pt-BR')}):

OBRAS ATIVAS (${obras.data?.length ?? 0}):
${obras.data?.map(o => `- ${o.nome} | Cliente: ${o.cliente} | Local: ${o.local}`).join('\n') ?? 'Nenhuma'}

FUNCIONÁRIOS (${funcs.data?.length ?? 0} total):
${funcs.data?.map(f => {
  const p1 = f.prazo1 ? new Date(f.prazo1+'T12:00') : null
  const dias = p1 ? Math.ceil((p1.getTime() - Date.now()) / 86400000) : null
  const alerta = dias !== null && dias <= 30 && dias >= 0 ? ` ⚠️ CONTRATO VENCE EM ${dias} DIAS` : ''
  return `- ${f.nome} | ${f.cargo} | Status: ${f.status}${alerta}`
}).join('\n') ?? 'Nenhum'}

ÚLTIMOS BOLETINS DE MEDIÇÃO:
${bms.data?.map((b: any) => `- BM${String(b.numero).padStart(2,'0')} | ${b.obras?.nome} | ${b.status} | ${b.data_inicio} a ${b.data_fim}`).join('\n') ?? 'Nenhum'}

FINANCEIRO (últimos lançamentos):
Receitas pagas: R$ ${fin.data?.filter(f => f.tipo === 'receita' && f.status === 'pago').reduce((s, f) => s + Number(f.valor), 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
Despesas pagas: R$ ${fin.data?.filter(f => f.tipo === 'despesa' && f.status === 'pago').reduce((s, f) => s + Number(f.valor), 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
Provisões futuras: R$ ${fin.data?.filter(f => f.tipo === 'despesa' && f.status === 'em_aberto').reduce((s, f) => s + Number(f.valor), 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
    `.trim()

    setContext(ctx)
  }

  async function sendMessage(text?: string) {
    const userText = text ?? input.trim()
    if (!userText || loading) return
    setInput('')

    const userMsg: Message = { role: 'user', content: userText, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }))

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: `Você é o Assistente Softmonte, IA interna da Tecnomonte — empresa especializada em fabricação, montagem e manutenção industrial.

Você tem acesso ao contexto em tempo real do sistema:
${context}

Instruções:
- Responda sempre em português brasileiro
- Seja direto e objetivo, use dados reais do contexto quando disponível  
- Ao mencionar valores financeiros, sempre formate como R$ X.XXX,XX
- Ao mencionar datas, use o formato DD/MM/AAAA
- Se algum dado não estiver no contexto, diga que precisa verificar no sistema
- Use emojis com moderação para melhorar a leitura
- Formate listas com bullets quando houver múltiplos itens
- Quando houver alertas importantes (contratos vencendo, etc.), destaque com ⚠️`,
          messages: [...history, { role: 'user', content: userText }],
        }),
      })

      const data = await response.json()
      const reply = data.content?.[0]?.text ?? 'Não consegui processar sua pergunta. Tente novamente.'

      setMessages(prev => [...prev, { role: 'assistant', content: reply, timestamp: new Date() }])
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Erro ao conectar com a IA. Verifique sua conexão e tente novamente.',
        timestamp: new Date()
      }])
    }
    setLoading(false)
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const userMsg: Message = {
      role: 'user',
      content: `Analisei o arquivo: **${file.name}**`,
      fileName: file.name,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    // Read file content
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const fileContent = ev.target?.result as string

      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1000,
            system: `Você é o Assistente Softmonte da Tecnomonte. Analise o conteúdo do arquivo enviado e forneça insights úteis para a gestão de obras e HH. Responda em português.

Contexto do sistema:
${context}`,
            messages: [{
              role: 'user',
              content: `Analise este arquivo "${file.name}" e me dê um resumo com os principais insights para a gestão da Tecnomonte:\n\n${fileContent.slice(0, 5000)}`
            }],
          }),
        })

        const data = await response.json()
        const reply = data.content?.[0]?.text ?? 'Não consegui analisar o arquivo.'
        setMessages(prev => [...prev, { role: 'assistant', content: reply, timestamp: new Date() }])
      } catch {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Erro ao analisar o arquivo.', timestamp: new Date() }])
      }
      setLoading(false)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function formatMsg(text: string) {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('**') && line.endsWith('**')) {
        return <p key={i} className="font-semibold">{line.slice(2, -2)}</p>
      }
      if (line.startsWith('- ') || line.startsWith('• ')) {
        return <p key={i} className="flex gap-2"><span className="text-brand-gold mt-0.5">•</span><span>{line.slice(2)}</span></p>
      }
      if (line.trim() === '') return <div key={i} className="h-2" />
      return <p key={i}>{line}</p>
    })
  }

  return (
    <div className="flex flex-col h-screen max-h-screen">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 bg-white border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" fill="white"/>
            </svg>
          </div>
          <div>
            <div className="font-display font-bold text-brand text-base">Assistente Softmonte</div>
            <div className="text-xs text-gray-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block"/>
              Dados atualizados em tempo real
            </div>
          </div>
        </div>
        <button onClick={loadContext} title="Atualizar contexto"
          className="text-xs text-gray-400 hover:text-brand px-3 py-1.5 rounded-lg hover:bg-brand-light transition-colors">
          ↻ Atualizar dados
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${
              m.role === 'assistant'
                ? 'bg-brand text-white'
                : 'bg-brand-gold text-white'
            }`}>
              {m.role === 'assistant' ? 'AI' : 'V'}
            </div>
            <div className={`max-w-[75%] ${m.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
              {m.fileName && (
                <div className="text-xs bg-blue-50 border border-blue-100 text-blue-700 px-3 py-1.5 rounded-lg flex items-center gap-2">
                  📎 {m.fileName}
                </div>
              )}
              <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                m.role === 'assistant'
                  ? 'bg-white border border-gray-100 text-gray-800 shadow-sm rounded-tl-sm'
                  : 'bg-brand text-white rounded-tr-sm'
              }`}>
                <div className="space-y-1">{formatMsg(m.content)}</div>
              </div>
              <div className="text-[10px] text-gray-400 px-1">
                {m.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-brand text-white flex items-center justify-center text-xs font-bold flex-shrink-0">AI</div>
            <div className="bg-white border border-gray-100 shadow-sm rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
              {[0,1,2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-brand animate-bounce" style={{ animationDelay: `${i * 0.15}s` }}/>
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {messages.length < 3 && (
        <div className="flex-shrink-0 px-6 pb-2">
          <p className="text-xs text-gray-400 mb-2">Sugestões:</p>
          <div className="flex flex-wrap gap-2">
            {SUGESTOES.map(s => (
              <button key={s} onClick={() => sendMessage(s)}
                className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:bg-brand hover:text-white hover:border-brand transition-all">
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="flex-shrink-0 px-6 py-4 bg-white border-t border-gray-100">
        <div className="flex items-end gap-2 bg-gray-50 rounded-2xl border border-gray-200 px-4 py-3 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 transition-all">
          <button onClick={() => fileRef.current?.click()}
            title="Enviar arquivo" className="text-gray-400 hover:text-brand transition-colors flex-shrink-0 mb-0.5">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
            </svg>
          </button>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
            placeholder="Pergunte sobre obras, funcionários, financeiro, HH... (Enter para enviar)"
            rows={1}
            className="flex-1 bg-transparent text-sm text-gray-800 resize-none outline-none placeholder-gray-400 leading-relaxed"
            style={{ maxHeight: 120 }}
          />
          <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
            className="w-8 h-8 rounded-xl bg-brand text-white flex items-center justify-center hover:bg-brand-dark disabled:opacity-40 transition-all flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M22 2L11 13M22 2L15 22 11 13 2 9l20-7z"/>
            </svg>
          </button>
        </div>
        <input ref={fileRef} type="file" accept=".txt,.csv,.json,.xlsx,.pdf" onChange={handleFile} className="hidden" />
        <p className="text-center text-[10px] text-gray-300 mt-2">Powered by Claude · Dados em tempo real do Softmonte</p>
      </div>
    </div>
  )
}
