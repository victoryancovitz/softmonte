import { requireRole } from '@/lib/require-role'

export default async function FinanceiroLayout({ children }: { children: React.ReactNode }) {
  // Financeiro é sensível — apenas admin, diretoria, financeiro
  await requireRole(['admin', 'diretoria', 'financeiro'])
  return <>{children}</>
}
