import { requireRole } from '@/lib/require-role'
import MergeClient from './MergeClient'

export default async function MergePage() {
  await requireRole(['admin', 'diretoria'])
  return <MergeClient />
}
