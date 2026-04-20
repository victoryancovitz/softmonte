import { SupabaseClient } from '@supabase/supabase-js'

type TipoEventoRH =
  | 'rh_aso_admissional'
  | 'rh_epi'
  | 'rh_uniforme'
  | 'rh_outros_admissao'
  | 'rh_aso_periodico'
  | 'rh_aso_demissional'
  | 'rh_treinamento_nr'
  | 'rh_rescisao_multa40'
  | 'rh_rescisao_verbas'

const CATEGORIAS: Record<TipoEventoRH, string> = {
  rh_aso_admissional: 'Exames Médicos',
  rh_aso_periodico: 'Exames Médicos',
  rh_aso_demissional: 'Exames Médicos',
  rh_epi: 'EPI',
  rh_uniforme: 'Uniforme',
  rh_outros_admissao: 'Outros - Admissão',
  rh_treinamento_nr: 'Treinamentos / Certificações',
  rh_rescisao_multa40: 'GRRF - Multa 40%',
  rh_rescisao_verbas: 'Rescisão',
}

const NOMES: Record<TipoEventoRH, string> = {
  rh_aso_admissional: 'ASO Admissional',
  rh_aso_periodico: 'ASO Periódico',
  rh_aso_demissional: 'ASO Demissional',
  rh_epi: 'Kit EPI',
  rh_uniforme: 'Uniforme',
  rh_outros_admissao: 'Custos de Admissão',
  rh_treinamento_nr: 'Treinamento NR',
  rh_rescisao_multa40: 'GRRF Multa 40%',
  rh_rescisao_verbas: 'Verbas Rescisórias',
}

interface GerarLancamentoRHParams {
  supabase: SupabaseClient
  funcionario_id: string
  tipo: TipoEventoRH
  valor: number
  data_evento: string // YYYY-MM-DD
  descricao_extra?: string
  created_by?: string
}

export async function gerarLancamentoRH({
  supabase,
  funcionario_id,
  tipo,
  valor,
  data_evento,
  descricao_extra,
  created_by,
}: GerarLancamentoRHParams) {
  if (!valor || valor <= 0) return null

  // Buscar dados do funcionário + alocação ativa
  const { data: func } = await supabase
    .from('funcionarios')
    .select('id, nome, centro_custo_id')
    .eq('id', funcionario_id)
    .single()

  if (!func) return null

  // Buscar obra ativa (alocação sem data_fim)
  const { data: aloc } = await supabase
    .from('alocacoes')
    .select('obra_id')
    .eq('funcionario_id', funcionario_id)
    .is('data_fim', null)
    .eq('ativo', true)
    .limit(1)
    .maybeSingle()

  // Buscar CC da obra ou usar CC do funcionário
  let centro_custo_id = func.centro_custo_id || null
  let obra_id = aloc?.obra_id || null

  if (obra_id) {
    const { data: cc } = await supabase
      .from('centros_custo')
      .select('id')
      .eq('obra_id', obra_id)
      .eq('tipo', 'obra')
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle()
    if (cc) centro_custo_id = cc.id
  }

  const competencia = data_evento.slice(0, 7) + '-01'
  const nome = `${NOMES[tipo]} — ${func.nome}${descricao_extra ? ` (${descricao_extra})` : ''}`

  const { data, error } = await supabase.from('financeiro_lancamentos').insert({
    tipo: 'despesa',
    nome,
    categoria: CATEGORIAS[tipo],
    funcionario_id,
    obra_id,
    centro_custo_id,
    valor,
    data_competencia: competencia,
    data_vencimento: data_evento,
    status: 'em_aberto',
    is_provisao: false,
    origem: tipo,
    observacao: descricao_extra || null,
    created_by: created_by || null,
  }).select('id').single()

  if (error) {
    console.error(`[gerarLancamentoRH] Erro ao criar ${tipo} para ${func.nome}:`, error.message)
    return null
  }

  return data
}

/** Gera múltiplos lançamentos de admissão de uma vez */
export async function gerarLancamentosAdmissao(
  supabase: SupabaseClient,
  funcionario_id: string,
  custos: {
    aso_admissional?: number
    epi?: number
    uniforme?: number
    outros?: number
  },
  data_admissao: string,
  created_by?: string,
): Promise<number> {
  const hoje = data_admissao || new Date().toISOString().split('T')[0]
  let total = 0

  const itens: { tipo: TipoEventoRH; valor: number }[] = [
    { tipo: 'rh_aso_admissional', valor: custos.aso_admissional || 0 },
    { tipo: 'rh_epi', valor: custos.epi || 0 },
    { tipo: 'rh_uniforme', valor: custos.uniforme || 0 },
    { tipo: 'rh_outros_admissao', valor: custos.outros || 0 },
  ]

  for (const item of itens) {
    if (item.valor > 0) {
      const result = await gerarLancamentoRH({
        supabase,
        funcionario_id,
        tipo: item.tipo,
        valor: item.valor,
        data_evento: hoje,
        created_by,
      })
      if (result) total += item.valor
    }
  }

  return total
}
