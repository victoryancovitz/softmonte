import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import * as XLSX from 'xlsx'
import { requireRoleApi } from '@/lib/require-role'
import { rateLimit } from '@/lib/rate-limit'
import { createClient } from '@/lib/supabase-server'
import { buildSystemContext } from '@/lib/assistant/context'
import { ASSISTANT_TOOLS, executeTool } from '@/lib/assistant/tools'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 2048
const MAX_ITERATIONS = 8
const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10MB

type ClientMessage = {
  role: 'user' | 'assistant'
  content: string
}

type AttachmentBlock =
  | { type: 'document'; source: { type: 'base64'; media_type: string; data: string } }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | { type: 'text'; text: string }

async function fileToBlock(file: File): Promise<AttachmentBlock | null> {
  if (file.size > MAX_FILE_BYTES) return null
  const buf = Buffer.from(await file.arrayBuffer())
  const name = file.name || 'arquivo'
  const type = (file.type || '').toLowerCase()

  // Excel → converter para texto
  if (
    type.includes('spreadsheet') ||
    type.includes('excel') ||
    name.toLowerCase().endsWith('.xlsx') ||
    name.toLowerCase().endsWith('.xls')
  ) {
    try {
      const wb = XLSX.read(buf, { type: 'buffer' })
      const partes: string[] = [`[Arquivo Excel: ${name}]`]
      for (const sheetName of wb.SheetNames) {
        const sheet = wb.Sheets[sheetName]
        const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false })
        partes.push(`\n--- Aba: ${sheetName} ---\n${csv}`)
      }
      return { type: 'text', text: partes.join('\n') }
    } catch (e: any) {
      return { type: 'text', text: `[Falha ao ler Excel ${name}: ${e?.message ?? 'erro'}]` }
    }
  }

  // PDF
  if (type === 'application/pdf' || name.toLowerCase().endsWith('.pdf')) {
    return {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: buf.toString('base64') },
    }
  }

  // Imagens
  if (type.startsWith('image/')) {
    const media =
      type === 'image/jpg' ? 'image/jpeg' :
      (['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(type) ? type : 'image/jpeg')
    return {
      type: 'image',
      source: { type: 'base64', media_type: media, data: buf.toString('base64') },
    }
  }

  // Fallback: texto
  try {
    const text = buf.toString('utf-8')
    return { type: 'text', text: `[Arquivo: ${name}]\n${text.slice(0, 100_000)}` }
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const authErr = await requireRoleApi([
    'admin', 'financeiro', 'rh', 'encarregado', 'engenheiro', 'diretoria',
    'almoxarife', 'gestor', 'funcionario',
  ])
  if (authErr) return authErr

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const rl = rateLimit(`assistant:${user?.id ?? 'anon'}`, { limit: 15, windowMs: 60_000 })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Muitas requisições. Aguarde ${Math.ceil((rl.resetAt - Date.now()) / 1000)}s.` },
      { status: 429 },
    )
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY não configurada no servidor.' },
      { status: 500 },
    )
  }

  let history: ClientMessage[] = []
  let attachments: AttachmentBlock[] = []

  const ct = req.headers.get('content-type') ?? ''
  if (ct.includes('multipart/form-data')) {
    try {
      const form = await req.formData()
      const messagesJson = form.get('messages')
      if (typeof messagesJson === 'string') {
        const parsed = JSON.parse(messagesJson)
        if (Array.isArray(parsed)) history = parsed
      }
      const files = form.getAll('files').filter((f): f is File => f instanceof File)
      for (const f of files) {
        const block = await fileToBlock(f)
        if (block) attachments.push(block)
      }
    } catch (e: any) {
      return NextResponse.json({ error: 'FormData inválido: ' + (e?.message ?? '') }, { status: 400 })
    }
  } else {
    try {
      const body = await req.json()
      if (Array.isArray(body?.messages)) history = body.messages
    } catch {
      return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
    }
  }

  if (history.length === 0) {
    return NextResponse.json({ error: 'Envie ao menos uma mensagem.' }, { status: 400 })
  }

  const client = new Anthropic({ apiKey })
  const system = await buildSystemContext()

  const convo: Anthropic.MessageParam[] = history.map(m => ({
    role: m.role,
    content: m.content,
  }))

  // Se houver anexos, injetar no último turno do usuário como content blocks
  if (attachments.length > 0) {
    const last = convo[convo.length - 1]
    if (last?.role === 'user') {
      const textBlock = typeof last.content === 'string' && last.content.trim()
        ? last.content.trim()
        : 'Analise este documento.'
      last.content = [
        ...attachments,
        { type: 'text', text: textBlock },
      ] as any
    }
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: any) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        )
      }

      try {
        for (let i = 0; i < MAX_ITERATIONS; i++) {
          const messageStream = client.messages.stream({
            model: MODEL,
            max_tokens: MAX_TOKENS,
            system,
            tools: ASSISTANT_TOOLS,
            messages: convo,
          })

          messageStream.on('text', (delta) => {
            send('text', { delta })
          })

          const final = await messageStream.finalMessage()
          convo.push({ role: 'assistant', content: final.content })

          if (final.stop_reason !== 'tool_use') {
            send('done', { stop_reason: final.stop_reason })
            controller.close()
            return
          }

          const toolUses = final.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
          )
          const toolResults: Anthropic.ToolResultBlockParam[] = []
          for (const tu of toolUses) {
            send('tool', { name: tu.name, status: 'running' })
            const result = await executeTool(tu.name, tu.input)
            send('tool', {
              name: tu.name,
              status: result.ok ? 'done' : 'error',
              error: result.error,
            })
            toolResults.push({
              type: 'tool_result',
              tool_use_id: tu.id,
              content: JSON.stringify(result.ok ? result.data ?? null : { error: result.error }),
              is_error: !result.ok,
            })
          }
          convo.push({ role: 'user', content: toolResults })
        }

        send('error', { error: 'Limite de iterações atingido.' })
        controller.close()
      } catch (e: any) {
        send('error', { error: e?.message ?? 'Erro no assistente.' })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
