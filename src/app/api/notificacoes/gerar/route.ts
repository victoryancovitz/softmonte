import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = createClient()
  const hoje = new Date().toISOString().split('T')[0]
  const em30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  const ontemTs = new Date(Date.now() - 24 * 3600000).toISOString()

  let criadas = 0

  // 1. Documentos vencendo
  const { data: docs } = await supabase
    .from('documentos')
    .select('id, tipo, vencimento, funcionario_id')
    .not('vencimento', 'is', null)
    .lte('vencimento', em30)

  for (const doc of docs ?? []) {
    // Check dedup
    const { data: existing } = await supabase
      .from('notificacoes')
      .select('id')
      .eq('ref_tabela', 'documentos')
      .eq('ref_id', doc.id)
      .gte('created_at', ontemTs)
      .limit(1)
    if (existing && existing.length > 0) continue

    // Get admin profiles as destinatarios
    const { data: admins } = await supabase.from('profiles').select('user_id').eq('role', 'admin')
    for (const admin of admins ?? []) {
      const dias = Math.round((new Date(doc.vencimento + 'T12:00:00').getTime() - Date.now()) / 86400000)
      await supabase.from('notificacoes').insert({
        destinatario_id: admin.user_id,
        tipo: 'documento_vencendo',
        titulo: dias < 0 ? `Documento ${doc.tipo} vencido` : `Documento ${doc.tipo} vence em ${dias}d`,
        mensagem: `Funcionario: documento ${doc.tipo} requer atencao.`,
        ref_tabela: 'documentos',
        ref_id: doc.id,
      })
      criadas++
    }
  }

  // 2. Treinamentos vencendo
  const { data: treins } = await supabase
    .from('treinamentos_funcionarios')
    .select('id, data_vencimento, tipo_id, funcionario_id, treinamentos_tipos(codigo, nome)')
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

    const { data: admins } = await supabase.from('profiles').select('user_id').eq('role', 'admin')
    for (const admin of admins ?? []) {
      const dias = Math.round((new Date(t.data_vencimento + 'T12:00:00').getTime() - Date.now()) / 86400000)
      const codigo = (t as any).treinamentos_tipos?.codigo ?? ''
      await supabase.from('notificacoes').insert({
        destinatario_id: admin.user_id,
        tipo: 'treinamento_vencendo',
        titulo: dias < 0 ? `${codigo} vencido` : `${codigo} vence em ${dias}d`,
        mensagem: `Treinamento ${codigo} requer renovacao.`,
        ref_tabela: 'treinamentos_funcionarios',
        ref_id: t.id,
      })
      criadas++
    }
  }

  return NextResponse.json({ criadas })
}
