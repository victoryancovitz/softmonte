import { redirect } from 'next/navigation'
import { NextResponse } from 'next/server'
import { getRole } from './get-role'
import { createClient } from './supabase-server'

/**
 * Para usar em server components. Redireciona para /dashboard se o usuário
 * não tem nenhuma das roles permitidas.
 */
export async function requireRole(allowed: string[]): Promise<string> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const role = await getRole()
  if (!allowed.includes(role)) redirect('/dashboard')
  return role
}

/**
 * Para usar em route handlers (API routes). Retorna Response de erro se bloqueado,
 * ou null se OK. Use: `const err = await requireRoleApi(['admin','rh']); if (err) return err`
 */
export async function requireRoleApi(allowed: string[]): Promise<NextResponse | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('user_id', user.id).single()
  const role = profile?.role ?? 'funcionario'
  if (!allowed.includes(role)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }
  return null
}
