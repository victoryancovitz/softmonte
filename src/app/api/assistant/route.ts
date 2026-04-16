import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
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

type ClientMessage = {
  role: 'user' | 'assistant'
  content: string
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

  let body: { messages?: ClientMessage[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const history = Array.isArray(body.messages) ? body.messages : []
  if (history.length === 0) {
    return NextResponse.json({ error: 'Envie ao menos uma mensagem.' }, { status: 400 })
  }

  const client = new Anthropic({ apiKey })
  const system = await buildSystemContext()

  const convo: Anthropic.MessageParam[] = history.map(m => ({
    role: m.role,
    content: m.content,
  }))

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
