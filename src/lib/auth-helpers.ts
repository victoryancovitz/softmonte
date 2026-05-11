import { NextResponse, type NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

const FORCE_SIGNOUT_MOTIVOS = new Set<string>([
  'user-banned',
  'admin-explicit-revoke',
])

export async function safeRedirect(
  req: NextRequest,
  motivo: string,
  supabase: SupabaseClient,
  destino: string = '/login'
): Promise<NextResponse> {
  console.warn('[AUTH-REDIRECT]', JSON.stringify({
    motivo,
    path: req.nextUrl.pathname,
    will_signout: FORCE_SIGNOUT_MOTIVOS.has(motivo),
    timestamp: new Date().toISOString(),
  }))

  if (FORCE_SIGNOUT_MOTIVOS.has(motivo)) {
    await supabase.auth.signOut()
  }

  const url = new URL(destino, req.url)
  url.searchParams.set('motivo', motivo)
  return NextResponse.redirect(url)
}
