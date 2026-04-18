import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { requireRoleApi } from '@/lib/require-role'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TIPO_CONFIG: Record<string, {
  tabelas: { tabela: string; coluna: string }[]
  softDelete: 'deleted_at' | 'ativo'
  usaNome?: boolean
}> = {
  centro_custo: {
    tabelas: [
      { tabela: 'financeiro_lancamentos', coluna: 'centro_custo_id' },
      { tabela: 'ativos_fixos', coluna: 'centro_custo_id' },
      { tabela: 'funcionarios', coluna: 'centro_custo_id' },
      { tabela: 'alocacoes', coluna: 'centro_custo_id' },
      { tabela: 'estoque_itens', coluna: 'centro_custo_id' },
      { tabela: 'cc_custos_fixos', coluna: 'centro_custo_id' },
    ],
    softDelete: 'deleted_at',
  },
  cliente: {
    tabelas: [
      { tabela: 'obras', coluna: 'cliente_id' },
    ],
    softDelete: 'deleted_at',
  },
  funcao: {
    tabelas: [
      { tabela: 'funcionarios', coluna: 'funcao_id' },
      { tabela: 'alocacoes', coluna: 'funcao_id' },
      { tabela: 'contrato_composicao', coluna: 'funcao_id' },
      { tabela: 'bm_itens', coluna: 'funcao_id' },
    ],
    softDelete: 'ativo',
  },
  fornecedor: {
    tabelas: [
      { tabela: 'financeiro_lancamentos', coluna: 'fornecedor' },
    ],
    softDelete: 'deleted_at',
    usaNome: true,
  },
}

export async function POST(req: NextRequest) {
  const authErr = await requireRoleApi(['admin', 'diretoria'])
  if (authErr) return authErr

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()
  const { tipo, origem_id, destino_id } = body

  if (!tipo || !origem_id || !destino_id) {
    return NextResponse.json({ error: 'tipo, origem_id e destino_id são obrigatórios' }, { status: 400 })
  }
  if (origem_id === destino_id) {
    return NextResponse.json({ error: 'Origem e destino devem ser diferentes' }, { status: 400 })
  }

  const config = TIPO_CONFIG[tipo]
  if (!config) {
    return NextResponse.json({ error: `Tipo inválido: ${tipo}` }, { status: 400 })
  }

  const tabelaNome: Record<string, string> = {
    centro_custo: 'centros_custo',
    cliente: 'clientes',
    funcao: 'funcoes',
    fornecedor: 'fornecedores',
  }

  // Buscar origem e destino
  const table = tabelaNome[tipo]
  const { data: origem } = await supabase.from(table).select('*').eq('id', origem_id).single()
  const { data: destino } = await supabase.from(table).select('*').eq('id', destino_id).single()

  if (!origem || !destino) {
    return NextResponse.json({ error: 'Registro de origem ou destino não encontrado' }, { status: 404 })
  }

  const tabelasAfetadas: Record<string, number> = {}
  let totalMigrado = 0

  try {
    for (const { tabela, coluna } of config.tabelas) {
      if (config.usaNome) {
        // Fornecedor: migra pelo nome
        const { data: rows, error } = await supabase
          .from(tabela)
          .update({ [coluna]: destino.nome })
          .eq(coluna, origem.nome)
          .select('id')

        if (error) throw new Error(`Erro ao migrar ${tabela}: ${error.message}`)
        const count = rows?.length ?? 0
        if (count > 0) {
          tabelasAfetadas[tabela] = count
          totalMigrado += count
        }
      } else {
        const { data: rows, error } = await supabase
          .from(tabela)
          .update({ [coluna]: destino_id })
          .eq(coluna, origem_id)
          .select('id')

        if (error) throw new Error(`Erro ao migrar ${tabela}: ${error.message}`)
        const count = rows?.length ?? 0
        if (count > 0) {
          tabelasAfetadas[tabela] = count
          totalMigrado += count
        }
      }
    }

    // Sub-CCs: reparent children
    if (tipo === 'centro_custo') {
      const { data: subCCs, error } = await supabase
        .from('centros_custo')
        .update({ parent_id: destino_id })
        .eq('parent_id', origem_id)
        .select('id')

      if (error) throw new Error(`Erro ao migrar sub-centros de custo: ${error.message}`)
      const count = subCCs?.length ?? 0
      if (count > 0) {
        tabelasAfetadas['centros_custo (sub-CCs)'] = count
        totalMigrado += count
      }
    }

    // Soft-delete da origem
    if (config.softDelete === 'deleted_at') {
      const { error } = await supabase
        .from(table)
        .update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
        .eq('id', origem_id)
      if (error) throw new Error(`Erro ao desativar origem: ${error.message}`)
    } else {
      const { error } = await supabase
        .from(table)
        .update({ ativo: false })
        .eq('id', origem_id)
      if (error) throw new Error(`Erro ao desativar origem: ${error.message}`)
    }

    // Log em merge_log
    await supabase.from('merge_log').insert({
      tipo,
      origem_id,
      origem_nome: origem.nome ?? origem.codigo ?? String(origem_id),
      destino_id,
      destino_nome: destino.nome ?? destino.codigo ?? String(destino_id),
      tabelas_afetadas: tabelasAfetadas,
      total_migrado: totalMigrado,
      realizado_por: user.id,
    })

    // Log em cc_merge_log se for centro_custo
    if (tipo === 'centro_custo') {
      await supabase.from('cc_merge_log').insert({
        cc_origem_id: origem_id,
        cc_destino_id: destino_id,
        tabelas_afetadas: tabelasAfetadas,
        revertido: false,
        realizado_por: user.id,
      })
    }

    return NextResponse.json({ tabelas_afetadas: tabelasAfetadas, total_migrado: totalMigrado })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao executar merge' }, { status: 500 })
  }
}
