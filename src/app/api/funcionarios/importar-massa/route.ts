import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { requireRoleApi } from '@/lib/require-role'

export const dynamic = 'force-dynamic'

interface FuncionarioInput {
  nome: string
  cpf: string
  cargo?: string
  pis?: string
  admissao?: string
  matricula?: string
  turno?: string
  salario_base?: number
  [key: string]: unknown
}

export async function POST(req: NextRequest) {
  // Somente admin e rh podem importar em massa
  const authErr = await requireRoleApi(['admin', 'rh'])
  if (authErr) return authErr

  let body: { funcionarios?: FuncionarioInput[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 })
  }

  const { funcionarios } = body
  if (!Array.isArray(funcionarios) || funcionarios.length === 0) {
    return NextResponse.json({ error: 'Array de funcionarios vazio ou ausente' }, { status: 400 })
  }

  if (funcionarios.length > 1000) {
    return NextResponse.json({ error: 'Maximo de 1000 funcionarios por requisicao' }, { status: 400 })
  }

  const supabase = createClient()

  let criados = 0
  let atualizados = 0
  const erros: { index: number; cpf?: string; error: string }[] = []

  for (let i = 0; i < funcionarios.length; i++) {
    const f = funcionarios[i]

    if (!f.nome || !f.cpf) {
      erros.push({ index: i, cpf: f.cpf, error: 'nome e cpf sao obrigatorios' })
      continue
    }

    const cpfLimpo = f.cpf.replace(/\D/g, '')
    if (cpfLimpo.length !== 11) {
      erros.push({ index: i, cpf: f.cpf, error: 'CPF invalido (deve ter 11 digitos)' })
      continue
    }

    const record: Record<string, unknown> = {
      nome: f.nome.trim().toUpperCase(),
      cpf: cpfLimpo,
      cargo: f.cargo?.trim().toUpperCase() || 'OUTROS',
      pis: f.pis?.toString().trim() || null,
      admissao: f.admissao || null,
      matricula: f.matricula?.toString().trim() || null,
      turno: f.turno || 'diurno',
      salario_base: f.salario_base ? Number(f.salario_base) : null,
    }

    // Verifica se ja existe pelo CPF
    const { data: existing } = await supabase
      .from('funcionarios')
      .select('id')
      .eq('cpf', cpfLimpo)
      .maybeSingle()

    if (existing) {
      // Atualiza
      const { error } = await supabase
        .from('funcionarios')
        .update(record)
        .eq('id', existing.id)
      if (error) {
        erros.push({ index: i, cpf: cpfLimpo, error: error.message })
      } else {
        atualizados++
      }
    } else {
      // Cria
      const { error } = await supabase
        .from('funcionarios')
        .insert(record)
      if (error) {
        erros.push({ index: i, cpf: cpfLimpo, error: error.message })
      } else {
        criados++
      }
    }
  }

  return NextResponse.json({ criados, atualizados, erros, total: funcionarios.length })
}
