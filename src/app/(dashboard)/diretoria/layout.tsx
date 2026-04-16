import { requireRole } from '@/lib/require-role'

export default async function DiretoriaLayout({ children }: { children: React.ReactNode }) {
  // Apenas admin e diretoria podem ver o painel executivo
  await requireRole(['admin', 'diretoria'])
  return <>{children}</>
}
