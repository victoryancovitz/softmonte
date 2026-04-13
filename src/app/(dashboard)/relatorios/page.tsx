'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Building, DollarSign, Clock, Shield, BarChart, ArrowLeft, Download, Printer } from 'lucide-react'
import { fmt } from '@/lib/cores'

type ReportId = 1 | 2 | 3 | 4 | 5

const REPORTS: { id: ReportId; title: string; icon: typeof Building; desc: string; color: string }[] = [
  { id: 1, title: 'Status dos Contratos HH', icon: Building, desc: 'Pessoas, HH, prazos e margens', color: 'bg-blue-100 text-blue-600' },
  { id: 2, title: 'DRE por Obra', icon: DollarSign, desc: 'Receita, custos e resultado', color: 'bg-green-100 text-green-600' },
  { id: 3, title: 'Banco de Horas Consolidado', icon: Clock, desc: 'Saldos por funcionário', color: 'bg-yellow-100 text-yellow-600' },
  { id: 4, title: 'Treinamentos e Conformidade', icon: Shield, desc: 'Situação NRs por obra', color: 'bg-red-100 text-red-600' },
  { id: 5, title: 'Análise de Produtividade', icon: BarChart, desc: 'HH realizado vs contratado', color: 'bg-purple-100 text-purple-600' },
]

function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const bom = '\uFEFF'
  const csv = bom + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const fmtNum = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })

