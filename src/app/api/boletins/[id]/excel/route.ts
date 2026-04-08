import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import ExcelJS from 'exceljs'
import { TECNOMONTE_LOGO_DARK_B64 } from '@/lib/tecnomonte-logo'
import { requireRoleApi } from '@/lib/require-role'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const authErr = await requireRoleApi(['admin', 'financeiro', 'encarregado', 'engenheiro', 'rh'])
  if (authErr) return authErr

  const supabase = createClient()

  // Carrega BM + obra
  const { data: bm } = await supabase
    .from('boletins_medicao')
    .select('*, obras(id, nome, cliente, local, bm_dia_unico)')
    .eq('id', params.id)
    .single()
  if (!bm) return NextResponse.json({ error: 'BM não encontrado' }, { status: 404 })

  // Carrega itens do BM
  const { data: itens } = await supabase
    .from('bm_itens')
    .select('*')
    .eq('boletim_id', params.id)
    .order('ordem')

  // Carrega composição da obra para os valores de R$/HH
  const { data: composicao } = await supabase
    .from('contrato_composicao')
    .select('funcao_nome, custo_hora_contratado, custo_hora_extra_70, custo_hora_extra_100, quantidade_contratada, carga_horaria_dia')
    .eq('obra_id', bm.obras.id)
    .eq('ativo', true)

  const compMap: Record<string, any> = {}
  ;(composicao ?? []).forEach((c: any) => { compMap[c.funcao_nome.toUpperCase()] = c })

  // Pivot por função (mesma estrutura do preview em /boletins/nova)
  type FuncaoLinha = {
    funcao: string
    efetivo: number
    carga_dia: number
    dia_hn: number
    dia_he70: number
    dia_he100: number
    hh_hn: number
    hh_he70: number
    hh_he100: number
    valor_hh_n: number
    valor_hh_70: number
    valor_hh_100: number
    valor_total: number
  }
  const pivotMap: Record<string, FuncaoLinha> = {}
  ;(itens ?? []).forEach((i: any) => {
    const key = (i.funcao_nome ?? '').toUpperCase()
    if (!pivotMap[key]) {
      const comp = compMap[key]
      pivotMap[key] = {
        funcao: i.funcao_nome ?? key,
        efetivo: Number(comp?.quantidade_contratada ?? 1),
        carga_dia: Number(i.carga_horaria_dia ?? comp?.carga_horaria_dia ?? 8),
        dia_hn: 0, dia_he70: 0, dia_he100: 0,
        hh_hn: 0, hh_he70: 0, hh_he100: 0,
        valor_hh_n: 0, valor_hh_70: 0, valor_hh_100: 0,
        valor_total: 0,
      }
    }
    const l = pivotMap[key]
    const dias = Number(i.dias ?? 0)
    const hh = Number(i.hh_total ?? 0)
    const vt = Number(i.valor_total ?? 0)
    const vhh = Number(i.valor_hh ?? 0)
    if (i.tipo_hora === 'normal') {
      l.dia_hn += dias; l.hh_hn += hh
      if (vhh > 0) l.valor_hh_n = vhh
    } else if (i.tipo_hora === 'extra_70') {
      l.dia_he70 += dias; l.hh_he70 += hh
      if (vhh > 0) l.valor_hh_70 = vhh
    } else if (i.tipo_hora === 'extra_100') {
      l.dia_he100 += dias; l.hh_he100 += hh
      if (vhh > 0) l.valor_hh_100 = vhh
    }
    l.valor_total += vt
  })
  const linhasFuncao = Object.values(pivotMap).sort((a, b) => a.funcao.localeCompare(b.funcao))

  // Calcular total geral
  const totalGeral = (itens ?? []).reduce((s: number, i: any) => s + Number(i.valor_total ?? 0), 0)
  const totalDiaHN = linhasFuncao.reduce((s, l) => s + l.dia_hn, 0)
  const totalDiaHe70 = linhasFuncao.reduce((s, l) => s + l.dia_he70, 0)
  const totalDiaHe100 = linhasFuncao.reduce((s, l) => s + l.dia_he100, 0)
  const totalHHn = linhasFuncao.reduce((s, l) => s + l.hh_hn, 0)
  const totalHH70 = linhasFuncao.reduce((s, l) => s + l.hh_he70, 0)
  const totalHH100 = linhasFuncao.reduce((s, l) => s + l.hh_he100, 0)

  // === Gerar workbook ===
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Tecnomonte Softmonte'
  wb.created = new Date()

  const ws = wb.addWorksheet('Resumo de Horas')

  // Paleta Tecnomonte — cores extraídas dos logos oficiais
  const NAVY        = 'FF0F3757'   // navy principal do logo
  const NAVY_SOFT   = 'FF164B73'   // tom intermediário para subheaders
  const GOLD        = 'FFC9A269'   // tan/bronze do ícone do logo
  const GOLD_LIGHT  = 'FFDBBE8A'   // ouro claro para detalhes
  const BG_LIGHT    = 'FFF4EDE0'   // bege muito claro (complementar ao ouro)
  const BORDER_LIGHT = 'FFE5E7EB'
  const WHITE = 'FFFFFFFF'

  const moneyFormat = '"R$" #,##0.00;[Red]-"R$" #,##0.00'
  const numberFormat = '#,##0'

  // Colunas (A vazia, depois 13 colunas: B..N)
  ws.columns = [
    { width: 3 },    // A — margem
    { width: 5 },    // B — Nº
    { width: 16 },   // C — Função (merged C:D)
    { width: 14 },   // D
    { width: 8 },    // E — Efetivo
    { width: 9 },    // F — DIA HN
    { width: 11 },   // G — DIA HE 70%
    { width: 11 },   // H — DIA HE 100%
    { width: 10 },   // I — HH Normal
    { width: 10 },   // J — HH HE 70%
    { width: 10 },   // K — HH HE 100%
    { width: 13 },   // L — R$/HH
    { width: 16 },   // M — Valor Total
  ]

  // ══════════════════════════════════════════
  // CABEÇALHO — logo (imagem) sobre fundo navy
  // ══════════════════════════════════════════

  // Row 1-3: barra navy grande para o logo
  ws.getRow(1).height = 18
  ws.getRow(2).height = 18
  ws.getRow(3).height = 18

  // Preenche o fundo da faixa superior em navy
  for (let r = 1; r <= 3; r++) {
    for (let c = 2; c <= 13; c++) {
      ws.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
    }
  }

  // Embute o logo Tecnomonte (PNG inline base64 — funciona em serverless sem depender do fs)
  try {
    const logoBuf = Buffer.from(TECNOMONTE_LOGO_DARK_B64, 'base64')
    const logoId = wb.addImage({ buffer: logoBuf as any, extension: 'png' })
    ws.addImage(logoId, {
      tl: { col: 1.2, row: 0.3 } as any,
      ext: { width: 235, height: 72 },
      editAs: 'oneCell',
    })
  } catch (e) {
    // Fallback: texto se o logo falhar
    ws.mergeCells('B1:F3')
    const fallback = ws.getCell('B1')
    fallback.value = 'TECNOMONTE'
    fallback.font = { name: 'Arial Black', size: 18, bold: true, color: { argb: WHITE } }
    fallback.alignment = { horizontal: 'center', vertical: 'middle' }
  }

  // Lado direito: razão social + boletim ID
  ws.mergeCells('G1:M2')
  const sub = ws.getCell('G1')
  sub.value = 'FABRICAÇÃO, MONTAGEM E MANUTENÇÃO INDUSTRIAL'
  sub.font = { size: 10, bold: true, color: { argb: GOLD_LIGHT }, italic: true }
  sub.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 }

  ws.mergeCells('G3:M3')
  const bmLabel = ws.getCell('G3')
  bmLabel.value = `BOLETIM DE MEDIÇÃO Nº ${String(bm.numero).padStart(2,'0')}`
  bmLabel.font = { size: 11, bold: true, color: { argb: WHITE } }
  bmLabel.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 }

  // Row 4: barra ouro fina decorativa
  ws.getRow(4).height = 4
  for (let c = 2; c <= 13; c++) {
    ws.getCell(4, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GOLD } }
  }

  // Row 5-6: bloco de título "RESUMO DE HORAS" + info do BM
  ws.getRow(5).height = 26
  ws.getRow(6).height = 22

  ws.mergeCells('B5:E6')
  const titBlock = ws.getCell('B5')
  titBlock.value = `RESUMO DE HORAS\nBM ${String(bm.numero).padStart(2,'0')}`
  titBlock.font = { name: 'Arial', size: 13, bold: true, color: { argb: NAVY } }
  titBlock.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  titBlock.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BG_LIGHT } }
  titBlock.border = {
    top: { style: 'thin', color: { argb: GOLD } },
    bottom: { style: 'thin', color: { argb: GOLD } },
    left: { style: 'thin', color: { argb: GOLD } },
    right: { style: 'thin', color: { argb: GOLD } },
  }

  // Info do BM (F5:M6) em 2 linhas
  // Linha 5: Cliente | Local
  const labelStyle = { size: 8, bold: true, color: { argb: NAVY } } as const
  const valStyle = { size: 10, bold: true, color: { argb: 'FF333333' } } as const

  ws.getCell('F5').value = 'CLIENTE'
  ws.getCell('F5').font = labelStyle
  ws.getCell('F5').alignment = { horizontal: 'left', vertical: 'bottom', indent: 1 }
  ws.mergeCells('G5:I5')
  ws.getCell('G5').value = (bm.obras.cliente ?? '').toUpperCase()
  ws.getCell('G5').font = valStyle
  ws.getCell('G5').alignment = { horizontal: 'left', vertical: 'bottom' }

  ws.getCell('J5').value = 'LOCAL'
  ws.getCell('J5').font = labelStyle
  ws.getCell('J5').alignment = { horizontal: 'left', vertical: 'bottom', indent: 1 }
  ws.mergeCells('K5:M5')
  ws.getCell('K5').value = (bm.obras.local ?? '').toUpperCase()
  ws.getCell('K5').font = valStyle
  ws.getCell('K5').alignment = { horizontal: 'left', vertical: 'bottom' }

  ws.getCell('F6').value = 'PERÍODO'
  ws.getCell('F6').font = labelStyle
  ws.getCell('F6').alignment = { horizontal: 'left', vertical: 'top', indent: 1 }
  ws.mergeCells('G6:I6')
  const diasTotal = Math.ceil((new Date(bm.data_fim).getTime() - new Date(bm.data_inicio).getTime()) / 86400000) + 1
  ws.getCell('G6').value = `${new Date(bm.data_inicio + 'T12:00').toLocaleDateString('pt-BR')} a ${new Date(bm.data_fim + 'T12:00').toLocaleDateString('pt-BR')}  (${diasTotal} dias)`
  ws.getCell('G6').font = { size: 9, color: { argb: 'FF555555' } }
  ws.getCell('G6').alignment = { horizontal: 'left', vertical: 'top' }

  ws.getCell('J6').value = 'HORÁRIO'
  ws.getCell('J6').font = labelStyle
  ws.getCell('J6').alignment = { horizontal: 'left', vertical: 'top', indent: 1 }
  ws.mergeCells('K6:M6')
  ws.getCell('K6').value = '07:00 às 17:00'
  ws.getCell('K6').font = { size: 9, color: { argb: 'FF555555' } }
  ws.getCell('K6').alignment = { horizontal: 'left', vertical: 'top' }

  // Row 7: outra barra fina ouro
  ws.getRow(7).height = 3
  for (let c = 2; c <= 13; c++) {
    ws.getCell(7, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GOLD } }
  }

  // Start dates (needed below for other sheets)
  const start = new Date(bm.data_inicio + 'T12:00')
  const end = new Date(bm.data_fim + 'T12:00')

  // ══════════════════════════════════════════
  // TABELA — formato preview (12 colunas)
  // ══════════════════════════════════════════

  // Header rows 9-10 (2 linhas de cabeçalho agrupado)
  const HEADER_TOP = 9
  const HEADER_BOT = 10
  ws.getRow(8).height = 4  // pequeno respiro
  ws.getRow(HEADER_TOP).height = 22
  ws.getRow(HEADER_BOT).height = 22

  // Merges do cabeçalho superior
  ws.mergeCells(`B${HEADER_TOP}:B${HEADER_BOT}`) // Nº
  ws.mergeCells(`C${HEADER_TOP}:D${HEADER_BOT}`) // Função
  ws.mergeCells(`E${HEADER_TOP}:E${HEADER_BOT}`) // Efetivo
  ws.mergeCells(`F${HEADER_TOP}:H${HEADER_TOP}`) // DIAS (agrupado)
  ws.mergeCells(`I${HEADER_TOP}:K${HEADER_TOP}`) // HORAS (agrupado)
  ws.mergeCells(`L${HEADER_TOP}:L${HEADER_BOT}`) // R$/HH
  ws.mergeCells(`M${HEADER_TOP}:M${HEADER_BOT}`) // Valor total

  // Cabeçalho superior (grupos)
  const topCells: Array<[string, string]> = [
    ['B', 'Nº'],
    ['C', 'FUNÇÃO'],
    ['E', 'EFETIVO'],
    ['F', 'DIAS'],
    ['I', 'HORAS'],
    ['L', 'R$/HH'],
    ['M', 'VALOR TOTAL'],
  ]
  topCells.forEach(([col, val]) => {
    const cell = ws.getCell(`${col}${HEADER_TOP}`)
    cell.value = val
    cell.font = { bold: true, size: 10, color: { argb: WHITE } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  })

  // Cabeçalho inferior (sub-colunas de DIAS e HORAS)
  const subHeaders: Array<[string, string, string]> = [
    ['F', 'DIA HN', 'blue'],
    ['G', 'DIA HE 70%', 'amber'],
    ['H', 'DIA HE 100%', 'red'],
    ['I', 'HH NORMAL', 'blue'],
    ['J', 'HH HE 70%', 'amber'],
    ['K', 'HH HE 100%', 'red'],
  ]
  subHeaders.forEach(([col, val]) => {
    const cell = ws.getCell(`${col}${HEADER_BOT}`)
    cell.value = val
    cell.font = { bold: true, size: 9, color: { argb: WHITE } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_SOFT } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  })

  // Bordas em todo o bloco de header
  for (let r = HEADER_TOP; r <= HEADER_BOT; r++) {
    for (let c = 2; c <= 13; c++) {
      ws.getCell(r, c).border = {
        top: { style: 'thin', color: { argb: GOLD } },
        bottom: { style: 'thin', color: { argb: GOLD } },
        left: { style: 'thin', color: { argb: BORDER_LIGHT } },
        right: { style: 'thin', color: { argb: BORDER_LIGHT } },
      }
    }
  }

  // Linhas de dados (uma por função, como no preview)
  let row = HEADER_BOT + 1
  linhasFuncao.forEach((l, idx) => {
    const isAlt = idx % 2 === 1
    const bg = isAlt ? 'FFFAF8F2' : WHITE
    const setCell = (col: string, val: any, opts: { format?: string; color?: string; bold?: boolean; align?: 'left'|'center'|'right' } = {}) => {
      const cell = ws.getCell(`${col}${row}`)
      cell.value = val
      if (opts.format) cell.numFmt = opts.format
      cell.font = {
        size: 10,
        bold: opts.bold ?? false,
        color: { argb: opts.color ?? 'FF222222' },
      }
      cell.alignment = { horizontal: opts.align ?? 'center', vertical: 'middle' }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
      cell.border = {
        top: { style: 'hair', color: { argb: BORDER_LIGHT } },
        bottom: { style: 'hair', color: { argb: BORDER_LIGHT } },
        left: { style: 'hair', color: { argb: BORDER_LIGHT } },
        right: { style: 'hair', color: { argb: BORDER_LIGHT } },
      }
    }

    ws.mergeCells(`C${row}:D${row}`)
    setCell('B', idx + 1, { bold: true, color: NAVY })
    setCell('C', l.funcao, { align: 'left', bold: true })
    setCell('E', l.efetivo, { color: 'FF555555' })
    setCell('F', l.dia_hn || '', { color: 'FF1D4ED8', bold: true })
    setCell('G', l.dia_he70 || '', { color: 'FFB45309', bold: true })
    setCell('H', l.dia_he100 || '', { color: 'FFB91C1C', bold: true })
    setCell('I', l.hh_hn || '', { format: numberFormat, color: 'FF1D4ED8' })
    setCell('J', l.hh_he70 || '', { format: numberFormat, color: 'FFB45309' })
    setCell('K', l.hh_he100 || '', { format: numberFormat, color: 'FFB91C1C' })
    // R$/HH: mostra o valor normal como principal; se houver HE, aparece entre parênteses
    setCell('L', l.valor_hh_n || l.valor_hh_70 || l.valor_hh_100 || 0, { format: moneyFormat, align: 'right', color: 'FF555555' })
    setCell('M', l.valor_total, { format: moneyFormat, align: 'right', bold: true, color: NAVY })

    ws.getRow(row).height = 22
    row++
  })

  // ══════════════════════════════════════════
  // TOTAL GERAL — barra navy
  // ══════════════════════════════════════════
  row += 1
  ws.getRow(row).height = 32

  // Label "TOTAL GERAL"
  ws.mergeCells(`B${row}:E${row}`)
  const totLabel = ws.getCell(`B${row}`)
  totLabel.value = 'TOTAL GERAL'
  totLabel.font = { bold: true, size: 13, color: { argb: GOLD } }
  totLabel.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
  totLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }

  // Totais dias
  const setTot = (col: string, val: any, color: string, format?: string) => {
    const c = ws.getCell(`${col}${row}`)
    c.value = val
    if (format) c.numFmt = format
    c.font = { bold: true, size: 11, color: { argb: color } }
    c.alignment = { horizontal: 'center', vertical: 'middle' }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
  }
  setTot('F', totalDiaHN || '', 'FF93C5FD')
  setTot('G', totalDiaHe70 || '', 'FFFCD34D')
  setTot('H', totalDiaHe100 || '', 'FFFCA5A5')
  setTot('I', totalHHn || '', 'FF93C5FD', numberFormat)
  setTot('J', totalHH70 || '', 'FFFCD34D', numberFormat)
  setTot('K', totalHH100 || '', 'FFFCA5A5', numberFormat)

  ws.getCell(`L${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }

  const totValor = ws.getCell(`M${row}`)
  totValor.value = totalGeral
  totValor.numFmt = moneyFormat
  totValor.font = { bold: true, size: 13, color: { argb: GOLD } }
  totValor.alignment = { horizontal: 'right', vertical: 'middle' }
  totValor.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }

  // Bordas do bloco total
  for (let c = 2; c <= 13; c++) {
    ws.getCell(row, c).border = {
      top: { style: 'medium', color: { argb: GOLD } },
      bottom: { style: 'medium', color: { argb: GOLD } },
    }
  }

  // Rodapé: linha de assinatura decorativa
  row += 2
  ws.getRow(row).height = 4
  for (let c = 2; c <= 13; c++) {
    ws.getCell(row, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GOLD } }
  }
  row += 1
  ws.getCell(`B${row}`).value = `Emitido em ${new Date().toLocaleDateString('pt-BR')} · Tecnomonte Softmonte`
  ws.getCell(`B${row}`).font = { size: 8, italic: true, color: { argb: 'FF888888' } }
  ws.mergeCells(`B${row}:M${row}`)

  // Congelar painéis (mantém cabeçalho ao rolar)
  ws.views = [{ state: 'frozen', ySplit: HEADER_BOT, xSplit: 0 }]

  // Print setup (paisagem, caber em 1 página de largura)
  ws.pageSetup.orientation = 'landscape'
  ws.pageSetup.fitToPage = true
  ws.pageSetup.fitToWidth = 1
  ws.pageSetup.fitToHeight = 0
  ws.pageSetup.margins = { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 }

  // Helper: adiciona cabeçalho de marca (logo + info) em qualquer aba.
  // Retorna a linha a partir da qual o conteúdo deve começar.
  function addBrandedHeader(sheet: ExcelJS.Worksheet, lastCol: number, titulo: string, descricao: string): number {
    // Linhas 1-3: faixa navy com logo à esquerda e título à direita
    sheet.getRow(1).height = 18
    sheet.getRow(2).height = 18
    sheet.getRow(3).height = 18
    for (let r = 1; r <= 3; r++) {
      for (let c = 1; c <= lastCol; c++) {
        sheet.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
      }
    }
    // Logo inline
    try {
      const logoBuf = Buffer.from(TECNOMONTE_LOGO_DARK_B64, 'base64')
      const logoId = wb.addImage({ buffer: logoBuf as any, extension: 'png' })
      sheet.addImage(logoId, {
        tl: { col: 0.2, row: 0.3 } as any,
        ext: { width: 220, height: 66 },
        editAs: 'oneCell',
      })
    } catch (e) {
      sheet.getCell(1, 1).value = 'TECNOMONTE'
      sheet.getCell(1, 1).font = { bold: true, size: 16, color: { argb: WHITE } }
    }

    // Texto à direita (razão social + BM)
    const rightStart = Math.max(5, Math.ceil(lastCol / 2))
    sheet.mergeCells(1, rightStart, 2, lastCol)
    const sub = sheet.getCell(1, rightStart)
    sub.value = 'FABRICAÇÃO, MONTAGEM E MANUTENÇÃO INDUSTRIAL'
    sub.font = { size: 9, bold: true, italic: true, color: { argb: GOLD_LIGHT } }
    sub.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 }

    sheet.mergeCells(3, rightStart, 3, lastCol)
    const bmLabel = sheet.getCell(3, rightStart)
    bmLabel.value = `BOLETIM DE MEDIÇÃO Nº ${String(bm.numero).padStart(2,'0')}`
    bmLabel.font = { size: 10, bold: true, color: { argb: WHITE } }
    bmLabel.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 }

    // Linha 4: barra ouro fina
    sheet.getRow(4).height = 4
    for (let c = 1; c <= lastCol; c++) {
      sheet.getCell(4, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GOLD } }
    }

    // Linha 5-6: título e descrição da aba
    sheet.getRow(5).height = 22
    sheet.getRow(6).height = 16

    sheet.mergeCells(5, 1, 5, lastCol)
    const tit = sheet.getCell(5, 1)
    tit.value = titulo
    tit.font = { bold: true, size: 13, color: { argb: NAVY } }
    tit.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
    tit.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BG_LIGHT } }

    sheet.mergeCells(6, 1, 6, lastCol)
    const desc = sheet.getCell(6, 1)
    desc.value = descricao
    desc.font = { size: 9, italic: true, color: { argb: 'FF555555' } }
    desc.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
    desc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BG_LIGHT } }

    // Linha 7: barra ouro fina
    sheet.getRow(7).height = 3
    for (let c = 1; c <= lastCol; c++) {
      sheet.getCell(7, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GOLD } }
    }

    sheet.getRow(8).height = 4  // respiro
    return 9  // conteúdo começa na linha 9
  }

  // === Aba Lançamentos: linha por dia × função ===
  const ws2 = wb.addWorksheet('Lançamentos')

  // Carrega efetivo_diario do período (com nome do funcionário para a aba de calendário)
  const { data: efetivo } = await supabase
    .from('efetivo_diario')
    .select('data, tipo_dia, funcionario_id, funcionarios(nome, nome_guerra, cargo)')
    .eq('obra_id', bm.obras.id)
    .gte('data', bm.data_inicio)
    .lte('data', bm.data_fim)

  // Construir grid: função → data → count
  const datasArr: string[] = []
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    datasArr.push(d.toISOString().split('T')[0])
  }
  const funcoesAll = Array.from(new Set((efetivo ?? []).map((e: any) => e.funcionarios?.cargo).filter(Boolean))).sort()
  const grid: Record<string, Record<string, number>> = {}
  funcoesAll.forEach(f => { grid[f] = {} })
  ;(efetivo ?? []).forEach((e: any) => {
    const c = e.funcionarios?.cargo
    if (!c) return
    grid[c][e.data] = (grid[c][e.data] ?? 0) + 1
  })

  // Detectar feriados a partir de tipo_dia=domingo_feriado (qualquer dia marcado assim no período)
  const feriadosSet = new Set<string>()
  ;(efetivo ?? []).forEach((e: any) => {
    if (e.tipo_dia === 'domingo_feriado') feriadosSet.add(e.data)
  })

  // Cores
  const FILL_SAB   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3B0' } } as const // amarelo claro
  const FILL_DOMF  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7C7' } } as const // vermelho claro

  function fillForDate(iso: string) {
    const d = new Date(iso + 'T12:00')
    const dow = d.getDay() // 0=Dom 6=Sáb
    if (dow === 0 || feriadosSet.has(iso)) return FILL_DOMF
    if (dow === 6) return FILL_SAB
    return null
  }

  // Larguras
  ws2.getColumn(1).width = 22
  for (let i = 1; i <= datasArr.length; i++) {
    ws2.getColumn(i + 1).width = 5
  }
  ws2.getColumn(datasArr.length + 2).width = 8

  // Cabeçalho de marca
  const ws2LastCol = datasArr.length + 2
  const ws2Start = addBrandedHeader(
    ws2,
    ws2LastCol,
    'LANÇAMENTOS POR FUNÇÃO',
    `Quantidade de pessoas por função em cada dia do período  ·  Sábados em amarelo  ·  Domingos/feriados em vermelho`
  )

  // Header da tabela
  const headerRow = ws2Start
  ws2.getCell(headerRow, 1).value = 'FUNÇÃO'
  ws2.getCell(headerRow, 1).font = { bold: true, size: 10, color: { argb: WHITE } }
  ws2.getCell(headerRow, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
  ws2.getCell(headerRow, 1).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
  datasArr.forEach((d, idx) => {
    const cell = ws2.getCell(headerRow, 2 + idx)
    cell.value = new Date(d + 'T12:00')
    cell.numFmt = 'dd/mm'
    cell.font = { bold: true, size: 9, color: { argb: WHITE } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    const fill = fillForDate(d)
    cell.fill = fill ?? { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } } as any
  })
  const totHeader = ws2.getCell(headerRow, 2 + datasArr.length)
  totHeader.value = 'TOTAL'
  totHeader.font = { bold: true, size: 10, color: { argb: GOLD } }
  totHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
  totHeader.alignment = { horizontal: 'center', vertical: 'middle' }
  ws2.getRow(headerRow).height = 24

  funcoesAll.forEach((f, fIdx) => {
    const r = headerRow + 1 + fIdx
    ws2.getCell(r, 1).value = f
    ws2.getCell(r, 1).font = { bold: true, size: 10, color: { argb: NAVY } }
    ws2.getCell(r, 1).alignment = { vertical: 'middle', indent: 1 }
    let total = 0
    datasArr.forEach((d, idx) => {
      const v = grid[f][d] ?? 0
      const cell = ws2.getCell(r, 2 + idx)
      cell.value = v || ''
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      const fill = fillForDate(d)
      if (fill) cell.fill = fill as any
      total += v
    })
    const tc = ws2.getCell(r, 2 + datasArr.length)
    tc.value = total
    tc.font = { bold: true, color: { argb: NAVY } }
    tc.alignment = { horizontal: 'center', vertical: 'middle' }
    tc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BG_LIGHT } }
  })

  // Congelar painéis e print
  ws2.views = [{ state: 'frozen', ySplit: headerRow, xSplit: 1 }]
  ws2.pageSetup.orientation = 'landscape'
  ws2.pageSetup.fitToPage = true
  ws2.pageSetup.fitToWidth = 1
  ws2.pageSetup.fitToHeight = 0

  // === Aba Calendário por funcionário ===
  const ws3 = wb.addWorksheet('Calendário')
  // Lista única de funcionários que aparecem no período, ordenados por cargo + nome
  const funcMap: Record<string, { nome: string; cargo: string; datas: Set<string> }> = {}
  ;(efetivo ?? []).forEach((e: any) => {
    const fid = e.funcionario_id
    if (!fid || !e.funcionarios) return
    if (!funcMap[fid]) {
      funcMap[fid] = {
        nome: e.funcionarios.nome_guerra || e.funcionarios.nome || '—',
        cargo: e.funcionarios.cargo || '',
        datas: new Set<string>(),
      }
    }
    funcMap[fid].datas.add(e.data)
  })
  const funcList = Object.values(funcMap).sort((a, b) => (a.cargo + a.nome).localeCompare(b.cargo + b.nome))

  // Larguras
  ws3.getColumn(1).width = 28
  ws3.getColumn(2).width = 18
  for (let i = 0; i < datasArr.length; i++) {
    ws3.getColumn(3 + i).width = 5
  }
  ws3.getColumn(3 + datasArr.length).width = 8

  // Cabeçalho de marca
  const ws3LastCol = datasArr.length + 3
  const ws3Start = addBrandedHeader(
    ws3,
    ws3LastCol,
    'CALENDÁRIO DE PRESENÇA',
    `Controle dia a dia de cada funcionário  ·  "P" = Presente  ·  Sábado amarelo  ·  Domingo/feriado vermelho`
  )

  // Header da tabela
  const hRow = ws3Start
  ws3.getCell(hRow, 1).value = 'FUNCIONÁRIO'
  ws3.getCell(hRow, 1).font = { bold: true, size: 10, color: { argb: WHITE } }
  ws3.getCell(hRow, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
  ws3.getCell(hRow, 1).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
  ws3.getCell(hRow, 2).value = 'FUNÇÃO'
  ws3.getCell(hRow, 2).font = { bold: true, size: 10, color: { argb: WHITE } }
  ws3.getCell(hRow, 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
  ws3.getCell(hRow, 2).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
  datasArr.forEach((d, idx) => {
    const cell = ws3.getCell(hRow, 3 + idx)
    const dt = new Date(d + 'T12:00')
    const dow = dt.getDay()
    const diaSem = ['D','S','T','Q','Q','S','S'][dow]
    cell.value = `${diaSem}\n${dt.getDate()}/${dt.getMonth()+1}`
    cell.font = { bold: true, size: 8, color: { argb: WHITE } }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    const fill = fillForDate(d)
    if (fill) {
      cell.fill = fill as any
      cell.font = { bold: true, size: 8, color: { argb: NAVY } }
    } else {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
    }
    cell.border = { top: { style: 'thin', color: { argb: GOLD } }, left: { style: 'hair' }, right: { style: 'hair' }, bottom: { style: 'thin', color: { argb: GOLD } } }
  })
  const totCal = ws3.getCell(hRow, 3 + datasArr.length)
  totCal.value = 'TOTAL'
  totCal.font = { bold: true, size: 10, color: { argb: GOLD } }
  totCal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
  totCal.alignment = { horizontal: 'center', vertical: 'middle' }
  ws3.getRow(hRow).height = 28

  funcList.forEach((f, fIdx) => {
    const r = hRow + 1 + fIdx
    ws3.getCell(r, 1).value = f.nome
    ws3.getCell(r, 1).font = { bold: true, size: 9, color: { argb: NAVY } }
    ws3.getCell(r, 1).alignment = { vertical: 'middle', indent: 1 }
    ws3.getCell(r, 2).value = f.cargo
    ws3.getCell(r, 2).font = { size: 9, color: { argb: 'FF555555' } }
    ws3.getCell(r, 2).alignment = { vertical: 'middle', indent: 1 }
    let total = 0
    datasArr.forEach((d, idx) => {
      const cell = ws3.getCell(r, 3 + idx)
      const present = f.datas.has(d)
      const fill = fillForDate(d)
      if (present) {
        cell.value = 'P'
        cell.font = { bold: true, size: 9, color: { argb: 'FF155E2B' } }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        if (!fill) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } } as any
        } else {
          cell.fill = fill as any
        }
        total++
      } else {
        if (fill) cell.fill = fill as any
      }
      cell.border = { top: { style: 'hair' }, left: { style: 'hair' }, right: { style: 'hair' }, bottom: { style: 'hair' } }
    })
    const tcell = ws3.getCell(r, 3 + datasArr.length)
    tcell.value = total
    tcell.font = { bold: true, color: { argb: NAVY } }
    tcell.alignment = { horizontal: 'center', vertical: 'middle' }
    tcell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BG_LIGHT } }
  })

  // Congelar painéis e print
  ws3.views = [{ state: 'frozen', ySplit: hRow, xSplit: 2 }]
  ws3.pageSetup.orientation = 'landscape'
  ws3.pageSetup.fitToPage = true
  ws3.pageSetup.fitToWidth = 1
  ws3.pageSetup.fitToHeight = 0

  // Legenda
  const legRow = hRow + funcList.length + 3
  ws3.getCell(legRow, 1).value = 'Legenda:'
  ws3.getCell(legRow, 1).font = { bold: true, size: 9, color: { argb: NAVY } }
  ws3.getCell(legRow, 2).value = 'P = Presente'
  ws3.getCell(legRow, 2).font = { size: 9 }
  ws3.getCell(legRow + 1, 2).value = 'Sábado'
  ws3.getCell(legRow + 1, 2).fill = FILL_SAB as any
  ws3.getCell(legRow + 2, 2).value = 'Domingo / Feriado'
  ws3.getCell(legRow + 2, 2).fill = FILL_DOMF as any

  // === Output ===
  const buffer = await wb.xlsx.writeBuffer()
  const numero = String(bm.numero).padStart(2, '0')
  const obraName = (bm.obras.nome ?? 'obra').replace(/[^a-zA-Z0-9]/g, '_')
  const filename = `BM${numero}_${obraName}.xlsx`

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
