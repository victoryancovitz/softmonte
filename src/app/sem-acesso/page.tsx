import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'

const HOME_POR_ROLE: Record<string, { href: string; label: string }> = {
  admin: { href: '/diretoria', label: 'Ir para Diretoria' },
  rh: { href: '/rh/folha', label: 'Ir para RH' },
  financeiro: { href: '/financeiro', label: 'Ir para Financeiro' },
  juridico: { href: '/juridico', label: 'Ir para Jurídico' },
  engenharia: { href: '/obras', label: 'Ir para Obras' },
  encarregado: { href: '/obras', label: 'Ir para Obras' },
  compras: { href: '/compras/pedidos', label: 'Ir para Compras' },
  funcionario: { href: '/portal', label: 'Ir para o Portal' },
}

export default async function SemAcesso() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let home: { href: string; label: string } | null = null
  if (user) {
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('ativo', true)
      .maybeSingle()
    const role = userRole?.role ?? 'visualizador'
    home = HOME_POR_ROLE[role] ?? { href: '/obras', label: 'Ir para Obras' }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center max-w-md p-8">
        <div className="text-6xl mb-4">🔒</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Sem acesso</h1>
        <p className="text-gray-500 mb-6">
          Você não tem permissão para acessar esta área. Se acha que isso está errado,
          fale com a diretoria.
        </p>
        <div className="flex flex-col gap-2.5 items-stretch">
          {home && (
            <Link href={home.href} className="px-6 py-2.5 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark">
              {home.label}
            </Link>
          )}
          <a href="/api/auth/logout" className="px-6 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-100">
            Sair da conta
          </a>
        </div>
      </div>
    </div>
  )
}
