/**
 * POST /api/auth/register
 *
 * Cria usuário via convite — usando service_role pra auto-confirmar email.
 * Não depende de SMTP. O admin já validou a identidade ao criar o convite.
 *
 * Body: { token, email, password }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // Rate limit: max 5 tentativas por IP a cada 15 minutos
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.ip || 'unknown'
  const rl = rateLimit(`register:${ip}`, { limit: 5, windowMs: 15 * 60 * 1000 })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Muitas tentativas de registro. Aguarde 15 minutos.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    )
  }

  const { token, email, password } = await req.json()

  if (!token || !email || !password) {
    return NextResponse.json({ error: 'token, email e password são obrigatórios' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'Senha deve ter pelo menos 6 caracteres' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceRoleKey) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor' }, { status: 500 })
  }

  // Client admin com service_role (bypassa RLS + pode criar users)
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // 1. Valida o convite
  const { data: convite, error: convErr } = await supabaseAdmin
    .from('convites')
    .select('*')
    .eq('token', token)
    .single()

  if (convErr || !convite) {
    return NextResponse.json({ error: 'Convite não encontrado' }, { status: 404 })
  }
  if (convite.usado_em) {
    return NextResponse.json({ error: 'Este convite já foi utilizado' }, { status: 400 })
  }
  if (!convite.ativo) {
    return NextResponse.json({ error: 'Este convite foi revogado' }, { status: 400 })
  }
  if (convite.expires_at && new Date(convite.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Este convite expirou' }, { status: 400 })
  }

  // 2. Cria usuário via admin API — já confirmado, sem precisar de email
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Auto-confirma sem email
    user_metadata: {
      nome: convite.nome_convidado,
      role: convite.role,
    },
  })

  if (authError) {
    // Se o email já existe, tenta signin em vez de criar
    if (authError.message.includes('already been registered') || authError.message.includes('already exists')) {
      return NextResponse.json({ error: 'Este email já está registrado. Use a tela de login.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Erro ao criar conta: ' + authError.message }, { status: 400 })
  }

  if (!authData.user) {
    return NextResponse.json({ error: 'Erro ao criar usuário' }, { status: 500 })
  }

  // 3. Cria profile
  const { error: profError } = await supabaseAdmin.from('profiles').upsert({
    user_id: authData.user.id,
    nome: convite.nome_convidado,
    email,
    role: convite.role,
    acessos: convite.acessos,
    ativo: true,
    funcionario_id: convite.funcionario_id,
  })

  if (profError) {
    console.error('[register] profile upsert error:', profError)
    // Não falha — o user foi criado, profile pode ser ajustado depois
  }

  // 4. Marca convite como usado
  await supabaseAdmin.from('convites').update({
    usado_em: new Date().toISOString(),
    ativo: false,
  }).eq('token', token)

  return NextResponse.json({
    ok: true,
    message: 'Conta criada com sucesso! Faça login.',
  })
}
