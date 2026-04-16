import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import JSZip from 'jszip'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Parseia um arquivo Excel de RDO e retorna dados estruturados.
 * Detecta automaticamente o formato (AGEO ou genérico).
 * Não salva no banco — apenas retorna o preview.
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Arquivo não enviado.' }, { status: 400 })
    }
    const buf = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buf, { type: 'buffer', cellDates: true })

    const abas = wb.SheetNames
    const formato = detectarFormato(wb)

    if (formato === 'ageo') {
      const rdo = parseAgeoRdo(wb)
      const ponto = parseAgeoPonto(wb, 'NR 12').concat(parseAgeoPonto(wb, 'APOIO'))
      // Extrai imagens embutidas do OOXML (.xlsm / .xlsx)
      const imagens = await extrairImagensOOXML(buf)
      return NextResponse.json({
        formato: 'ageo',
        abas,
        rdo,
        ponto,
        imagens, // [{ name, dataBase64, mediaType }]
        fileName: file.name,
        fileSize: file.size,
      })
    }

    // Genérico: lê primeira aba como grade
    const firstSheet = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: null })
    return NextResponse.json({
      formato: 'generico',
      abas,
      preview: rows.slice(0, 50),
      fileName: file.name,
      fileSize: file.size,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Falha ao processar arquivo.' }, { status: 500 })
  }
}

// ─── Detector ────────────────────────────────────────────────────────────────

function detectarFormato(wb: XLSX.WorkBook): 'ageo' | 'generico' {
  // AGEO: célula A10 contém "MÃO DE OBRA DIRETA" (ou similar)
  const sheet = wb.Sheets['RDO'] ?? wb.Sheets[wb.SheetNames[0]]
  if (!sheet) return 'generico'
  const a10 = String(getCell(sheet, 'A10') ?? '').toUpperCase()
  const a11 = String(getCell(sheet, 'A11') ?? '').toUpperCase()
  const check = a10 + ' ' + a11
  if (check.includes('MÃO DE OBRA') || check.includes('MAO DE OBRA') || check.includes('MO DIRETA')) return 'ageo'
  // Secondary check: nomes de abas típicas AGEO
  const abas = wb.SheetNames.map(n => n.toUpperCase())
  if (abas.includes('RDO') && (abas.includes('NR 12') || abas.includes('APOIO'))) return 'ageo'
  return 'generico'
}

function getCell(sheet: XLSX.WorkSheet, ref: string): any {
  const c = sheet[ref]
  return c ? (c.v ?? null) : null
}

// ─── Parser AGEO — aba RDO ───────────────────────────────────────────────────

