import type Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase-server'

type ToolDef = Anthropic.Tool

export const ASSISTANT_TOOLS: ToolDef[] = [
  {
    name: 'query_database',
    description:
      'Executa uma consulta SELECT no banco Softmonte. Somente leitura — inserir/atualizar/deletar é rejeitado. Use para responder perguntas com dados reais. Views úteis: vw_alertas, vw_dre_obra, vw_dre_obra_mes, vw_custo_funcionario, vw_forecast_geral, vw_prazos_legais, vw_absenteismo, vw_estoque_posicao, vw_contas_saldo, vw_indicadores_empresa. Tabelas: obras, funcionarios, alocacoes, boletins_medicao, financeiro_lancamentos, contrato_composicao, faltas, ponto_registros, notificacoes, empresa_config.',
    input_schema: {
      type: 'object',
      properties: {
        table: {
          type: 'string',
          description: 'Nome da view ou tabela (ex: "vw_alertas", "obras").',
        },
        columns: {
          type: 'string',
          description: 'Colunas a selecionar separadas por vírgula, ou "*". Default "*".',
        },
        filter_eq: {
          type: 'object',
          description: 'Filtros de igualdade: { coluna: valor }. Opcional.',
          additionalProperties: true,
        },
        filter_ilike: {
          type: 'object',
          description: 'Filtros ILIKE para busca textual: { coluna: "%termo%" }. Opcional.',
          additionalProperties: true,
        },
        order_by: { type: 'string', description: 'Coluna para ordenação. Opcional.' },
        order_desc: { type: 'boolean', description: 'Se true, ordem decrescente. Default false.' },
        limit: { type: 'number', description: 'Limite de linhas (default 50, máx 500).' },
      },
      required: ['table'],
    },
  },
  {
    name: 'buscar_funcionario',
    description: 'Busca funcionários por nome parcial (ILIKE) ou CPF exato. Retorna até 20.',
    input_schema: {
      type: 'object',
      properties: {
        nome_parcial: { type: 'string', description: 'Parte do nome.' },
        cpf: { type: 'string', description: 'CPF (só dígitos ou com máscara).' },
      },
    },
  },
  {
    name: 'listar_alertas',
    description: 'Retorna últimos alertas da view vw_alertas ordenados por criação.',
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Máximo de alertas (default 20).' },
      },
    },
  },
  {
    name: 'cadastrar_funcionario',
    description:
      'AÇÃO DE ESCRITA. Cria um funcionário e opcionalmente aloca em uma obra. Só execute APÓS o usuário confirmar via card de confirmação.',
    input_schema: {
      type: 'object',
      properties: {
        nome: { type: 'string' },
        cpf: { type: 'string' },
        funcao_id: { type: 'string', description: 'UUID da função/cargo.' },
        data_admissao: { type: 'string', description: 'YYYY-MM-DD.' },
        salario_base: { type: 'number' },
        id_ponto: { type: 'string', description: 'Matrícula/ID do ponto biométrico.' },
        obra_id: { type: 'string', description: 'UUID da obra para alocar (opcional).' },
      },
      required: ['nome', 'cpf', 'data_admissao', 'salario_base'],
    },
  },
  {
    name: 'lancar_falta',
    description:
      'AÇÃO DE ESCRITA. Registra falta/afastamento de um funcionário em uma data. Só execute APÓS confirmação.',
    input_schema: {
      type: 'object',
      properties: {
        funcionario_id: { type: 'string' },
        data: { type: 'string', description: 'YYYY-MM-DD.' },
        tipo: {
          type: 'string',
          description:
            'Ex: "falta", "falta_justificada", "atestado", "ferias", "licenca".',
        },
        observacao: { type: 'string' },
        obra_id: { type: 'string', description: 'UUID da obra (opcional).' },
      },
      required: ['funcionario_id', 'data', 'tipo'],
    },
  },
  {
    name: 'registrar_ponto',
    description:
      'AÇÃO DE ESCRITA. Cria ou atualiza registro de ponto (entrada/saída/intervalo) de um funcionário em uma data. Só execute APÓS confirmação.',
    input_schema: {
      type: 'object',
      properties: {
        funcionario_id: { type: 'string' },
        data: { type: 'string', description: 'YYYY-MM-DD.' },
        entrada: { type: 'string', description: 'HH:MM.' },
        saida: { type: 'string', description: 'HH:MM.' },
        intervalo_min: { type: 'number', description: 'Minutos de almoço/intervalo.' },
        obra_id: { type: 'string' },
      },
      required: ['funcionario_id', 'data'],
    },
  },
  {
    name: 'criar_notificacao',
    description:
      'AÇÃO DE ESCRITA. Cria uma notificação interna para um usuário. Só execute APÓS confirmação.',
    input_schema: {
      type: 'object',
      properties: {
        destinatario_id: { type: 'string', description: 'UUID do usuário destinatário.' },
        titulo: { type: 'string' },
        mensagem: { type: 'string' },
        tipo: { type: 'string', description: 'Ex: "info", "alerta", "aviso".' },
      },
      required: ['destinatario_id', 'titulo', 'mensagem'],
    },
  },
]

function isReadOnlyTable(name: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(name)
}

function clampLimit(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n ?? 50)
  if (!Number.isFinite(v) || v <= 0) return 50
  return Math.min(Math.floor(v), 500)
}

