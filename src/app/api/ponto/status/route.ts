/**
 * GET /api/ponto/status
 *
 * Retorna estatísticas do estado atual da importação de ponto:
 * - Primeira e última data importada
 * - Total de marcações e dias distintos
 * - Último sync executado
 */
import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { requireRoleApi } from '@/lib/require-role'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const roleErr = await requireRoleApi(['admin', 'rh'])
  if (roleErr) return roleErr

  const supabase = createServerClient()

  const [{ data: stats }, { data: lastSync }] = await Promise.all([
    supabase.rpc('ponto_import_stats'),
    supabase.from('ponto_sync_log')
      .select('started_at, finished_at, status, periodo_inicio, periodo_fim, total_batidas, novas, trigger')
      .eq('status', 'ok')
      .order('finished_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  return NextResponse.json({
    ok: true,
    importacao: stats ?? { primeira_data: null, ultima_data: null, total_marcacoes: 0, dias_distintos: 0 },
    ultimo_sync: lastSync,
  })
}
