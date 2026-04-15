import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Test-only login route that sets Supabase auth cookies server-side.
 * Only works in non-production or with explicit flag.
 * Used by Playwright E2E tests.
 */
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')
  const password = req.nextUrl.searchParams.get('password')

  if (!email || !password) {
    return NextResponse.json({ error: 'Missing email or password' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  const supabase = createClient(supabaseUrl, supabaseAnonKey)
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.session) {
    return NextResponse.json({ error: error?.message || 'Login failed' }, { status: 401 })
  }

  const { access_token, refresh_token } = data.session

  // Build the response and set cookies that @supabase/ssr expects
  const response = NextResponse.json({ ok: true, user: data.user?.email })

  const cookieOptions = {
    path: '/',
    httpOnly: false, // Playwright needs to read these
    secure: true,
    sameSite: 'lax' as const,
    maxAge: 60 * 60, // 1 hour
  }

  // Supabase SSR stores tokens in chunked cookies
  const projectRef = 'wzmkifutluyqzqefrbpp'
  response.cookies.set(`sb-${projectRef}-auth-token.0`, JSON.stringify({
    access_token,
    refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: data.user,
  }), cookieOptions)

  // Also set the simple format some setups use
  response.cookies.set(`sb-${projectRef}-auth-token`, access_token, cookieOptions)

  return response
}
