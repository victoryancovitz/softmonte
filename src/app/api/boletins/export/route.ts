import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { requireRoleApi } from '@/lib/require-role'

export async function POST(req: NextRequest) {
  const authErr = await requireRoleApi(['admin', 'financeiro', 'encarregado', 'engenheiro', 'rh'])
  if (authErr) return authErr

  const { bm_id } = await req.json()
  if (!bm_id) return NextResponse.json({ error: 'bm_id obrigatório' }, { status: 400 })
  const supabase = createClient()

  const { data: bm } = await supabase.from('boletins_medicao')
    .select('*, obras(nome, cliente, local)').eq('id', bm_id).single()
  if (!bm) return NextResponse.json({ error: 'BM não encontrado' }, { status: 404 })

  const { data: efetivo } = await supabase.from('efetivo_diario')
    .select('funcionario_id, data, tipo_dia, observacao, funcionarios(nome, cargo, matricula, custo_hora, vt_estrutura)')
    .eq('obra_id', bm.obras.id)
    .gte('data', bm.data_inicio)
    .lte('data', bm.data_fim)
    .order('data')

  // Build CSV as fallback (xlsx requires library not available server-side without install)
  const rows = [
    ['BOLETIM DE MEDIÇÃO - ' + bm.obras.nome],
    ['Cliente:', bm.obras.cliente ?? '', 'Local:', bm.obras.local ?? ''],
    ['Período:', bm.data_inicio + ' a ' + bm.data_fim, 'Medição Nº:', `BM${String(bm.numero).padStart(2,'0')}`],
    [],
    ['NOME', 'MATRÍCULA', 'CARGO', 'DATA', 'TIPO DIA', 'OBSERVAÇÃO'],
    ...(efetivo ?? []).map((e: any) => [
      e.funcionarios?.nome ?? '',
      e.funcionarios?.matricula ?? '',
      e.funcionarios?.cargo ?? '',
      e.data,
      e.tipo_dia === 'util' ? 'Dia Útil' : e.tipo_dia === 'sabado' ? 'Sábado' : 'Dom/Feriado',
      e.observacao ?? '',
    ]),
    [],
    ['RESUMO POR FUNÇÃO'],
    ['FUNÇÃO', 'DIAS ÚTEIS', 'SÁBADOS', 'DOM/FER', 'TOTAL'],
  ]

  // Aggregate by cargo
  const byCargo: Record<string, { util: number; sabado: number; dom: number }> = {}
  ;(efetivo ?? []).forEach((e: any) => {
    const cargo = e.funcionarios?.cargo ?? 'OUTROS'
    if (!byCargo[cargo]) byCargo[cargo] = { util: 0, sabado: 0, dom: 0 }
    if (e.tipo_dia === 'util') byCargo[cargo].util++
    else if (e.tipo_dia === 'sabado') byCargo[cargo].sabado++
    else byCargo[cargo].dom++
  })
  Object.entries(byCargo).forEach(([cargo, dias]) => {
    rows.push([cargo, String(dias.util), String(dias.sabado), String(dias.dom), String(dias.util + dias.sabado + dias.dom)])
  })

  const csv = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
  const bom = '\uFEFF'
  const content = bom + csv

  return new NextResponse(content, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="BM${String(bm.numero).padStart(2,'0')}_${bm.obras.nome.replace(/\s+/g,'_')}.csv"`,
    },
  })
}
