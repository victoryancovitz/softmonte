import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'
import FuncionariosView from '@/components/FuncionariosView'

export default async function FuncionariosPage() {
  const supabase = createClient()

  // Carrega apenas funcionários ativos (não deletados) + join com funcoes
  const { data: all } = await supabase
    .from('funcionarios')
    .select('*, funcoes(nome)')
    .is('deleted_at', null)
    .order('nome')

  const funcs = all ?? []

  const hoje = new Date()
  const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`

  const cargosUnicos = Array.from(new Set(funcs.map(f => f.cargo).filter(Boolean))).sort()

  // Busca alocações ativas pra filtro por obra
  const { data: alocAtivas } = await supabase
    .from('alocacoes')
    .select('funcionario_id, obra_id, obras(id, nome)')
    .eq('ativo', true)

  const obraAtualMap: Record<string, { id: string; nome: string }> = {}
  const obrasSet = new Map<string, string>()
  ;(alocAtivas ?? []).forEach((a: any) => {
    if (a.funcionario_id && a.obras?.id) {
      obraAtualMap[a.funcionario_id] = { id: a.obras.id, nome: a.obras.nome }
      obrasSet.set(a.obras.id, a.obras.nome)
    }
  })
  const obrasUnicas = Array.from(obrasSet.entries()).sort((a, b) => a[1].localeCompare(b[1]))

  const { data: prazosLegais } = await supabase.from('vw_prazos_legais').select('funcionario_id,alerta_tipo,dias_restantes').limit(1000)
  const alertaMap: Record<string, string> = {}
  ;(prazosLegais ?? []).forEach((p: any) => { if (p.alerta_tipo && p.alerta_tipo !== 'ok') alertaMap[p.funcionario_id] = p.alerta_tipo })

  // Banners separados por tipo de alerta
  const prazo2Urgentes = (prazosLegais ?? [])
    .filter((p: any) => p.alerta_tipo === 'experiencia_2_vencendo')
    .map((p: any) => ({ ...p, func: funcs.find(f => f.id === p.funcionario_id) }))
    .filter((p: any) => p.func)
    .sort((a: any, b: any) => (a.dias_restantes ?? 999) - (b.dias_restantes ?? 999))

  const prazo1Info = (prazosLegais ?? [])
    .filter((p: any) => p.alerta_tipo === 'experiencia_1_vencendo')
    .map((p: any) => ({ ...p, func: funcs.find(f => f.id === p.funcionario_id) }))
    .filter((p: any) => p.func)
    .sort((a: any, b: any) => (a.dias_restantes ?? 999) - (b.dias_restantes ?? 999))

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold font-display text-brand">Funcionários</h1>
          <p className="text-sm text-gray-500 mt-0.5">{funcs.filter(f => !f.deleted_at).length} ativo(s) · {funcs.length} total</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/funcionarios/novo" className="px-4 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark">+ Novo</Link>
        </div>
      </div>

      {prazo2Urgentes.length > 0 && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
          <strong>⚠️ Decisão necessária:</strong>{' '}
          {prazo2Urgentes.map((p: any, i: number) => (
            <span key={p.funcionario_id}>
              {i > 0 && ', '}
              <a href={`/rh/vencimentos`} className="font-bold underline hover:text-red-900">
                {p.func.nome.split(' ')[0]} ({p.dias_restantes}d)
              </a>
            </span>
          ))}
          <span className="block text-xs text-red-600 mt-1">
            Período de experiência final vence em breve. Decida: Renovar para CLT ou Não Renovar.{' '}
            <a href="/rh/vencimentos" className="underline font-semibold">Ver vencimentos →</a>
          </span>
        </div>
      )}

      {prazo1Info.length > 0 && (
        <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <strong>📋 Avalie o desempenho:</strong>{' '}
          {prazo1Info.map((p: any, i: number) => (
            <span key={p.funcionario_id}>
              {i > 0 && ', '}
              <a href={`/funcionarios/${p.funcionario_id}`} className="font-bold underline hover:text-amber-900">
                {p.func.nome.split(' ')[0]} (prazo1 em {p.dias_restantes}d)
              </a>
            </span>
          ))}
          <span className="block text-xs text-amber-600 mt-1">
            1º período de experiência vencendo. Avalie para confirmar o 2º período.
          </span>
        </div>
      )}

      <FuncionariosView funcs={funcs} hoje={hojeStr} alertas={alertaMap} cargosUnicos={cargosUnicos} obraAtualMap={obraAtualMap} obrasUnicas={obrasUnicas} />
    </div>
  )
}
