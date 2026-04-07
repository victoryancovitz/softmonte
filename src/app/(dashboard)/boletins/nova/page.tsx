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
  carga_horaria_dia: number
  // Dias por tipo de hora
  dias_normais: number
  dias_he70: number
  dias_he100: number
  // Datas presentes (para o calendário)
  datas_presentes: string[]
  // Valores R$/HH (editáveis)
  valor_hh_normal: number
  valor_hh_he70: number
  valor_hh_he100: number
  sem_contrato: boolean
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
    supabase.from('obras').select('id,nome,cliente,data_inicio,data_prev_fim,status,bm_dia_unico').is('deleted_at', null).neq('status','cancelado').order('nome')
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

  async function validateDates(): Promise<string | null> {
    if (!form.obra_id) return 'Selecione uma obra.'
    if (!form.data_inicio) return 'Informe a data inicial do período.'
    if (!form.data_fim) return 'Informe a data final do período.'
    if (form.data_inicio > form.data_fim) {
      return 'A data inicial deve ser anterior ou igual à data final.'
    }
    const hojeStr = new Date().toISOString().split('T')[0]
    if (form.data_inicio > hojeStr) {
      return 'A data inicial não pode ser no futuro.'
    }

    // Validate against obra dates
    const obra = obras.find(o => o.id === form.obra_id)
    if (obra) {
      if (obra.data_inicio && form.data_inicio < obra.data_inicio) {
        return `A data inicial (${new Date(form.data_inicio + 'T12:00').toLocaleDateString('pt-BR')}) é anterior ao início da obra (${new Date(obra.data_inicio + 'T12:00').toLocaleDateString('pt-BR')}).`
      }
      if (obra.data_prev_fim && form.data_fim > obra.data_prev_fim) {
        return `A data final (${new Date(form.data_fim + 'T12:00').toLocaleDateString('pt-BR')}) é posterior à previsão de término da obra (${new Date(obra.data_prev_fim + 'T12:00').toLocaleDateString('pt-BR')}).`
      }
      if (obra.status === 'cancelado') {
        return 'Não é possível criar BM para uma obra cancelada.'
      }
    }

    // Validate that period doesn't overlap with existing BMs
    const { data: existing } = await supabase
      .from('boletins_medicao')
      .select('numero, data_inicio, data_fim')
      .eq('obra_id', form.obra_id)
      .is('deleted_at', null)

    for (const bm of existing ?? []) {
      // overlap if periods intersect
      if (!(form.data_fim < bm.data_inicio || form.data_inicio > bm.data_fim)) {
        return `O período sobrepõe o BM ${String(bm.numero).padStart(2,'0')} (${new Date(bm.data_inicio + 'T12:00').toLocaleDateString('pt-BR')} a ${new Date(bm.data_fim + 'T12:00').toLocaleDateString('pt-BR')}).`
      }
    }

    return null
  }

  async function handlePreview() {
    setError('')
    const validationError = await validateDates()
    if (validationError) { setError(validationError); return }

    setPreviewing(true)

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

    const obra = obras.find(o => o.id === form.obra_id)
    const diaUnico = obra?.bm_dia_unico === true

    // Group by funcionario only - consolidate all tipo_dia into a single row
    const groups: Record<string, { func: any; datas: Set<string>; tipos: Record<string, Set<string>> }> = {}
    efetivo.forEach((e: any) => {
      const f = e.funcionarios
      if (!f) return
      if (!groups[f.id]) {
        groups[f.id] = { func: f, datas: new Set(), tipos: { util: new Set(), sabado: new Set(), domingo_feriado: new Set() } }
      }
      groups[f.id].datas.add(e.data)
      ;(groups[f.id].tipos[e.tipo_dia] ?? groups[f.id].tipos.util).add(e.data)
    })

    const rows: PreviewRow[] = Object.values(groups).map(g => {
      const cargo = g.func.cargo?.toUpperCase() ?? ''
      const comp = compMap[cargo]
      const cargaHoraDia = Number(comp?.carga_horaria_dia ?? 8)

      let dias_normais: number, dias_he70: number, dias_he100: number
      if (diaUnico) {
        dias_normais = g.datas.size
        dias_he70 = 0
        dias_he100 = 0
      } else {
        dias_normais = g.tipos.util.size
        dias_he70 = g.tipos.sabado.size
        dias_he100 = g.tipos.domingo_feriado.size
      }

      return {
        funcionario_id: g.func.id,
        funcionario_nome: g.func.nome_guerra ?? g.func.nome,
        funcao_nome: g.func.cargo ?? 'OUTROS',
        carga_horaria_dia: cargaHoraDia,
        dias_normais,
        dias_he70,
        dias_he100,
        datas_presentes: Array.from(g.datas).sort(),
        valor_hh_normal: Number(comp?.custo_hora_contratado ?? 0),
        valor_hh_he70: Number(comp?.custo_hora_extra_70 ?? 0),
        valor_hh_he100: Number(comp?.custo_hora_extra_100 ?? 0),
        sem_contrato: !comp,
      }
    }).sort((a, b) => a.funcao_nome.localeCompare(b.funcao_nome) || a.funcionario_nome.localeCompare(b.funcionario_nome))

    setPreview(rows)
    setPreviewing(false)
  }

  function updateRow(index: number, field: 'valor_hh_normal' | 'valor_hh_he70' | 'valor_hh_he100', value: number) {
    setPreview(prev => {
      if (!prev) return prev
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  function rowHHNormal(r: PreviewRow) { return r.dias_normais * r.carga_horaria_dia }
  function rowHHHe70(r: PreviewRow) { return r.dias_he70 * r.carga_horaria_dia }
  function rowHHHe100(r: PreviewRow) { return r.dias_he100 * r.carga_horaria_dia }
  function rowTotal(r: PreviewRow) {
    return rowHHNormal(r) * r.valor_hh_normal
         + rowHHHe70(r)   * r.valor_hh_he70
         + rowHHHe100(r)  * r.valor_hh_he100
  }
  function rowDias(r: PreviewRow) { return r.dias_normais + r.dias_he70 + r.dias_he100 }

  const totalGeral = preview?.reduce((s, r) => s + rowTotal(r), 0) ?? 0
  const totalHH = preview?.reduce((s, r) => s + rowHHNormal(r) + rowHHHe70(r) + rowHHHe100(r), 0) ?? 0
  const totalDiasNormais = preview?.reduce((s, r) => s + r.dias_normais, 0) ?? 0
  const totalDiasHe70 = preview?.reduce((s, r) => s + r.dias_he70, 0) ?? 0
  const totalDiasHe100 = preview?.reduce((s, r) => s + r.dias_he100, 0) ?? 0

  async function handleSave() {
    if (!preview || preview.length === 0) return
    setError('')
    const validationError = await validateDates()
    if (validationError) { setError(validationError); return }
    setSaving(true)

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

    // 2. Insert bm_itens — one row per (funcionario × tipo_hora) where dias > 0
    const itens: any[] = []
    let ordem = 0
    preview.forEach(r => {
      const tipos: Array<{ tipo: 'normal'|'he70'|'he100'; dias: number; valor_hh: number }> = [
        { tipo: 'normal', dias: r.dias_normais, valor_hh: r.valor_hh_normal },
        { tipo: 'he70',   dias: r.dias_he70,    valor_hh: r.valor_hh_he70 },
        { tipo: 'he100',  dias: r.dias_he100,   valor_hh: r.valor_hh_he100 },
      ]
      tipos.forEach(t => {
        if (t.dias <= 0) return
        const hh = t.dias * r.carga_horaria_dia
        itens.push({
          boletim_id: bmData.id,
          funcionario_id: r.funcionario_id,
          funcionario_nome: r.funcionario_nome,
          funcao_nome: r.funcao_nome,
          tipo_hora: t.tipo,
          efetivo: 1,
          dias: t.dias,
          carga_horaria_dia: r.carga_horaria_dia,
          hh_total: hh,
          valor_hh: t.valor_hh,
          valor_total: hh * t.valor_hh,
          ordem: ordem++,
        })
      })
    })

    if (itens.length > 0) {
      const { error: itErr } = await supabase.from('bm_itens').insert(itens)
      if (itErr) { setError(itErr.message); setSaving(false); return }
    }

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
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
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

            {/* Tabela consolidada por funcionário */}
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-200 bg-gray-50">
                    <th className="text-left px-3 py-2.5 text-xs font-bold text-gray-600 uppercase tracking-wide">Funcionário</th>
                    <th className="text-left px-3 py-2.5 text-xs font-bold text-gray-600 uppercase tracking-wide">Função</th>
                    <th className="text-center px-2 py-2.5 text-xs font-bold text-blue-700 uppercase tracking-wide w-16">Dias N.</th>
                    <th className="text-center px-2 py-2.5 text-xs font-bold text-amber-700 uppercase tracking-wide w-16">Dias HE 70%</th>
                    <th className="text-center px-2 py-2.5 text-xs font-bold text-red-700 uppercase tracking-wide w-16">Dias HE 100%</th>
                    <th className="text-center px-2 py-2.5 text-xs font-bold text-gray-600 uppercase tracking-wide w-16">HH Total</th>
                    <th className="text-center px-2 py-2.5 text-xs font-bold text-blue-700 uppercase tracking-wide w-24">R$/HH N.</th>
                    <th className="text-center px-2 py-2.5 text-xs font-bold text-amber-700 uppercase tracking-wide w-24">R$/HH 70%</th>
                    <th className="text-center px-2 py-2.5 text-xs font-bold text-red-700 uppercase tracking-wide w-24">R$/HH 100%</th>
                    <th className="text-right px-3 py-2.5 text-xs font-bold text-brand uppercase tracking-wide w-32">Valor Total</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => {
                    const hhTot = rowHHNormal(row) + rowHHHe70(row) + rowHHHe100(row)
                    return (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-800">{row.funcionario_nome}</td>
                        <td className="px-3 py-2 text-xs text-gray-600">{row.funcao_nome}</td>
                        <td className="px-2 py-2 text-center text-blue-700 font-medium">{row.dias_normais || '—'}</td>
                        <td className="px-2 py-2 text-center text-amber-700 font-medium">{row.dias_he70 || '—'}</td>
                        <td className="px-2 py-2 text-center text-red-700 font-medium">{row.dias_he100 || '—'}</td>
                        <td className="px-2 py-2 text-center text-gray-700 font-semibold">{hhTot}h</td>
                        <td className="px-2 py-2 text-center">
                          <input type="number" min="0" step="0.01" value={row.valor_hh_normal}
                            onChange={e => updateRow(i, 'valor_hh_normal', Number(e.target.value))}
                            className={`w-20 px-1.5 py-1 border rounded text-center text-xs focus:outline-none focus:ring-2 focus:ring-brand ${
                              row.sem_contrato && row.valor_hh_normal === 0 ? 'border-red-300 bg-red-50' : 'border-gray-200'
                            }`} />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <input type="number" min="0" step="0.01" value={row.valor_hh_he70}
                            onChange={e => updateRow(i, 'valor_hh_he70', Number(e.target.value))}
                            disabled={row.dias_he70 === 0}
                            className="w-20 px-1.5 py-1 border border-gray-200 rounded text-center text-xs focus:outline-none focus:ring-2 focus:ring-brand disabled:bg-gray-50 disabled:text-gray-300" />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <input type="number" min="0" step="0.01" value={row.valor_hh_he100}
                            onChange={e => updateRow(i, 'valor_hh_he100', Number(e.target.value))}
                            disabled={row.dias_he100 === 0}
                            className="w-20 px-1.5 py-1 border border-gray-200 rounded text-center text-xs focus:outline-none focus:ring-2 focus:ring-brand disabled:bg-gray-50 disabled:text-gray-300" />
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-gray-800">
                          R$ {rowTotal(row).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    )
                  })}
                  <tr className="border-t-2 border-gray-300 bg-brand/5">
                    <td colSpan={2} className="px-3 py-3 font-black text-xs uppercase tracking-wide text-brand">Total Geral</td>
                    <td className="px-2 py-3 text-center font-bold text-blue-700">{totalDiasNormais}</td>
                    <td className="px-2 py-3 text-center font-bold text-amber-700">{totalDiasHe70 || '—'}</td>
                    <td className="px-2 py-3 text-center font-bold text-red-700">{totalDiasHe100 || '—'}</td>
                    <td className="px-2 py-3 text-center font-bold text-gray-700">{totalHH}h</td>
                    <td colSpan={3}></td>
                    <td className="px-3 py-3 text-right font-black text-brand text-base">
                      R$ {totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Calendário visual */}
            <details className="bg-gray-50 rounded-lg border border-gray-200 p-4">
              <summary className="cursor-pointer text-xs font-semibold text-gray-600 uppercase tracking-wide">
                📅 Calendário detalhado (clique para expandir)
              </summary>
              <div className="mt-4 overflow-x-auto">
                {(() => {
                  const start = new Date(form.data_inicio + 'T12:00')
                  const end = new Date(form.data_fim + 'T12:00')
                  const dates: Date[] = []
                  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                    dates.push(new Date(d))
                  }
                  return (
                    <table className="text-[10px] border-collapse">
                      <thead>
                        <tr>
                          <th className="text-left px-2 py-1 sticky left-0 bg-gray-50 z-10 min-w-[140px]">Funcionário</th>
                          {dates.map((d, idx) => {
                            const dow = d.getDay()
                            const isWk = dow === 0 || dow === 6
                            return (
                              <th key={idx} className={`px-1 py-1 text-center min-w-[24px] ${isWk ? 'bg-gray-100 text-gray-400' : 'text-gray-500'}`}>
                                <div className="text-[8px]">{['D','S','T','Q','Q','S','S'][dow]}</div>
                                <div>{d.getDate()}</div>
                              </th>
                            )
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.map(r => {
                          const presentSet = new Set(r.datas_presentes)
                          return (
                            <tr key={r.funcionario_id} className="border-t border-gray-100">
                              <td className="px-2 py-0.5 font-medium text-gray-700 sticky left-0 bg-white z-10 truncate max-w-[140px]" title={r.funcionario_nome}>
                                {r.funcionario_nome}
                              </td>
                              {dates.map((d, idx) => {
                                const iso = d.toISOString().split('T')[0]
                                const dow = d.getDay()
                                const isWk = dow === 0 || dow === 6
                                const present = presentSet.has(iso)
                                let cls = 'bg-white text-gray-200'
                                let label = '·'
                                if (isWk) { cls = 'bg-gray-100 text-gray-300' }
                                if (present) {
                                  cls = 'bg-green-100 text-green-700 font-bold'
                                  label = 'P'
                                }
                                return <td key={idx} className={`px-1 py-0.5 text-center ${cls}`}>{label}</td>
                              })}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )
                })()}
              </div>
              <p className="text-[10px] text-gray-400 mt-2">P = Presente · · = Sem registro</p>
            </details>
          </div>
        )
      )}
    </div>
  )
}
