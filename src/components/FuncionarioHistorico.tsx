import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'

export default async function FuncionarioHistorico({
  cpf,
  funcionarioAtualId,
  admissaoAtual,
}: {
  cpf: string | null
  funcionarioAtualId: string
  admissaoAtual: string | null
}) {
  if (!cpf) return null

  const supabase = createClient()
  const [{ data: vinculos }, { data: arquivados }] = await Promise.all([
    supabase.from('vinculos_funcionario').select('*').eq('cpf', cpf).order('admissao', { ascending: false }),
    supabase.from('funcionarios').select('id, nome, cargo, admissao, deleted_at, matricula, id_ponto').eq('cpf', cpf).not('deleted_at', 'is', null).order('admissao', { ascending: false }),
  ])

  const totalAnteriores = (vinculos?.length ?? 0) + (arquivados?.length ?? 0)

  if (totalAnteriores === 0) {
    return (
      <div className="mt-5 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="text-sm font-bold text-brand font-display mb-4">Histórico na Empresa</h2>
        <p className="text-sm text-gray-400">Primeiro vínculo com a empresa.</p>
      </div>
    )
  }

  // Combine sources for display, current vínculo first
  const items: any[] = [
    {
      tipo: 'atual',
      numero: totalAnteriores + 1,
      admissao: admissaoAtual,
      demissao: null,
    },
    ...(arquivados ?? []).map((a: any, i: number) => ({
      tipo: 'arquivado',
      id: a.id,
      numero: totalAnteriores - i,
      admissao: a.admissao,
      demissao: a.deleted_at?.split('T')[0],
      cargo: a.cargo,
      matricula: a.matricula,
      id_ponto: a.id_ponto,
    })),
    ...(vinculos ?? []).map((v: any, i: number) => ({
      tipo: 'vinculo',
      id: v.id,
      numero: i + 1,
      admissao: v.admissao,
      demissao: v.demissao,
      cargo: v.cargo,
      matricula: v.matricula,
      id_ponto: v.id_ponto,
      motivo_saida: v.motivo_saida,
      obra_principal: v.obra_principal,
    })),
  ]

  return (
    <div className="mt-5 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-brand font-display">Histórico na Empresa</h2>
        <span className="text-xs text-gray-400">{items.length} vínculo{items.length > 1 ? 's' : ''}</span>
      </div>
      <div className="space-y-2">
        {items.map((item, idx) => {
          const isAtual = item.tipo === 'atual'
          const card = (
            <div className={`p-3 rounded-xl border ${isAtual ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-gray-600">
                  Vínculo #{item.numero} {isAtual && <span className="ml-1 text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">ATUAL</span>}
                </span>
                <div className="flex items-center gap-2 text-[10px] text-gray-500">
                  {item.id_ponto && <span>ID: {item.id_ponto}</span>}
                  {item.matricula && <span>Mat: {item.matricula}</span>}
                </div>
              </div>
              <div className="text-xs text-gray-500">
                {item.admissao ? new Date(item.admissao + 'T12:00').toLocaleDateString('pt-BR') : '—'}
                {' → '}
                {item.demissao ? new Date(item.demissao + 'T12:00').toLocaleDateString('pt-BR') : isAtual ? 'Em andamento' : '—'}
                {item.cargo && <span className="ml-2 text-gray-400">· {item.cargo}</span>}
              </div>
              {item.motivo_saida && (
                <div className="text-[10px] text-gray-400 mt-1">Motivo: {item.motivo_saida}</div>
              )}
            </div>
          )

          if (item.tipo === 'arquivado') {
            return <Link key={idx} href={`/funcionarios/${item.id}?arquivado=1`} className="block hover:opacity-80">{card}</Link>
          }
          return <div key={idx}>{card}</div>
        })}
      </div>
    </div>
  )
}
