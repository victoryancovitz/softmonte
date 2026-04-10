import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { requireRoleApi } from '@/lib/require-role'

const TABELAS_BACKUP = [
  'funcionarios',
  'boletins_medicao',
  'bm_itens',
  'financeiro_lancamentos',
  'alocacoes',
  'obras',
  'correcoes_salariais',
  'desligamentos_workflow',
  'admissoes_workflow',
]

export async function POST() {
  const authErr = await requireRoleApi(['admin', 'diretoria'])
  if (authErr) return authErr

  const supabase = createClient()
  const resultados: Record<string, number> = {}
  const erros: string[] = []

  for (const tabela of TABELAS_BACKUP) {
    try {
      // Fetch all rows (paginated for safety)
      let allData: any[] = []
      let offset = 0
      while (true) {
        const { data, error } = await supabase.from(tabela).select('*').range(offset, offset + 999)
        if (error) throw error
        if (!data || data.length === 0) break
        allData = allData.concat(data)
        if (data.length < 1000) break
        offset += 1000
      }

      const { error: insertError } = await supabase.from('backup_snapshots').insert({
        tabela,
        total_rows: allData.length,
        dados: allData,
      })
      if (insertError) throw insertError
      resultados[tabela] = allData.length
    } catch (e: any) {
      erros.push(`${tabela}: ${e.message}`)
    }
  }

  // Clean old backups (>30 days)
  try { await supabase.rpc('fn_limpar_backups_antigos') } catch {}

  return NextResponse.json({
    sucesso: erros.length === 0,
    data: new Date().toISOString(),
    tabelas_salvas: resultados,
    erros,
  })
}
