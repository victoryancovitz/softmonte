import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { requireRoleApi } from '@/lib/require-role'
import { enviarWhatsApp } from '@/lib/whatsapp/send'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const authErr = await requireRoleApi(['admin', 'diretoria', 'rh'])
  if (authErr) return authErr

  const supabase = createClient()

  try {
    const body = await req.json()
    const { funcionarioId, tipo, mensagem, arquivoUrl, obraId } = body

    if (!funcionarioId || !tipo) {
      return NextResponse.json(
        { error: 'funcionarioId e tipo são obrigatórios' },
        { status: 400 }
      )
    }

    // Buscar telefone do funcionário
    const { data: func, error: funcErr } = await supabase
      .from('funcionarios')
      .select('id, nome, telefone, telefone_celular, cpf')
      .eq('id', funcionarioId)
      .single()

    if (funcErr || !func) {
      return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 })
    }

    const telefone = func.telefone_celular || func.telefone
    if (!telefone) {
      return NextResponse.json(
        { error: 'Funcionário não possui telefone cadastrado' },
        { status: 400 }
      )
    }

    // Buscar usuário logado
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { envioId } = await enviarWhatsApp(
      {
        funcionarioId,
        obraId: obraId || undefined,
        tipoDocumento: tipo,
        numeroTelefone: telefone,
        nomeDestinatario: func.nome,
        mensagemTexto: mensagem || undefined,
        arquivoUrl: arquivoUrl || undefined,
        enviadoPor: user?.id,
      },
      supabase
    )

    return NextResponse.json({ success: true, envioId })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao enviar WhatsApp'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
