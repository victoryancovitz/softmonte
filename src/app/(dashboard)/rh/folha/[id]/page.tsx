'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import BackButton from '@/components/BackButton'
import { formatStatus } from '@/lib/formatters'
import { ChevronDown, ChevronUp, Printer } from 'lucide-react'

const MESES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

export default function FolhaDetalhePage() {
  const { id } = useParams<{ id: string }>()
  const [folha, setFolha] = useState<any>(null)
  const [itens, setItens] = useState<any[]>([])
  const [empresa, setEmpresa] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    (async () => {
      const [{ data: f }, { data: its }, { data: emp }] = await Promise.all([
        supabase.from('folha_fechamentos').select('*, obras(nome,cliente)').eq('id', id).single(),
        supabase.from('folha_itens').select('*, funcionarios(nome,cargo,matricula,admissao)').eq('folha_id', id).order('created_at'),
        supabase.from('empresa_config').select('*').limit(1).maybeSingle(),
      ])
      setFolha(f)
      setItens(its || [])
      setEmpresa(emp)
      setLoading(false)
    })()
  }, [id])

  const fmt = (v: any) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const num = (v: any) => Number(v || 0)
  const fmtDate = (d: string | null) => {
    if (!d) return '--'
    const [y, m, day] = d.split('-')
    return `${day}/${m}/${y}`
  }

  function toggleHolerite(itemId: string) {
    setExpandedId(prev => prev === itemId ? null : itemId)
  }

  function handlePrint(itemId: string) {
    setExpandedId(itemId)
    setTimeout(() => window.print(), 200)
  }

  if (loading) return <div className="p-6 text-gray-400 text-sm">Carregando...</div>
  if (!folha) return <div className="p-6 text-gray-400">Fechamento não encontrado.</div>

  return (
    <>
      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          .holerite-print, .holerite-print * { visibility: visible !important; }
          .holerite-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20px;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-2 mb-6 text-sm no-print">
          <BackButton fallback="/rh/folha" />
          <Link href="/rh/folha" className="text-gray-400 hover:text-gray-600">Folha</Link>
          <span className="text-gray-300">/</span>
          <span className="font-medium text-gray-700">{MESES[folha.mes]}/{folha.ano} — {folha.obras?.nome}</span>
        </div>

        {/* Resumo da folha */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-5 no-print">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-lg font-bold font-display text-brand">Folha {MESES[folha.mes]}/{folha.ano}</h1>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
              folha.status === 'fechada' ? 'bg-amber-100 text-amber-700' :
              folha.status === 'paga' ? 'bg-green-100 text-green-700' :
              'bg-gray-100 text-gray-500'
            }`}>
              {formatStatus(folha.status)}
            </span>
          </div>
          <p className="text-sm text-gray-500 mb-4">{folha.obras?.nome} · {folha.funcionarios_incluidos} funcionarios</p>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-[10px] text-gray-400 font-semibold uppercase">Bruto</div>
              <div className="text-sm font-bold text-gray-900">{fmt(folha.valor_total_bruto)}</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-[10px] text-gray-400 font-semibold uppercase">Encargos</div>
              <div className="text-sm font-bold text-gray-900">{fmt(folha.valor_total_encargos)}</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-[10px] text-gray-400 font-semibold uppercase">Provisoes</div>
              <div className="text-sm font-bold text-gray-900">{fmt(folha.valor_total_provisoes)}</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-[10px] text-gray-400 font-semibold uppercase">Beneficios</div>
              <div className="text-sm font-bold text-gray-900">{fmt(folha.valor_total_beneficios)}</div>
            </div>
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
              <div className="text-[10px] text-red-500 font-semibold uppercase">TOTAL</div>
              <div className="text-sm font-bold text-red-700">{fmt(folha.valor_total)}</div>
            </div>
          </div>
        </div>

        {/* Tabela de funcionarios */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm no-print">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Funcionario', 'Dias', 'Desc.', 'Bruto', 'Descontos', 'Liquido', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {itens.map(it => {
                const totalDescontos = num(it.desconto_inss) + num(it.desconto_irrf) + num(it.outros_descontos)
                const isExpanded = expandedId === it.id
                return (
                  <tr key={it.id} className="border-b border-gray-50">
                    <td colSpan={7} className="p-0">
                      {/* Row principal */}
                      <div className="flex items-center hover:bg-gray-50/80 cursor-pointer" onClick={() => toggleHolerite(it.id)}>
                        <div className="flex-1 grid grid-cols-7 items-center">
                          <div className="px-4 py-3 col-span-1">
                            <Link href={`/funcionarios/${it.funcionario_id}`} className="font-medium text-gray-900 hover:text-brand" onClick={e => e.stopPropagation()}>
                              {it.funcionarios?.nome}
                            </Link>
                            <div className="text-xs text-gray-400">{it.funcionarios?.cargo} · {it.funcionarios?.matricula}</div>
                          </div>
                          <div className="px-4 py-3 text-gray-600">{num(it.dias_trabalhados)}</div>
                          <div className="px-4 py-3 text-red-600">{num(it.dias_descontados) > 0 ? `-${num(it.dias_descontados).toFixed(1)}d` : '--'}</div>
                          <div className="px-4 py-3">{fmt(it.valor_bruto)}</div>
                          <div className="px-4 py-3 text-red-600 text-xs">{totalDescontos > 0 ? fmt(totalDescontos) : '--'}</div>
                          <div className="px-4 py-3 font-bold text-green-700">{fmt(it.valor_liquido)}</div>
                          <div className="px-4 py-3 flex items-center gap-2 justify-end">
                            <button
                              onClick={(e) => { e.stopPropagation(); handlePrint(it.id) }}
                              className="text-gray-400 hover:text-brand p-1"
                              title="Imprimir holerite"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                            <button className="text-gray-400 hover:text-brand p-1" title="Ver holerite">
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Holerite expandido */}
                      {isExpanded && (
                        <HoleriteCard item={it} folha={folha} empresa={empresa} fmt={fmt} num={num} fmtDate={fmtDate} />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {itens.length === 0 && (
            <div className="p-10 text-center text-gray-400 text-sm no-print">
              Nenhum item nesta folha.
            </div>
          )}
        </div>
      </div>
    </>
  )
}

/* ──────────────────────────────────────────────────────────────── */

function HoleriteCard({ item, folha, empresa, fmt, num, fmtDate }: {
  item: any
  folha: any
  empresa: any
  fmt: (v: any) => string
  num: (v: any) => number
  fmtDate: (d: string | null) => string
}) {
  const func = item.funcionarios || {}
  const MESES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

  // Proventos
  const proventos: { descricao: string; referencia: string; valor: number }[] = []
  proventos.push({ descricao: 'Salario Base', referencia: `${num(item.dias_trabalhados)} dias`, valor: num(item.salario_base) })
  if (num(item.valor_he_50) > 0) proventos.push({ descricao: 'Horas Extras 50%', referencia: `${num(item.horas_extras_50).toFixed(1)}h`, valor: num(item.valor_he_50) })
  if (num(item.valor_he_100) > 0) proventos.push({ descricao: 'Horas Extras 100%', referencia: `${num(item.horas_extras_100).toFixed(1)}h`, valor: num(item.valor_he_100) })
  if (num(item.valor_adicional_noturno) > 0) proventos.push({ descricao: 'Adicional Noturno', referencia: `${num(item.horas_noturnas).toFixed(1)}h`, valor: num(item.valor_adicional_noturno) })
  const totalProventos = proventos.reduce((s, p) => s + p.valor, 0)

  // Descontos
  const descontos: { descricao: string; referencia: string; valor: number }[] = []
  if (num(item.desconto_inss) > 0) descontos.push({ descricao: 'INSS', referencia: '', valor: num(item.desconto_inss) })
  if (num(item.desconto_irrf) > 0) descontos.push({ descricao: 'IRRF', referencia: '', valor: num(item.desconto_irrf) })
  if (num(item.outros_descontos) > 0) descontos.push({ descricao: 'Outros Descontos', referencia: '', valor: num(item.outros_descontos) })
  const totalDescontos = descontos.reduce((s, d) => s + d.valor, 0)

  const totalHE = num(item.horas_extras_50) + num(item.horas_extras_100)

  return (
    <div className="holerite-print border-t border-gray-100 bg-gray-50/50 px-4 py-5">
      <div className="max-w-3xl mx-auto bg-white border border-gray-200 rounded-lg shadow-sm">
        {/* Cabecalho empresa */}
        <div className="border-b border-gray-200 p-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-bold text-sm text-gray-900">{empresa?.razao_social || empresa?.nome_fantasia || 'Empresa'}</h3>
              <p className="text-[11px] text-gray-500">
                {empresa?.cnpj && <>CNPJ: {empresa.cnpj}</>}
                {empresa?.endereco && <> · {empresa.endereco}</>}
                {empresa?.cidade && <>, {empresa.cidade}</>}
                {empresa?.estado && <>/{empresa.estado}</>}
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs font-bold text-gray-700 uppercase">Demonstrativo de Pagamento</div>
              <div className="text-[11px] text-gray-500">{MESES[folha.mes]}/{folha.ano}</div>
            </div>
          </div>
        </div>

        {/* Dados do funcionario */}
        <div className="border-b border-gray-200 p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
            <div>
              <div className="text-gray-400 font-semibold uppercase text-[10px]">Nome</div>
              <div className="font-medium text-gray-900">{func.nome || '--'}</div>
            </div>
            <div>
              <div className="text-gray-400 font-semibold uppercase text-[10px]">Cargo</div>
              <div className="font-medium text-gray-900">{func.cargo || '--'}</div>
            </div>
            <div>
              <div className="text-gray-400 font-semibold uppercase text-[10px]">Matricula</div>
              <div className="font-medium text-gray-900">{func.matricula || '--'}</div>
            </div>
            <div>
              <div className="text-gray-400 font-semibold uppercase text-[10px]">Admissao</div>
              <div className="font-medium text-gray-900">{fmtDate(func.admissao)}</div>
            </div>
          </div>
        </div>

        {/* Proventos e Descontos lado a lado */}
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-200">
          {/* PROVENTOS */}
          <div className="p-4">
            <div className="text-[10px] font-bold text-green-700 uppercase tracking-wider mb-2">Proventos</div>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-1 font-semibold text-gray-500">Descricao</th>
                  <th className="text-right py-1 font-semibold text-gray-500 w-16">Ref.</th>
                  <th className="text-right py-1 font-semibold text-gray-500 w-24">Valor</th>
                </tr>
              </thead>
              <tbody>
                {proventos.map((p, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-1.5 text-gray-700">{p.descricao}</td>
                    <td className="py-1.5 text-right text-gray-500">{p.referencia}</td>
                    <td className="py-1.5 text-right font-medium text-gray-900">{fmt(p.valor)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200">
                  <td colSpan={2} className="py-2 font-bold text-green-700 text-[11px]">Total Proventos</td>
                  <td className="py-2 text-right font-bold text-green-700">{fmt(totalProventos)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* DESCONTOS */}
          <div className="p-4">
            <div className="text-[10px] font-bold text-red-600 uppercase tracking-wider mb-2">Descontos</div>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-1 font-semibold text-gray-500">Descricao</th>
                  <th className="text-right py-1 font-semibold text-gray-500 w-16">Ref.</th>
                  <th className="text-right py-1 font-semibold text-gray-500 w-24">Valor</th>
                </tr>
              </thead>
              <tbody>
                {descontos.length > 0 ? descontos.map((d, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-1.5 text-gray-700">{d.descricao}</td>
                    <td className="py-1.5 text-right text-gray-500">{d.referencia}</td>
                    <td className="py-1.5 text-right font-medium text-red-600">{fmt(d.valor)}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={3} className="py-3 text-gray-400 text-center">Sem descontos</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200">
                  <td colSpan={2} className="py-2 font-bold text-red-600 text-[11px]">Total Descontos</td>
                  <td className="py-2 text-right font-bold text-red-600">{fmt(totalDescontos)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Salario Liquido */}
        <div className="border-t-2 border-gray-300 p-4 bg-gray-50 rounded-b-lg">
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold text-gray-700 uppercase">Salario Liquido</div>
            <div className="text-xl font-bold text-green-700">{fmt(item.valor_liquido)}</div>
          </div>
        </div>

        {/* Rodape: resumo */}
        <div className="border-t border-gray-200 px-4 py-3 bg-gray-50/50 rounded-b-lg">
          <div className="flex flex-wrap gap-4 text-[11px] text-gray-500">
            <div>
              <span className="font-semibold text-gray-600">Dias trabalhados:</span> {num(item.dias_trabalhados)}
            </div>
            <div>
              <span className="font-semibold text-gray-600">Faltas/descontos:</span> {num(item.dias_descontados) > 0 ? `${num(item.dias_descontados).toFixed(1)} dias` : 'Nenhuma'}
            </div>
            <div>
              <span className="font-semibold text-gray-600">HE total:</span> {totalHE > 0 ? `${totalHE.toFixed(1)}h` : 'Nenhuma'}
            </div>
            {item.observacao && (
              <div>
                <span className="font-semibold text-gray-600">Obs:</span> {item.observacao}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