export default function RelatoriosPage() {
  const supabase = createClient()
  const [activeReport, setActiveReport] = useState<ReportId | null>(null)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any[]>([])

  async function loadReport(id: ReportId) {
    setLoading(true)
    setData([])

    switch (id) {
      case 1: {
        const [obrasRes, alocRes, hhRes] = await Promise.all([
          supabase.from('obras').select('id, nome, numero_contrato, pessoas_contratadas, hh_contratados, margem_alvo, status').is('deleted_at', null),
          supabase.from('alocacoes').select('obra_id').eq('ativo', true),
          supabase.from('hh_lancamentos').select('obra_id, horas_normais, horas_extras, horas_noturnas'),
        ])
        const obras = obrasRes.data ?? []
        const alocacoes = alocRes.data ?? []
        const hhs = hhRes.data ?? []
        const alocCount: Record<string, number> = {}
        alocacoes.forEach((a: any) => { alocCount[a.obra_id] = (alocCount[a.obra_id] ?? 0) + 1 })
        const hhSum: Record<string, number> = {}
        hhs.forEach((h: any) => {
          hhSum[h.obra_id] = (hhSum[h.obra_id] ?? 0) + Number(h.horas_normais ?? 0) + Number(h.horas_extras ?? 0) + Number(h.horas_noturnas ?? 0)
        })
        setData(obras.map((o: any) => ({
          nome: o.nome,
          contrato: o.numero_contrato ?? '-',
          pessoas_contratadas: o.pessoas_contratadas ?? 0,
          pessoas_alocadas: alocCount[o.id] ?? 0,
          hh_contratados: o.hh_contratados ?? 0,
          hh_realizados: hhSum[o.id] ?? 0,
          margem_alvo: o.margem_alvo ?? 0,
          status: o.status ?? '-',
        })))
        break
      }
      case 2: {
        const [obrasRes, finRes] = await Promise.all([
          supabase.from('obras').select('id, nome').is('deleted_at', null),
          supabase.from('financeiro_lancamentos').select('obra_id, tipo, valor, categoria').is('deleted_at', null),
        ])
        const obras = obrasRes.data ?? []
        const fins = finRes.data ?? []
        const byObra: Record<string, { receita: number; custo_mo: number; outros: number }> = {}
        obras.forEach((o: any) => { byObra[o.id] = { receita: 0, custo_mo: 0, outros: 0 } })
        fins.forEach((f: any) => {
          if (!byObra[f.obra_id]) byObra[f.obra_id] = { receita: 0, custo_mo: 0, outros: 0 }
          if (f.tipo === 'receita') {
            byObra[f.obra_id].receita += Number(f.valor ?? 0)
          } else {
            const cat = (f.categoria ?? '').toLowerCase()
            if (cat.includes('mão de obra') || cat.includes('mao de obra') || cat.includes('salário') || cat.includes('folha')) {
              byObra[f.obra_id].custo_mo += Number(f.valor ?? 0)
            } else {
              byObra[f.obra_id].outros += Number(f.valor ?? 0)
            }
          }
        })
        const obraMap: Record<string, string> = {}
        obras.forEach((o: any) => { obraMap[o.id] = o.nome })
        setData(Object.entries(byObra).map(([id, v]) => {
          const resultado = v.receita - v.custo_mo - v.outros
          return {
            obra: obraMap[id] ?? id,
            receita: v.receita,
            custo_mo: v.custo_mo,
            outros_custos: v.outros,
            resultado,
            margem: v.receita > 0 ? ((resultado / v.receita) * 100) : 0,
          }
        }))
        break
      }
      case 3: {
        const { data: bh } = await supabase
          .from('banco_horas')
          .select('*, funcionarios(nome), obras(nome)')
          .order('created_at', { ascending: false })
        setData((bh ?? []).map((b: any) => ({
          funcionario: b.funcionarios?.nome ?? '-',
          obra: b.obras?.nome ?? '-',
          saldo: b.saldo_acumulado_final ?? b.saldo_acumulado ?? 0,
        })))
        break
      }
      case 4: {
        const { data: treinos } = await supabase
          .from('treinamentos')
          .select('*, funcionarios(nome)')
          .order('funcionario_id')
        setData((treinos ?? []).map((t: any) => ({
          funcionario: t.funcionarios?.nome ?? '-',
          treinamento: t.nome ?? t.tipo ?? '-',
          status: t.status ?? 'pendente',
          validade: t.validade ?? t.data_validade ?? null,
        })))
        break
      }
      case 5: {
        const [obrasRes, hhRes] = await Promise.all([
          supabase.from('obras').select('id, nome, hh_contratados').is('deleted_at', null),
          supabase.from('hh_lancamentos').select('obra_id, horas_normais, horas_extras, horas_noturnas, funcionarios(cargo, funcao)'),
        ])
        const obras = obrasRes.data ?? []
        const hhs = hhRes.data ?? []
        const byObraFunc: Record<string, Record<string, number>> = {}
        const obraMap: Record<string, string> = {}
        const obraHH: Record<string, number> = {}
        obras.forEach((o: any) => { obraMap[o.id] = o.nome; obraHH[o.id] = o.hh_contratados ?? 0 })
        hhs.forEach((h: any) => {
          const funcao = h.funcionarios?.funcao ?? h.funcionarios?.cargo ?? 'Geral'
          if (!byObraFunc[h.obra_id]) byObraFunc[h.obra_id] = {}
          byObraFunc[h.obra_id][funcao] = (byObraFunc[h.obra_id][funcao] ?? 0) + Number(h.horas_normais ?? 0) + Number(h.horas_extras ?? 0) + Number(h.horas_noturnas ?? 0)
        })
        const rows: any[] = []
        Object.entries(byObraFunc).forEach(([obraId, funcs]) => {
          const contratado = obraHH[obraId] ?? 0
          Object.entries(funcs).forEach(([funcao, realizado]) => {
            rows.push({
              obra: obraMap[obraId] ?? obraId,
              funcao,
              hh_contratado: contratado,
              hh_realizado: realizado,
              pct: contratado > 0 ? ((realizado / contratado) * 100) : 0,
            })
          })
        })
        setData(rows)
        break
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    if (activeReport) loadReport(activeReport)
  }, [activeReport])

  function handleExport() {
    if (!activeReport || data.length === 0) return
    const report = REPORTS.find((r) => r.id === activeReport)!
    const filename = `${report.title.replace(/\s+/g, '_')}.csv`

    switch (activeReport) {
      case 1:
        downloadCSV(filename,
          ['Obra', 'Contrato', 'Pess. Contratadas', 'Pess. Alocadas', 'HH Contratados', 'HH Realizados', 'Margem Alvo', 'Status'],
          data.map((d) => [d.nome, d.contrato, d.pessoas_contratadas, d.pessoas_alocadas, d.hh_contratados, fmtNum(d.hh_realizados), d.margem_alvo + '%', d.status])
        )
        break
      case 2:
        downloadCSV(filename,
          ['Obra', 'Receita', 'Custo MO', 'Outros Custos', 'Resultado', 'Margem %'],
          data.map((d) => [d.obra, fmtNum(d.receita), fmtNum(d.custo_mo), fmtNum(d.outros_custos), fmtNum(d.resultado), fmtNum(d.margem) + '%'])
        )
        break
      case 3:
        downloadCSV(filename,
          ['Funcionário', 'Obra', 'Saldo (h)'],
          data.map((d) => [d.funcionario, d.obra, fmtNum(d.saldo)])
        )
        break
      case 4:
        downloadCSV(filename,
          ['Funcionário', 'Treinamento', 'Status', 'Validade'],
          data.map((d) => [d.funcionario, d.treinamento, d.status, d.validade ?? '-'])
        )
        break
      case 5:
        downloadCSV(filename,
          ['Obra', 'Função', 'HH Contratado', 'HH Realizado', '%'],
          data.map((d) => [d.obra, d.funcao, fmtNum(d.hh_contratado), fmtNum(d.hh_realizado), fmtNum(d.pct) + '%'])
        )
        break
    }
  }

  // Card grid view
  if (!activeReport) {
    return (
      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold font-display text-brand">Relatórios</h1>
          <p className="text-sm text-gray-500 mt-0.5">Selecione um relatório para visualizar</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {REPORTS.map((r) => {
            const Icon = r.icon
            return (
              <button
                key={r.id}
                onClick={() => setActiveReport(r.id)}
                className="bg-white shadow-sm rounded-xl p-5 text-left hover:shadow-md transition border border-gray-100"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 ${r.color}`}>
                  <Icon size={20} />
                </div>
                <h3 className="text-sm font-bold text-gray-900 mb-1">{r.title}</h3>
                <p className="text-xs text-gray-500 mb-3">{r.desc}</p>
                <span className="text-xs font-medium text-brand">Ver relatório &rarr;</span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // Report detail view
  const report = REPORTS.find((r) => r.id === activeReport)!
  const Icon = report.icon

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveReport(null)}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <ArrowLeft size={20} />
          </button>
          <div className={`w-9 h-9 rounded-full flex items-center justify-center ${report.color}`}>
            <Icon size={18} />
          </div>
          <div>
            <h1 className="text-xl font-bold font-display text-brand">{report.title}</h1>
            <p className="text-xs text-gray-500">{report.desc}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            disabled={data.length === 0}
            className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition disabled:opacity-50"
          >
            <Download size={16} /> Exportar Excel
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition"
          >
            <Printer size={16} /> Imprimir
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">Carregando dados...</p>
      ) : data.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">Nenhum dado encontrado para este relatório.</p>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          {/* Report 1: Contratos HH */}
          {activeReport === 1 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-3 text-xs font-bold text-gray-500">Obra</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500">Contrato</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 text-right">Pess. Contrat.</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 text-right">Pess. Alocadas</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 text-right">HH Contrat.</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 text-right">HH Realiz.</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 text-right">Margem Alvo</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.map((d, i) => (
                  <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{d.nome}</td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{d.contrato}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{d.pessoas_contratadas}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{d.pessoas_alocadas}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmtNum(d.hh_contratados)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmtNum(d.hh_realizados)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{d.margem_alvo}%</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        d.status === 'ativo' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>{d.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Report 2: DRE */}
          {activeReport === 2 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-3 text-xs font-bold text-gray-500">Obra</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 text-right">Receita</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 text-right">Custo MO</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 text-right">Outros Custos</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 text-right">Resultado</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 text-right">Margem %</th>
                </tr>
              </thead>
              <tbody>
                {data.map((d, i) => (
                  <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{d.obra}</td>
                    <td className="px-4 py-3 text-right text-green-700 font-medium">{fmt(d.receita)}</td>
                    <td className="px-4 py-3 text-right text-red-600">{fmt(d.custo_mo)}</td>
                    <td className="px-4 py-3 text-right text-red-600">{fmt(d.outros_custos)}</td>
                    <td className={`px-4 py-3 text-right font-bold ${d.resultado >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {fmt(d.resultado)}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${d.margem >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {fmtNum(d.margem)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Report 3: Banco de Horas */}
          {activeReport === 3 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-3 text-xs font-bold text-gray-500">Funcionário</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500">Obra</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 text-right">Saldo (h)</th>
                </tr>
              </thead>
              <tbody>
                {data.map((d, i) => (
                  <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{d.funcionario}</td>
                    <td className="px-4 py-3 text-gray-600">{d.obra}</td>
                    <td className={`px-4 py-3 text-right font-bold ${
                      d.saldo > 0 ? 'text-green-700' : d.saldo < 0 ? 'text-red-700' : 'text-gray-500'
                    }`}>
                      {d.saldo > 0 ? '+' : ''}{fmtNum(d.saldo)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Report 4: Treinamentos */}
          {activeReport === 4 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-3 text-xs font-bold text-gray-500">Funcionário</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500">Treinamento</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500">Status</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500">Validade</th>
                </tr>
              </thead>
              <tbody>
                {data.map((d, i) => {
                  const statusColor =
                    d.status === 'valido' || d.status === 'concluido' || d.status === 'concluído'
                      ? 'bg-green-100 text-green-700'
                      : d.status === 'vencido' || d.status === 'expirado'
                      ? 'bg-red-100 text-red-700'
                      : d.status === 'pendente'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-gray-100 text-gray-600'
                  return (
                    <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{d.funcionario}</td>
                      <td className="px-4 py-3 text-gray-600">{d.treinamento}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColor}`}>
                          {d.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {d.validade ? new Date(d.validade + 'T12:00').toLocaleDateString('pt-BR') : '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {/* Report 5: Produtividade */}
          {activeReport === 5 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-3 text-xs font-bold text-gray-500">Obra</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500">Função</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 text-right">HH Contratado</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 text-right">HH Realizado</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {data.map((d, i) => (
                  <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{d.obra}</td>
                    <td className="px-4 py-3 text-gray-600">{d.funcao}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmtNum(d.hh_contratado)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmtNum(d.hh_realizado)}</td>
                    <td className={`px-4 py-3 text-right font-bold ${
                      d.pct <= 100 ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {fmtNum(d.pct)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