function parseAgeoRdo(wb: XLSX.WorkBook) {
  const sheet = wb.Sheets['RDO']
  if (!sheet) return null

  const cabecalho = {
    contratante: getCell(sheet, 'B3'),
    contrato: getCell(sheet, 'B4'),
    data: parseDate(getCell(sheet, 'P2')),
    numero_rdo: getCell(sheet, 'R3'),
  }

  // Clima: colunas U-X, linhas 7-18 (aproximado; extrai valores não-vazios)
  const clima: Array<{ turno: string; hora: string; condicao: string }> = []
  for (let row = 7; row <= 18; row++) {
    const hora = String(getCell(sheet, `T${row}`) ?? getCell(sheet, `S${row}`) ?? '').trim()
    const c1 = getCell(sheet, `U${row}`)
    const c2 = getCell(sheet, `V${row}`)
    if (hora && c1) clima.push({ turno: '1turno', hora, condicao: String(c1).toLowerCase().trim() })
    if (hora && c2) clima.push({ turno: '2turno', hora, condicao: String(c2).toLowerCase().trim() })
  }

  // MO Direta: linhas 12-20
  const moDireta: any[] = []
  for (let row = 12; row <= 20; row++) {
    const funcao = getCell(sheet, `A${row}`)
    if (!funcao) continue
    const qtd = Number(getCell(sheet, `E${row}`)) || 0
    if (qtd === 0 && !String(funcao).trim()) continue
    moDireta.push({
      tipo: 'direta',
      funcao: String(funcao).trim(),
      quantidade: qtd,
      hora_entrada: parseTime(getCell(sheet, `G${row}`)),
      entrada_almoco: parseTime(getCell(sheet, `I${row}`)),
      saida_almoco: parseTime(getCell(sheet, `K${row}`)),
      hora_saida: parseTime(getCell(sheet, `M${row}`)),
      horas_trabalhadas: Number(getCell(sheet, `O${row}`)) || 0,
    })
  }

  // MO Indireta: linhas 23-30
  const moIndireta: any[] = []
  for (let row = 23; row <= 30; row++) {
    const funcao = getCell(sheet, `A${row}`)
    if (!funcao) continue
    const qtd = Number(getCell(sheet, `E${row}`)) || 0
    if (qtd === 0 && !String(funcao).trim()) continue
    moIndireta.push({
      tipo: 'indireta',
      funcao: String(funcao).trim(),
      quantidade: qtd,
      hora_entrada: parseTime(getCell(sheet, `G${row}`)),
      entrada_almoco: parseTime(getCell(sheet, `I${row}`)),
      saida_almoco: parseTime(getCell(sheet, `K${row}`)),
      hora_saida: parseTime(getCell(sheet, `M${row}`)),
      horas_trabalhadas: Number(getCell(sheet, `O${row}`)) || 0,
    })
  }

  // Atividades: linhas 33-50
  const atividades: any[] = []
  for (let row = 33; row <= 50; row++) {
    const item = getCell(sheet, `A${row}`)
    const projeto = getCell(sheet, `B${row}`)
    const descricao = getCell(sheet, `H${row}`) ?? getCell(sheet, `G${row}`)
    if (!item && !projeto && !descricao) continue
    atividades.push({
      item: Number(item) || atividades.length + 1,
      projeto: String(projeto ?? '').trim(),
      local: String(getCell(sheet, `C${row}`) ?? '').trim(),
      encarregado: String(getCell(sheet, `D${row}`) ?? '').trim(),
      pt: String(getCell(sheet, `E${row}`) ?? '').trim(),
      descricao: String(descricao ?? '').trim(),
      total_hh: Number(getCell(sheet, `F${row}`)) || 0,
    })
  }

  // Equipamentos: linhas 55-65 (aproximado)
  const equipamentos: any[] = []
  for (let row = 55; row <= 70; row++) {
    const desc = getCell(sheet, `A${row}`)
    if (!desc) continue
    const qtd = Number(getCell(sheet, `E${row}`)) || 0
    if (!String(desc).trim()) continue
    equipamentos.push({ descricao: String(desc).trim(), quantidade: qtd })
  }

  // Fotos: linhas com legenda — tenta linhas 70-90 coluna A
  const fotos: any[] = []
  for (let row = 70; row <= 100 && fotos.length < 10; row++) {
    const leg = getCell(sheet, `A${row}`)
    if (leg && String(leg).toUpperCase().includes('FOTO')) {
      const m = String(leg).match(/FOTO\s*(\d+)/i)
      const num = m ? Number(m[1]) : fotos.length + 1
      const legenda = getCell(sheet, `B${row}`) ?? getCell(sheet, `C${row}`)
      fotos.push({ numero: num, legenda: String(legenda ?? '').trim(), url: '' })
    }
  }

  // Observações
  const obsContratada = extractLongText(sheet, ['E52', 'E53', 'E54', 'A52'])
  const obsFisca = extractLongText(sheet, ['E60', 'E61', 'A60'])

  return {
    cabecalho,
    clima,
    efetivo: [...moDireta, ...moIndireta],
    atividades,
    fotos,
    equipamentos,
    observacoes_contratada: obsContratada,
    observacoes_fiscalizacao: obsFisca,
  }
}

function extractLongText(sheet: XLSX.WorkSheet, refs: string[]): string {
  for (const r of refs) {
    const v = getCell(sheet, r)
    if (v && String(v).trim()) return String(v).trim()
  }
  return ''
}

// ─── Parser AGEO — abas de ponto (NR 12, APOIO) ──────────────────────────────

