import { requireRole } from '@/lib/require-role'

/**
 * Layout protetor de todas as rotas /admin/*.
 * Server component: verifica role antes de renderizar qualquer child.
 * Se não for admin, redireciona para /dashboard.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole(['admin'])
  return <>{children}</>
}
