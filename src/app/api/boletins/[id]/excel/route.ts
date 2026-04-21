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
  if (!bm.obras) return NextResponse.json({ error: 'Obra vinculada a este BM foi removida' }, { status: 404 })

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

  // Colunas — layout 3 seções (como PDF Cesari)
  ws.columns = [
    { width: 3 },    // A — margem
    { width: 7 },    // B — ITEM
    { width: 32 },   // C — DESCRIÇÃO
    { width: 10 },   // D — EFETIVO
    { width: 8 },    // E — DIAS
    { width: 16 },   // F — CARGA HORÁRIA
    { width: 14 },   // G — VALOR
    { width: 16 },   // H — VALOR TOTAL
  ]
  const LAST_COL = 8

  // ══════════════════════════════════════════
  // CABEÇALHO — logo + info do BM (formato Cesari)
  // ══════════════════════════════════════════
  const start = new Date(bm.data_inicio + 'T12:00')
  const end = new Date(bm.data_fim + 'T12:00')
  const diasTotal = Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1

  // Contar dias úteis, sábados e domingos/feriados no período
  let diasUteis = 0, diasSab = 0, diasDomFer = 0
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay()
    if (dow === 0) diasDomFer++
    else if (dow === 6) diasSab++
    else diasUteis++
  }

  // Rows 1-3: faixa navy com logo
  for (let r = 1; r <= 3; r++) {
    ws.getRow(r).height = 18
    for (let c = 2; c <= LAST_COL; c++) {
      ws.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
    }
  }
  try {
    const logoBuf = Buffer.from(TECNOMONTE_LOGO_DARK_B64, 'base64')
    const logoId = wb.addImage({ buffer: logoBuf as any, extension: 'png' })
    ws.addImage(logoId, { tl: { col: 1.2, row: 0.2 } as any, ext: { width: 200, height: 60 }, editAs: 'oneCell' })
  } catch { /* fallback sem logo */ }

  // Título "RESUMO DE HORAS" + subtítulo
  ws.mergeCells('D1:F2')
  const titCell = ws.getCell('D1')
  titCell.value = 'RESUMO DE HORAS\nMÃO DE OBRA APOIO ROTINA'
  titCell.font = { size: 11, bold: true, color: { argb: WHITE } }
  titCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }

  // Info lado direito
  const infoFont = { size: 9, bold: true, color: { argb: WHITE } } as const
  const infoValFont = { size: 9, bold: true, color: { argb: GOLD_LIGHT } } as const

  ws.getCell('G1').value = 'Local:'
  ws.getCell('G1').font = infoFont
  ws.getCell('H1').value = (bm.obras.nome ?? '').toUpperCase()
  ws.getCell('H1').font = infoValFont

  ws.getCell('G2').value = 'Início:'
  ws.getCell('G2').font = infoFont
  ws.getCell('H2').value = `${new Date(bm.data_inicio + 'T12:00').toLocaleDateString('pt-BR')}`
  ws.getCell('H2').font = infoValFont

  ws.getCell('G3').value = 'Período:'
  ws.getCell('G3').font = infoFont
  ws.getCell('H3').value = `${diasTotal} dias`
  ws.getCell('H3').font = infoValFont

  // Row 4: info dias úteis
  ws.getRow(4).height = 18
  for (let c = 2; c <= LAST_COL; c++) {
    ws.getCell(4, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BG_LIGHT } }
  }
  ws.getCell('C4').value = 'Segunda a Sexta'
  ws.getCell('C4').font = { size: 9, bold: true, color: { argb: NAVY } }
  ws.getCell('D4').value = diasUteis
  ws.getCell('D4').font = { size: 10, bold: true, color: { argb: NAVY } }
  ws.getCell('D4').alignment = { horizontal: 'center' }
  ws.getCell('E4').value = 'Sábado'
  ws.getCell('E4').font = { size: 9, bold: true, color: { argb: NAVY } }
  ws.getCell('F4').value = diasSab
  ws.getCell('F4').font = { size: 10, bold: true, color: { argb: NAVY } }
  ws.getCell('F4').alignment = { horizontal: 'center' }
  ws.getCell('G4').value = 'Domingo / Feriado'
  ws.getCell('G4').font = { size: 9, bold: true, color: { argb: NAVY } }
  ws.getCell('H4').value = diasDomFer
  ws.getCell('H4').font = { size: 10, bold: true, color: { argb: NAVY } }
  ws.getCell('H4').alignment = { horizontal: 'center' }

  // Row 5: barra ouro
  ws.getRow(5).height = 3
  for (let c = 2; c <= LAST_COL; c++) {
    ws.getCell(5, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GOLD } }
  }

  // ══════════════════════════════════════════
  // CABEÇALHO DA TABELA (row 6)
  // ══════════════════════════════════════════
  ws.getRow(6).height = 26
  const headerCols: Array<[string, string]> = [
    ['B', 'ITEM'], ['C', 'DESCRIÇÃO'], ['D', 'EFETIVO'],
    ['E', 'DIAS'], ['F', 'CARGA HORÁRIA'], ['G', 'VALOR'], ['H', 'VALOR\nTOTAL'],
  ]
  headerCols.forEach(([col, val]) => {
    const cell = ws.getCell(`${col}6`)
    cell.value = val
    cell.font = { bold: true, size: 9, color: { argb: WHITE } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border = { bottom: { style: 'thin', color: { argb: GOLD } } }
  })

  // ══════════════════════════════════════════
  // 3 SEÇÕES: HORA NORMAL / HORA EXTRA 70% / HORA EXTRA 100%
  // ══════════════════════════════════════════
  const sections = [
    { num: 1, label: 'HORA NORMAL', hhKey: 'hh_hn' as const, vhhKey: 'valor_hh_n' as const },
    { num: 2, label: 'HORA EXTRA 70%', hhKey: 'hh_he70' as const, vhhKey: 'valor_hh_70' as const },
    { num: 3, label: 'HORA EXTRA 100%', hhKey: 'hh_he100' as const, vhhKey: 'valor_hh_100' as const },
  ]

  let row = 7
  const thinBorder = { style: 'hair' as const, color: { argb: BORDER_LIGHT } }
  const cellBorder = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder }

  for (const sec of sections) {
    // Subtotal da seção
    const secTotal = linhasFuncao.reduce((s, l) => {
      const hh = l[sec.hhKey]
      const vhh = l[sec.vhhKey]
      return s + hh * vhh
    }, 0)

    // Section header row
    ws.getRow(row).height = 24
    ws.getCell(`B${row}`).value = sec.num
    ws.getCell(`B${row}`).font = { bold: true, size: 11, color: { argb: NAVY } }
    ws.getCell(`B${row}`).alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getCell(`C${row}`).value = sec.label
    ws.getCell(`C${row}`).font = { bold: true, size: 11, color: { argb: NAVY } }
    ws.getCell(`C${row}`).alignment = { horizontal: 'left', vertical: 'middle' }
    ws.getCell(`H${row}`).value = secTotal > 0 ? secTotal : null
    ws.getCell(`H${row}`).numFmt = moneyFormat
    ws.getCell(`H${row}`).font = { bold: true, size: 11, color: { argb: NAVY } }
    ws.getCell(`H${row}`).alignment = { horizontal: 'right', vertical: 'middle' }
    // Background for section header
    for (let c = 2; c <= LAST_COL; c++) {
      ws.getCell(row, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BG_LIGHT } }
      ws.getCell(row, c).border = cellBorder
    }
    row++

    // Function rows
    linhasFuncao.forEach((l, idx) => {
      const hh = l[sec.hhKey]
      const vhh = l[sec.vhhKey]
      const valorLinha = hh * vhh
      const isAlt = idx % 2 === 1
      const bg = isAlt ? 'FFFAF8F2' : WHITE

      ws.getRow(row).height = 20
      const setC = (col: string, val: any, opts: { fmt?: string; bold?: boolean; align?: 'left'|'center'|'right' } = {}) => {
        const cell = ws.getCell(`${col}${row}`)
        cell.value = val
        if (opts.fmt) cell.numFmt = opts.fmt
        cell.font = { size: 10, bold: opts.bold, color: { argb: 'FF222222' } }
        cell.alignment = { horizontal: opts.align ?? 'center', vertical: 'middle' }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
        cell.border = cellBorder
      }

      setC('B', `${sec.num}.${idx + 1}`, { bold: true })
      setC('C', l.funcao, { align: 'left', bold: true })
      setC('D', l.efetivo)
      setC('E', hh > 0 ? diasUteis : 0)
      setC('F', hh > 0 ? Math.round(hh * 10) / 10 : 0, { fmt: '#,##0.0' })
      setC('G', vhh > 0 ? vhh : null, { fmt: moneyFormat })
      setC('H', valorLinha > 0 ? valorLinha : null, { fmt: moneyFormat, bold: true })

      row++
    })
  }

  // ══════════════════════════════════════════
  // TOTAL GERAL
  // ══════════════════════════════════════════
  row += 1
  ws.getRow(row).height = 30
  ws.mergeCells(`B${row}:F${row}`)
  // Empty cells for merge
  for (let c = 2; c <= LAST_COL; c++) {
    ws.getCell(row, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: WHITE } }
  }
  ws.getCell(`F${row}`).value = 'TOTAL :'
  ws.getCell(`F${row}`).font = { bold: true, size: 12, color: { argb: NAVY } }
  ws.getCell(`F${row}`).alignment = { horizontal: 'right', vertical: 'middle' }
  ws.getCell(`G${row}`).value = 'R$'
  ws.getCell(`G${row}`).font = { bold: true, size: 12, color: { argb: NAVY } }
  ws.getCell(`G${row}`).alignment = { horizontal: 'right', vertical: 'middle' }
  ws.getCell(`H${row}`).value = totalGeral
  ws.getCell(`H${row}`).numFmt = '#,##0.00'
  ws.getCell(`H${row}`).font = { bold: true, size: 13, color: { argb: NAVY } }
  ws.getCell(`H${row}`).alignment = { horizontal: 'right', vertical: 'middle' }
  for (let c = 2; c <= LAST_COL; c++) {
    ws.getCell(row, c).border = {
      top: { style: 'medium', color: { argb: NAVY } },
      bottom: { style: 'medium', color: { argb: NAVY } },
    }
  }

  // Rodapé
  row += 2
  ws.getRow(row).height = 4
  for (let c = 2; c <= LAST_COL; c++) {
    ws.getCell(row, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GOLD } }
  }
  row += 1
  ws.getCell(`B${row}`).value = `Emitido em ${new Date().toLocaleDateString('pt-BR')} · Tecnomonte Softmonte`
  ws.getCell(`B${row}`).font = { size: 8, italic: true, color: { argb: 'FF888888' } }
  ws.mergeCells(`B${row}:H${row}`)

  // Congelar painéis
  ws.views = [{ state: 'frozen', ySplit: 6, xSplit: 0 }]

  // Print setup
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

  // Carrega presença real: alocações + ponto_marcacoes (não depende de efetivo_diario)
  const { data: alocsPeriodo } = await supabase
    .from('alocacoes')
    .select('funcionario_id, data_inicio, data_fim, funcionarios(id, nome, nome_guerra, cargo)')
    .eq('obra_id', bm.obras.id)
    .lte('data_inicio', bm.data_fim)
    .or(`data_fim.is.null,data_fim.gte.${bm.data_inicio}`)

  const funcIdsObra = (alocsPeriodo ?? []).map((a: any) => a.funcionario_id).filter(Boolean)

  // Busca marcações de ponto paginada
  let allPontoMarcs: any[] = []
  if (funcIdsObra.length > 0) {
    let offset = 0
    while (true) {
      const { data: page } = await supabase
        .from('ponto_marcacoes')
        .select('funcionario_id, data')
        .in('funcionario_id', funcIdsObra)
        .gte('data', bm.data_inicio)
        .lte('data', bm.data_fim)
        .range(offset, offset + 999)
      if (!page || page.length === 0) break
      allPontoMarcs = allPontoMarcs.concat(page)
      if (page.length < 1000) break
      offset += 1000
    }
  }

  // Mapa funcionario_id → {nome, cargo, datas com ponto}
  type FuncPresenca = { nome: string; cargo: string; datas: Set<string> }
  const funcPresMap: Record<string, FuncPresenca> = {}
  ;(alocsPeriodo ?? []).forEach((a: any) => {
    const fid = a.funcionario_id
    if (!fid || !a.funcionarios || funcPresMap[fid]) return
    funcPresMap[fid] = {
      nome: a.funcionarios.nome_guerra || a.funcionarios.nome || '—',
      cargo: a.funcionarios.cargo || '—',
      datas: new Set(),
    }
  })
  allPontoMarcs.forEach((m: any) => {
    if (funcPresMap[m.funcionario_id]) funcPresMap[m.funcionario_id].datas.add(m.data)
  })

  // Simula "efetivo" pra compatibilidade com o grid abaixo
  const efetivo = Object.entries(funcPresMap).flatMap(([fid, fp]) =>
    Array.from(fp.datas).map(data => ({
      funcionario_id: fid,
      data,
      tipo_dia: (() => { const dow = new Date(data + 'T12:00').getDay(); return dow === 0 ? 'domingo_feriado' : dow === 6 ? 'sabado' : 'util' })(),
      funcionarios: { nome: fp.nome, nome_guerra: fp.nome, cargo: fp.cargo },
    }))
  )

  // Construir grid: função → data → count
  const datasArr: string[] = []
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    datasArr.push(d.toISOString().split('T')[0])
  }
  const funcoesAll = Array.from(new Set(efetivo.map(e => e.funcionarios?.cargo).filter(Boolean))).sort()
  const grid: Record<string, Record<string, number>> = {}
  funcoesAll.forEach(f => { grid[f] = {} })
  efetivo.forEach(e => {
    const c = e.funcionarios?.cargo
    if (!c) return
    grid[c][e.data] = (grid[c][e.data] ?? 0) + 1
  })

  // Detectar domingos/feriados
  const feriadosSet = new Set<string>()
  efetivo.forEach(e => {
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
