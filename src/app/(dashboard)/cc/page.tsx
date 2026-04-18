import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'
import EmptyState from '@/components/ui/EmptyState'
import { Building2, Landmark, Wrench, Package } from 'lucide-react'
import BackButton from '@/components/BackButton'
import { fmt } from '@/lib/cores'

/* ═══ Helpers ═══ */

const TIPO_ICON: Record<string, React.ReactNode> = {
  obra:           <Building2 className="w-4 h-4 text-blue-500" />,
  suporte_obra:   <Building2 className="w-4 h-4 text-sky-400" />,
  administrativo: <Landmark className="w-4 h-4 text-violet-500" />,
  equipamento:    <Package className="w-4 h-4 text-amber-500" />,
}

const TIPO_BADGE: Record<string, string> = {
  obra:           'bg-blue-100 text-blue-700',
  suporte_obra:   'bg-sky-100 text-sky-700',
  administrativo: 'bg-violet-100 text-violet-700',
  equipamento:    'bg-amber-100 text-amber-700',
}

const TIPO_LABEL: Record<string, string> = {
  obra: 'Obra',
  suporte_obra: 'Suporte Obra',
  administrativo: 'Administrativo',
  equipamento: 'Equipamento',
}

interface CCRow {
  id: string
  codigo: string
  nome: string
  tipo: string
  subtipo: string | null
  parent_id: string | null
  custo_mensal_estimado: number | null
  nivel?: number
  ativo: boolean
}

function getGrupo(tipo: string): string {
  if (tipo === 'obra' || tipo === 'suporte_obra') return 'Obras e Suporte'
  if (tipo === 'administrativo') return 'Estrutura Administrativa'
  return 'Equipamentos'
}

export default async function CentrosCustoMapaPage() {
  const supabase = createClient()
  const { data: rows } = await supabase
    .from('vw_centros_custo_arvore')
    .select('*')

  const ccs: CCRow[] = rows ?? []

  // KPIs
  const total = ccs.length
  const totalObra = ccs.filter(c => c.tipo === 'obra' || c.tipo === 'suporte_obra').length
  const totalAdm = ccs.filter(c => c.tipo === 'administrativo').length
  const totalEq = ccs.filter(c => c.tipo === 'equipamento').length

  // Agrupar
  const grupos: Record<string, CCRow[]> = {
    'Obras e Suporte': [],
    'Estrutura Administrativa': [],
    'Equipamentos': [],
  }
  ccs.forEach(c => {
    const g = getGrupo(c.tipo)
    grupos[g].push(c)
  })

  if (total === 0) {
    return (
      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <BackButton fallback="/diretoria" />
          <h1 className="text-xl font-bold font-display text-brand">Centros de Custo</h1>
        </div>
        <EmptyState
          titulo="Nenhum centro de custo cadastrado"
          descricao="Crie o primeiro centro de custo para organizar a estrutura de custos da empresa."
          icone={<Landmark className="w-12 h-12" />}
          acao={{ label: '+ Novo Centro de Custo', href: '/cc/estrutura' }}
        />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <BackButton fallback="/diretoria" />
          <div>
            <h1 className="text-xl font-bold font-display text-brand">Centros de Custo</h1>
            <p className="text-sm text-gray-500">Mapa da estrutura de centros de custo</p>
          </div>
        </div>
        <Link
          href="/cc/estrutura"
          className="px-4 py-2 bg-brand text-white rounded-xl text-sm font-semibold hover:bg-brand-dark"
        >
          + Novo Centro de Custo
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total CCs', value: total, cls: 'text-gray-800' },
          { label: 'Obras', value: totalObra, cls: 'text-blue-600' },
          { label: 'Administrativos', value: totalAdm, cls: 'text-violet-600' },
          { label: 'Equipamentos', value: totalEq, cls: 'text-amber-600' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500 mb-1">{k.label}</p>
            <p className={`text-2xl font-bold ${k.cls}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Árvore por grupo */}
      {Object.entries(grupos).map(([grupo, items]) => {
        if (items.length === 0) return null
        return (
          <div key={grupo} className="mb-6">
            <h2 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">{grupo}</h2>
            <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
              {items.map(cc => {
                const nivel = cc.nivel ?? (cc.parent_id ? 1 : 0)
                return (
                  <div
                    key={cc.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                    style={{ paddingLeft: `${16 + nivel * 24}px` }}
                  >
                    {TIPO_ICON[cc.tipo] ?? <Package className="w-4 h-4 text-gray-400" />}
                    <span className="text-xs font-mono text-gray-400 min-w-[64px]">{cc.codigo}</span>
                    <span className="text-sm font-medium text-gray-800 flex-1 truncate">{cc.nome}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TIPO_BADGE[cc.tipo] ?? 'bg-gray-100 text-gray-500'}`}>
                      {TIPO_LABEL[cc.tipo] ?? cc.tipo}
                    </span>
                    {cc.custo_mensal_estimado ? (
                      <span className="text-xs text-gray-500 tabular-nums min-w-[80px] text-right">
                        {fmt(cc.custo_mensal_estimado)}/mês
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300 min-w-[80px] text-right">—</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
