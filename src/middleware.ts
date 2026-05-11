import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { safeRedirect } from '@/lib/auth-helpers'

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
    if (isApiRoute) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // user_roles é a única source-of-truth para bloqueio e RBAC.
  // profiles guarda metadado (nome, foto) mas NÃO controla acesso — soft-delete em profiles
  // não derruba mais o usuário (era a causa do loop login→logout de 11/05).
  if (user && !isAuthPage && !isApiRoute) {
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role, ativo')
      .eq('user_id', user.id)
      .maybeSingle()

    if (userRole && userRole.ativo === false) {
      return safeRedirect(request, 'user-role-inactive', supabase)
    }

    const role = userRole?.role ?? 'visualizador'

    if (role === 'funcionario' && !isPortalRoute) {
      return NextResponse.redirect(new URL('/portal', request.url))
    }

    const ROTAS_RBAC: Record<string, string[]> = {
      '/financeiro/dividas': ['financeiro'],
      '/financeiro/contas': ['financeiro'],
      '/financeiro/lixeira': ['financeiro'],
      '/financeiro/fluxo-caixa': ['financeiro'],
      '/financeiro/categorias': ['financeiro'],
      '/financeiro/dre': ['financeiro'],
      '/financeiro/conciliacao': ['financeiro'],
      '/rh/folha': ['rh'],
      '/rh/admissoes': ['rh'],
      '/rh/desligamentos': ['rh'],
      '/rh/treinamentos': ['rh'],
      '/rh/pagamentos-extras': ['rh'],
      '/rh/correcoes': ['rh'],
      '/rh/banco-horas': ['rh'],
      '/rh/ferias': ['rh'],
      '/juridico': ['juridico', 'financeiro'],
      '/diretoria': ['admin'],
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
