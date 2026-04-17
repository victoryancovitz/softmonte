import Anthropic from '@anthropic-ai/sdk'

interface ClassificacaoResult {
  intencao: string
  confianca: number
  resposta_sugerida: string
}

const INTENCOES = [
  'solicitacao_ferias',
  'envio_atestado',
  'duvida_holerite',
  'solicitacao_documento',
  'declaracao_falta',
  'duvida_ponto',
  'solicitacao_adiantamento',
  'reclamacao',
  'outro',
] as const

export async function classificarIntencao(
  texto: string,
  nome: string
): Promise<ClassificacaoResult> {
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: `Classifique a intenção da mensagem de WhatsApp abaixo enviada pelo colaborador "${nome}".

Intenções possíveis: ${INTENCOES.join(', ')}

Responda APENAS em JSON: {"intencao":"...","confianca":0.0-1.0,"resposta_sugerida":"..."}

Mensagem: "${texto}"`,
        },
      ],
    })

    const content = response.content[0]
    if (content.type !== 'text') throw new Error('Resposta inesperada')

    const parsed = JSON.parse(content.text) as ClassificacaoResult

    if (!INTENCOES.includes(parsed.intencao as (typeof INTENCOES)[number])) {
      parsed.intencao = 'outro'
    }

    return parsed
  } catch {
    return {
      intencao: 'outro',
      confianca: 0.5,
      resposta_sugerida: 'Em breve o RH entrará em contato.',
    }
  }
}
