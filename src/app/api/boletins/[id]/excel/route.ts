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

  // Agrupar itens por (função × tipo_hora)
  const grupos: Record<string, { funcao: string; tipo: string; pessoasDia: number; carga: number; valorHH: number; valorTotal: number }> = {}
  ;(itens ?? []).forEach((i: any) => {
    const key = `${i.funcao_nome}_${i.tipo_hora}`
    if (!grupos[key]) {
      grupos[key] = {
        funcao: i.funcao_nome,
        tipo: i.tipo_hora,
        pessoasDia: 0,
        carga: 0,
        valorHH: Number(i.valor_hh ?? 0),
        valorTotal: 0,
      }
    }
    grupos[key].pessoasDia += Number(i.dias ?? 0)
    grupos[key].carga += Number(i.hh_total ?? 0)
    grupos[key].valorTotal += Number(i.valor_total ?? 0)
  })

  const linhasNormal = Object.values(grupos).filter(g => g.tipo === 'normal').sort((a, b) => a.funcao.localeCompare(b.funcao))
  const linhasHe70   = Object.values(grupos).filter(g => g.tipo === 'extra_70').sort((a, b) => a.funcao.localeCompare(b.funcao))
  const linhasHe100  = Object.values(grupos).filter(g => g.tipo === 'extra_100').sort((a, b) => a.funcao.localeCompare(b.funcao))

  // Calcular total geral
  const totalGeral = (itens ?? []).reduce((s: number, i: any) => s + Number(i.valor_total ?? 0), 0)

  // === Gerar workbook ===
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Tecnomonte Softmonte'
  wb.created = new Date()

  const ws = wb.addWorksheet('Resumo de Horas')

  // Definir larguras de coluna
  ws.columns = [
    { width: 4 },   // A
    { width: 6 },   // B - ITEM
    { width: 14 },  // C - DESCRIÇÃO
    { width: 14 },  // D
    { width: 14 },  // E
    { width: 12 },  // F - EFETIVO
    { width: 10 },  // G - DIAS
    { width: 18 },  // H - CARGA HORÁRIA
    { width: 14 },  // I - VALOR
    { width: 18 },  // J - VALOR TOTAL
  ]

  // === Cabeçalho ===
  ws.mergeCells('B1:J1')
  ws.getCell('B1').value = 'TECNOMONTE MONTAGEM E FABRICAÇAO DE TANQUES INDUSTRIAIS EIRELI'
  ws.getCell('B1').font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } }
  ws.getCell('B1').alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getCell('B1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F1E2E' } }
  ws.getRow(1).height = 30

  ws.mergeCells('C2:E6')
  ws.getCell('C2').value = `RESUMO DE HORAS\nMÃO DE OBRA APOIO ROTINA ${(bm.obras.local ?? 'CUBATÃO').toUpperCase()}`
  ws.getCell('C2').font = { bold: true, size: 13 }
  ws.getCell('C2').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  ws.getCell('C2').border = { top: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'thin' } }

  ws.getCell('F2').value = 'Local:'
  ws.getCell('F2').font = { bold: true }
  ws.mergeCells('G2:J2')
  ws.getCell('G2').value = `${(bm.obras.cliente ?? '').toUpperCase()} - ${(bm.obras.local ?? 'CUBATÃO').toUpperCase()}`
  ws.getCell('G2').font = { bold: true }

  ws.getCell('F3').value = 'Início:'
  ws.getCell('F3').font = { bold: true }
  ws.getCell('G3').value = new Date(bm.data_inicio + 'T12:00')
  ws.getCell('G3').numFmt = 'dd/mm/yyyy'
  ws.getCell('I3').value = 'Término:'
  ws.getCell('I3').font = { bold: true }
  ws.getCell('J3').value = new Date(bm.data_fim + 'T12:00')
  ws.getCell('J3').numFmt = 'dd/mm/yyyy'

  const dias = Math.ceil((new Date(bm.data_fim).getTime() - new Date(bm.data_inicio).getTime()) / 86400000) + 1
  ws.getCell('F4').value = 'Período:'
  ws.getCell('F4').font = { bold: true }
  ws.getCell('G4').value = `${dias} dias`
  ws.getCell('H4').value = 'Carga Horária:'
  ws.getCell('H4').font = { bold: true }
  ws.getCell('J4').value = '07:00 às 17:00'

  // Contar dias úteis no período
  const start = new Date(bm.data_inicio + 'T12:00')
  const end = new Date(bm.data_fim + 'T12:00')
  let diasUteis = 0
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) diasUteis++
  }

  ws.getCell('F5').value = 'Segunda a Sexta'
  ws.getCell('F5').font = { bold: true, size: 9 }
  ws.getCell('F5').alignment = { horizontal: 'center' }
  ws.getCell('H5').value = 'Sábado'
  ws.getCell('H5').font = { bold: true, size: 9 }
  ws.getCell('H5').alignment = { horizontal: 'center' }
  ws.getCell('J5').value = 'Domingo / Feriado'
  ws.getCell('J5').font = { bold: true, size: 9 }
  ws.getCell('J5').alignment = { horizontal: 'center' }

  ws.getCell('F6').value = diasUteis
  ws.getCell('F6').alignment = { horizontal: 'center' }
  ws.getCell('F6').font = { bold: true }
  ws.getCell('H6').value = 0
  ws.getCell('H6').alignment = { horizontal: 'center' }
  ws.getCell('H6').font = { bold: true }
  ws.getCell('J6').value = 0
  ws.getCell('J6').alignment = { horizontal: 'center' }
  ws.getCell('J6').font = { bold: true }

  // === Tabela de itens ===
  const headerRow = 8
  const headers = ['ITEM', 'DESCRIÇÃO', '', '', 'EFETIVO', 'DIAS', 'CARGA HORÁRIA', 'VALOR', 'VALOR TOTAL']
  headers.forEach((h, i) => {
    const cell = ws.getCell(headerRow, 2 + i)
    cell.value = h
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC8960C' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'thin' } }
  })
  ws.mergeCells(`C${headerRow}:E${headerRow}`)
  ws.getRow(headerRow).height = 28

  let row = headerRow + 1
  const moneyFormat = '"R$" #,##0.00;[Red]-"R$" #,##0.00'
  const numberFormat = '#,##0.00'

  function addSecao(numero: number, label: string, linhas: typeof linhasNormal) {
    // Cabeçalho da seção
    ws.getCell(`B${row}`).value = numero
    ws.getCell(`B${row}`).font = { bold: true }
    ws.mergeCells(`C${row}:I${row}`)
    ws.getCell(`C${row}`).value = label
    ws.getCell(`C${row}`).font = { bold: true, color: { argb: 'FF0F1E2E' } }
    ws.getCell(`C${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF8' } }
    const subtotal = linhas.reduce((s, l) => s + l.valorTotal, 0)
    ws.getCell(`J${row}`).value = subtotal
    ws.getCell(`J${row}`).numFmt = moneyFormat
    ws.getCell(`J${row}`).font = { bold: true }
    ws.getCell(`J${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF8' } }
    for (let c = 2; c <= 10; c++) {
      ws.getCell(row, c).border = { top: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'thin' } }
    }
    row++

    // Linhas da seção
    linhas.forEach((l, idx) => {
      const efetivo = compMap[l.funcao.toUpperCase()]?.quantidade_contratada ?? 1
      ws.getCell(`B${row}`).value = `${numero}.${idx + 1}`
      ws.mergeCells(`C${row}:E${row}`)
      ws.getCell(`C${row}`).value = l.funcao
      ws.getCell(`F${row}`).value = efetivo
      ws.getCell(`F${row}`).alignment = { horizontal: 'center' }
      ws.getCell(`G${row}`).value = l.pessoasDia / efetivo  // dias por pessoa? actually we use total dias-pessoa here
      // Actually use the total person-days as "dias" for the row, like the official does
      ws.getCell(`G${row}`).value = diasUteis  // total dias úteis do período
      ws.getCell(`G${row}`).alignment = { horizontal: 'center' }
      ws.getCell(`H${row}`).value = l.carga
      ws.getCell(`H${row}`).numFmt = numberFormat
      ws.getCell(`H${row}`).alignment = { horizontal: 'center' }
      ws.getCell(`I${row}`).value = l.valorHH
      ws.getCell(`I${row}`).numFmt = moneyFormat
      ws.getCell(`I${row}`).alignment = { horizontal: 'right' }
      ws.getCell(`J${row}`).value = l.valorTotal
      ws.getCell(`J${row}`).numFmt = moneyFormat
      ws.getCell(`J${row}`).alignment = { horizontal: 'right' }
      for (let c = 2; c <= 10; c++) {
        ws.getCell(row, c).border = { top: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'thin' } }
      }
      row++
    })
  }

  addSecao(1, 'HORA NORMAL', linhasNormal)
  if (linhasHe70.length > 0) addSecao(2, 'HORA EXTRA 70%', linhasHe70)
  if (linhasHe100.length > 0) addSecao(3, 'HORA EXTRA 100%', linhasHe100)

  // === Total geral ===
  row += 1
  ws.mergeCells(`B${row}:I${row}`)
  ws.getCell(`B${row}`).value = 'TOTAL :'
  ws.getCell(`B${row}`).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } }
  ws.getCell(`B${row}`).alignment = { horizontal: 'right', vertical: 'middle' }
  ws.getCell(`B${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F1E2E' } }
  ws.getCell(`J${row}`).value = totalGeral
  ws.getCell(`J${row}`).numFmt = moneyFormat
  ws.getCell(`J${row}`).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } }
  ws.getCell(`J${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F1E2E' } }
  for (let c = 2; c <= 10; c++) {
    ws.getCell(row, c).border = { top: { style: 'medium' }, left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'medium' } }
  }
  ws.getRow(row).height = 28

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
