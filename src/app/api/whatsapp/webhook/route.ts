import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { classificarIntencao } from '@/lib/whatsapp/classificar'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STATUS_MAP: Record<string, string> = {
  queued: 'pendente',
  sent: 'enviado',
  delivered: 'entregue',
  read: 'lido',
  failed: 'erro',
  undelivered: 'erro',
}

function normalizarTelefone(tel: string): string {
  return tel.replace(/^whatsapp:/, '').replace(/\D/g, '')
}

export async function POST(req: NextRequest) {
  const supabase = createClient()

  try {
    const formData = await req.formData()
    const params: Record<string, string> = {}
    formData.forEach((value, key) => {
      params[key] = value.toString()
    })

    // Status update (callback de status do Twilio)
    if (params.MessageStatus && params.MessageSid) {
      const statusMapped = STATUS_MAP[params.MessageStatus] || params.MessageStatus

      const updateData: Record<string, string> = {
        status: statusMapped,
        provider_status_raw: params.MessageStatus,
      }

      if (statusMapped === 'entregue') {
        updateData.entregue_em = new Date().toISOString()
      } else if (statusMapped === 'lido') {
        updateData.lido_em = new Date().toISOString()
      }

      await supabase
        .from('whatsapp_envios')
        .update(updateData)
        .eq('provider_message_id', params.MessageSid)

      return new NextResponse('<Response/>', {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      })
    }

    // Mensagem recebida
    if (params.Body || params.MediaUrl0) {
      const telefoneRaw = params.From || ''
      const telefoneNorm = normalizarTelefone(telefoneRaw)

      // Buscar funcionário pelo telefone
      const { data: func } = await supabase
        .from('funcionarios')
        .select('id, nome')
        .or(`telefone.ilike.%${telefoneNorm}%,telefone_celular.ilike.%${telefoneNorm}%`)
        .limit(1)
        .single()

      // Classificar intenção com IA
      const classificacao = params.Body
        ? await classificarIntencao(params.Body, func?.nome || 'Desconhecido')
        : { intencao: 'outro', confianca: 0.5, resposta_sugerida: null }

      await supabase.from('whatsapp_mensagens_recebidas').insert({
        funcionario_id: func?.id || null,
        numero_telefone: telefoneRaw,
        tipo: params.MediaUrl0 ? 'midia' : 'texto',
        conteudo_texto: params.Body || null,
        arquivo_url: params.MediaUrl0 || null,
        arquivo_mime: params.MediaContentType0 || null,
        intencao: classificacao.intencao,
        intencao_confianca: classificacao.confianca,
        intencao_raw: JSON.stringify(classificacao),
        status: 'pendente',
        provider: 'twilio',
        provider_message_id: params.MessageSid || null,
        received_at: new Date().toISOString(),
      })

      // Resposta TwiML vazia (não auto-responde)
      return new NextResponse('<Response/>', {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      })
    }

    return new NextResponse('<Response/>', {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    })
  } catch (err) {
    console.error('Webhook WhatsApp error:', err)
    return new NextResponse('<Response/>', {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    })
  }
}
