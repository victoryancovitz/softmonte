'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import BackButton from '@/components/BackButton'
import { useToast } from '@/components/Toast'
import { Calculator, Save } from 'lucide-react'

const MOTIVOS = [
  { v: 'acordo_coletivo', l: 'Acordo coletivo' },
  { v: 'dissidio', l: 'Dissídio' },
  { v: 'merito', l: 'Mérito' },
  { v: 'promocao', l: 'Promoção' },
  { v: 'correcao', l: 'Correção' },
  { v: 'piso', l: 'Ajuste ao piso' },
  { v: 'outro', l: 'Outro' },
]

export default function NovaCorrecaoPage() {
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()
  const [funcoes, setFuncoes] = useState<any[]>([])
  const [obras, setObras] = useState<any[]>([])
  const [form, setForm] = useState<any>({
    titulo: '',
    motivo: 'acordo_coletivo',
    data_efetivo: new Date().toISOString().slice(0, 10),
    funcao_id: '',
    obra_id: '',
    tipo_reajuste: 'percentual',
    percentual: '',
    valor_fixo: '',
    observacao: '',
  })
  const [preview, setPreview] = useState<any[] | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('funcoes').select('id,nome').eq('ativo', true).order('nome'),
      supabase.from('obras').select('id,nome').eq('status', 'ativo').is('deleted_at', null).order('nome'),
    ]).then(([f, o]) => {
      setFuncoes(f.data || [])
      setObras(o.data || [])
    })
  }, [])

  function set(field: string, value: any) { setForm((f: any) => ({ ...f, [field]: value })) }

  async function gerarPreview() {
    if (!form.titulo) { toast.error('Digite um título'); return }
    if (form.tipo_reajuste === 'percentual' && !form.percentual) { toast.error('Digite o percentual'); return }
    if ((form.tipo_reajuste === 'valor_fixo' || form.tipo_reajuste === 'novo_salario') && !form.valor_fixo) {
      toast.error('Digite o valor'); return
    }

    // Cria correção em rascunho pra usar a função
    const { data: { user } } = await supabase.auth.getUser()
    const { data: corr, error } = await supabase.from('correcoes_salariais').insert({
      titulo: form.titulo,
      motivo: form.motivo,
      data_efetivo: form.data_efetivo,
      funcao_id: form.funcao_id || null,
      obra_id: form.obra_id || null,
      tipo_reajuste: form.tipo_reajuste,
      percentual: form.percentual ? parseFloat(form.percentual) : null,
      valor_fixo: form.valor_fixo ? parseFloat(form.valor_fixo) : null,
      observacao: form.observacao || null,
      status: 'rascunho',
      created_by: user?.id ?? null,
    }).select().single()
    if (error) { toast.error('Erro: ' + error.message); return }

    // Dry-run
    const { data: prev, error: pErr } = await supabase.rpc('aplicar_correcao_salarial', { p_correcao_id: corr.id, p_dry_run: true })
    if (pErr) { toast.error('Erro preview: ' + pErr.message); return }
    setPreview(prev || [])
    setForm((f: any) => ({ ...f, _corrId: corr.id }))
  }

  async function aplicar() {
    if (!form._corrId || !preview) return
    if (!confirm(`Aplicar reajuste em ${preview.length} funcionário(s)? Isso atualiza salários e registra histórico.`)) return
    setSaving(true)
    const { error } = await supabase.rpc('aplicar_correcao_salarial', { p_correcao_id: form._corrId, p_dry_run: false })
    if (error) { toast.error('Erro: ' + error.message); setSaving(false); return }
    toast.success(`Correção aplicada em ${preview.length} funcionários`)
    router.push(`/rh/correcoes/${form._corrId}`)
  }

  const fmt = (v: any) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const totalReajuste = preview?.reduce((s: number, p: any) => s + Number(p.diferenca || 0), 0) ?? 0

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/rh/correcoes" />
        <Link href="/rh/correcoes" className="text-gray-400 hover:text-gray-600">Correções</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700">Nova</span>
      </div>

      <h1 className="text-xl font-bold font-display text-brand mb-1">Nova correção salarial</h1>
      <p className="text-sm text-gray-500 mb-6">Aplica reajuste em massa com histórico e possibilidade de reverter.</p>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-5">
        <h2 className="text-sm font-bold text-brand mb-3">1. Identificação</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Título *</label>
            <input type="text" value={form.titulo} onChange={e => set('titulo', e.target.value)}
              placeholder="Ex: Dissídio 2026 - Sindicato Metalúrgicos SP"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"/>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Motivo</label>
            <select value={form.motivo} onChange={e => set('motivo', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
              {MOTIVOS.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Data de efetivação</label>
            <input type="date" value={form.data_efetivo} onChange={e => set('data_efetivo', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"/>
          </div>
        </div>

        <h2 className="text-sm font-bold text-brand mt-5 mb-3">2. Escopo (deixe em branco para todos)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Apenas função</label>
            <select value={form.funcao_id} onChange={e => set('funcao_id', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
              <option value="">Todas as funções</option>
              {funcoes.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Apenas obra</label>
            <select value={form.obra_id} onChange={e => set('obra_id', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
              <option value="">Todas as obras</option>
              {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
          </div>
        </div>

        <h2 className="text-sm font-bold text-brand mt-5 mb-3">3. Reajuste</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo</label>
            <select value={form.tipo_reajuste} onChange={e => set('tipo_reajuste', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
              <option value="percentual">Percentual (%)</option>
              <option value="valor_fixo">Valor fixo (R$ a somar)</option>
              <option value="novo_salario">Novo salário (R$ absoluto)</option>
            </select>
          </div>
          {form.tipo_reajuste === 'percentual' ? (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Percentual (%)</label>
              <input type="number" step="0.01" value={form.percentual} onChange={e => set('percentual', e.target.value)}
                placeholder="5.50" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"/>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                {form.tipo_reajuste === 'valor_fixo' ? 'Valor a somar (R$)' : 'Novo salário (R$)'}
              </label>
              <input type="number" step="0.01" value={form.valor_fixo} onChange={e => set('valor_fixo', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"/>
            </div>
          )}
          <div className="flex items-end">
            <button onClick={gerarPreview}
              className="w-full px-4 py-2 bg-brand text-white rounded-lg text-sm font-semibold hover:bg-brand-dark flex items-center justify-center gap-2">
              <Calculator className="w-4 h-4" /> Gerar preview
            </button>
          </div>
        </div>

        <div className="mt-3">
          <label className="block text-xs font-semibold text-gray-600 mb-1">Observação</label>
          <textarea value={form.observacao} onChange={e => set('observacao', e.target.value)} rows={2}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"/>
        </div>
      </div>

      {preview && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-sm font-bold text-brand mb-3">Preview — {preview.length} funcionário(s) afetado(s)</h2>
          {preview.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum funcionário bate com os critérios de escopo.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Funcionário</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Anterior</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Novo</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Diferença</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((p: any) => (
                      <tr key={p.funcionario_id} className="border-b border-gray-50">
                        <td className="px-3 py-2 font-medium">{p.nome}</td>
                        <td className="px-3 py-2 text-right text-gray-500">{fmt(p.salario_anterior)}</td>
                        <td className="px-3 py-2 text-right font-bold text-green-700">{fmt(p.salario_novo)}</td>
                        <td className="px-3 py-2 text-right font-bold text-green-600">+{fmt(p.diferenca)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-green-50 border-t-2 border-green-200 font-bold">
                      <td className="px-3 py-2 text-green-800" colSpan={3}>Total de reajuste mensal</td>
                      <td className="px-3 py-2 text-right text-green-800">+{fmt(totalReajuste)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="flex gap-3 justify-end mt-5">
                <Link href="/rh/correcoes" className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-semibold hover:bg-gray-50">Cancelar</Link>
                <button onClick={aplicar} disabled={saving}
                  className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-bold hover:bg-brand-dark disabled:opacity-50 flex items-center gap-2">
                  <Save className="w-4 h-4" /> Aplicar correção
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
