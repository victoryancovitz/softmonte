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
    pathname.startsWith('/api/health')
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

  // Verificar perfil pra: (a) bloquear usuários inativos/deletados, (b) redirect funcionário
  if (user && !isAuthPage && !isApiRoute) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, ativo, deleted_at')
      .eq('user_id', user.id)
      .maybeSingle()

    // Usuário bloqueado (ativo=false) ou deletado → força logout
    if (profile && (profile.ativo === false || profile.deleted_at)) {
      await supabase.auth.signOut()
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Funcionário logado é isolado ao /portal — bloqueia TODAS as rotas admin
    if (profile?.role === 'funcionario' && !isPortalRoute && !pathname.startsWith('/api/')) {
      return NextResponse.redirect(new URL('/portal', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
