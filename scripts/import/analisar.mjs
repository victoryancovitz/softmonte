import XLSX from 'xlsx'

const wb = XLSX.readFile('scripts/import/caixa.xlsx')
console.log('Abas:', wb.SheetNames)

for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name]
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
  const rows = range.e.r + 1
  const cols = range.e.c + 1
  console.log(`\n=== ${name} (${rows} linhas × ${cols} cols) ===`)

  // Primeiras 5 linhas
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, range: 0, defval: '' })
  for (let i = 0; i < Math.min(5, data.length); i++) {
    console.log(`  L${i+1}:`, data[i].slice(0, 15).map(v => v === '' ? '—' : v))
  }
}

// Analisar aba principal
const mainSheet = wb.SheetNames.find(n => n.includes('BASE') || n.includes('2026')) || wb.SheetNames[0]
console.log(`\n\n========== ANÁLISE DETALHADA: ${mainSheet} ==========`)

const ws = wb.Sheets[mainSheet]
const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

// Encontrar cabeçalho
let headerIdx = -1
for (let i = 0; i < Math.min(10, data.length); i++) {
  const row = data[i].map(v => String(v).toLowerCase())
  if (row.some(v => v.includes('mês') || v.includes('mes') || v.includes('data'))) {
    headerIdx = i
    break
  }
}

if (headerIdx < 0) {
  console.log('Cabeçalho não encontrado. Mostrando primeiras 10 linhas:')
  for (let i = 0; i < 10; i++) console.log(`  L${i+1}:`, data[i])
  process.exit(0)
}

const headers = data[headerIdx].map(v => String(v).trim())
console.log(`Cabeçalho na linha ${headerIdx + 1}:`, headers.filter(h => h))

// Mapear colunas
const colMap = {}
headers.forEach((h, i) => { if (h) colMap[h.toLowerCase()] = i })
console.log('Colunas mapeadas:', Object.keys(colMap))

// Contar dados
const cats = {}, subcats = {}, meses = {}, bancos = {}, ccs = {}, fornecs = {}
let totalEnt = 0, totalSai = 0, linhasValidas = 0

for (let i = headerIdx + 1; i < data.length; i++) {
  const row = data[i]
  const cat = row[colMap['categoria']] || row[colMap['categorias']] || ''
  const sub = row[colMap['subcategoria']] || row[colMap['subcategorias']] || ''
  const mes = row[colMap['mês']] || row[colMap['mes']] || ''
  const ent = row[colMap['entradas']] || 0
  const sai = row[colMap['saídas']] || row[colMap['saidas']] || 0
  const banco = row[colMap['banco']] || ''
  const cc = row[colMap['centro de custo']] || row[colMap['centro custo']] || ''
  const forn = row[colMap['fornecedor']] || row[colMap['fornecedores']] || ''

  if (!cat && !sub && !ent && !sai) continue
  linhasValidas++

  if (cat) cats[cat] = (cats[cat] || 0) + 1
  if (sub) subcats[sub] = (subcats[sub] || 0) + 1
  if (mes) meses[mes] = (meses[mes] || 0) + 1
  if (banco) bancos[banco] = (bancos[banco] || 0) + 1
  if (cc) ccs[cc] = (ccs[cc] || 0) + 1
  if (forn) fornecs[forn] = (fornecs[forn] || 0) + 1
  if (typeof ent === 'number' && ent > 0) totalEnt += ent
  if (typeof sai === 'number' && sai > 0) totalSai += sai
}

console.log(`\nLinhas válidas: ${linhasValidas}`)
console.log(`Total ENTRADAS: R$ ${totalEnt.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`)
console.log(`Total SAÍDAS: R$ ${totalSai.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`)

console.log(`\nMeses:`, meses)
console.log(`\nBancos (${Object.keys(bancos).length}):`, bancos)

console.log(`\nTop 15 Categorias:`)
Object.entries(cats).sort((a,b) => b[1]-a[1]).slice(0,15).forEach(([k,v]) => console.log(`  ${v}× ${k}`))

console.log(`\nTop 25 Subcategorias:`)
Object.entries(subcats).sort((a,b) => b[1]-a[1]).slice(0,25).forEach(([k,v]) => console.log(`  ${v}× ${k}`))

console.log(`\nCentros de Custo (${Object.keys(ccs).length}):`)
Object.entries(ccs).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log(`  ${v}× ${k}`))

console.log(`\nFornecedores únicos: ${Object.keys(fornecs).length}`)
console.log(`Top 20:`)
Object.entries(fornecs).sort((a,b) => b[1]-a[1]).slice(0,20).forEach(([k,v]) => console.log(`  ${v}× ${k}`))
