import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const start = Date.now()
  try {
    const supabase = createClient()
    const { count, error } = await supabase.from('obras').select('id', { count: 'exact', head: true })
    const ms = Date.now() - start
    if (error) throw error
    return NextResponse.json({
      status: 'ok',
      database: 'connected',
      latency_ms: ms,
      timestamp: new Date().toISOString(),
    })
  } catch (e: any) {
    return NextResponse.json({
      status: 'error',
      database: 'disconnected',
      error: e.message,
      timestamp: new Date().toISOString(),
    }, { status: 503 })
  }
}
