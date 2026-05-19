// Executa /tmp/importacao_inserts.sql via driver pg em uma única transação.
// Lê DATABASE_URL do .env.local.

import pg from 'pg'
import { readFileSync } from 'node:fs'
import { config as loadEnv } from 'dotenv'

loadEnv({ path: '.env.local' })

const dbUrl = process.env.DATABASE_URL
if (!dbUrl) {
  console.error('DATABASE_URL ausente em .env.local')
  process.exit(1)
}

const sql = readFileSync('/tmp/importacao_inserts.sql', 'utf8')

const client = new pg.Client({ connectionString: dbUrl })
const t0 = Date.now()

try {
  console.log('Conectando…')
  await client.connect()
  console.log('Conectado. Iniciando transação.')

  await client.query('BEGIN')

  // Executa o SQL inteiro como uma única query (pg suporta múltiplos statements)
  // O último statement é o SELECT de verificação — capturamos seu resultado.
  console.log('Executando', sql.length, 'chars de SQL...')
  const res = await client.query(sql)

  // res pode ser array (múltiplos statements) ou objeto único
  const ultimoComRows = Array.isArray(res)
    ? [...res].reverse().find(r => r.rows && r.rows.length > 0)
    : res

  await client.query('COMMIT')
  const ms = Date.now() - t0
  console.log(`✓ Transação commitada em ${ms}ms`)

  if (ultimoComRows?.rows?.length) {
    console.log('\n=== VERIFICAÇÃO ===')
    for (const row of ultimoComRows.rows) {
      console.log(' ', row)
    }
  }
} catch (err) {
  await client.query('ROLLBACK').catch(() => {})
  console.error('✗ ERRO — ROLLBACK feito.')
  console.error(err.message)
  if (err.position) console.error('Posição:', err.position)
  if (err.detail) console.error('Detalhe:', err.detail)
  process.exit(1)
} finally {
  await client.end()
}
