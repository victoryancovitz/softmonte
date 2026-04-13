'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

const fmt = (v: any) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function SocietarioClient({ socios, movimentacoes, indicadores, config, contas }: {
  socios: any[]; movimentacoes: any[]; indicadores: any; config: any; contas: any[]
}) {
  const supabase = createClient()
  const toast = useToast()
  const [showDist, setShowDist] = useState(false)
  const [showAporte, setShowAporte] = useState(false)
  const [valor, setValor] = useState('')
  const [tipo, setTipo] = useState('dividendos')
  const [socioId, setSocioId] = useState('')
  const [contaEmpresaId, setContaEmpresaId] = useState('')
  const [saving, setSaving] = useState(false)
  const contasEmpresa = contas.filter((c: any) => c.proprietario !== 'socio')
  const contasPorSocio = (sid: string) => contas.filter((c: any) => c.socio_id === sid)

  const lucroDisp = Number(indicadores?.lucro_liquido_caixa || 0)
  const capitalSocial = Number(config?.capital_social || 100000)
  const distribuido = Number(indicadores?.distribuicoes || 0)

  async function distribuir() {
    const v = Number(valor)
    if (!v || v <= 0) { toast.error('Valor inválido'); return }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const hoje = new Date()
    const ano = hoje.getFullYear()
    const mes = hoje.getMonth() + 1

    for (const s of socios) {
      const proporcional = Math.round(v * Number(s.participacao_pct) / 100 * 100) / 100
      const contaSocio = contasPorSocio(s.id)[0]?.id || null
      // Movimentação societária
      await supabase.from('movimentacoes_societarias').insert({
        socio_id: s.id, tipo, valor_total: proporcional,
        competencia_ano: ano, competencia_mes: mes,
        data_deliberacao: hoje.toISOString().slice(0, 10),
        participacao_pct: Number(s.participacao_pct),
        lucro_base_distribuicao: lucroDisp,
        conta_id: contaEmpresaId || null,
        conta_destino_id: contaSocio,
        status: 'pendente', created_by: user?.id,
      })
      // Lançamento financeiro
      await supabase.from('financeiro_lancamentos').insert({
        tipo: 'despesa', nome: `${tipo === 'dividendos' ? 'Dividendos' : 'Pró-labore'} — ${s.nome}`,
        categoria: tipo === 'dividendos' ? 'Distribuição de Lucros' : 'Pró-labore',
        valor: proporcional, status: 'em_aberto', socio_id: s.id,
        data_competencia: `${ano}-${String(mes).padStart(2, '0')}-01`,
        origem: 'manual', is_provisao: false, created_by: user?.id,
        conta_id: contaEmpresaId || null, conta_destino_id: contaSocio,
        natureza: 'societario',
      })
    }
    toast.success(`${tipo === 'dividendos' ? 'Distribuição' : 'Pró-labore'} de ${fmt(v)} registrado para ${socios.length} sócios`)
    setShowDist(false); setValor(''); setSaving(false)
  }

  async function aportar() {
    const v = Number(valor)
    if (!v || v <= 0 || !socioId) { toast.error('Preencha todos os campos'); return }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const hoje = new Date()
    const socio = socios.find(s => s.id === socioId)

    await supabase.from('movimentacoes_societarias').insert({
      socio_id: socioId, tipo: 'aporte_capital', valor_total: v,
      competencia_ano: hoje.getFullYear(), competencia_mes: hoje.getMonth() + 1,
      data_deliberacao: hoje.toISOString().slice(0, 10),
      capital_social_antes: capitalSocial, capital_social_depois: capitalSocial + v,
      participacao_pct: Number(socio?.participacao_pct || 50),
      status: 'pago', created_by: user?.id,
    })
    await supabase.from('empresa_config').update({ capital_social: capitalSocial + v }).neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('financeiro_lancamentos').insert({
      tipo: 'receita', nome: `Aporte de Capital — ${socio?.nome}`,
      categoria: 'Aporte de Capital', valor: v, status: 'pago',
      socio_id: socioId, data_competencia: hoje.toISOString().slice(0, 10),
      data_pagamento: hoje.toISOString().slice(0, 10),
      origem: 'manual', is_provisao: false, created_by: user?.id,
    })
    toast.success(`Aporte de ${fmt(v)} registrado. Capital social: ${fmt(capitalSocial + v)}`)
    setShowAporte(false); setValor(''); setSaving(false)
  }

  return (
    <>
      {/* Quadro societário */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {socios.map(s => (
          <div key={s.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="font-bold text-gray-900">{s.nome}</div>
            <div className="text-xs text-gray-400">{s.email || '—'} · CPF: {s.cpf || 'Não informado'}</div>
            <div className="mt-2 text-2xl font-bold text-brand font-display">{Number(s.participacao_pct).toFixed(0)}%</div>
            <div className="text-xs text-gray-400">Desde {s.data_entrada ? new Date(s.data_entrada + 'T12:00').toLocaleDateString('pt-BR') : '—'}</div>
          </div>
        ))}
      </div>

      {/* Resumo financeiro */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-[10px] font-bold text-gray-400 uppercase">Capital Social</div>
          <div className="text-xl font-bold text-gray-900">{fmt(capitalSocial)}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-[10px] font-bold text-gray-400 uppercase">Lucro Acumulado</div>
          <div className="text-xl font-bold text-green-700">{fmt(lucroDisp)}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-[10px] font-bold text-gray-400 uppercase">Já Distribuído</div>
          <div className="text-xl font-bold text-amber-700">{fmt(distribuido)}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-[10px] font-bold text-gray-400 uppercase">Disponível p/ Distribuição</div>
          <div className={`text-xl font-bold ${lucroDisp - distribuido >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(lucroDisp - distribuido)}</div>
        </div>
      </div>

      {/* Botões */}
      <div className="flex gap-3 mb-6">
        <button onClick={() => setShowAporte(true)} className="px-4 py-2 border border-brand text-brand rounded-lg text-sm font-medium hover:bg-brand/5">+ Aporte de Capital</button>
        <button onClick={() => setShowDist(true)} className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark">Distribuir Dividendos</button>
      </div>

      {/* Modal Distribuição */}
      {showDist && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
          <h3 className="text-sm font-bold text-brand mb-3">Distribuição de Lucros</h3>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Tipo</label>
              <select value={tipo} onChange={e => setTipo(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                <option value="dividendos">Dividendos</option>
                <option value="pro_labore">Pró-labore</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Valor Total</label>
              <input type="number" step="0.01" value={valor} onChange={e => setValor(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="0,00" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Conta Empresa (origem)</label>
              <select value={contaEmpresaId} onChange={e => setContaEmpresaId(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                <option value="">Selecionar...</option>
                {contasEmpresa.map((c: any) => <option key={c.id} value={c.id}>{c.banco ? `${c.banco} — ` : ''}{c.nome}</option>)}
              </select>
            </div>
          </div>
          {Number(valor) > 0 && (
            <div className="bg-gray-50 rounded-lg p-3 mb-3 text-xs">
              {socios.map(s => <div key={s.id} className="flex justify-between"><span>{s.nome} ({Number(s.participacao_pct).toFixed(0)}%)</span><span className="font-bold">{fmt(Number(valor) * Number(s.participacao_pct) / 100)}</span></div>)}
              {Number(valor) > lucroDisp && <div className="mt-2 text-red-600 font-semibold">⚠️ Valor excede o lucro disponível ({fmt(lucroDisp)})</div>}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => setShowDist(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm">Cancelar</button>
            <button onClick={distribuir} disabled={saving || !valor} className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium disabled:opacity-50">{saving ? 'Salvando...' : 'Confirmar'}</button>
          </div>
        </div>
      )}

      {/* Modal Aporte */}
      {showAporte && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
          <h3 className="text-sm font-bold text-brand mb-3">Aporte de Capital</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Sócio</label>
              <select value={socioId} onChange={e => setSocioId(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                <option value="">Selecionar...</option>
                {socios.map(s => <option key={s.id} value={s.id}>{s.nome} ({Number(s.participacao_pct).toFixed(0)}%)</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Valor do Aporte</label>
              <input type="number" step="0.01" value={valor} onChange={e => setValor(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
          </div>
          {Number(valor) > 0 && <div className="bg-green-50 rounded-lg p-2 mb-3 text-xs text-green-700">Capital social passará de {fmt(capitalSocial)} para {fmt(capitalSocial + Number(valor))}</div>}
          <div className="flex gap-2">
            <button onClick={() => setShowAporte(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm">Cancelar</button>
            <button onClick={aportar} disabled={saving || !valor || !socioId} className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium disabled:opacity-50">{saving ? 'Salvando...' : 'Confirmar'}</button>
          </div>
        </div>
      )}

      {/* Histórico */}
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Histórico de Movimentações</h3>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 border-b border-gray-100">
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Data</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Sócio</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tipo</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Valor</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
          </tr></thead>
          <tbody>
            {movimentacoes.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">Nenhuma movimentação registrada.</td></tr>
            ) : movimentacoes.map(m => (
              <tr key={m.id} className="border-b border-gray-50">
                <td className="px-4 py-2.5 text-xs text-gray-500">{new Date(m.created_at).toLocaleDateString('pt-BR')}</td>
                <td className="px-4 py-2.5">{m.socios?.nome || '—'}</td>
                <td className="px-4 py-2.5"><span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${m.tipo === 'aporte_capital' ? 'bg-green-100 text-green-700' : m.tipo === 'dividendos' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>{m.tipo === 'aporte_capital' ? 'Aporte' : m.tipo === 'dividendos' ? 'Dividendos' : 'Pró-labore'}</span></td>
                <td className="px-4 py-2.5 text-right font-semibold">{fmt(m.valor_total)}</td>
                <td className="px-4 py-2.5"><span className={`text-[10px] px-2 py-0.5 rounded-full ${m.status === 'pago' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{m.status === 'pago' ? 'Pago' : 'Pendente'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
