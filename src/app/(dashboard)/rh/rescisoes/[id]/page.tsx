'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import BackButton from '@/components/BackButton'
import { useToast } from '@/components/Toast'

const TIPO_LABEL: Record<string, string> = {
  sem_justa_causa: 'Sem justa causa',
  justa_causa: 'Justa causa',
  pedido_demissao: 'Pedido demissão',
  comum_acordo: 'Comum acordo',
  fim_contrato_experiencia: 'Fim experiência',
  fim_contrato_determinado: 'Fim contrato',
  rescisao_indireta: 'Rescisão indireta',
  falecimento: 'Falecimento',
}

export default function RescisaoDetalhePage() {
  const { id } = useParams<{ id: string }>()
  const [r, setR] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const toast = useToast()

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('rescisoes')
        .select('*, funcionarios(id,nome,cargo,matricula,admissao,cpf), obras(nome)')
        .eq('id', id).single()
      setR(data); setLoading(false)
    })()
  }, [id])

  const fmt = (v: any) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  async function marcarPaga() {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('rescisoes').update({ status: 'paga', paga_em: new Date().toISOString(), paga_por: user?.id }).eq('id', id)
    if (r.financeiro_lancamento_id) {
      await supabase.from('financeiro_lancamentos').update({ status: 'pago', data_pagamento: new Date().toISOString().slice(0, 10) }).eq('id', r.financeiro_lancamento_id)
    }
    setR({ ...r, status: 'paga' })
    toast.success('Rescisão marcada como paga')
  }

  if (loading) return <div className="p-6 text-gray-400 text-sm">Carregando...</div>
  if (!r) return <div className="p-6 text-gray-400">Rescisão não encontrada.</div>

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/rh/rescisoes" />
        <Link href="/rh/rescisoes" className="text-gray-400 hover:text-gray-600">Rescisões</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700">{r.funcionarios?.nome}</span>
      </div>

      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold font-display text-brand mb-1">
            <Link href={`/funcionarios/${r.funcionario_id}`} className="hover:underline">{r.funcionarios?.nome}</Link>
          </h1>
          <p className="text-sm text-gray-500">
            {r.funcionarios?.cargo} · {TIPO_LABEL[r.tipo]} · Desligamento: {new Date(r.data_desligamento + 'T12:00').toLocaleDateString('pt-BR')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-3 py-1 rounded-full font-bold ${
            r.status === 'paga' ? 'bg-green-100 text-green-700' :
            r.status === 'homologada' ? 'bg-blue-100 text-blue-700' :
            r.status === 'cancelada' ? 'bg-gray-100 text-gray-500' :
            'bg-amber-100 text-amber-700'
          }`}>{r.status.toUpperCase()}</span>
          {r.status === 'homologada' && (
            <button onClick={marcarPaga} className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700">
              Marcar como paga
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-xs font-bold text-green-700 uppercase tracking-wide mb-3">Proventos</h2>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-gray-500">Saldo de salário</dt><dd className="font-semibold">{fmt(r.saldo_salario)}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Aviso prévio ({r.aviso_previo_dias}d)</dt><dd className="font-semibold">{fmt(r.aviso_previo_valor)}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Férias vencidas</dt><dd className="font-semibold">{fmt(r.ferias_vencidas)}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Férias proporcionais</dt><dd className="font-semibold">{fmt(r.ferias_proporcionais)}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">1/3 constitucional</dt><dd className="font-semibold">{fmt(r.terco_ferias)}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">13º proporcional</dt><dd className="font-semibold">{fmt(r.decimo_proporcional)}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Outros proventos</dt><dd className="font-semibold">{fmt(r.outros_proventos)}</dd></div>
            <div className="pt-2 mt-2 border-t border-gray-100 flex justify-between font-bold text-green-700">
              <dt>Total</dt><dd>{fmt(r.total_proventos)}</dd>
            </div>
          </dl>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-xs font-bold text-red-700 uppercase tracking-wide mb-3">Descontos</h2>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-gray-500">INSS</dt><dd className="font-semibold">{fmt(r.desconto_inss)}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">IRRF</dt><dd className="font-semibold">{fmt(r.desconto_irrf)}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">VT</dt><dd className="font-semibold">{fmt(r.desconto_vt)}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Adiantamentos</dt><dd className="font-semibold">{fmt(r.desconto_adiantamento)}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Outros descontos</dt><dd className="font-semibold">{fmt(r.outros_descontos)}</dd></div>
            <div className="pt-2 mt-2 border-t border-gray-100 flex justify-between font-bold text-red-700">
              <dt>Total</dt><dd>{fmt(r.total_descontos)}</dd>
            </div>
          </dl>

          <h2 className="text-xs font-bold text-violet-700 uppercase tracking-wide mb-2 mt-5">FGTS & Multa</h2>
          <dl className="space-y-1.5 text-sm text-gray-500">
            <div className="flex justify-between"><dt>FGTS mês</dt><dd>{fmt(r.fgts_mes)}</dd></div>
            <div className="flex justify-between"><dt>FGTS aviso</dt><dd>{fmt(r.fgts_aviso)}</dd></div>
            <div className="flex justify-between"><dt>FGTS 13º</dt><dd>{fmt(r.fgts_13)}</dd></div>
            <div className="flex justify-between"><dt>Saldo FGTS estimado</dt><dd>{fmt(r.fgts_saldo_estimado)}</dd></div>
            <div className="flex justify-between font-semibold text-violet-700"><dt>Multa 40%</dt><dd>{fmt(r.multa_fgts_40)}</dd></div>
          </dl>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div className="p-5 bg-green-50 border border-green-200 rounded-xl">
          <div className="text-xs text-green-600 font-semibold uppercase">Líquido ao funcionário</div>
          <div className="text-3xl font-bold text-green-700 font-display">{fmt(r.valor_liquido)}</div>
        </div>
        <div className="p-5 bg-red-50 border border-red-200 rounded-xl">
          <div className="text-xs text-red-600 font-semibold uppercase">Custo total empresa</div>
          <div className="text-3xl font-bold text-red-700 font-display">{fmt(r.custo_total_empresa)}</div>
        </div>
      </div>

      {r.financeiro_lancamento_id && (
        <div className="mt-5 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
          🔗 Lançamento financeiro vinculado: <Link href="/financeiro" className="font-semibold underline">ver no financeiro</Link>
        </div>
      )}
    </div>
  )
}
