import { requireRole } from '@/lib/require-role'

export default async function RhLayout({ children }: { children: React.ReactNode }) {
  // Módulo RH — folha, admissões, desligamentos, treinamentos, férias
  await requireRole(['admin', 'diretoria', 'rh'])
  return <>{children}</>
}
