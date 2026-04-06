'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import BackButton from '@/components/BackButton'
import { useToast } from '@/components/Toast'

interface PreviewRow {
  funcionario_id: string
  funcionario_nome: string
  funcao_nome: string
  tipo_hora: 'normal' | 'he70' | 'he100'
  tipo_hora_label: string
  dias: number
  carga_horaria_dia: number
  hh_total: number
  valor_hh: number
  valor_total: number
  sem_contrato: boolean
}

const TIPO_DIA_TO_HORA: Record<string, { tipo: 'normal' | 'he70' | 'he100'; label: string }> = {
  util: { tipo: 'normal', label: 'Hora Normal' },
  sabado: { tipo: 'he70', label: 'HE 70%' },
  domingo_feriado: { tipo: 'he100', label: 'HE 100%' },
}

export default function NovoBMPage() {
  const [obras, setObras] = useState<any[]>([])
  const [form, setForm] = useState({ obra_id: '', data_inicio: '', data_fim: '', observacao: '' })
  const [proximoBM, setProximoBM] = useState(1)
  const [loading, setLoading] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<PreviewRow[] | null>(null)
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()

  useEffect(() => {
    supabase.from('obras').select('id,nome,cliente').eq('status','ativo').order('nome')
      .then(({ data }) => setObras(data ?? []))
  }, [])

  async function onObraChange(obraId: string) {
    set('obra_id', obraId)
    setPreview(null)
    if (!obraId) return
    const { data } = await supabase.from('boletins_medicao')
      .select('numero').eq('obra_id', obraId).order('numero', { ascending: false }).limit(1)
    setProximoBM(data?.[0] ? Number(data[0].numero) + 1 : 1)
  }

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
    if (field !== 'observacao') setPreview(null)
  }

  async function handlePreview() {
    if (!form.obra_id || !form.data_inicio || !form.data_fim) return
    setPreviewing(true)
    setError('')

    // Fetch efetivo_diario for the obra + period
    const { data: efetivo, error: efErr } = await supabase
      .from('efetivo_diario')
      .select('funcionario_id, data, tipo_dia, funcionarios(id, nome, cargo)')
      .eq('obra_id', form.obra_id)
      .gte('data', form.data_inicio)
      .lte('data', form.data_fim)

    if (efErr) { setError(efErr.message); setPreviewing(false); return }
    if (!efetivo || efetivo.length === 0) { setPreview([]); setPreviewing(false); return }

    // Fetch contrato_composicao for this obra
    const { data: composicao } = await supabase
      .from('contrato_composicao')
      .select('funcao_nome, custo_hora_contratado, custo_hora_extra_70, custo_hora_extra_100, carga_horaria_dia')
      .eq('obra_id', form.obra_id)
      .eq('ativo', true)

    const compMap: Record<string, any> = {}
    ;(composicao ?? []).forEach((c: any) => {
      compMap[c.funcao_nome?.toUpperCase()] = c
    })

    // Group by funcionario + tipo_dia
    const groups: Record<string, { func: any; tipo_dia: string; dias: Set<string> }> = {}
    efetivo.forEach((e: any) => {
      const f = e.funcionarios
      if (!f) return
      const key = `${f.id}_${e.tipo_dia}`
      if (!groups[key]) groups[key] = { func: f, tipo_dia: e.tipo_dia, dias: new Set() }
      groups[key].dias.add(e.data)
    })

    // Build preview rows
    const rows: PreviewRow[] = Object.values(groups).map(g => {
      const { tipo, label } = TIPO_DIA_TO_HORA[g.tipo_dia] || TIPO_DIA_TO_HORA.util
      const cargo = g.func.cargo?.toUpperCase() ?? ''
      const comp = compMap[cargo]
      const cargaHoraDia = Number(comp?.carga_horaria_dia ?? 8)
      const dias = g.dias.size
      const hh = dias * cargaHoraDia

      let valorHH = 0
      if (comp) {
        if (tipo === 'normal') valorHH = Number(comp.custo_hora_contratado ?? 0)
        else if (tipo === 'he70') valorHH = Number(comp.custo_hora_extra_70 ?? 0)
        else valorHH = Number(comp.custo_hora_extra_100 ?? 0)
      }

      return {
        funcionario_id: g.func.id,
        funcionario_nome: g.func.nome,
        funcao_nome: g.func.cargo ?? 'OUTROS',
        tipo_hora: tipo,
        tipo_hora_label: label,
        dias,
        carga_horaria_dia: cargaHoraDia,
        hh_total: hh,
        valor_hh: valorHH,
        valor_total: hh * valorHH,
        sem_contrato: !comp,
      }
    }).sort((a, b) => a.funcionario_nome.localeCompare(b.funcionario_nome) || a.tipo_hora.localeCompare(b.tipo_hora))

    setPreview(rows)
    setPreviewing(false)
  }

  function updateRow(index: number, field: 'valor_hh', value: number) {
    setPreview(prev => {
      if (!prev) return prev
      const next = [...prev]
      next[index] = { ...next[index], [field]: value, valor_total: next[index].hh_total * value }
      return next
    })
  }

  const totalGeral = preview?.reduce((s, r) => s + r.valor_total, 0) ?? 0
  const totalHH = preview?.reduce((s, r) => s + r.hh_total, 0) ?? 0

  async function handleSave() {
    if (!preview || preview.length === 0) return
    setSaving(true)
    setError('')

    // 1. Create the BM
    const { data: bmData, error: bmErr } = await supabase.from('boletins_medicao').insert({
      obra_id: form.obra_id,
      numero: String(proximoBM),
      data_inicio: form.data_inicio,
      data_fim: form.data_fim,
      status: 'aberto',
      observacao: form.observacao || null,
    }).select().single()

    if (bmErr || !bmData) { setError(bmErr?.message ?? 'Erro ao criar BM'); setSaving(false); return }

    // 2. Insert bm_itens
    const itens = preview.map((r, i) => ({
      boletim_id: bmData.id,
      funcionario_id: r.funcionario_id,
      funcionario_nome: r.funcionario_nome,
      funcao_nome: r.funcao_nome,
      tipo_hora: r.tipo_hora,
      efetivo: 1,
      dias: r.dias,
      carga_horaria_dia: r.carga_horaria_dia,
      hh_total: r.hh_total,
      valor_hh: r.valor_hh,
      valor_total: r.valor_total,
      ordem: i,
    }))

    const { error: itErr } = await supabase.from('bm_itens').insert(itens)
    if (itErr) { setError(itErr.message); setSaving(false); return }

    // 3. Update valor no BM
    await supabase.from('boletins_medicao').update({ valor_aprovado: null }).eq('id', bmData.id)

    toast.success(
      `BM criado com sucesso com ${new Set(preview.map(r => r.funcionario_id)).size} funcionários e ${totalHH}h registradas`
    )
    router.push(`/boletins/${bmData.id}`)
  }

  const dias = form.data_inicio && form.data_fim
    ? Math.ceil((new Date(form.data_fim).getTime() - new Date(form.data_inicio).getTime()) / 86400000) + 1
    : null

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <BackButton fallback="/boletins" />
        <Link href="/boletins" className="text-gray-400 hover:text-gray-600 text-sm">Boletins</Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-medium">Novo BM</span>
      </div>

      {/* Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-5">
        <h1 className="text-lg font-semibold font-display mb-6">Novo Boletim de Medição</h1>
        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Obra *</label>
            <select required value={form.obra_id} onChange={e => onObraChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
              <option value="">Selecione a obra...</option>
              {obras.map(o => <option key={o.id} value={o.id}>{o.nome} — {o.cliente}</option>)}
            </select>
          </div>

          {form.obra_id && (
            <div className="flex items-center gap-2 p-3 bg-brand/5 rounded-lg border border-brand/20">
              <span className="text-brand font-bold text-sm">BM {String(proximoBM).padStart(2,'0')}</span>
              <span className="text-gray-500 text-sm">— Este será o próximo boletim desta obra</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Período de *</label>
              <input type="date" required value={form.data_inicio} onChange={e => set('data_inicio', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Período até *</label>
              <input type="date" required value={form.data_fim} onChange={e => set('data_fim', e.target.value)}
                min={form.data_inicio}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observação (opcional)</label>
            <textarea value={form.observacao} onChange={e => set('observacao', e.target.value)}
              rows={2} placeholder="Observações sobre este boletim..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none" />
          </div>

          {dias && (
            <div className="text-sm text-gray-600 p-3 bg-gray-50 rounded-lg">
              Período de <strong>{dias} dias</strong>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handlePreview}
              disabled={!form.obra_id || !form.data_inicio || !form.data_fim || previewing}
              className="px-6 py-2.5 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark disabled:opacity-50"
            >
              {previewing ? 'Carregando...' : 'Pré-visualizar horas do ponto'}
            </button>
            <Link href="/boletins" className="px-6 py-2.5 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">
              Cancelar
            </Link>
          </div>
        </div>
      </div>

      {/* Preview */}
      {preview !== null && (
        preview.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-dashed border-gray-300 p-10 text-center">
            <div className="text-gray-400 text-3xl mb-3">📋</div>
            <p className="text-gray-600 font-medium text-sm mb-1">Nenhum registro de ponto encontrado para esta obra no período selecionado.</p>
            <p className="text-gray-400 text-xs mb-4">Verifique se o efetivo diário foi registrado para o período informado.</p>
            <Link href="/ponto" className="text-brand text-sm font-medium hover:underline">
              Ir para Ponto para registrar →
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold">Pré-visualização — Horas do Ponto</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Set(preview.map(r => r.funcionario_id)).size} funcionários · {totalHH}h totais
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">
                  Total: <span className="font-bold text-brand text-sm">R$ {totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </span>
                <button onClick={handleSave} disabled={saving}
                  className="px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                  {saving ? 'Salvando...' : 'Confirmar e Criar BM'}
                </button>
              </div>
            </div>

            {preview.some(r => r.sem_contrato) && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                ⚠ Algumas funções não possuem composição no contrato. O valor R$/HH está zerado — preencha manualmente antes de salvar.
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Funcionário</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Função</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Tipo</th>
                    <th className="text-center px-3 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide w-20">Dias</th>
                    <th className="text-center px-3 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide w-24">HH Total</th>
                    <th className="text-center px-3 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide w-32">R$/HH</th>
                    <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide w-36">Total R$</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => {
                    const typeColor = row.tipo_hora === 'normal' ? 'text-blue-700 bg-blue-50' : row.tipo_hora === 'he70' ? 'text-amber-700 bg-amber-50' : 'text-red-700 bg-red-50'
                    return (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-3 py-2.5 font-medium text-gray-800">{row.funcionario_nome}</td>
                        <td className="px-3 py-2.5 text-gray-600">{row.funcao_nome}</td>
                        <td className="px-3 py-2.5">
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${typeColor}`}>{row.tipo_hora_label}</span>
                        </td>
                        <td className="px-3 py-2.5 text-center">{row.dias}</td>
                        <td className="px-3 py-2.5 text-center">{row.hh_total}h</td>
                        <td className="px-3 py-2.5 text-center">
                          <input
                            type="number" min="0" step="0.01"
                            value={row.valor_hh}
                            onChange={e => updateRow(i, 'valor_hh', Number(e.target.value))}
                            className={`w-28 px-2 py-1 border rounded text-center text-sm focus:outline-none focus:ring-2 focus:ring-brand ${
                              row.sem_contrato && row.valor_hh === 0 ? 'border-red-300 bg-red-50' : 'border-gray-200'
                            }`}
                          />
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold text-gray-700">
                          {row.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    )
                  })}
                  <tr className="border-t-2 border-gray-200 bg-gray-50">
                    <td colSpan={4} className="px-3 py-3 font-bold text-xs uppercase tracking-wide text-gray-600">Total Geral</td>
                    <td className="px-3 py-3 text-center font-bold">{totalHH}h</td>
                    <td className="px-3 py-3" />
                    <td className="px-3 py-3 text-right font-bold text-brand">
                      R$ {totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  )
}
