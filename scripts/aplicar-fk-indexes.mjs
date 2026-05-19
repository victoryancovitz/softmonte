import pg from 'pg'
import { config } from 'dotenv'
import { readFileSync } from 'node:fs'
config({ path: '.env.local' })

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
const t0 = Date.now()

await client.connect()
const sql = readFileSync('/tmp/fk_indexes.sql', 'utf8')

try {
  await client.query('BEGIN')
  await client.query(sql)
  await client.query('COMMIT')
  console.log(`✓ 172 índices criados em ${Date.now() - t0}ms`)
} catch (err) {
  await client.query('ROLLBACK').catch(() => {})
  console.error('✗', err.message)
  process.exit(1)
} finally {
  await client.end()
}
