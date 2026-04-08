import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { requireRoleApi } from '@/lib/require-role'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  // Só admin e RH podem importar funcionários em massa
  const authErr = await requireRoleApi(['admin', 'rh'])
  if (authErr) return authErr

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  // Rate limit: 5 imports por minuto (impede DOS via upload massivo)
  const rl = rateLimit(`importar:${user?.id}`, { limit: 5, windowMs: 60_000 })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Muitas importações. Aguarde 1 minuto.' },
      { status: 429 }
    )
  }

  const body = await req.json()
  const { funcionarios } = body

  if (!Array.isArray(funcionarios) || funcionarios.length === 0)
    return NextResponse.json({ error: 'Nenhum funcionário para importar' }, { status: 400 })

  const toInsert = funcionarios.map((f: any) => ({
    nome: f.nome?.trim(),
    matricula: f.matricula?.toString().trim(),
    cargo: f.cargo?.trim() || 'AJUDANTE',
    turno: 'diurno',
    jornada_horas: 8,
    status: f.situacao?.toLowerCase() === 'ativo' || f.situacao?.toLowerCase() === 'ativa' ? 'disponivel' : 'disponivel',
    re: f.re?.toString().trim() || null,
    cpf: f.cpf?.toString().trim() || null,
    pis: f.pis?.toString().trim() || null,
    banco: f.banco?.toString().trim() || null,
    agencia_conta: f.agencia_conta?.toString().trim() || null,
    pix: f.pix?.toString().trim() || null,
    vt_estrutura: f.hora?.toString().trim() || null,
    tamanho_bota: f.bota?.toString().trim() || null,
    tamanho_uniforme: f.uniforme?.toString().trim() || null,
    admissao: f.admissao || null,
    prazo1: f.prazo1 || null,
    prazo2: f.prazo2 || null,
    periodo_contrato: f.periodo_contrato || '45 DIAS',
    custo_hora: f.hora_valor ? parseFloat(f.hora_valor) : null,
  })).filter((f: any) => f.nome && f.matricula)

  const { data, error } = await supabase.from('funcionarios').upsert(toInsert, { onConflict: 'matricula', ignoreDuplicates: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, imported: toInsert.length })
}
