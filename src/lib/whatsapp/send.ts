import crypto from 'crypto'
import { SupabaseClient } from '@supabase/supabase-js'

export interface EnvioParams {
  funcionarioId: string
  obraId?: string
  tipoDocumento: string
  referenciaId?: string
  referenciaTabela?: string
  numeroTelefone: string
  nomeDestinatario: string
  arquivoUrl?: string
  arquivoNome?: string
  arquivoTamanhoBytes?: number
  mensagemTexto?: string
  mensagemTemplate?: string
  enviadoPor?: string
}

export async function enviarWhatsApp(params: EnvioParams, supabase: SupabaseClient) {
  const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID!
  const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN!
  const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM!
  const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL!

  // 1. Gerar token
  const token = crypto.randomBytes(32).toString('hex')
  const tokenExpiraEm = new Date(Date.now() + 72 * 60 * 60 * 1000) // 72h

  // 2. INSERT em whatsapp_envios
  const { data: envio, error: insertError } = await supabase
    .from('whatsapp_envios')
    .insert({
      funcionario_id: params.funcionarioId,
      obra_id: params.obraId || null,
      tipo_documento: params.tipoDocumento,
      referencia_id: params.referenciaId || null,
      referencia_tabela: params.referenciaTabela || null,
      numero_telefone: params.numeroTelefone,
      nome_destinatario: params.nomeDestinatario,
      arquivo_url: params.arquivoUrl || null,
      arquivo_nome: params.arquivoNome || null,
      arquivo_tamanho_bytes: params.arquivoTamanhoBytes || null,
      mensagem_texto: params.mensagemTexto || null,
      mensagem_template: params.mensagemTemplate || null,
      token_confirmacao: token,
      token_expira_em: tokenExpiraEm.toISOString(),
      provider: 'twilio',
      status: 'pendente',
      enviado_por: params.enviadoPor || null,
    })
    .select('id')
    .single()

  if (insertError || !envio) {
    throw new Error(`Erro ao criar envio: ${insertError?.message}`)
  }

  // 3. Enviar via Twilio REST API
  const toNumber = params.numeroTelefone.startsWith('whatsapp:')
    ? params.numeroTelefone
    : `whatsapp:${params.numeroTelefone}`

  const fromNumber = TWILIO_WHATSAPP_FROM.startsWith('whatsapp:')
    ? TWILIO_WHATSAPP_FROM
    : `whatsapp:${TWILIO_WHATSAPP_FROM}`

  const confirmUrl = `${BASE_URL}/confirmar/${token}`

  const body = new URLSearchParams()
  body.append('From', fromNumber)
  body.append('To', toNumber)
  body.append(
    'Body',
    params.mensagemTexto ||
      `Olá ${params.nomeDestinatario}, você recebeu um documento (${params.tipoDocumento}). Confirme em: ${confirmUrl}`
  )

  if (params.arquivoUrl) {
    body.append('MediaUrl', params.arquivoUrl)
  }

  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`
  const authHeader = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')

  const response = await fetch(twilioUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authHeader}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })

  const result = await response.json()

  if (!response.ok) {
    await supabase
      .from('whatsapp_envios')
      .update({ status: 'erro', provider_status_raw: JSON.stringify(result) })
      .eq('id', envio.id)
    throw new Error(`Erro Twilio: ${result.message || JSON.stringify(result)}`)
  }

  // 4. Atualizar com provider_message_id e status='enviado'
  await supabase
    .from('whatsapp_envios')
    .update({
      provider_message_id: result.sid,
      status: 'enviado',
      enviado_em: new Date().toISOString(),
    })
    .eq('id', envio.id)

  return { envioId: envio.id, token }
}
