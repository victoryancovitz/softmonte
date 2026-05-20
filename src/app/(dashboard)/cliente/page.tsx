import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Construction, FileText, TrendingUp, Camera, Calendar, Wallet } from 'lucide-react'

/**
 * Portal do Cliente — somente leitura.
 *
 * MVP (próxima sessão): avanço da obra, BMs aprovados, pagamentos realizados,
 * avanço físico × financeiro, KPIs HH (obras por homem-hora), fotos, cronograma,
 * documentos compartilhados.
 *
 * Isolamento: cliente só vê obras vinculadas ao seu cliente_id em user_roles
 * (helper SQL get_my_cliente_id() já criado). Policies dedicadas serão
 * adicionadas em obras / boletins_medicao / financeiro_lancamentos quando o
 * MVP for construído.
 */
export default async function ClientePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: ur }, { data: profile }] = await Promise.all([
    supabase.from('user_roles').select('cliente_id').eq('user_id', user.id).maybeSingle(),
    supabase.from('profiles').select('nome').eq('user_id', user.id).maybeSingle(),
  ])

  const clienteId = ur?.cliente_id ?? null
  const { data: cliente } = clienteId
    ? await supabase.from('clientes').select('nome, razao_social').eq('id', clienteId).maybeSingle()
    : { data: null as any }

  const features = [
    { icon: TrendingUp, label: 'Avanço da obra (%)', desc: 'Físico × financeiro em tempo real' },
    { icon: FileText, label: 'Boletins de medição', desc: 'BMs aprovados e em revisão' },
    { icon: Wallet, label: 'Pagamentos recebidos', desc: 'Histórico de receitas do contrato' },
    { icon: Calendar, label: 'Cronograma', desc: 'Próximos marcos e entregas' },
    { icon: Camera, label: 'Galeria de fotos', desc: 'Registros do diário de obra' },
    { icon: FileText, label: 'Documentos', desc: 'Contratos, aditivos, ARTs' },
  ]

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold font-display text-brand">
          Olá{profile?.nome ? `, ${profile.nome.split(' ')[0]}` : ''}!
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {cliente?.razao_social || cliente?.nome
            ? `Portal de acompanhamento — ${cliente.razao_social || cliente.nome}`
            : 'Portal de acompanhamento da sua obra'}
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-8">
        <div className="flex items-start gap-4">
          <Construction className="w-8 h-8 text-amber-600 flex-shrink-0 mt-1" />
          <div>
            <h2 className="text-base font-bold text-amber-900 mb-1">Portal em construção</h2>
            <p className="text-sm text-amber-800 leading-relaxed">
              Em breve você acompanhará aqui o avanço da obra, medições, pagamentos e fotos em tempo real.
              Enquanto isso, qualquer dúvida fale com a equipe da Tecnomonte.
            </p>
          </div>
        </div>
      </div>

      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">O que virá</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {features.map(f => (
          <div key={f.label} className="bg-white rounded-xl border border-gray-100 p-5">
            <f.icon className="w-6 h-6 text-brand mb-3" />
            <h3 className="text-sm font-bold text-gray-900 mb-1">{f.label}</h3>
            <p className="text-xs text-gray-500">{f.desc}</p>
          </div>
        ))}
      </div>

      {!clienteId && (
        <div className="mt-8 p-4 bg-gray-50 rounded-xl text-xs text-gray-500 text-center">
          Sua conta ainda não está vinculada a um cliente. Avise o administrador.
        </div>
      )}
    </div>
  )
}
