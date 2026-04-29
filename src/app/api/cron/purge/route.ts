import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/purge
 * Limpa registros soft-deletados com mais de 30 dias.
 * Chamado via Vercel Cron ou manualmente.
 */
export async function GET(req: NextRequest) {
  const cronSecret = req.headers.get('x-cron-secret')
  const expected = process.env.CRON_SECRET
  if (expected && cronSecret !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient()
  const { data, error } = await supabase.rpc('purge_soft_deleted_antigos', { p_dias: 30 })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, resultado: data })
}
