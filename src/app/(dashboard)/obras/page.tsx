import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'
import ObrasView from '@/components/ObrasView'

export default async function ObrasPage() {
  const supabase = createClient()
  const { data: obras } = await supabase.from('obras').select('*').is('deleted_at', null).order('created_at', { ascending: false })

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold font-display">Obras</h1>
          <p className="text-sm text-gray-500 mt-0.5">{obras?.length ?? 0} obras cadastradas</p>
        </div>
        <Link href="/obras/nova" className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark transition-colors">+ Nova obra</Link>
      </div>
      <ObrasView obras={obras ?? []} />
    </div>
  )
}
