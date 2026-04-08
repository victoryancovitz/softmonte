/**
 * GET /api/ponto/reconciliar-funcionarios
 *
 * Cruza o cadastro de funcionários do Softmonte com a lista completa da
 * Secullum Ponto Web. Retorna:
 *  - soSecullum: funcionários no Secullum mas NÃO no Softmonte (precisam
 *    ser cadastrados pra as batidas dele serem importadas)
 *  - soSoftmonte: funcionários no Softmonte sem correspondência na Secullum
 *    (podem estar sem cartão de ponto cadastrado)
 *  - match: funcionários presentes em ambos
 *
 * Auth: admin | rh
 */
import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { requireRoleApi } from '@/lib/require-role'
import {
  autenticarViaEnv,
  listarTodosFuncionarios,
  SecullumError,
  type SecullumFuncionario,
} from '@/lib/ponto/secullum'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function onlyDigits(s: string | null | undefined): string {
  return (s || '').replace(/\D/g, '')
}

export async function GET() {
  const roleErr = await requireRoleApi(['admin', 'rh'])
  if (roleErr) return roleErr

  const supabase = createServerClient()

  // 1. Lista funcionários ativos no Softmonte
  const { data: softFuncs, error: sfErr } = await supabase
    .from('funcionarios')
    .select('id, nome, cpf, pis, matricula, id_ponto, cargo, status, deleted_at')
    .is('deleted_at', null)
    .order('nome')

  if (sfErr) {
    return NextResponse.json({ error: 'Erro lendo funcionários do Softmonte: ' + sfErr.message }, { status: 500 })
  }

  // 2. Autentica e lista funcionários no Secullum
  let session
  try {
    session = await autenticarViaEnv()
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro autenticando no Secullum' }, { status: 502 })
  }

  let secFuncs: SecullumFuncionario[]
  try {
    secFuncs = await listarTodosFuncionarios(session)
  } catch (e: any) {
    const status = e instanceof SecullumError ? e.status || 502 : 502
    return NextResponse.json({ error: e?.message || 'Erro listando funcionários na Secullum' }, { status })
  }

  // 3. Indexa por CPF e PIS
  const softByCpf = new Map<string, any>()
  const softByPis = new Map<string, any>()
  const softIds = new Set<string>()
  ;(softFuncs || []).forEach(f => {
    if (f.cpf) softByCpf.set(onlyDigits(f.cpf), f)
    if (f.pis) softByPis.set(onlyDigits(f.pis), f)
    softIds.add(f.id)
  })

  const secByCpf = new Map<string, SecullumFuncionario>()
  const secByPis = new Map<string, SecullumFuncionario>()
  ;(secFuncs || []).forEach(f => {
    const cpf = onlyDigits(f.cpf || (f as any).Cpf)
    const pis = onlyDigits(f.pis || (f as any).NumeroPis || (f as any).Pis || '')
    if (cpf) secByCpf.set(cpf, f)
    if (pis) secByPis.set(pis, f)
  })

  // 4. Classifica
  type SoftFunc = { id: string; nome: string | null; cpf: string | null; pis: string | null; cargo: string | null }
  type SecFunc = { nome: string | null; cpf: string | null; pis: string | null; numeroFolha: string | null }

  const matchedSoftIds = new Set<string>()
  const match: { soft: SoftFunc; sec: SecFunc }[] = []
  const soSecullum: SecFunc[] = []

  for (const sec of secFuncs || []) {
    const cpf = onlyDigits(sec.cpf || (sec as any).Cpf)
    const pis = onlyDigits(sec.pis || (sec as any).NumeroPis || (sec as any).Pis || '')
    const soft = (cpf && softByCpf.get(cpf)) || (pis && softByPis.get(pis)) || null

    const secNormalized: SecFunc = {
      nome: sec.nome || (sec as any).Nome || null,
      cpf: cpf || null,
      pis: pis || null,
      numeroFolha: (sec as any).NumeroFolha || sec.numeroFolha || null,
    }

    if (soft) {
      matchedSoftIds.add(soft.id)
      match.push({
        soft: { id: soft.id, nome: soft.nome, cpf: soft.cpf, pis: soft.pis, cargo: soft.cargo },
        sec: secNormalized,
      })
    } else {
      soSecullum.push(secNormalized)
    }
  }

  const soSoftmonte: SoftFunc[] = (softFuncs || [])
    .filter(f => !matchedSoftIds.has(f.id))
    .map(f => ({ id: f.id, nome: f.nome, cpf: f.cpf, pis: f.pis, cargo: f.cargo }))

  return NextResponse.json({
    ok: true,
    banco_secullum: session.bancoNome,
    totais: {
      softmonte: softFuncs?.length ?? 0,
      secullum: secFuncs?.length ?? 0,
      match: match.length,
      so_secullum: soSecullum.length,
      so_softmonte: soSoftmonte.length,
    },
    match,
    so_secullum: soSecullum,
    so_softmonte: soSoftmonte,
  })
}
