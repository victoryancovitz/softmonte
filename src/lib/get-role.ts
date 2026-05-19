import { createClient } from './supabase-server'

// user_roles é a source-of-truth para RBAC desde 11/05/2026 (ver project_softmonte memory).
// profiles guarda metadado de UI; nunca usar profiles.role para autorização.
export async function getRole(): Promise<string> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 'funcionario'
  const { data: userRole } = await supabase
    .from('user_roles')
    .select('role, ativo')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!userRole || userRole.ativo === false) return 'funcionario'
  return userRole.role
}
