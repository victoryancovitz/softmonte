'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import BackButton from '@/components/BackButton'

const CATEGORIAS = ['Montagem','Elétrica','Tubulação','Mecânica','Pintura','Qualidade','Gestão','Suporte','Equipamentos','Operacional']

export default function EditarFuncaoPage({ params }: { params: { id: string } }) {
  const [form, setForm] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.from('funcoes').select('*').eq('id', params.id).single()
      .then(({ data }) => { setForm(data); setLoading(false) })
  }, [params.id])

  function set(field: string, value: any) { setForm((f: any) => ({ ...f, [field]: value })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const sb = parseFloat(form.salario_base) || 0
    const jm = parseInt(form.jornada_horas_mes) || 220
    const pPct = parseFloat(form.periculosidade_pct_padrao) || 0
    const iPct = parseFloat(form.insalubridade_pct_padrao) || 0
    const salTotal = sb * (1 + pPct/100 + iPct/100)
    const custoHora = jm > 0 ? salTotal / jm : 0

    const { error } = await supabase.from('funcoes').update({
      nome: form.nome?.toUpperCase().trim(),
      categoria: form.categoria,
      salario_base: sb || null,
      piso_clt: parseFloat(form.piso_clt) || null,
      cbo: form.cbo || null,
      jornada_horas_mes: jm,
      periculosidade_pct_padrao: pPct,
      insalubridade_pct_padrao: iPct,
      vt_mensal_padrao: parseFloat(form.vt_mensal_padrao) || 0,
      vr_diario_padrao: parseFloat(form.vr_diario_padrao) || 0,
      va_mensal_padrao: parseFloat(form.va_mensal_padrao) || 0,
      plano_saude_padrao: parseFloat(form.plano_saude_padrao) || 0,
      descricao: form.descricao || null,
      custo_hora: custoHora || null,
      multiplicador_extra: parseFloat(form.multiplicador_extra) || 1.70,
      multiplicador_noturno: parseFloat(form.multiplicador_noturno) || 1.40,
      ativo: form.ativo,
      updated_at: new Date().toISOString(),
    }).eq('id', params.id)
    if (error) { setError(error.message); setSaving(false); return }
    setSuccess(true)
    setTimeout(() => router.push('/cadastros/funcoes'), 800)
  }

  if (loading || !form) return <div className="p-6 text-sm text-gray-400">Carregando...</div>

  const sb = parseFloat(form.salario_base) || 0
  const piso = parseFloat(form.piso_clt) || 0
  const jm = parseInt(form.jornada_horas_mes) || 220
  const pPct = parseFloat(form.periculosidade_pct_padrao) || 0
  const iPct = parseFloat(form.insalubridade_pct_padrao) || 0
  const salTotal = sb * (1 + pPct/100 + iPct/100)
  const custoHora = jm > 0 ? salTotal / jm : 0
  const abaixoPiso = sb > 0 && piso > 0 && sb < piso
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/cadastros/funcoes" />
        <Link href="/cadastros/funcoes" className="text-gray-400 hover:text-gray-600">Funções</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium">Editar {form.nome}</span>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h1 className="text-lg font-bold font-display text-brand mb-1">Editar função</h1>
        <p className="text-sm text-gray-500 mb-6">Alterações aqui afetam apenas novos funcionários cadastrados a partir de agora. Para reajustar salários existentes, use <Link href="/rh/correcoes" className="text-brand underline">Correções salariais</Link>.</p>

        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200">{error}</div>}
        {success && <div className="mb-4 p-3 bg-green-50 text-green-700 text-sm rounded-xl border border-green-200">Salvo com sucesso.</div>}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Nome</label>
              <input type="text" value={form.nome || ''} onChange={e => set('nome', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm uppercase"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Categoria</label>
              <select value={form.categoria} onChange={e => set('categoria', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">CBO</label>
            <input type="text" value={form.cbo || ''} onChange={e => set('cbo', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"/>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <h2 className="text-xs font-bold text-brand uppercase tracking-wide mb-3">Dados salariais</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Salário base</label>
                <input type="number" step="0.01" value={form.salario_base || ''} onChange={e => set('salario_base', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"/>
                {abaixoPiso && <p className="text-[10px] text-red-600 mt-1">⚠ Abaixo do piso CLT</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Piso CLT</label>
                <input type="number" step="0.01" value={form.piso_clt || ''} onChange={e => set('piso_clt', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Jornada (h/mês)</label>
                <input type="number" value={form.jornada_horas_mes || 220} onChange={e => set('jornada_horas_mes', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"/>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div>
                <label className="block text-xs font-semibold text-red-600 mb-1">Periculosidade (%)</label>
                <input type="number" step="0.01" value={form.periculosidade_pct_padrao || 0} onChange={e => set('periculosidade_pct_padrao', e.target.value)}
                  className="w-full px-3 py-2 border border-red-200 rounded-lg text-sm"/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-amber-600 mb-1">Insalubridade (%)</label>
                <input type="number" step="0.01" value={form.insalubridade_pct_padrao || 0} onChange={e => set('insalubridade_pct_padrao', e.target.value)}
                  className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm"/>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <h2 className="text-xs font-bold text-brand uppercase tracking-wide mb-3">Benefícios padrão</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">VT mensal</label>
                <input type="number" step="0.01" value={form.vt_mensal_padrao || 0} onChange={e => set('vt_mensal_padrao', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">VR diário</label>
                <input type="number" step="0.01" value={form.vr_diario_padrao || 0} onChange={e => set('vr_diario_padrao', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">VA mensal</label>
                <input type="number" step="0.01" value={form.va_mensal_padrao || 0} onChange={e => set('va_mensal_padrao', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Plano saúde</label>
                <input type="number" step="0.01" value={form.plano_saude_padrao || 0} onChange={e => set('plano_saude_padrao', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"/>
              </div>
            </div>
          </div>

          {sb > 0 && (
            <div className="p-4 bg-brand/5 rounded-xl border border-brand/10">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Preview</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div><div className="text-gray-400">Base</div><div className="font-bold">{fmt(sb)}</div></div>
                <div><div className="text-gray-400">+ Adicionais</div><div className="font-bold text-brand">{fmt(salTotal)}</div></div>
                <div><div className="text-gray-400">Custo/h</div><div className="font-bold text-blue-700">{fmt(custoHora)}/h</div></div>
                <div><div className="text-gray-400">Jornada</div><div className="font-bold">{jm}h</div></div>
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={form.ativo} onChange={e => set('ativo', e.target.checked)} className="rounded border-gray-300 text-brand w-4 h-4"/>
            <span className="text-sm text-gray-700">Função ativa</span>
          </label>

          <div className="flex gap-3 pt-3 border-t border-gray-100">
            <button type="submit" disabled={saving}
              className="px-6 py-2.5 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
            <Link href="/cadastros/funcoes" className="px-6 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</Link>
          </div>
        </form>
      </div>
    </div>
  )
}
