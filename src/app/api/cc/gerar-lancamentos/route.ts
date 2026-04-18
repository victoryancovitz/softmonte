import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { requireRoleApi } from '@/lib/require-role'

export async function POST(req: Request) {
  const authErr = await requireRoleApi(['admin', 'diretoria', 'financeiro'])
  if (authErr) return authErr

  const supabase = createClient()

  try {
    const { mes, ano } = await req.json()
    if (!mes || !ano) {
      return NextResponse.json({ error: 'mes e ano sao obrigatorios' }, { status: 400 })
    }

    const mesNum = Number(mes)
    const anoNum = Number(ano)
    const competencia = `${anoNum}-${String(mesNum).padStart(2, '0')}-01`

    // Busca custos fixos ativos com gerar_lancamento=true, dentro do periodo
    const { data: custosFixos, error: errCF } = await supabase
      .from('cc_custos_fixos')
      .select('*, centros_custo(id, codigo, nome)')
      .eq('ativo', true)
      .eq('gerar_lancamento', true)
      .lte('data_inicio', `${anoNum}-${String(mesNum).padStart(2, '0')}-31`)

    if (errCF) {
      return NextResponse.json({ error: errCF.message }, { status: 500 })
    }

    // Filtra custos que nao passaram do data_fim
    const custosValidos = (custosFixos ?? []).filter((cf: any) => {
      if (cf.data_fim && cf.data_fim < competencia) return false
      return true
    })

    let gerados = 0
    let ja_existiam = 0

    for (const cf of custosValidos) {
      // Verifica se ja existe lancamento para este mes com mesma origem e nome similar
      const { data: existente } = await supabase
        .from('financeiro_lancamentos')
        .select('id')
        .is('deleted_at', null)
        .eq('origem', 'custo_fixo_cc')
        .gte('data_competencia', `${anoNum}-${String(mesNum).padStart(2, '0')}-01`)
        .lte('data_competencia', `${anoNum}-${String(mesNum).padStart(2, '0')}-31`)
        .ilike('nome', `%${cf.nome}%`)
        .limit(1)

      if (existente && existente.length > 0) {
        ja_existiam++
        continue
      }

      // Calcula data de vencimento
      const diaVenc = Math.min(cf.dia_vencimento, 28) // seguro para fevereiro
      const dataVencimento = `${anoNum}-${String(mesNum).padStart(2, '0')}-${String(diaVenc).padStart(2, '0')}`

      const ccTexto = cf.centros_custo ? `${cf.centros_custo.codigo} — ${cf.centros_custo.nome}` : null

      const { error: errInsert } = await supabase.from('financeiro_lancamentos').insert({
        tipo: 'despesa',
        nome: cf.nome,
        valor: cf.valor,
        categoria: null,
        centro_custo: ccTexto,
        centro_custo_id: cf.centro_custo_id,
        obra_id: null,
        conta_id: cf.conta_id || null,
        data_competencia: competencia,
        data_vencimento: dataVencimento,
        origem: 'custo_fixo_cc',
        status: 'em_aberto',
        is_provisao: false,
      })

      if (errInsert) {
        console.error('Erro ao inserir lancamento CC:', errInsert.message)
        continue
      }

      gerados++
    }

    return NextResponse.json({ gerados, ja_existiam })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}
