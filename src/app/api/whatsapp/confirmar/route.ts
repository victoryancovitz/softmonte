import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function normalizarCpf(cpf: string): string {
  return cpf.replace(/\D/g, '')
}

export async function POST(req: NextRequest) {
  const supabase = createClient()

  try {
    const { token, cpf } = await req.json()

    if (!token || !cpf) {
      return NextResponse.json({ error: 'Token e CPF são obrigatórios' }, { status: 400 })
    }

    // Buscar envio pelo token
    const { data: envio, error: envioErr } = await supabase
      .from('whatsapp_envios')
      .select('id, funcionario_id, token_expira_em, status, tentativas_cpf_errado, bloqueado_em, tipo_documento')
      .eq('token_confirmacao', token)
      .single()

    if (envioErr || !envio) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 404 })
    }

    // Verificar se já confirmado
    if (envio.status === 'confirmado') {
      return NextResponse.json({ error: 'Documento já confirmado' }, { status: 400 })
    }

    // Verificar bloqueio
    if (envio.status === 'bloqueado' || envio.bloqueado_em) {
      return NextResponse.json({ error: 'Acesso bloqueado por excesso de tentativas' }, { status: 403 })
    }

    // Verificar expiração
    if (envio.token_expira_em && new Date(envio.token_expira_em) < new Date()) {
      await supabase
        .from('whatsapp_envios')
        .update({ status: 'expirado' })
        .eq('id', envio.id)
      return NextResponse.json({ error: 'Token expirado' }, { status: 410 })
    }

    // Buscar CPF do funcionário
    const { data: func } = await supabase
      .from('funcionarios')
      .select('id, nome, cpf')
      .eq('id', envio.funcionario_id)
      .single()

    if (!func) {
      return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 })
    }

    const cpfNorm = normalizarCpf(cpf)
    const cpfFunc = normalizarCpf(func.cpf || '')

    // Comparar CPF
    if (cpfNorm !== cpfFunc) {
      const tentativas = (envio.tentativas_cpf_errado || 0) + 1

      if (tentativas >= 3) {
        await supabase
          .from('whatsapp_envios')
          .update({
            tentativas_cpf_errado: tentativas,
            status: 'bloqueado',
            bloqueado_em: new Date().toISOString(),
          })
          .eq('id', envio.id)
        return NextResponse.json(
          { error: 'Acesso bloqueado por excesso de tentativas' },
          { status: 403 }
        )
      }

      await supabase
        .from('whatsapp_envios')
        .update({ tentativas_cpf_errado: tentativas })
        .eq('id', envio.id)

      return NextResponse.json(
        { error: 'CPF incorreto', tentativasRestantes: 3 - tentativas },
        { status: 401 }
      )
    }

    // CPF correto — confirmar
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    const userAgent = req.headers.get('user-agent') || 'unknown'

    await supabase
      .from('whatsapp_envios')
      .update({
        status: 'confirmado',
        confirmado_em: new Date().toISOString(),
        cpf_confirmado: cpfNorm,
        ip_confirmacao: ip,
        user_agent_confirmacao: userAgent,
        metodo_confirmacao: 'cpf_web',
      })
      .eq('id', envio.id)

    return NextResponse.json({
      success: true,
      documento: envio.tipo_documento,
      funcionarioNome: func.nome,
    })
  } catch {
    return NextResponse.json({ error: 'Erro ao processar confirmação' }, { status: 500 })
  }
}
