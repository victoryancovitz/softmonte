'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import BackButton from '@/components/BackButton'
import { FileText, CheckCircle2, ExternalLink, PenLine, X } from 'lucide-react'

const MESES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

export default function PortalHoleritesPage() {
  const [itens, setItens] = useState<any[]>([])
  const [assinaturas, setAssinaturas] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [funcId, setFuncId] = useState<string | null>(null)
  const [modalItem, setModalItem] = useState<any | null>(null)
  const [signing, setSigning] = useState(false)
  const supabase = createClient()
  const toast = useToast()

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data: func } = await supabase.from('funcionarios').select('id').eq('user_id', user.id).maybeSingle()
      if (!func) { setLoading(false); return }
      setFuncId(func.id)

      const [{ data: itensData }, { data: assData }] = await Promise.all([
        supabase.from('folha_itens')
          .select('*, folha_fechamentos(id, ano, mes, obras(nome))')
          .eq('funcionario_id', func.id)
          .order('created_at', { ascending: false }),
        supabase.from('holerite_assinaturas')
          .select('folha_item_id, status, assinado_em')
          .eq('funcionario_id', func.id),
      ])

      setItens(itensData || [])

      const assMap: Record<string, any> = {}
      for (const a of (assData || [])) {
        assMap[a.folha_item_id] = a
      }
      setAssinaturas(assMap)
      setLoading(false)
    })()
  }, [])

  const fmt = (v: any) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const fmtDate = (d: string) => {
    const dt = new Date(d)
    return dt.toLocaleDateString('pt-BR')
  }

  const handleSign = async (item: any) => {
    if (!funcId) return
    setSigning(true)
    const { error } = await supabase.from('holerite_assinaturas').insert({
      folha_item_id: item.id,
      funcionario_id: funcId,
      folha_id: item.folha_fechamentos?.id || item.folha_id,
      status: 'assinado',
      assinado_device: navigator.userAgent,
    })
    setSigning(false)
    setModalItem(null)

    if (error) {
      toast.error('Erro ao assinar holerite', error.message)
      return
    }

    setAssinaturas(prev => ({
      ...prev,
      [item.id]: { folha_item_id: item.id, status: 'assinado', assinado_em: new Date().toISOString() },
    }))
    toast.success('Holerite assinado digitalmente')
  }

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
        {itens.length > 0 ? itens.map(i => {
          const ass = assinaturas[i.id]
          const isSigned = ass?.status === 'assinado'
          const folhaId = i.folha_fechamentos?.id || i.folha_id
          const mesNome = MESES[i.folha_fechamentos?.mes] || ''
          const ano = i.folha_fechamentos?.ano || ''

          return (
            <div key={i.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-4">
              {/* Left: month/year, obra, days */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-gray-900">{mesNome}/{ano}</div>
                <div className="text-xs text-gray-500">{i.folha_fechamentos?.obras?.nome}</div>
                <div className="text-[11px] text-gray-400">
                  {Number(i.dias_trabalhados)} dias trab. · {Number(i.dias_descontados) > 0 ? `${Number(i.dias_descontados).toFixed(1)}d descontados` : 'sem descontos'}
                </div>
              </div>

              {/* Center: signature status */}
              <div className="flex-shrink-0">
                {isSigned ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-xs font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Assinado em {fmtDate(ass.assinado_em)}
                  </span>
                ) : (
                  <button
                    onClick={() => setModalItem(i)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand/10 text-brand text-xs font-medium hover:bg-brand/20 transition-colors"
                  >
                    <PenLine className="w-3.5 h-3.5" />
                    Assinar Holerite
                  </button>
                )}
              </div>

              {/* Right: valor líquido + ver holerite */}
              <div className="text-right flex-shrink-0">
                <div className="text-xs text-gray-400">Líquido</div>
                <div className="text-lg font-bold text-green-700">{fmt(i.valor_liquido)}</div>
                <a
                  href={`/rh/folha/${folhaId}/holerite/${funcId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-brand hover:underline mt-0.5"
                >
                  Ver holerite <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )
        }) : (
          <div className="bg-white rounded-xl border border-gray-100 p-10 text-center">
            <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Nenhum holerite disponível ainda.</p>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {modalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-900">Assinar holerite</h2>
              <button onClick={() => setModalItem(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Ao assinar, você confirma o recebimento e concordância com os valores apresentados neste holerite de{' '}
              <span className="font-semibold">{MESES[modalItem.folha_fechamentos?.mes]}/{modalItem.folha_fechamentos?.ano}</span>.
            </p>
            <div className="bg-gray-50 rounded-lg p-3 mb-5 text-center">
              <div className="text-xs text-gray-400">Valor líquido</div>
              <div className="text-xl font-bold text-green-700">{fmt(modalItem.valor_liquido)}</div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setModalItem(null)}
                disabled={signing}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleSign(modalItem)}
                disabled={signing}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-brand rounded-lg hover:bg-brand/90 transition-colors disabled:opacity-50"
              >
                {signing ? 'Assinando...' : 'Confirmar assinatura'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
