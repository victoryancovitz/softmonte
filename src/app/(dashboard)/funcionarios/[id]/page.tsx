import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export default async function FuncionarioPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: f } = await supabase.from('funcionarios').select('*').eq('id', params.id).single()
  if (!f) notFound()

  const { data: alocacoes } = await supabase.from('alocacoes')
    .select('*, obras(nome, status)').eq('funcionario_id', params.id).order('data_inicio', { ascending: false })

  const campos = [
    { label: 'Matrícula', value: f.matricula },
    { label: 'RE', value: f.re },
    { label: 'CPF', value: f.cpf },
    { label: 'PIS', value: f.pis },
    { label: 'Data de Nascimento', value: f.data_nascimento ? new Date(f.data_nascimento+'T12:00').toLocaleDateString('pt-BR') : null },
    { label: 'Admissão', value: f.admissao ? new Date(f.admissao+'T12:00').toLocaleDateString('pt-BR') : null },
    { label: 'Prazo 1', value: f.prazo1 ? new Date(f.prazo1+'T12:00').toLocaleDateString('pt-BR') : null },
    { label: 'Prazo 2', value: f.prazo2 ? new Date(f.prazo2+'T12:00').toLocaleDateString('pt-BR') : null },
    { label: 'Banco', value: f.banco },
    { label: 'Agência / Conta', value: f.agencia_conta },
    { label: 'PIX', value: f.pix },
    { label: 'VT Estrutura', value: f.vt_estrutura },
    { label: 'Tamanho Bota', value: f.tamanho_bota },
    { label: 'Uniforme', value: f.tamanho_uniforme },
  ]

  const STATUS_COLOR: Record<string, string> = {
    disponivel: 'bg-green-100 text-green-700',
    alocado: 'bg-blue-100 text-blue-700',
    afastado: 'bg-yellow-100 text-yellow-700',
    inativo: 'bg-gray-100 text-gray-500',
  }

  const p1 = f.prazo1 ? new Date(f.prazo1+'T12:00') : null
  const diasP1 = p1 ? Math.ceil((p1.getTime() - Date.now()) / 86400000) : null
  const alertaP1 = diasP1 !== null && diasP1 <= 30 && diasP1 >= 0

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <Link href="/funcionarios" className="text-gray-400 hover:text-gray-600">Funcionários</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700">{f.nome}</span>
      </div>

      {alertaP1 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 flex items-center gap-2">
          ⚠️ <span>Contrato vencendo em <strong>{diasP1} dias</strong> ({p1?.toLocaleDateString('pt-BR')})</span>
        </div>
      )}

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-display text-brand">{f.nome}</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-gray-600">{f.cargo}</span>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLOR[f.status] ?? 'bg-gray-100'}`}>{f.status}</span>
          </div>
        </div>
        <Link href={`/funcionarios/${f.id}/editar`}
          className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
          ✏️ Editar
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Dados */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="text-sm font-bold text-brand font-display mb-4">Dados cadastrais</h2>
          <div className="space-y-3">
            {campos.filter(c => c.value).map(c => (
              <div key={c.label} className="flex justify-between">
                <span className="text-xs text-gray-500">{c.label}</span>
                <span className="text-sm font-medium text-gray-800">{c.value}</span>
              </div>
            ))}
            <div className="flex justify-between">
              <span className="text-xs text-gray-500">Custo/hora</span>
              <span className="text-sm font-medium text-gray-800">
                {f.custo_hora ? `R$ ${Number(f.custo_hora).toFixed(2)}` : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Alocações */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="text-sm font-bold text-brand font-display mb-4">Obras</h2>
          {alocacoes && alocacoes.length > 0 ? (
            <div className="space-y-2">
              {alocacoes.map((a: any) => (
                <div key={a.id} className={`p-3 rounded-xl border ${a.ativo ? 'border-green-200 bg-green-50' : 'border-gray-100 bg-gray-50'}`}>
                  <div className="text-sm font-semibold text-gray-900">{a.obras?.nome}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{a.cargo_na_obra}</div>
                  <div className="text-xs text-gray-400">
                    Desde {a.data_inicio ? new Date(a.data_inicio+'T12:00').toLocaleDateString('pt-BR') : '—'}
                    {a.ativo ? <span className="ml-2 text-green-600 font-medium">Ativo</span> : <span className="ml-2 text-gray-400">Encerrado</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Sem alocações.</p>
          )}
        </div>
      </div>
    </div>
  )
}
