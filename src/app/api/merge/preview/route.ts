import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { requireRoleApi } from '@/lib/require-role'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TIPO_CONFIG: Record<string, {
  tabela: string
  fks: { tabela: string; coluna: string }[]
  usaNome?: boolean
}> = {
  centro_custo: {
    tabela: 'centros_custo',
    fks: [
      { tabela: 'financeiro_lancamentos', coluna: 'centro_custo_id' },
      { tabela: 'ativos_fixos', coluna: 'centro_custo_id' },
      { tabela: 'funcionarios', coluna: 'centro_custo_id' },
      { tabela: 'alocacoes', coluna: 'centro_custo_id' },
      { tabela: 'estoque_itens', coluna: 'centro_custo_id' },
      { tabela: 'cc_custos_fixos', coluna: 'centro_custo_id' },
    ],
  },
  cliente: {
    tabela: 'clientes',
    fks: [
      { tabela: 'obras', coluna: 'cliente_id' },
    ],
  },
  funcao: {
    tabela: 'funcoes',
    fks: [
      { tabela: 'funcionarios', coluna: 'funcao_id' },
      { tabela: 'alocacoes', coluna: 'funcao_id' },
      { tabela: 'contrato_composicao', coluna: 'funcao_id' },
      { tabela: 'bm_itens', coluna: 'funcao_id' },
    ],
  },
  fornecedor: {
    tabela: 'fornecedores',
    fks: [
      { tabela: 'financeiro_lancamentos', coluna: 'fornecedor' },
    ],
    usaNome: true,
  },
}

export async function GET(req: NextRequest) {
  const authErr = await requireRoleApi(['admin', 'diretoria'])
  if (authErr) return authErr

  const supabase = createClient()
  const { searchParams } = new URL(req.url)
  const tipo = searchParams.get('tipo')
  const origem_id = searchParams.get('origem_id')
  const destino_id = searchParams.get('destino_id')

  if (!tipo || !origem_id || !destino_id) {
    return NextResponse.json({ error: 'tipo, origem_id e destino_id são obrigatórios' }, { status: 400 })
  }

  const config = TIPO_CONFIG[tipo]
  if (!config) {
    return NextResponse.json({ error: `Tipo inválido: ${tipo}` }, { status: 400 })
  }

  const { data: origem } = await supabase.from(config.tabela).select('*').eq('id', origem_id).single()
  const { data: destino } = await supabase.from(config.tabela).select('*').eq('id', destino_id).single()

  if (!origem || !destino) {
    return NextResponse.json({ error: 'Registro de origem ou destino não encontrado' }, { status: 404 })
  }

  const impacto: { tabela: string; registros: number }[] = []
  let total = 0

  for (const { tabela, coluna } of config.fks) {
    if (config.usaNome) {
      const { count, error } = await supabase
        .from(tabela)
        .select('id', { count: 'exact', head: true })
        .eq(coluna, origem.nome)
      const n = error ? 0 : (count ?? 0)
      impacto.push({ tabela, registros: n })
      total += n
    } else {
      const { count, error } = await supabase
        .from(tabela)
        .select('id', { count: 'exact', head: true })
        .eq(coluna, origem_id)
      const n = error ? 0 : (count ?? 0)
      impacto.push({ tabela, registros: n })
      total += n
    }
  }

  // Sub-CCs
  if (tipo === 'centro_custo') {
    const { count } = await supabase
      .from('centros_custo')
      .select('id', { count: 'exact', head: true })
      .eq('parent_id', origem_id)
    const n = count ?? 0
    if (n > 0) {
      impacto.push({ tabela: 'centros_custo (sub-CCs)', registros: n })
      total += n
    }
  }

  return NextResponse.json({
    origem: { id: origem.id, nome: origem.nome ?? origem.codigo },
    destino: { id: destino.id, nome: destino.nome ?? destino.codigo },
    impacto,
    total,
    seguro: total === 0,
  })
}
