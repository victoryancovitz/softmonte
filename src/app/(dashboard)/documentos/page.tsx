import { createClient } from '@/lib/supabase-server'
import { getRole } from '@/lib/get-role'
import Link from 'next/link'
import DocumentosTable from './DocumentosTable'

export default async function DocumentosPage() {
  const supabase = createClient()
  const role = await getRole()
  const { data: docs } = await supabase
    .from('documentos')
    .select('*, funcionarios(nome, cargo)')
    .is('deleted_at', null)
    .order('vencimento', { ascending: true })

  const hoje = new Date()
  const docsComDias = docs?.map((d: any) => ({
    ...d,
    dias: d.vencimento ? Math.ceil((new Date(d.vencimento+'T12:00').getTime() - hoje.getTime()) / 86400000) : null,
    funcionario_nome: d.funcionarios?.nome ?? '',
  })) ?? []

  const vencidos = docsComDias.filter(d => d.dias !== null && d.dias < 0)
  const vencendo = docsComDias.filter(d => d.dias !== null && d.dias >= 0 && d.dias <= 30)

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold font-display text-brand">Documentos</h1>
          <p className="text-sm text-gray-500 mt-0.5">{docs?.length ?? 0} documentos</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/documentos/gerar" className="px-4 py-2 border border-brand text-brand rounded-xl text-sm font-semibold hover:bg-brand/5 transition-all">Gerar Documento</Link>
          <Link href="/documentos/novo" className="px-4 py-2 bg-brand text-white rounded-xl text-sm font-semibold hover:bg-brand-dark">+ Novo documento</Link>
        </div>
      </div>

      {(vencidos.length > 0 || vencendo.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-5">
          {vencidos.length > 0 && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
              <div className="font-semibold text-red-800 text-sm mb-1 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> {vencidos.length} documento(s) VENCIDO(S)</div>
              <div className="text-xs text-red-600">{vencidos.map((d: any) => `${d.funcionarios?.nome?.split(' ')[0]} — ${d.tipo}`).join(' · ')}</div>
            </div>
          )}
          {vencendo.length > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="font-semibold text-amber-800 text-sm mb-1 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> {vencendo.length} documento(s) vencendo em 30 dias</div>
              <div className="text-xs text-amber-600">{vencendo.map((d: any) => `${d.funcionarios?.nome?.split(' ')[0]} — ${d.tipo}`).join(' · ')}</div>
            </div>
          )}
        </div>
      )}

      <DocumentosTable docs={docsComDias} role={role} />
    </div>
  )
}
