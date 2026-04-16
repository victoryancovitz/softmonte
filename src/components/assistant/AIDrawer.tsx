'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface Props {
  onClose: () => void
}

type ActionBlock = {
  tool: string
  params: Record<string, any>
  descricao: string
}

type NavigationBlock = {
  url: string
  label: string
  descricao?: string | null
}

type Msg = {
  id: string
  role: 'user' | 'assistant'
  content: string
  actions?: ActionBlock[]
  toolStatus?: { name: string; status: 'running' | 'done' | 'error'; error?: string }[]
  files?: { name: string; size: number }[]
  navigations?: NavigationBlock[]
}

const ACCEPTED_EXT = ['.pdf', '.xlsx', '.xls', '.png', '.jpg', '.jpeg']
const MAX_FILE_MB = 10

function fileIcon(name: string): string {
  const lower = name.toLowerCase()
  if (lower.endsWith('.pdf')) return '\uD83D\uDCC4' // 📄
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return '\uD83D\uDCCA' // 📊
  if (/\.(png|jpe?g|gif|webp)$/.test(lower)) return '\uD83D\uDDBC\uFE0F' // 🖼️
  return '\uD83D\uDCCE' // 📎
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const SUGESTOES = [
  { icon: '\uD83D\uDCCA', label: 'Resumo da obra Cesari', prompt: 'Mostre um resumo atualizado da obra Cesari: status, efetivo atual, último BM e margem.' },
  { icon: '\uD83D\uDC77', label: 'Listar funcionários ativos', prompt: 'Liste todos os funcionários ativos com seus cargos.' },
  { icon: '\uD83D\uDCB0', label: 'Qual a margem atual?', prompt: 'Qual é a margem atual das obras ativas? Use vw_dre_obra.' },
  { icon: '\u26A0\uFE0F', label: 'Ver alertas pendentes', prompt: 'Liste os alertas pendentes mais críticos.' },
]

const ACTION_RE = /<action>([\s\S]*?)<\/action>/g

function parseActions(text: string): { clean: string; actions: ActionBlock[] } {
  const actions: ActionBlock[] = []
  const clean = text.replace(ACTION_RE, (_, json) => {
    try {
      const parsed = JSON.parse(String(json).trim())
      if (parsed?.tool && parsed?.descricao) {
        actions.push({
          tool: String(parsed.tool),
          params: parsed.params ?? {},
          descricao: String(parsed.descricao),
        })
      }
    } catch {}
    return ''
  }).trim()
  return { clean, actions }
}

function newId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export default function AIDrawer({ onClose }: Props) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [dragOver, setDragOver] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const clearChat = () => {
    abortRef.current?.abort()
    setMessages([])
    setPendingFiles([])
    setLoading(false)
  }

  const addFiles = (list: FileList | File[]) => {
    const arr = Array.from(list)
    const valid: File[] = []
    const rejected: string[] = []
    for (const f of arr) {
      const lower = f.name.toLowerCase()
      const okExt = ACCEPTED_EXT.some(ext => lower.endsWith(ext))
      const okSize = f.size <= MAX_FILE_MB * 1024 * 1024
      if (!okExt) { rejected.push(`${f.name} (tipo não suportado)`); continue }
      if (!okSize) { rejected.push(`${f.name} (> ${MAX_FILE_MB}MB)`); continue }
      valid.push(f)
    }
    if (rejected.length) {
      alert('Ignorados:\n' + rejected.join('\n'))
    }
    if (valid.length) {
      setPendingFiles(prev => [...prev, ...valid])
    }
  }

  const removePending = (idx: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== idx))
  }

  const send = useCallback(async (text: string, files: File[] = []) => {
    const trimmed = text.trim()
    const hasText = !!trimmed
    const hasFiles = files.length > 0
    if (!hasText && !hasFiles) return
    if (loading) return

    const effectiveText = hasText ? trimmed : 'Analise este documento'
    const userMsg: Msg = {
      id: newId(),
      role: 'user',
      content: effectiveText,
      files: hasFiles ? files.map(f => ({ name: f.name, size: f.size })) : undefined,
    }
    const asstMsg: Msg = { id: newId(), role: 'assistant', content: '', toolStatus: [] }
    setMessages(prev => [...prev, userMsg, asstMsg])
    setInput('')
    setPendingFiles([])
    setLoading(true)

    const ctrl = new AbortController()
    abortRef.current = ctrl

    try {
      const historyForServer = [...messages, userMsg].map(m => ({
        role: m.role,
        content: m.content,
      }))

      let res: Response
      if (hasFiles) {
        const fd = new FormData()
        fd.append('messages', JSON.stringify(historyForServer))
        for (const f of files) fd.append('files', f, f.name)
        res = await fetch('/api/assistant', { method: 'POST', body: fd, signal: ctrl.signal })
      } else {
        res = await fetch('/api/assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: historyForServer }),
          signal: ctrl.signal,
        })
      }

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => 'Erro no servidor.')
        setMessages(prev => prev.map(m =>
          m.id === asstMsg.id ? { ...m, content: errText || 'Erro no servidor.' } : m
        ))
        setLoading(false)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let accumulated = ''

      const flushEvent = (event: string, raw: string) => {
        let data: any = null
        try { data = JSON.parse(raw) } catch { return }
        if (event === 'text' && typeof data?.delta === 'string') {
          accumulated += data.delta
          const { clean, actions } = parseActions(accumulated)
          setMessages(prev => prev.map(m =>
            m.id === asstMsg.id ? { ...m, content: clean, actions } : m
          ))
        } else if (event === 'tool') {
          setMessages(prev => prev.map(m => {
            if (m.id !== asstMsg.id) return m
            const existing = m.toolStatus ?? []
            const idx = existing.findIndex(t => t.name === data.name && t.status === 'running')
            const next = existing.slice()
            if (idx >= 0 && data.status !== 'running') next[idx] = data
            else next.push(data)
            return { ...m, toolStatus: next }
          }))
        } else if (event === 'navigation') {
          setMessages(prev => prev.map(m => {
            if (m.id !== asstMsg.id) return m
            const existing = m.navigations ?? []
            return { ...m, navigations: [...existing, { url: data.url, label: data.label, descricao: data.descricao }] }
          }))
        } else if (event === 'error') {
          setMessages(prev => prev.map(m =>
            m.id === asstMsg.id
              ? { ...m, content: (m.content ? m.content + '\n\n' : '') + `⚠️ ${data?.error ?? 'Erro desconhecido'}` }
              : m
          ))
        }
      }

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''
        for (const part of parts) {
          const lines = part.split('\n')
          let ev = 'message'
          const dataLines: string[] = []
          for (const line of lines) {
            if (line.startsWith('event:')) ev = line.slice(6).trim()
            else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
          }
          if (dataLines.length) flushEvent(ev, dataLines.join('\n'))
        }
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        // silenciado — usuário cancelou
      } else {
        setMessages(prev => prev.map(m =>
          m.id === asstMsg.id ? { ...m, content: 'Erro de conexão com o assistente.' } : m
        ))
      }
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }, [messages, loading])

  const confirmAction = (action: ActionBlock) => {
    const pretty = Object.entries(action.params)
      .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
      .join(', ')
    send(`Confirmado. Execute a ferramenta ${action.tool} com os parâmetros: ${pretty}`)
  }

  const cancelAction = (msgId: string, idx: number) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId || !m.actions) return m
      const next = m.actions.slice()
      next.splice(idx, 1)
      return { ...m, actions: next }
    }))
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
        aria-hidden
      />
      <aside
        className="fixed top-0 left-0 z-50 h-full w-full sm:w-[480px] bg-white shadow-2xl flex flex-col relative"
        role="dialog"
        aria-label="Assistente Softmonte"
        onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true) }}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true) }}
        onDragLeave={(e) => {
          e.preventDefault(); e.stopPropagation()
          // Só desativa se saiu do aside, não se passou entre filhos
          if (e.currentTarget === e.target) setDragOver(false)
        }}
        onDrop={(e) => {
          e.preventDefault(); e.stopPropagation(); setDragOver(false)
          if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files)
        }}
      >
        {dragOver && (
          <div className="absolute inset-0 z-[60] bg-[#00215B]/80 flex items-center justify-center pointer-events-none">
            <div className="text-white text-center">
              <div className="text-5xl mb-2">{'\uD83D\uDCCE'}</div>
              <div className="text-lg font-semibold">Solte para enviar</div>
              <div className="text-xs text-white/70 mt-1">PDF, Excel, PNG ou JPG (máx {MAX_FILE_MB}MB)</div>
            </div>
          </div>
        )}
        <header className="flex-shrink-0 px-4 py-3 border-b border-gray-100 flex items-center justify-between" style={{ backgroundColor: '#00215B' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-lg">{'\u2728'}</div>
            <div className="text-white">
              <div className="font-semibold text-sm">Assistente Softmonte</div>
              <div className="text-[10px] text-white/60">Powered by Claude</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={clearChat}
              title="Limpar conversa"
              className="w-8 h-8 rounded-lg text-white/80 hover:bg-white/10 flex items-center justify-center text-sm"
            >
              {'\uD83D\uDDD1'}
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Fechar"
              className="w-8 h-8 rounded-lg text-white/80 hover:bg-white/10 flex items-center justify-center text-lg"
            >
              {'\u2715'}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-[#F4F6FA]">
          {messages.length === 0 && !loading && (
            <div className="space-y-3">
              <div className="text-sm text-gray-600 leading-relaxed">
                Olá! Sou o Assistente Softmonte. Posso consultar dados em tempo real e executar ações operacionais (cadastros, ponto, faltas) com sua confirmação.
              </div>
              <div className="flex flex-col gap-2">
                {SUGESTOES.map(s => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => send(s.prompt)}
                    className="text-left text-sm px-3 py-2.5 rounded-xl border border-gray-200 bg-white hover:border-[#00215B] hover:bg-[#00215B]/5 transition-all flex items-center gap-2"
                  >
                    <span>{s.icon}</span>
                    <span className="text-gray-700">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(m => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] flex flex-col gap-2 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                {m.files && m.files.length > 0 && (
                  <div className="flex flex-col gap-1">
                    {m.files.map((f, i) => (
                      <div key={i} className="inline-flex items-center gap-2 text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-1.5">
                        <span>{fileIcon(f.name)}</span>
                        <span className="font-medium text-gray-800 truncate max-w-[220px]">{f.name}</span>
                        <span className="text-gray-400">({fmtSize(f.size)})</span>
                      </div>
                    ))}
                  </div>
                )}
                <div
                  className={`px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap rounded-2xl ${
                    m.role === 'user'
                      ? 'text-white rounded-tr-sm'
                      : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                  }`}
                  style={m.role === 'user' ? { backgroundColor: '#00215B' } : undefined}
                >
                  {m.content || (m.role === 'assistant' && loading ? (
                    <TypingDots />
                  ) : '')}
                </div>

                {m.toolStatus && m.toolStatus.length > 0 && (
                  <div className="flex flex-col gap-1 w-full">
                    {m.toolStatus.map((t, i) => (
                      <div key={i} className="text-[11px] text-gray-500 flex items-center gap-2 px-1">
                        <span>
                          {t.status === 'running' ? '\u23F3' : t.status === 'done' ? '\u2713' : '\u26A0\uFE0F'}
                        </span>
                        <span className="font-mono">{t.name}</span>
                        {t.status === 'error' && t.error && (
                          <span className="text-red-500">— {t.error}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {m.navigations && m.navigations.map((n, idx) => (
                  <a
                    key={`nav-${idx}`}
                    href={n.url}
                    onClick={() => { onClose() }}
                    className="w-full border border-blue-200 bg-blue-50 rounded-xl p-3 text-sm hover:bg-blue-100 transition-colors block no-underline"
                  >
                    <div className="flex items-center gap-2 font-semibold text-blue-900">
                      <span>🔗</span>
                      <span>{n.label}</span>
                    </div>
                    {n.descricao && <div className="mt-1 text-xs text-gray-700">{n.descricao}</div>}
                    <div className="mt-2 text-right text-xs font-semibold text-blue-700">Abrir →</div>
                  </a>
                ))}

                {m.actions && m.actions.map((a, idx) => (
                  <div key={idx} className="w-full border border-amber-200 bg-amber-50 rounded-xl p-3 text-sm">
                    <div className="flex items-center gap-2 font-semibold text-amber-900">
                      <span>{'\u26A0\uFE0F'}</span>
                      <span>Confirmar ação</span>
                    </div>
                    <div className="mt-1.5 text-gray-800">{a.descricao}</div>
                    <div className="mt-1 text-[11px] text-gray-500 font-mono">
                      {a.tool}
                    </div>
                    <div className="mt-3 flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => cancelAction(m.id, idx)}
                        className="px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-200"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => { cancelAction(m.id, idx); confirmAction(a) }}
                        className="px-3 py-1.5 rounded-lg text-sm text-white"
                        style={{ backgroundColor: '#00215B' }}
                      >
                        {'\u2713'} Confirmar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {loading && messages.length > 0 && messages[messages.length - 1].role === 'assistant' && !messages[messages.length - 1].content && (
            <div className="flex justify-start">
              <div className="bg-gray-100 px-3.5 py-2.5 rounded-2xl rounded-tl-sm">
                <TypingDots />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <footer className="flex-shrink-0 p-3 border-t border-gray-100 bg-white">
          {pendingFiles.length > 0 && (
            <div className="mb-2 flex flex-col gap-1.5">
              {pendingFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-1.5 text-xs">
                  <span>{fileIcon(f.name)}</span>
                  <span className="font-medium text-gray-800 truncate flex-1">{f.name}</span>
                  <span className="text-gray-400">{fmtSize(f.size)}</span>
                  <button
                    type="button"
                    onClick={() => removePending(i)}
                    className="text-gray-400 hover:text-red-600 px-1"
                    title="Remover"
                  >
                    {'\u2715'}
                  </button>
                </div>
              ))}
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_EXT.join(',')}
            onChange={e => {
              if (e.target.files) addFiles(e.target.files)
              e.target.value = ''
            }}
            className="hidden"
          />
          <div className="flex items-end gap-2 bg-gray-50 border border-gray-200 rounded-xl px-2 py-1.5 focus-within:border-[#00215B] focus-within:ring-2 focus-within:ring-[#00215B]/20">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="w-8 h-8 rounded-lg text-gray-500 hover:bg-gray-200 flex items-center justify-center disabled:opacity-40 flex-shrink-0"
              title="Anexar arquivo (PDF, Excel, imagem)"
            >
              {'\uD83D\uDCCE'}
            </button>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send(input, pendingFiles)
                }
              }}
              placeholder={pendingFiles.length > 0 ? 'Mensagem opcional...' : 'Pergunte algo ou peça uma ação...'}
              rows={1}
              disabled={loading}
              className="flex-1 bg-transparent text-sm outline-none resize-none placeholder-gray-400 leading-relaxed py-1.5"
              style={{ maxHeight: 120 }}
            />
            <button
              type="button"
              onClick={() => send(input, pendingFiles)}
              disabled={(!input.trim() && pendingFiles.length === 0) || loading}
              className="w-8 h-8 rounded-lg text-white flex items-center justify-center disabled:opacity-40 flex-shrink-0"
              style={{ backgroundColor: '#00215B' }}
              title="Enviar"
            >
              {'\u2192'}
            </button>
          </div>
          <p className="text-center text-[10px] text-gray-400 mt-2">
            Enter envia · Shift+Enter nova linha
          </p>
        </footer>
      </aside>
    </>
  )
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  )
}
