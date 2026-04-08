import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { requireRoleApi } from '@/lib/require-role'

export async function POST() {
  const authErr = await requireRoleApi(['admin', 'rh', 'financeiro'])
  if (authErr) return authErr
  try {
    const supabase = createClient()
    const hoje = new Date().toISOString().split('T')[0]
    const em30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
    const ontemTs = new Date(Date.now() - 24 * 3600000).toISOString()

    let criadas = 0

    // Get destinatarios: admins + encarregados
    const { data: destinatarios, error: destErr } = await supabase
      .from('profiles')
      .select('id, role')
      .in('role', ['admin', 'encarregado'])
    if (destErr) {
      console.error('[notificacoes/gerar] Erro ao buscar admins:', destErr.message)
      return NextResponse.json({ criadas: 0, aviso: 'Erro ao buscar destinatarios' })
    }
    if (!destinatarios || destinatarios.length === 0) {
      console.error('[notificacoes/gerar] Nenhum admin/encarregado encontrado na tabela profiles')
      return NextResponse.json({ criadas: 0, aviso: 'Nenhum destinatario encontrado' })
    }

    // 1. Documentos vencendo
    const { data: docs } = await supabase
      .from('documentos')
      .select('id, tipo, vencimento, funcionario_id, funcionarios(nome)')
      .not('vencimento', 'is', null)
      .lte('vencimento', em30)

    for (const doc of docs ?? []) {
      const { data: existing } = await supabase
        .from('notificacoes')
        .select('id')
        .eq('ref_tabela', 'documentos')
        .eq('ref_id', doc.id)
        .gte('created_at', ontemTs)
        .limit(1)
      if (existing && existing.length > 0) continue

      const dias = Math.round((new Date(doc.vencimento + 'T12:00:00').getTime() - Date.now()) / 86400000)
      const funcNome = (doc as any).funcionarios?.nome ?? 'Funcionario'
      for (const dest of destinatarios) {
        await supabase.from('notificacoes').insert({
          destinatario_id: dest.id,
          tipo: 'documento_vencendo',
          titulo: dias < 0 ? `${doc.tipo} vencido — ${funcNome}` : `${doc.tipo} vence em ${dias}d — ${funcNome}`,
          mensagem: `Documento ${doc.tipo} de ${funcNome} requer atencao.`,
          ref_tabela: 'documentos',
          ref_id: doc.id,
        })
        criadas++
      }
    }

    // 2. Treinamentos vencendo
    const { data: treins } = await supabase
      .from('treinamentos_funcionarios')
      .select('id, data_vencimento, tipo_id, funcionario_id, treinamentos_tipos(codigo, nome), funcionarios(nome)')
      .lte('data_vencimento', em30)

    for (const t of treins ?? []) {
      const { data: existing } = await supabase
        .from('notificacoes')
        .select('id')
        .eq('ref_tabela', 'treinamentos_funcionarios')
        .eq('ref_id', t.id)
        .gte('created_at', ontemTs)
        .limit(1)
      if (existing && existing.length > 0) continue

      const dias = Math.round((new Date(t.data_vencimento + 'T12:00:00').getTime() - Date.now()) / 86400000)
      const codigo = (t as any).treinamentos_tipos?.codigo ?? ''
      const funcNome = (t as any).funcionarios?.nome ?? 'Funcionario'
      for (const dest of destinatarios) {
        await supabase.from('notificacoes').insert({
          destinatario_id: dest.id,
          tipo: 'treinamento_vencendo',
          titulo: dias < 0 ? `${codigo} vencido — ${funcNome}` : `${codigo} vence em ${dias}d — ${funcNome}`,
          mensagem: `Treinamento ${codigo} de ${funcNome} requer renovacao.`,
          ref_tabela: 'treinamentos_funcionarios',
          ref_id: t.id,
        })
        criadas++
      }
    }

    return NextResponse.json({ criadas })
  } catch (err: any) {
    return NextResponse.json({ criadas: 0, erro: err.message }, { status: 500 })
  }
}
