import { redirect } from 'next/navigation'
import { NextResponse } from 'next/server'
import { getRole } from './get-role'
import { createClient } from './supabase-server'

/**
 * Para usar em server components. Redireciona para /dashboard se o usuário
 * não tem nenhuma das roles permitidas.
 */
export async function requireRole(allowed: readonly string[]): Promise<string> {
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
export async function requireRoleApi(allowed: readonly string[]): Promise<NextResponse | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { data: userRole } = await supabase
    .from('user_roles')
    .select('role, ativo')
    .eq('user_id', user.id)
    .maybeSingle()
  const role = userRole && userRole.ativo !== false ? userRole.role : 'funcionario'
  if (!allowed.includes(role)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }
  return null
}
