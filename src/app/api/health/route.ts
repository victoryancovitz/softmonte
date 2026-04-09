import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  let db: 'connected' | 'error' = 'error'

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey)
      const { error } = await supabase.from('profiles').select('user_id').limit(1)
      db = error ? 'error' : 'connected'
    }
  } catch {
    db = 'error'
  }

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    db,
  })
}
