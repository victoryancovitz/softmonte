import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

async function logout(req: Request) {
  const supabase = createClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/login', req.url))
}

export const GET = logout
export const POST = logout
