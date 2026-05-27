// Script one-shot: remove arquivos DUPLICADOS EXATOS (mesmo nome + mesmo tamanho)
// dentro de cada pasta de ex-funcionario importada do Drive
// (bucket `documentos`, prefixo `funcionarios/{id}/drive/`).
// Mantem 1 copia (a mais recente) de cada grupo; remove o resto via Storage API.
//
// SEGURANCA:
//   - escopo TRAVADO em `funcionarios/%/drive/%` — nao toca em mais nada
//   - so agrupa por (pasta, nome normalizado, TAMANHO identico) = re-upload byte a byte
//   - DRY-RUN por padrao; so apaga de verdade com --apply
//
// Uso:
//   node scripts/limpar-duplicados-storage.mjs            # lista o que apagaria
//   node scripts/limpar-duplicados-storage.mjs --apply    # apaga de verdade
//
// Requer em .env.local: DATABASE_URL e SUPABASE_SERVICE_ROLE_KEY

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import pg from 'pg'
import { createClient } from '@supabase/supabase-js'

const APPLY = process.argv.includes('--apply')
const INCLUDE_MIXED = process.argv.includes('--include-mixed')
const MODE = (process.argv.find(a => a.startsWith('--mode='))?.split('=')[1]) || 'exato'
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wzmkifutluyqzqefrbpp.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DATABASE_URL = process.env.DATABASE_URL
const BUCKET = 'documentos'
const PASTA_MISTURADA = '5e82c20c-f798-4669-8259-d6a3811c91b8' // docs de varias pessoas juntas

if (!DATABASE_URL) { console.error('Falta DATABASE_URL em .env.local'); process.exit(1) }
if (APPLY && !SERVICE_KEY) { console.error('Falta SUPABASE_SERVICE_ROLE_KEY em .env.local (Settings > API > service_role)'); process.exit(1) }

// modo 'exato': remove copias byte-a-byte (mesmo nome + mesmo tamanho), mantem 1
// modo 'nr':    remove copias do MESMO certificado de NR (mesmo nome), mantem a MAIOR
const SQL_EXATO = `
WITH d AS (
  SELECT name, split_part(name,'/',2) AS old_id,
    regexp_replace(split_part(name,'/',4),'^[0-9]+_(retry)?[0-9]+_','') AS norm,
    (metadata->>'size')::bigint AS size, created_at
  FROM storage.objects WHERE bucket_id = $1 AND name LIKE 'funcionarios/%/drive/%'
),
g AS (SELECT name, size, ROW_NUMBER() OVER (PARTITION BY old_id, norm, size ORDER BY created_at DESC, name) AS rn FROM d)
SELECT name, size FROM g WHERE rn > 1 ORDER BY name;
`
const SQL_NR = `
WITH d AS (
  SELECT name, split_part(name,'/',2) AS old_id,
    regexp_replace(split_part(name,'/',4),'^[0-9]+_(retry)?[0-9]+_','') AS norm,
    (metadata->>'size')::bigint AS size, created_at
  FROM storage.objects WHERE bucket_id = $1 AND name LIKE 'funcionarios/%/drive/%'
    AND (${INCLUDE_MIXED ? 'TRUE' : `split_part(name,'/',2) <> '${PASTA_MISTURADA}'`})
),
nr AS (SELECT * FROM d WHERE norm ~* '^n_?r?[0-9]'),
g AS (SELECT name, size, ROW_NUMBER() OVER (PARTITION BY old_id, norm ORDER BY size DESC, created_at DESC) AS rn FROM nr)
SELECT name, size FROM g WHERE rn > 1 ORDER BY name;
`
const SQL = MODE === 'nr' ? SQL_NR : SQL_EXATO

const client = new pg.Client({ connectionString: DATABASE_URL })
await client.connect()
const { rows } = await client.query(SQL, [BUCKET])
await client.end()

if (rows.length === 0) { console.log('Nenhum duplicado exato encontrado.'); process.exit(0) }

const totalBytes = rows.reduce((s, r) => s + Number(r.size), 0)
console.log(`${rows.length} arquivos duplicados (${(totalBytes / 1048576).toFixed(1)} MB) — ${APPLY ? 'APAGANDO' : 'DRY-RUN (use --apply pra apagar)'}`)
for (const r of rows) console.log('  -', r.name)

if (!APPLY) { console.log('\nNada foi apagado. Rode com --apply pra confirmar.'); process.exit(0) }

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
const paths = rows.map(r => r.name)
let removed = 0
for (let i = 0; i < paths.length; i += 1000) {
  const batch = paths.slice(i, i + 1000)
  const { error } = await supabase.storage.from(BUCKET).remove(batch)
  if (error) { console.error('Erro no batch:', error.message); process.exit(1) }
  removed += batch.length
}
console.log(`\nOK — ${removed} arquivos removidos do Storage.`)
