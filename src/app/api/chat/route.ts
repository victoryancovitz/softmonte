import { NextRequest, NextResponse } from 'next/server'
import { requireRoleApi } from '@/lib/require-role'
import { rateLimit } from '@/lib/rate-limit'
import { createClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  // Bloqueia chamadas sem auth (abuso da cota Anthropic)
  const authErr = await requireRoleApi(['admin', 'financeiro', 'rh', 'encarregado', 'engenheiro'])
  if (authErr) return authErr

  // Rate limit por usuário: 10 requisições por minuto
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const rl = rateLimit(`chat:${user?.id ?? 'anon'}`, { limit: 10, windowMs: 60_000 })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Muitas requisições. Aguarde ${Math.ceil((rl.resetAt - Date.now()) / 1000)}s.` },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    )
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY não configurada no servidor.' },
      { status: 500 }
    )
  }

  try {
    const body = await req.json()

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: body.model ?? 'claude-sonnet-4-20250514',
        max_tokens: body.max_tokens ?? 1000,
        system: body.system,
        messages: body.messages,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error?.message ?? 'Erro na API Anthropic' },
        { status: response.status }
      )
    }

    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message ?? 'Erro interno' },
      { status: 500 }
    )
  }
}
