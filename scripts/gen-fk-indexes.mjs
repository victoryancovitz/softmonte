import pg from 'pg'
import { config } from 'dotenv'
import { writeFileSync } from 'node:fs'
config({ path: '.env.local' })

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()

const { rows } = await client.query(`
  WITH fks AS (
    SELECT
      c.conrelid::regclass::text AS tabela,
      a.attname AS coluna_fk,
      c.conrelid AS rel_oid,
      a.attnum AS col_num
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE c.contype = 'f' AND n.nspname = 'public'
  )
  SELECT tabela, coluna_fk
  FROM fks
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_index i
    WHERE i.indrelid = fks.rel_oid
      AND fks.col_num = ANY(i.indkey)
      AND i.indkey[0] = fks.col_num
  )
  ORDER BY tabela, coluna_fk
`)

const stmts = ['-- Indexa ' + rows.length + ' FKs sem índice (gera ganho em joins/deletes)']
for (const r of rows) {
  // Nome único do índice. Trunca pra evitar > 63 chars (limite PG)
  let idx = `idx_${r.tabela}_${r.coluna_fk}`
  if (idx.length > 63) idx = idx.slice(0, 63)
  stmts.push(`CREATE INDEX IF NOT EXISTS ${idx} ON public.${r.tabela}(${r.coluna_fk});`)
}

const sql = stmts.join('\n')
writeFileSync('/tmp/fk_indexes.sql', sql)
console.log('FKs sem índice:', rows.length, '| Chars:', sql.length)
await client.end()