function parseAgeoPonto(wb: XLSX.WorkBook, sheetName: string) {
  const sheet = wb.Sheets[sheetName]
  if (!sheet) return []
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as any[][]
  if (rows.length < 2) return []

  // Tenta detectar a linha de cabeçalho procurando por "Nome"
  let headerRow = -1
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const r = rows[i]
    if (!r) continue
    const joined = r.map(c => String(c ?? '').toLowerCase()).join(' ')
    if (joined.includes('nome')) { headerRow = i; break }
  }
  if (headerRow === -1) return []

  const header = rows[headerRow].map(c => String(c ?? '').toLowerCase().trim())
  const idx = (key: string) => header.findIndex(h => h.includes(key))

  const iNome = idx('nome')
  const iFolha = idx('folha')
  const iEnt1 = idx('entrada 1') >= 0 ? idx('entrada 1') : idx('entrada1')
  const iSai1 = idx('sa') // saída 1
  const iNormais = idx('normal') >= 0 ? idx('normal') : idx('normais')
  const iFaltas = idx('falta')
  const iExtras = idx('extra')

  const results: any[] = []
  for (let i = headerRow + 1; i < rows.length; i++) {
    const r = rows[i]
    if (!r) continue
    const nome = r[iNome]
    if (!nome || !String(nome).trim()) continue
    results.push({
      folha: iFolha >= 0 ? r[iFolha] : null,
      nome: String(nome).trim().toUpperCase(),
      entrada1: parseTime(r[iEnt1 >= 0 ? iEnt1 : -1]),
      saida1: parseTime(iSai1 >= 0 ? r[iSai1] : null),
      normais: Number(iNormais >= 0 ? r[iNormais] : 0) || 0,
      faltas: Number(iFaltas >= 0 ? r[iFaltas] : 0) || 0,
      extras: Number(iExtras >= 0 ? r[iExtras] : 0) || 0,
      aba: sheetName,
    })
  }
  return results
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseDate(v: any): string | null {
  if (!v) return null
  if (v instanceof Date) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`
  }
  if (typeof v === 'number') {
    // Excel date serial
    const dt = XLSX.SSF.parse_date_code(v)
    if (dt) return `${dt.y}-${String(dt.m).padStart(2, '0')}-${String(dt.d).padStart(2, '0')}`
  }
  const s = String(v).trim()
  const m = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/)
  if (m) {
    const year = m[3].length === 2 ? '20' + m[3] : m[3]
    return `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  }
  return null
}

// ─── Extração de imagens embutidas no OOXML (.xlsx/.xlsm) ────────────────────

async function extrairImagensOOXML(buf: Buffer): Promise<Array<{ name: string; dataBase64: string; mediaType: string }>> {
  try {
    const zip = await JSZip.loadAsync(buf)
    const results: Array<{ name: string; dataBase64: string; mediaType: string }> = []
    const files = Object.keys(zip.files).filter(f => f.startsWith('xl/media/'))
    for (const filePath of files) {
      const f = zip.files[filePath]
      if (f.dir) continue
      const ext = filePath.split('.').pop()?.toLowerCase() ?? 'png'
      const mediaType =
        ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
        ext === 'png' ? 'image/png' :
        ext === 'gif' ? 'image/gif' :
        'image/png'
      const data = await f.async('base64')
      const name = filePath.split('/').pop() ?? 'imagem'
      results.push({ name, dataBase64: data, mediaType })
    }
    return results
  } catch {
    return []
  }
}

function parseTime(v: any): string | null {
  if (!v) return null
  if (v instanceof Date) {
    return `${String(v.getHours()).padStart(2, '0')}:${String(v.getMinutes()).padStart(2, '0')}`
  }
  if (typeof v === 'number' && v >= 0 && v < 1) {
    // Excel time fraction
    const totalMin = Math.round(v * 24 * 60)
    const h = Math.floor(totalMin / 60)
    const m = totalMin % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }
  const s = String(v).trim()
  const m = s.match(/^(\d{1,2}):(\d{2})/)
  if (m) return `${m[1].padStart(2, '0')}:${m[2]}`
  return null
}
