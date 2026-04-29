import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request: { headers: request.headers } })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isAuthPage = pathname.startsWith('/login') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/convite')
  const isApiRoute = pathname.startsWith('/api/')
  const isPublicApi = pathname.startsWith('/api/auth/register') ||
    pathname.startsWith('/api/whatsapp/webhook') ||
    pathname.startsWith('/api/whatsapp/confirmar') ||
    pathname.startsWith('/api/health') ||
    pathname.startsWith('/api/cron/') ||
    pathname.startsWith('/api/ponto/sync-secullum') ||
    pathname.startsWith('/api/ponto/calcular-efetivo')
  const isPortalRoute = pathname.startsWith('/portal')

  if (!user && !isAuthPage && !isPublicApi) {
    // Rotas /api/* retornam 401 JSON em vez de redirect HTML pra /login,
    // pra clientes fetch receberem erro tratável.
    if (isApiRoute) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Verificar perfil pra: (a) bloquear inativos, (b) redirect funcionário, (c) RBAC por rota
  if (user && !isAuthPage && !isApiRoute) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, ativo, deleted_at')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profile && (profile.ativo === false || profile.deleted_at)) {
      await supabase.auth.signOut()
      return NextResponse.redirect(new URL('/login', request.url))
    }

    if (profile?.role === 'funcionario' && !isPortalRoute && !pathname.startsWith('/api/')) {
      return NextResponse.redirect(new URL('/portal', request.url))
    }

    // RBAC: verificar role via user_roles e bloquear rotas não autorizadas
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('ativo', true)
      .maybeSingle()

    const role = userRole?.role ?? 'visualizador'

    // Matriz de rotas protegidas: rota → roles permitidos (admin sempre pode)
    const ROTAS_RBAC: Record<string, string[]> = {
      // Financeiro: só financeiro edita
      '/financeiro/dividas': ['financeiro'],
      '/financeiro/contas': ['financeiro'],
      '/financeiro/lixeira': ['financeiro'],
      '/financeiro/fluxo-caixa': ['financeiro'],
      '/financeiro/categorias': ['financeiro'],
      '/financeiro/dre': ['financeiro'],
      '/financeiro/conciliacao': ['financeiro'],
      // RH: só rh edita
      '/rh/folha': ['rh'],
      '/rh/admissoes': ['rh'],
      '/rh/desligamentos': ['rh'],
      '/rh/treinamentos': ['rh'],
      '/rh/pagamentos-extras': ['rh'],
      '/rh/correcoes': ['rh'],
      '/rh/banco-horas': ['rh'],
      '/rh/ferias': ['rh'],
      // Jurídico
      '/juridico': ['juridico', 'financeiro'],
      // Diretoria
      '/diretoria': ['admin'],
      // Admin
      '/admin': ['admin'],
    }

    if (role !== 'admin') {
      for (const [rota, rolesPermitidos] of Object.entries(ROTAS_RBAC)) {
        if (pathname.startsWith(rota) && !rolesPermitidos.includes(role)) {
          return NextResponse.redirect(new URL('/sem-acesso', request.url))
        }
      }
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
