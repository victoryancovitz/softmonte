'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import EmptyState from '@/components/ui/EmptyState'
import { Wrench } from 'lucide-react'
import { fmt } from '@/lib/cores'

const CATEGORIAS = ['Ferramenta', 'Equipamento', 'Veículo', 'Mobiliário', 'TI', 'Outro']

interface CCOption {
  id: string
  codigo: string
  nome: string
}

interface Props {
  ativos: any[]
  obras: any[]
  funcionarios: any[]
  proximoPat: number
  centrosCusto?: CCOption[]
}

export default function PatrimonioClient({ ativos, obras, funcionarios, proximoPat, centrosCusto = [] }: Props) {
  const supabase = createClient()
  const toast = useToast()

  const [showCadastro, setShowCadastro] = useState(false)
  const [showDepreciacao, setShowDepreciacao] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filtroCc, setFiltroCc] = useState('')

  const padPat = (n: number) => `PAT-${String(n).padStart(5, '0')}`

  const [form, setForm] = useState({
    nome: '', categoria: '', numero_patrimonio: padPat(proximoPat),
    valor_aquisicao: '', data_aquisicao: '', vida_util_meses: '60',
    taxa_depreciacao_anual: '20', obra_id: '', funcionario_id: '',
    nota_fiscal: '', observacao: '',
  })

  const [mesRef, setMesRef] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  // Recalcular taxa ao mudar vida útil
  function handleVidaUtil(v: string) {
    const meses = Number(v) || 60
    const taxa = Math.round((12 / meses) * 100 * 100) / 100
    setForm(f => ({ ...f, vida_util_meses: v, taxa_depreciacao_anual: String(taxa) }))
  }

  // Stats
  const valorTotal = ativos.reduce((s: number, a: any) => s + Number(a.valor_aquisicao || 0), 0)
  const depAcum = ativos.reduce((s: number, a: any) => s + Number(a.depreciacao_acumulada || 0), 0)

  // Cadastro
  async function salvarAtivo() {
    if (!form.nome || !form.valor_aquisicao) { toast.error('Preencha nome e valor de aquisição'); return }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('ativos_fixos').insert({
      nome: form.nome,
      categoria: form.categoria || null,
      numero_patrimonio: form.numero_patrimonio || null,
      valor_aquisicao: Number(form.valor_aquisicao),
      data_aquisicao: form.data_aquisicao || null,
      vida_util_meses: Number(form.vida_util_meses) || 60,
      taxa_depreciacao_anual: Number(form.taxa_depreciacao_anual) || 20,
      obra_id: form.obra_id || null,
      funcionario_id: form.funcionario_id || null,
      nota_fiscal: form.nota_fiscal || null,
      observacao: form.observacao || null,
      status_ativo: 'ativo',
      depreciacao_acumulada: 0,
      created_by: user?.id,
    })
    setSaving(false)
    if (error) { toast.error('Erro ao cadastrar: ' + error.message); return }
    toast.success(`Ativo "${form.nome}" cadastrado com sucesso!`)
    setShowCadastro(false)
    setForm({
      nome: '', categoria: '', numero_patrimonio: padPat(proximoPat + 1),
      valor_aquisicao: '', data_aquisicao: '', vida_util_meses: '60',
      taxa_depreciacao_anual: '20', obra_id: '', funcionario_id: '',
      nota_fiscal: '', observacao: '',
    })
  }

  // Depreciação em lote
  const ativosAtivos = ativos.filter((a: any) => (a.status_ativo || 'ativo') === 'ativo')

  async function registrarDepreciacao() {
    if (ativosAtivos.length === 0) { toast.error('Nenhum ativo ativo para depreciar'); return }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    let totalDep = 0

    for (const a of ativosAtivos) {
      const mensal = (Number(a.valor_aquisicao) * Number(a.taxa_depreciacao_anual || 20) / 100) / 12
      const novaDepAcum = Number(a.depreciacao_acumulada || 0) + mensal
      totalDep += mensal

      await supabase.from('ativos_fixos').update({ depreciacao_acumulada: Math.round(novaDepAcum * 100) / 100 }).eq('id', a.id)

      await supabase.from('financeiro_lancamentos').insert({
        tipo: 'despesa',
        nome: `Depreciação — ${a.nome}`,
        categoria: 'Depreciação',
        valor: Math.round(mensal * 100) / 100,
        status: 'pago',
        data_competencia: `${mesRef}-01`,
        data_pagamento: new Date().toISOString().slice(0, 10),
        origem: 'manual',
        is_provisao: false,
        created_by: user?.id,
      })
    }

    setSaving(false)
    toast.success(`Depreciação registrada: ${fmt(totalDep)} em ${ativosAtivos.length} ativos.`)
    setShowDepreciacao(false)
  }

  return (
    <>
      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-[10px] font-bold text-gray-400 uppercase">Valor do Imobilizado</div>
          <div className="text-xl font-bold text-gray-900">{fmt(valorTotal)}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-[10px] font-bold text-gray-400 uppercase">Depreciação Acumulada</div>
          <div className="text-xl font-bold text-red-600">{fmt(depAcum)}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-[10px] font-bold text-gray-400 uppercase">Valor Líquido Contábil</div>
          <div className="text-xl font-bold text-brand">{fmt(valorTotal - depAcum)}</div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-2 mb-4">
        <button onClick={() => setShowDepreciacao(true)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">Depreciar Lote</button>
        <button onClick={() => setShowCadastro(true)} className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark">+ Cadastrar Ativo</button>
      </div>

      {/* Modal Cadastro */}
      {showCadastro && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
          <h3 className="text-sm font-bold text-brand mb-4">Cadastrar Ativo Patrimonial</h3>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Nome *</label>
              <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Ex: Betoneira 400L" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Categoria</label>
              <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                <option value="">Selecionar...</option>
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Nº Patrimônio</label>
              <input value={form.numero_patrimonio} onChange={e => setForm(f => ({ ...f, numero_patrimonio: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Valor Aquisição (R$) *</label>
              <input type="number" step="0.01" value={form.valor_aquisicao} onChange={e => setForm(f => ({ ...f, valor_aquisicao: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Data Aquisição</label>
              <input type="date" value={form.data_aquisicao} onChange={e => setForm(f => ({ ...f, data_aquisicao: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Vida Útil (meses)</label>
              <input type="number" value={form.vida_util_meses} onChange={e => handleVidaUtil(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Taxa Depr. Anual (%)</label>
              <input type="number" step="0.01" value={form.taxa_depreciacao_anual} onChange={e => setForm(f => ({ ...f, taxa_depreciacao_anual: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Obra</label>
              <select value={form.obra_id} onChange={e => setForm(f => ({ ...f, obra_id: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                <option value="">Nenhuma</option>
                {obras.map((o: any) => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Responsável</label>
              <select value={form.funcionario_id} onChange={e => setForm(f => ({ ...f, funcionario_id: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                <option value="">Nenhum</option>
                {funcionarios.map((f: any) => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Nota Fiscal</label>
              <input value={form.nota_fiscal} onChange={e => setForm(f => ({ ...f, nota_fiscal: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Observação</label>
              <textarea value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
          </div>
          {form.valor_aquisicao && (
            <div className="bg-blue-50 rounded-lg p-2 mb-3 text-xs text-blue-700">
              Depreciação mensal estimada: {fmt(Number(form.valor_aquisicao) * Number(form.taxa_depreciacao_anual || 20) / 100 / 12)}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => setShowCadastro(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm">Cancelar</button>
            <button onClick={salvarAtivo} disabled={saving} className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium disabled:opacity-50">{saving ? 'Salvando...' : 'Cadastrar Ativo'}</button>
          </div>
        </div>
      )}

      {/* Modal Depreciação em Lote */}
      {showDepreciacao && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
          <h3 className="text-sm font-bold text-brand mb-4">Depreciação em Lote</h3>
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Mês de Referência</label>
            <input type="month" value={mesRef} onChange={e => setMesRef(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
          {ativosAtivos.length === 0 ? (
            <p className="text-sm text-gray-500 mb-4">Nenhum ativo ativo para depreciar.</p>
          ) : (
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Ativo</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Valor Aquisição</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Taxa Anual</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Depr. Mensal</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Depr. Acum.</th>
                  </tr>
                </thead>
                <tbody>
                  {ativosAtivos.map((a: any) => {
                    const mensal = (Number(a.valor_aquisicao) * Number(a.taxa_depreciacao_anual || 20) / 100) / 12
                    return (
                      <tr key={a.id} className="border-b border-gray-50">
                        <td className="px-4 py-2 font-medium">{a.nome}</td>
                        <td className="px-4 py-2">{fmt(a.valor_aquisicao)}</td>
                        <td className="px-4 py-2 text-xs">{Number(a.taxa_depreciacao_anual || 20)}%</td>
                        <td className="px-4 py-2 text-red-600">{fmt(mensal)}</td>
                        <td className="px-4 py-2 text-gray-500">{fmt(a.depreciacao_acumulada)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div className="bg-red-50 rounded-lg p-2 mt-3 text-xs text-red-700 font-semibold">
                Total a depreciar: {fmt(ativosAtivos.reduce((s: number, a: any) => s + (Number(a.valor_aquisicao) * Number(a.taxa_depreciacao_anual || 20) / 100) / 12, 0))}
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => setShowDepreciacao(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm">Cancelar</button>
            <button onClick={registrarDepreciacao} disabled={saving || ativosAtivos.length === 0} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">{saving ? 'Processando...' : 'Registrar Depreciação'}</button>
          </div>
        </div>
      )}

      {/* Filtro por CC */}
      {centrosCusto.length > 0 && (
        <div className="mb-4">
          <select
            value={filtroCc}
            onChange={e => setFiltroCc(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand"
          >
            <option value="">Todos os centros de custo</option>
            {centrosCusto.map(c => (
              <option key={c.id} value={c.id}>{c.codigo} — {c.nome}</option>
            ))}
          </select>
        </div>
      )}

      {/* Tabela de Ativos */}
      {ativos.length === 0 ? (
        <EmptyState titulo="Nenhum ativo cadastrado" descricao="Cadastre ferramentas, equipamentos e bens patrimoniais." icone={<Wrench className="w-10 h-10" />} />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 border-b border-gray-100">
              {['TAG', 'Nome', 'Categoria', 'Localização (CC)', 'Valor Aquisição', 'Depr. Acum.', 'Valor Líquido', 'Status', 'Responsável'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {(filtroCc ? ativos.filter((a: any) => a.centro_custo_id === filtroCc) : ativos).map((a: any) => (
                <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{a.numero_patrimonio || '—'}</td>
                  <td className="px-4 py-3 font-medium">{a.nome}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{a.categoria || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {a.centros_custo ? (
                      <>
                        <span className="text-xs font-mono text-gray-400 mr-1">{a.centros_custo.codigo}</span>
                        {a.centros_custo.nome}
                      </>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{fmt(a.valor_aquisicao)}</td>
                  <td className="px-4 py-3 text-red-600">{fmt(a.depreciacao_acumulada)}</td>
                  <td className="px-4 py-3 font-semibold">{fmt(Number(a.valor_aquisicao) - Number(a.depreciacao_acumulada || 0))}</td>
                  <td className="px-4 py-3"><span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${(a.status_ativo || 'ativo') === 'ativo' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{a.status_ativo || 'ativo'}</span></td>
                  <td className="px-4 py-3 text-xs text-gray-500">{a.funcionarios?.nome || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