export async function executeTool(
  name: string,
  input: any,
): Promise<{ ok: boolean; data?: any; error?: string }> {
  const supabase = createClient()

  try {
    switch (name) {
      case 'query_database': {
        const table = String(input?.table ?? '')
        if (!isReadOnlyTable(table)) {
          return { ok: false, error: 'Nome de tabela inválido.' }
        }
        const columns = typeof input?.columns === 'string' && input.columns.trim()
          ? input.columns
          : '*'
        let q: any = supabase.from(table).select(columns)
        if (input?.filter_eq && typeof input.filter_eq === 'object') {
          for (const [k, v] of Object.entries(input.filter_eq)) q = q.eq(k, v)
        }
        if (input?.filter_ilike && typeof input.filter_ilike === 'object') {
          for (const [k, v] of Object.entries(input.filter_ilike)) q = q.ilike(k, String(v))
        }
        if (input?.order_by) {
          q = q.order(String(input.order_by), { ascending: !input?.order_desc })
        }
        q = q.limit(clampLimit(input?.limit))
        const { data, error } = await q
        if (error) return { ok: false, error: error.message }
        return { ok: true, data }
      }

      case 'buscar_funcionario': {
        let q: any = supabase
          .from('funcionarios')
          .select('id, nome, cpf, cargo, status, admissao, matricula, id_ponto')
          .is('deleted_at', null)
          .limit(20)
        if (input?.cpf) q = q.eq('cpf', String(input.cpf).replace(/\D/g, ''))
        else if (input?.nome_parcial) q = q.ilike('nome', `%${input.nome_parcial}%`)
        else return { ok: false, error: 'Informe nome_parcial ou cpf.' }
        const { data, error } = await q
        if (error) return { ok: false, error: error.message }
        return { ok: true, data }
      }

      case 'listar_alertas': {
        const limit = clampLimit(input?.limit ?? 20)
        const { data, error } = await supabase
          .from('vw_alertas')
          .select('*')
          .order('dias_restantes', { ascending: true, nullsFirst: false })
          .limit(limit)
        if (error) return { ok: false, error: error.message }
        return { ok: true, data }
      }

      case 'cadastrar_funcionario': {
        const payload = {
          nome: input.nome,
          cpf: String(input.cpf ?? '').replace(/\D/g, ''),
          funcao_id: input.funcao_id ?? null,
          admissao: input.data_admissao,
          salario_base: input.salario_base,
          id_ponto: input.id_ponto ?? null,
          status: 'disponivel',
        }
        const { data, error } = await supabase
          .from('funcionarios')
          .insert(payload)
          .select('id, nome')
          .single()
        if (error) return { ok: false, error: error.message }
        if (input.obra_id && data?.id) {
          const { error: alocErr } = await supabase.from('alocacoes').insert({
            funcionario_id: data.id,
            obra_id: input.obra_id,
            data_inicio: input.data_admissao,
          })
          if (alocErr) {
            return {
              ok: true,
              data: {
                funcionario: data,
                aviso: `Funcionário criado, mas falha ao alocar: ${alocErr.message}`,
              },
            }
          }
        }
        return { ok: true, data: { funcionario: data } }
      }

      case 'lancar_falta': {
        const { data: { user } } = await supabase.auth.getUser()
        const { data, error } = await supabase
          .from('faltas')
          .insert({
            funcionario_id: input.funcionario_id,
            obra_id: input.obra_id ?? null,
            data: input.data,
            tipo: input.tipo,
            observacao: input.observacao ?? null,
            registrado_por: user?.id ?? null,
          })
          .select('id')
          .single()
        if (error) return { ok: false, error: error.message }
        return { ok: true, data }
      }

      case 'registrar_ponto': {
        const { data: { user } } = await supabase.auth.getUser()
        const payload: any = {
          entrada: input.entrada ?? null,
          saida: input.saida ?? null,
          intervalo_min: input.intervalo_min ?? null,
          origem: 'correcao',
          editado_em: new Date().toISOString(),
          editado_por: user?.id ?? null,
          motivo_edicao: 'Assistente IA',
        }
        const { data: existing } = await supabase
          .from('ponto_registros')
          .select('id')
          .eq('funcionario_id', input.funcionario_id)
          .eq('data', input.data)
          .maybeSingle()
        if (existing?.id) {
          const { error } = await supabase
            .from('ponto_registros')
            .update(payload)
            .eq('id', existing.id)
          if (error) return { ok: false, error: error.message }
          return { ok: true, data: { id: existing.id, atualizado: true } }
        }
        const { data, error } = await supabase
          .from('ponto_registros')
          .insert({ ...payload, funcionario_id: input.funcionario_id, data: input.data })
          .select('id')
          .single()
        if (error) return { ok: false, error: error.message }
        return { ok: true, data }
      }

      case 'criar_notificacao': {
        const { data, error } = await supabase
          .from('notificacoes')
          .insert({
            destinatario_id: input.destinatario_id,
            titulo: input.titulo,
            mensagem: input.mensagem,
            tipo: input.tipo ?? 'info',
            lida: false,
          })
          .select('id')
          .single()
        if (error) return { ok: false, error: error.message }
        return { ok: true, data }
      }

      default:
        return { ok: false, error: `Ferramenta desconhecida: ${name}` }
    }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Erro inesperado executando ferramenta.' }
  }
}
