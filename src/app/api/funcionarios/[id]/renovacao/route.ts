import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { requireRoleApi } from '@/lib/require-role'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const roleErr = await requireRoleApi(['admin', 'diretoria', 'rh'])
  if (roleErr) return roleErr

  const { decisao, observacao } = await req.json()
  if (!['renovar', 'nao_renovar', 'pendente'].includes(decisao)) {
    return NextResponse.json({ error: 'Decisão inválida' }, { status: 400 })
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  // Se for nao_renovar, usar o RPC atômico
  if (decisao === 'nao_renovar') {
    const { data, error } = await supabase.rpc('marcar_nao_renovar', {
      p_funcionario_id: params.id,
      p_motivo: observacao || null,
      p_usuario: user.email || user.id,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  }

  // Senão, UPDATE simples
  const { data, error } = await supabase
    .from('funcionarios')
    .update({
      renovacao_decisao: decisao,
      renovacao_decisao_em: new Date().toISOString(),
      renovacao_decisao_por: user.email || user.id,
      observacao_renovacao: observacao || null,
    })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
