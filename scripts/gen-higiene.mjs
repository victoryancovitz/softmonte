import pg from 'pg'
import { config } from 'dotenv'
import { writeFileSync } from 'node:fs'
config({ path: '.env.local' })

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()

const { rows } = await client.query(`
  SELECT p.proname,
    pg_get_function_identity_arguments(p.oid) AS args
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prokind = 'f'
    AND NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) AS cfg WHERE cfg LIKE 'search_path=%')
    AND p.proname NOT IN ('unaccent', 'unaccent_init', 'unaccent_lexize')
  ORDER BY p.proname
`)

const stmts = [
  '-- Higiene rápida — fixa search_path em ' + rows.length + ' funções + dropa 4 índices duplicados',
]
for (const r of rows) {
  // Escapa nome (não tem aspas, são identificadores simples)
  stmts.push(`ALTER FUNCTION public.${r.proname}(${r.args}) SET search_path = public, pg_temp;`)
}
stmts.push('')
stmts.push('-- Dropar índices duplicados')
stmts.push('DROP INDEX IF EXISTS public.diario_obra_obra_data_key;')
stmts.push('DROP INDEX IF EXISTS public.idx_efetivo_obra_data;')
stmts.push('DROP INDEX IF EXISTS public.idx_fin_competencia;')
stmts.push('DROP INDEX IF EXISTS public.idx_hist_sal_func;')

const sql = stmts.join('\n')
writeFileSync('/tmp/higiene.sql', sql)
console.log('Funções:', rows.length, '| Total statements:', stmts.length, '| Chars:', sql.length)
await client.end()
