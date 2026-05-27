// Backup INCREMENTAL do Supabase Storage para uma pasta local.
// Lista todos os objetos (todos os buckets) e baixa apenas o que falta
// ou mudou de tamanho — nao re-baixa o que ja existe igual.
//
// Env necessarios:
//   BACKUP_STORAGE_DIR  -> pasta destino (ex: .../OneDrive/Backups/softmonte/storage)
//   DATABASE_URL, SUPABASE_SERVICE_ROLE_KEY (lidos de .env.local se nao vierem do shell)

import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import dotenv from 'dotenv'
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env.local') })
import pg from 'pg'
import { createClient } from '@supabase/supabase-js'
import { mkdir, writeFile, stat } from 'node:fs/promises'

const DEST = process.env.BACKUP_STORAGE_DIR
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wzmkifutluyqzqefrbpp.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DATABASE_URL = process.env.DATABASE_URL

if (!DEST) { console.error('Falta BACKUP_STORAGE_DIR'); process.exit(1) }
if (!SERVICE_KEY || !DATABASE_URL) { console.error('Falta SUPABASE_SERVICE_ROLE_KEY ou DATABASE_URL'); process.exit(1) }

const client = new pg.Client({ connectionString: DATABASE_URL })
await client.connect()
const { rows } = await client.query(
  `SELECT bucket_id, name, COALESCE((metadata->>'size')::bigint, 0) AS size
   FROM storage.objects ORDER BY bucket_id, name`
)
await client.end()

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
let baixados = 0, pulados = 0, erros = 0
for (const o of rows) {
  const local = join(DEST, o.bucket_id, o.name)
  try {
    const st = await stat(local).catch(() => null)
    if (st && Number(st.size) === Number(o.size) && Number(o.size) > 0) { pulados++; continue }
    const { data, error } = await supabase.storage.from(o.bucket_id).download(o.name)
    if (error) { erros++; console.error('  ERRO download', o.bucket_id, o.name, error.message); continue }
    await mkdir(dirname(local), { recursive: true })
    await writeFile(local, Buffer.from(await data.arrayBuffer()))
    baixados++
  } catch (e) { erros++; console.error('  ERRO', o.bucket_id, o.name, e.message) }
}
console.log(`storage: ${baixados} novos/atualizados, ${pulados} ja existiam, ${erros} erros (${rows.length} objetos no total)`)
process.exit(erros > 0 ? 1 : 0)
