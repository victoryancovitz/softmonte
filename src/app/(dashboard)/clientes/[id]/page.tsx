import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import BackButton from '@/components/BackButton'

export default async function ClientePage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: cliente } = await supabase.from('clientes').select('*').eq('id', params.id).single()
  if (!cliente) notFound()

  const { data: obras } = await supabase.from('obras').select('*').eq('cliente', cliente.nome)
  const { data: emailLogs } = await supabase.from('email_logs').select('*')
    .order('enviado_em', { ascending: false }).limit(20)

  const contatos = Array.isArray(cliente.contatos) ? cliente.contatos : []

  const campos = [
    { label: 'Razão social', value: cliente.razao_social },
    { label: 'CNPJ', value: cliente.cnpj },
    { label: 'Endereço', value: cliente.endereco },
    { label: 'Cidade', value: cliente.cidade },
    { label: 'Estado', value: cliente.estado },
    { label: 'Email principal', value: cliente.email_principal },
    { label: 'Email medição', value: cliente.email_medicao },
    { label: 'Email fiscal', value: cliente.email_fiscal },
    { label: 'Email RH', value: cliente.email_rh },
  ]

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/clientes" />
        <Link href="/clientes" className="text-gray-400 hover:text-gray-600">Clientes</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700">{cliente.nome}</span>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-display text-brand">{cliente.nome}</h1>
          <div className="flex items-center gap-3 mt-2">
            {cliente.cidade && <span className="text-gray-600 text-sm">{cliente.cidade}{cliente.estado ? ` - ${cliente.estado}` : ''}</span>}
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${cliente.ativo !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {cliente.ativo !== false ? 'Ativo' : 'Inativo'}
            </span>
          </div>
        </div>
        <Link href={`/clientes/${cliente.id}/editar`}
          className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
          Editar
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Dados cadastrais */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="text-sm font-bold text-brand font-display mb-4">Dados cadastrais</h2>
          <div className="space-y-3">
            {campos.filter(c => c.value).map(c => (
              <div key={c.label} className="flex justify-between">
                <span className="text-xs text-gray-500">{c.label}</span>
                <span className="text-sm font-medium text-gray-800">{c.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Contatos */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="text-sm font-bold text-brand font-display mb-4">Contatos</h2>
          {contatos.length > 0 ? (
            <div className="space-y-2">
              {contatos.map((c: any, i: number) => (
                <div key={i} className="p-3 rounded-xl border border-gray-100 bg-gray-50">
                  <div className="text-sm font-semibold text-gray-900">{c.nome}</div>
                  {c.funcao && <div className="text-xs text-gray-500 mt-0.5">{c.funcao}</div>}
                  <div className="flex items-center gap-3 mt-1">
                    {c.email && (
                      <a href={`mailto:${c.email}`} className="text-xs text-brand hover:underline">{c.email}</a>
                    )}
                    {c.whatsapp && <span className="text-xs text-gray-400">{c.whatsapp}</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Nenhum contato cadastrado.</p>
          )}
        </div>
      </div>

      {/* Obras vinculadas */}
      <div className="mt-5 bg-white rounded-2xl border border-gray-200 p-5">
        <h2 className="text-sm font-bold text-brand font-display mb-4">Obras vinculadas</h2>
        {obras && obras.length > 0 ? (
          <div className="space-y-2">
            {obras.map((o: any) => (
              <Link key={o.id} href={`/obras/${o.id}`}
                className="block p-3 rounded-xl border border-gray-100 bg-gray-50 hover:border-brand hover:bg-blue-50 transition-colors">
                <div className="text-sm font-semibold text-gray-900">{o.nome}</div>
                <div className="flex items-center gap-3 mt-1">
                  {o.status && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${o.status === 'ativa' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {o.status}
                    </span>
                  )}
                  {o.cidade && <span className="text-xs text-gray-400">{o.cidade}</span>}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">Nenhuma obra vinculada.</p>
        )}
      </div>

      {/* Emails enviados */}
      <div className="mt-5 bg-white rounded-2xl border border-gray-200 p-5">
        <h2 className="text-sm font-bold text-brand font-display mb-4">Emails enviados</h2>
        {emailLogs && emailLogs.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-gray-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Data</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Assunto</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody>
                {emailLogs.map((log: any) => (
                  <tr key={log.id} className="border-b border-gray-50">
                    <td className="px-4 py-2.5 text-gray-500 text-xs">
                      {log.enviado_em ? new Date(log.enviado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-gray-800">{log.assunto ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        log.status === 'enviado' ? 'bg-green-100 text-green-700' :
                        log.status === 'erro' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {log.status ?? '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400">Nenhum email enviado.</p>
        )}
      </div>
    </div>
  )
}
