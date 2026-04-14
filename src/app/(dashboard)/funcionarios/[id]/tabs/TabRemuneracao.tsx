import Link from 'next/link'
import FuncionarioHistoricoSalarial from '@/components/FuncionarioHistoricoSalarial'
import PagamentosExtrasFuncionario from '@/components/PagamentosExtrasFuncionario'
import MobilizacaoCustos from '@/components/MobilizacaoCustos'
import { TrendingUp, TrendingDown, Calendar } from 'lucide-react'

interface TabRemuneracaoProps {
  f: any
  salarioBase: number
  insalPct: number
  insalVal: number
  pericPct: number
  pericVal: number
  salarioBruto: number
  vtMensal: number
  vrDiario: number
  vrMensal: number
  vaMensal: number
  planoSaude: number
  outros: number
  totalBeneficios: number
  ultimoHolerite: any
  holerites: any[]
  holeriteAssinados: number
  sigMap: Map<string, any>
  envMap: Map<string, any>
  historicoSalarial: any[] | null
  alocacaoAtiva: any
  fmtR: (v: number) => string
  fmtD: (d: string | null | undefined) => string
}

const MESES_HOLERITE = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export default function TabRemuneracao({
  f, salarioBase, insalPct, insalVal, pericPct, pericVal, salarioBruto,
  vtMensal, vrDiario, vrMensal, vaMensal, planoSaude, outros, totalBeneficios,
  ultimoHolerite, holerites, holeriteAssinados, sigMap, envMap,
  historicoSalarial, alocacaoAtiva, fmtR, fmtD,
}: TabRemuneracaoProps) {
  return (
    <div className="space-y-5">
      {salarioBase > 0 || totalBeneficios > 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Salário e benefícios</h2>
            <Link href={`/funcionarios/${f.id}/editar`} className="text-[11px] text-brand hover:underline">Editar</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            <div className="flex justify-between py-1 border-b border-gray-50">
              <span className="text-[11px] text-gray-500">Salário base</span>
              <span className="text-sm font-bold text-gray-900">{fmtR(salarioBase)}</span>
            </div>
            {insalPct > 0 && (
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-[11px] text-gray-500">Insalubridade ({insalPct}%)</span>
                <span className="text-xs font-medium text-gray-800">{fmtR(insalVal)}</span>
              </div>
            )}
            {pericPct > 0 && (
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-[11px] text-gray-500">Periculosidade ({pericPct}%)</span>
                <span className="text-xs font-medium text-gray-800">{fmtR(pericVal)}</span>
              </div>
            )}
            <div className="sm:col-span-2 flex justify-between py-2 bg-blue-50 px-3 rounded-lg">
              <span className="text-[11px] font-bold text-blue-700 uppercase">Salário bruto</span>
              <span className="text-sm font-bold text-blue-700">{fmtR(salarioBruto)}</span>
            </div>
            {totalBeneficios > 0 && (
              <>
                {vtMensal > 0 && <div className="flex justify-between py-1 border-b border-gray-50"><span className="text-[11px] text-gray-500">VT</span><span className="text-xs font-medium">{fmtR(vtMensal)}</span></div>}
                {vrDiario > 0 && <div className="flex justify-between py-1 border-b border-gray-50"><span className="text-[11px] text-gray-500">VR ({fmtR(vrDiario)}×21)</span><span className="text-xs font-medium">{fmtR(vrMensal)}</span></div>}
                {vaMensal > 0 && <div className="flex justify-between py-1 border-b border-gray-50"><span className="text-[11px] text-gray-500">VA</span><span className="text-xs font-medium">{fmtR(vaMensal)}</span></div>}
                {planoSaude > 0 && <div className="flex justify-between py-1 border-b border-gray-50"><span className="text-[11px] text-gray-500">Plano saúde</span><span className="text-xs font-medium">{fmtR(planoSaude)}</span></div>}
                {outros > 0 && <div className="flex justify-between py-1 border-b border-gray-50"><span className="text-[11px] text-gray-500">Outros</span><span className="text-xs font-medium">{fmtR(outros)}</span></div>}
                <div className="sm:col-span-2 flex justify-between py-2 bg-purple-50 px-3 rounded-lg">
                  <span className="text-[11px] font-bold text-purple-700 uppercase">Total benefícios</span>
                  <span className="text-sm font-bold text-purple-700">{fmtR(totalBeneficios)}</span>
                </div>
              </>
            )}
            <div className="sm:col-span-2 flex justify-between pt-3 border-t-2 border-brand/20">
              <span className="text-xs font-bold uppercase text-gray-600">Custo líquido (sem encargos)</span>
              <span className="text-base font-black text-brand">{fmtR(salarioBruto + totalBeneficios)}</span>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-2">Não inclui encargos patronais (INSS 20%, FGTS 8%, RAT, Sistema S) e provisões (13º, férias, FGTS). Custo completo com encargos: ver Margem DRE.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 p-6 text-center">
          <p className="text-sm text-gray-400 mb-2">Salário e benefícios não cadastrados.</p>
          <Link href={`/funcionarios/${f.id}/editar`} className="text-xs text-brand hover:underline font-semibold">+ Preencher agora</Link>
        </div>
      )}

      {/* Último holerite */}
      {ultimoHolerite && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Último holerite</h2>
            <span className="text-[10px] text-gray-400">{holerites.length} holerites no total · {holeriteAssinados} assinados</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-gray-900">{MESES_HOLERITE[ultimoHolerite.folha_fechamentos?.mes]}/{ultimoHolerite.folha_fechamentos?.ano}</div>
              <div className="text-xs text-gray-500">{ultimoHolerite.folha_fechamentos?.obras?.nome} · {Number(ultimoHolerite.dias_trabalhados)} dias</div>
            </div>
            <div className="flex items-center gap-3">
              {sigMap.has(ultimoHolerite.id) ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-bold">Assinado</span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold">Não assinado</span>
              )}
              {envMap.has(ultimoHolerite.id) && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold">Enviado</span>
              )}
              <div className="text-right">
                <div className="text-xs text-gray-400">Líquido</div>
                <div className="text-lg font-bold text-green-700">{fmtR(Number(ultimoHolerite.valor_liquido))}</div>
              </div>
              <a href={`/rh/folha/${ultimoHolerite.folha_id}/holerite/${f.id}`} target="_blank" className="text-brand hover:underline text-xs font-semibold">Ver →</a>
            </div>
          </div>
        </div>
      )}

      {/* Histórico salarial */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Histórico salarial</h2>
          <Link href="/rh/correcoes" className="text-[11px] text-brand hover:underline">Correções coletivas →</Link>
        </div>
        <FuncionarioHistoricoSalarial funcionarioId={f.id} />
      </div>

      {/* Histórico de cargo e salário (timeline server-rendered) */}
      {(historicoSalarial ?? []).length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Historico de Cargo e Salario</h2>
          <div className="space-y-0">
            {(historicoSalarial ?? []).map((h: any, i: number) => {
              const anterior = Number(h.salario_anterior || 0)
              const novo = Number(h.salario_novo || 0)
              const diff = novo - anterior
              const pct = anterior > 0 ? (diff / anterior * 100) : null
              const isUp = diff >= 0
              const isFirst = i === 0
              const isLast = i === (historicoSalarial ?? []).length - 1
              const cargoChanged = h.cargo_anterior && h.cargo_novo && h.cargo_anterior !== h.cargo_novo

              const TIPO_DOT: Record<string, string> = {
                promocao: 'bg-green-500',
                reenquadramento: 'bg-blue-500',
                merito: 'bg-green-500',
                acordo_coletivo: 'bg-violet-500',
                dissidio: 'bg-violet-500',
                correcao: 'bg-amber-500',
                piso: 'bg-amber-500',
                admissao: 'bg-brand',
              }
              const TIPO_BADGE: Record<string, string> = {
                promocao: 'bg-green-100 text-green-700 border-green-200',
                reenquadramento: 'bg-blue-100 text-blue-700 border-blue-200',
                merito: 'bg-green-100 text-green-700 border-green-200',
                acordo_coletivo: 'bg-violet-100 text-violet-700 border-violet-200',
                dissidio: 'bg-violet-100 text-violet-700 border-violet-200',
                correcao: 'bg-amber-100 text-amber-700 border-amber-200',
                piso: 'bg-amber-100 text-amber-700 border-amber-200',
                admissao: 'bg-blue-100 text-blue-700 border-blue-200',
              }
              const MOTIVO_L: Record<string, string> = {
                admissao: 'Admissao', acordo_coletivo: 'Acordo coletivo', dissidio: 'Dissidio',
                merito: 'Merito', promocao: 'Promocao', correcao: 'Correcao',
                reenquadramento: 'Reenquadramento', piso: 'Ajuste ao piso', outro: 'Outro',
              }

              return (
                <div key={h.id} className="relative flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-1.5 ${
                      isFirst ? `${TIPO_DOT[h.motivo] || 'bg-gray-400'} ring-4 ring-opacity-20 ${h.motivo === 'promocao' || h.motivo === 'merito' ? 'ring-green-200' : 'ring-gray-200'}` : (TIPO_DOT[h.motivo] || 'bg-gray-300')
                    }`} />
                    {!isLast && <div className="w-px flex-1 bg-gray-200 my-1" />}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-start justify-between flex-wrap gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${TIPO_BADGE[h.motivo] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                            {MOTIVO_L[h.motivo] || h.motivo}
                          </span>
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(h.data_efetivo + 'T12:00').toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        {cargoChanged && (
                          <p className="text-[11px] text-gray-600 mt-1">
                            {h.cargo_anterior} <span className="text-gray-400">→</span> <strong>{h.cargo_novo}</strong>
                          </p>
                        )}
                        {h.observacao && <p className="text-[11px] text-gray-400 mt-1 italic">{h.observacao}</p>}
                      </div>
                      <div className="text-right">
                        {h.motivo === 'admissao' ? (
                          <div className="text-sm font-bold text-brand">{fmtR(novo)}</div>
                        ) : (
                          <>
                            <div className="flex items-center gap-1 justify-end">
                              <span className="text-[11px] text-gray-400 line-through">{fmtR(anterior)}</span>
                              <span className="text-gray-300">→</span>
                              <span className="text-sm font-bold text-gray-900">{fmtR(novo)}</span>
                            </div>
                            {pct !== null && (
                              <div className={`text-[11px] font-bold flex items-center gap-0.5 justify-end ${isUp ? 'text-green-600' : 'text-red-600'}`}>
                                {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                {isUp ? '+' : ''}{fmtR(diff)}
                                <span className="text-gray-400 font-normal">({isUp ? '+' : ''}{pct.toFixed(1)}%)</span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Pagamentos extras (bônus, comissões, PLR, por fora) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pagamentos extras</h2>
          <Link href="/rh/pagamentos-extras" className="text-[11px] text-brand hover:underline">Visão global →</Link>
        </div>
        <PagamentosExtrasFuncionario funcionarioId={f.id} />

        {/* Custos de Mobilização */}
        <MobilizacaoCustos funcionarioId={f.id} admissao={f.admissao}
          initial={{ aso: Number(f.custo_aso_admissional || 0), epi: Number(f.custo_epi || 0), uniforme: Number(f.custo_uniforme || 0), outros: Number(f.custo_outros_admissao || 0) }}
          obraId={alocacaoAtiva?.obra_id ?? null} />
      </div>
    </div>
  )
}
