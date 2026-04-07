'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import BackButton from '@/components/BackButton'
import { FileText } from 'lucide-react'

const MESES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

export default function PortalHoleritesPage() {
  const [itens, setItens] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data: func } = await supabase.from('funcionarios').select('id').eq('user_id', user.id).maybeSingle()
      if (!func) { setLoading(false); return }
      const { data } = await supabase.from('folha_itens')
        .select('*, folha_fechamentos(ano, mes, obras(nome))')
        .eq('funcionario_id', func.id)
        .order('created_at', { ascending: false })
      setItens(data || [])
      setLoading(false)
    })()
  }, [])

  const fmt = (v: any) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  if (loading) return <div className="p-6 text-gray-400 text-sm">Carregando...</div>

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/portal" />
        <Link href="/portal" className="text-gray-400 hover:text-gray-600">Portal</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700">Holerites</span>
      </div>

      <h1 className="text-xl font-bold font-display text-brand mb-1">Meus holerites</h1>
      <p className="text-sm text-gray-500 mb-6">Histórico de folha mensal.</p>

      <div className="space-y-3">
        {itens.length > 0 ? itens.map(i => (
          <div key={i.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-gray-900">{MESES[i.folha_fechamentos?.mes]}/{i.folha_fechamentos?.ano}</div>
              <div className="text-xs text-gray-500">{i.folha_fechamentos?.obras?.nome}</div>
              <div className="text-[11px] text-gray-400">
                {Number(i.dias_trabalhados)} dias trab. · {Number(i.dias_descontados) > 0 ? `${Number(i.dias_descontados).toFixed(1)}d descontados` : 'sem descontos'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-400">Líquido</div>
              <div className="text-lg font-bold text-green-700">{fmt(i.valor_liquido)}</div>
            </div>
          </div>
        )) : (
          <div className="bg-white rounded-xl border border-gray-100 p-10 text-center">
            <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Nenhum holerite disponível ainda.</p>
          </div>
        )}
      </div>
    </div>
  )
}
