import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'

const HOME_POR_ROLE: Record<string, string> = {
  admin: '/diretoria',
  rh: '/rh/folha',
  financeiro: '/financeiro',
  juridico: '/juridico',
  engenharia: '/obras',
  encarregado: '/obras',
  compras: '/compras/pedidos',
  funcionario: '/portal',
}

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('ativo', true)
    .maybeSingle()

  const role = userRole?.role ?? 'visualizador'
  redirect(HOME_POR_ROLE[role] ?? '/obras')
}
