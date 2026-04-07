import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import ExcelJS from 'exceljs'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
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

  // Paleta Tecnomonte
  const NAVY = 'FF0F1E2E'
  const NAVY_DARK = 'FF091623'
  const GOLD = 'FFC8960C'
  const GOLD_LIGHT = 'FFE4B341'
  const BG_LIGHT = 'FFF7F3E8'
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
  // CABEÇALHO — logo em células + barras
  // ══════════════════════════════════════════

  // Row 1-2: barra navy grande com logo + título
  ws.getRow(1).height = 22
  ws.getRow(2).height = 34

  // Logo block em B1:C2 — monograma "TM" em ouro sobre navy
  ws.mergeCells('B1:C2')
  const logo = ws.getCell('B1')
  logo.value = 'TM'
  logo.font = { name: 'Arial Black', size: 28, bold: true, color: { argb: GOLD } }
  logo.alignment = { horizontal: 'center', vertical: 'middle' }
  logo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
  logo.border = {
    top: { style: 'medium', color: { argb: GOLD } },
    left: { style: 'medium', color: { argb: GOLD } },
    bottom: { style: 'medium', color: { argb: GOLD } },
    right: { style: 'medium', color: { argb: GOLD } },
  }

  // Título principal "TECNOMONTE" (D1:M1)
  ws.mergeCells('D1:M1')
  const t1 = ws.getCell('D1')
  t1.value = 'TECNOMONTE'
  t1.font = { name: 'Arial Black', size: 18, bold: true, color: { argb: WHITE } }
  t1.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
  t1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }

  // Subtítulo (D2:M2)
  ws.mergeCells('D2:M2')
  const t2 = ws.getCell('D2')
  t2.value = 'MONTAGEM E FABRICAÇÃO DE TANQUES INDUSTRIAIS EIRELI'
  t2.font = { size: 9, color: { argb: GOLD_LIGHT }, italic: true }
  t2.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
  t2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }

  // Row 3: barra ouro fina decorativa
  ws.getRow(3).height = 4
  for (let c = 2; c <= 13; c++) {
    ws.getCell(3, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GOLD } }
  }

  // Row 4-5: bloco de título "RESUMO DE HORAS" + info do BM
  ws.getRow(4).height = 26
  ws.getRow(5).height = 22

  ws.mergeCells('B4:E5')
  const titBlock = ws.getCell('B4')
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

  // Info do BM (F4:M5) em 2 linhas
  // Linha 4: Cliente | Local | Período
  const labelStyle = { size: 8, bold: true, color: { argb: NAVY } } as const
  const valStyle = { size: 10, bold: true, color: { argb: 'FF333333' } } as const

  ws.getCell('F4').value = 'CLIENTE'
  ws.getCell('F4').font = labelStyle
  ws.getCell('F4').alignment = { horizontal: 'left', vertical: 'bottom', indent: 1 }
  ws.mergeCells('G4:I4')
  ws.getCell('G4').value = (bm.obras.cliente ?? '').toUpperCase()
  ws.getCell('G4').font = valStyle
  ws.getCell('G4').alignment = { horizontal: 'left', vertical: 'bottom' }

  ws.getCell('J4').value = 'LOCAL'
  ws.getCell('J4').font = labelStyle
  ws.getCell('J4').alignment = { horizontal: 'left', vertical: 'bottom', indent: 1 }
  ws.mergeCells('K4:M4')
  ws.getCell('K4').value = (bm.obras.local ?? '').toUpperCase()
  ws.getCell('K4').font = valStyle
  ws.getCell('K4').alignment = { horizontal: 'left', vertical: 'bottom' }

  ws.getCell('F5').value = 'PERÍODO'
  ws.getCell('F5').font = labelStyle
  ws.getCell('F5').alignment = { horizontal: 'left', vertical: 'top', indent: 1 }
  ws.mergeCells('G5:I5')
  const diasTotal = Math.ceil((new Date(bm.data_fim).getTime() - new Date(bm.data_inicio).getTime()) / 86400000) + 1
  ws.getCell('G5').value = `${new Date(bm.data_inicio + 'T12:00').toLocaleDateString('pt-BR')} a ${new Date(bm.data_fim + 'T12:00').toLocaleDateString('pt-BR')}  (${diasTotal} dias)`
  ws.getCell('G5').font = { size: 9, color: { argb: 'FF555555' } }
  ws.getCell('G5').alignment = { horizontal: 'left', vertical: 'top' }

  ws.getCell('J5').value = 'HORÁRIO'
  ws.getCell('J5').font = labelStyle
  ws.getCell('J5').alignment = { horizontal: 'left', vertical: 'top', indent: 1 }
  ws.mergeCells('K5:M5')
  ws.getCell('K5').value = '07:00 às 17:00'
  ws.getCell('K5').font = { size: 9, color: { argb: 'FF555555' } }
  ws.getCell('K5').alignment = { horizontal: 'left', vertical: 'top' }

  // Row 6: outra barra fina ouro
  ws.getRow(6).height = 3
  for (let c = 2; c <= 13; c++) {
    ws.getCell(6, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GOLD } }
  }

  // Row 7: espaçamento
  ws.getRow(7).height = 4

  // Start dates (needed below for other sheets)
  const start = new Date(bm.data_inicio + 'T12:00')
  const end = new Date(bm.data_fim + 'T12:00')

  // ══════════════════════════════════════════
  // TABELA — formato preview (12 colunas)
  // ══════════════════════════════════════════

  // Header rows 8-9 (2 linhas de cabeçalho agrupado)
  const HEADER_TOP = 8
  const HEADER_BOT = 9
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
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_DARK } }
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

  // Header
  ws2.getCell(1, 1).value = 'Função'
  ws2.getCell(1, 1).font = { bold: true }
  datasArr.forEach((d, idx) => {
    const cell = ws2.getCell(1, 2 + idx)
    cell.value = new Date(d + 'T12:00')
    cell.numFmt = 'dd/mm'
    cell.font = { bold: true, size: 9 }
    cell.alignment = { horizontal: 'center' }
    const fill = fillForDate(d)
    if (fill) cell.fill = fill as any
  })
  ws2.getCell(1, 2 + datasArr.length).value = 'Total'
  ws2.getCell(1, 2 + datasArr.length).font = { bold: true }

  funcoesAll.forEach((f, fIdx) => {
    const r = 2 + fIdx
    ws2.getCell(r, 1).value = f
    ws2.getCell(r, 1).font = { bold: true }
    let total = 0
    datasArr.forEach((d, idx) => {
      const v = grid[f][d] ?? 0
      const cell = ws2.getCell(r, 2 + idx)
      cell.value = v
      cell.alignment = { horizontal: 'center' }
      const fill = fillForDate(d)
      if (fill) cell.fill = fill as any
      total += v
    })
    ws2.getCell(r, 2 + datasArr.length).value = total
    ws2.getCell(r, 2 + datasArr.length).font = { bold: true }
    ws2.getCell(r, 2 + datasArr.length).alignment = { horizontal: 'center' }
  })

  ws2.columns[0] = { width: 22 }
  for (let i = 1; i <= datasArr.length; i++) {
    ws2.getColumn(i + 1).width = 5
  }
  ws2.getColumn(datasArr.length + 2).width = 8

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

  // Header
  ws3.getCell(1, 1).value = 'Funcionário'
  ws3.getCell(1, 1).font = { bold: true }
  ws3.getCell(1, 2).value = 'Função'
  ws3.getCell(1, 2).font = { bold: true }
  datasArr.forEach((d, idx) => {
    const cell = ws3.getCell(1, 3 + idx)
    const dt = new Date(d + 'T12:00')
    const dow = dt.getDay()
    const diaSem = ['D','S','T','Q','Q','S','S'][dow]
    cell.value = `${diaSem}\n${dt.getDate()}/${dt.getMonth()+1}`
    cell.font = { bold: true, size: 8 }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    const fill = fillForDate(d)
    if (fill) cell.fill = fill as any
    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'thin' } }
  })
  ws3.getCell(1, 3 + datasArr.length).value = 'Total'
  ws3.getCell(1, 3 + datasArr.length).font = { bold: true }
  ws3.getRow(1).height = 28

  funcList.forEach((f, fIdx) => {
    const r = 2 + fIdx
    ws3.getCell(r, 1).value = f.nome
    ws3.getCell(r, 1).font = { bold: true, size: 9 }
    ws3.getCell(r, 2).value = f.cargo
    ws3.getCell(r, 2).font = { size: 9 }
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
    ws3.getCell(r, 3 + datasArr.length).value = total
    ws3.getCell(r, 3 + datasArr.length).font = { bold: true }
    ws3.getCell(r, 3 + datasArr.length).alignment = { horizontal: 'center' }
  })

  ws3.getColumn(1).width = 28
  ws3.getColumn(2).width = 18
  for (let i = 0; i < datasArr.length; i++) {
    ws3.getColumn(3 + i).width = 5
  }
  ws3.getColumn(3 + datasArr.length).width = 8

  // Legenda
  const legRow = funcList.length + 4
  ws3.getCell(legRow, 1).value = 'Legenda:'
  ws3.getCell(legRow, 1).font = { bold: true, size: 9 }
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
