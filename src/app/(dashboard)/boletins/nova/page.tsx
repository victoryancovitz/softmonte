'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import BackButton from '@/components/BackButton'
import { useToast } from '@/components/Toast'

interface PreviewRow {
  funcao_nome: string
  carga_horaria_dia: number
  efetivo: number              // qtd contratada (do contrato_composicao)
  funcionarios_unicos: number  // pessoas distintas que trabalharam
  // Dias-pessoa por tipo de hora
  dias_normais: number
  dias_he70: number
  dias_he100: number
  // Horas reais do ponto (pra modelo HH-Hora Efetiva)
  hh_normais_real: number
  hh_he70_real: number
  hh_he100_real: number
  // Lista de funcionários (para detalhamento)
  funcionarios: Array<{ id: string; nome: string; dias_normais: number; dias_he70: number; dias_he100: number; datas: string[] }>
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
    // Bloqueia obras canceladas E encerradas
    supabase.from('obras').select('id,nome,cliente,data_inicio,data_prev_fim,status,bm_dia_unico,modelo_cobranca,escala_almoco_minutos,carga_horaria_dia')
      .is('deleted_at', null)
      .not('status', 'in', '(cancelado,encerrado)')
      .order('nome')
      .then(({ data }) => setObras(data ?? []))
  }, [])

  async function onObraChange(obraId: string) {
    set('obra_id', obraId)
    setPreview(null)
    if (!obraId) return
    const { data } = await supabase.from('boletins_medicao')
      .select('numero').eq('obra_id', obraId).is('deleted_at', null).order('numero', { ascending: false }).limit(1)
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
      if (obra.status === 'cancelado' || obra.status === 'encerrado') {
        return `Não é possível criar BM para uma obra ${obra.status}.`
      }
    }

    // Revalida status da obra no banco (caso tenha sido alterado entre load e submit)
    const { data: freshObra } = await supabase.from('obras')
      .select('status, deleted_at').eq('id', form.obra_id).maybeSingle()
    if (!freshObra || (freshObra as any).deleted_at) return 'Obra não encontrada ou excluída.'
    if (['cancelado','encerrado'].includes((freshObra as any).status)) {
      return `A obra foi ${(freshObra as any).status} e não aceita mais BMs.`
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

    // Fetch efetivo_diario for the obra + period (inclui horas reais pra modelo hora efetiva)
    const { data: efetivo, error: efErr } = await supabase
      .from('efetivo_diario')
      .select('funcionario_id, data, tipo_dia, horas_normais, horas_extras_50, horas_extras_100, funcionarios(id, nome, cargo)')
      .eq('obra_id', form.obra_id)
      .gte('data', form.data_inicio)
      .lte('data', form.data_fim)

    if (efErr) { setError(efErr.message); setPreviewing(false); return }
    if (!efetivo || efetivo.length === 0) {
      setError('Nenhum registro encontrado em efetivo_diario para esta obra no periodo. Importe e calcule o ponto primeiro (Ponto > Importar Secullum > Calcular Efetivo).')
      setPreview([])
      setPreviewing(false)
      return
    }

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

    // Identifica o modelo de cobrança da obra
    const obraSel = obras.find(o => o.id === form.obra_id)
    const modeloCobranca = obraSel?.modelo_cobranca || 'hh_diaria'

    // Para HH-Hora Efetiva: busca marcações BRUTAS pra calcular horas reais
    // (não depende de calcular-efetivo ter rodado)
    type MarcDia = { funcionario_id: string; data: string; horas: string[] }
    const marcPorFuncDia = new Map<string, number>() // "funcId|data" -> horas trabalhadas
    if (modeloCobranca === 'hh_hora_efetiva') {
      const funcIds = Array.from(new Set((efetivo as any[]).map((e: any) => e.funcionarios?.id).filter(Boolean)))
      if (funcIds.length > 0) {
        const { data: marcData } = await supabase
          .from('ponto_marcacoes')
          .select('funcionario_id, data, hora')
          .in('funcionario_id', funcIds)
          .gte('data', form.data_inicio)
          .lte('data', form.data_fim)
          .order('hora')

        // Agrupa batidas por func+dia e calcula horas: (última - primeira) - almoço
        const escalaAlmoco = Number(obraSel?.escala_almoco_minutos ?? 60)
        const grouped = new Map<string, string[]>() // "funcId|data" -> [horas]
        for (const m of (marcData ?? []) as any[]) {
          const key = `${m.funcionario_id}|${m.data}`
          if (!grouped.has(key)) grouped.set(key, [])
          grouped.get(key)!.push(String(m.hora).slice(0, 5))
        }
        grouped.forEach((horas, key) => {
          if (horas.length < 2) return
          const sorted = [...horas].sort()
          const first = sorted[0].split(':').map(Number)
          const last = sorted[sorted.length - 1].split(':').map(Number)
          const entradaMin = first[0] * 60 + first[1]
          const saidaMin = last[0] * 60 + last[1]
          let intervalo = escalaAlmoco
          if (sorted.length >= 4) {
            // Usa batidas 2 e 3 como intervalo real
            const s2 = sorted[1].split(':').map(Number)
            const e3 = sorted[2].split(':').map(Number)
            intervalo = (e3[0] * 60 + e3[1]) - (s2[0] * 60 + s2[1])
          } else if (saidaMin - entradaMin <= 360) {
            intervalo = 0 // jornada <= 6h, sem almoço
          }
          const totalMin = Math.max(0, (saidaMin - entradaMin) - intervalo)
          marcPorFuncDia.set(key, Math.round((totalMin / 60) * 100) / 100)
        })
      }
    }

    // Step 1: aggregate by funcionario first (so we can list per function)
    const perFunc: Record<string, { func: any; tipos: Record<string, Set<string>>; horas: { normais: number; he50: number; he100: number } }> = {}
    efetivo.forEach((e: any) => {
      const f = e.funcionarios
      if (!f) return
      if (!perFunc[f.id]) {
        perFunc[f.id] = { func: f, tipos: { util: new Set(), sabado: new Set(), domingo_feriado: new Set() }, horas: { normais: 0, he50: 0, he100: 0 } }
      }
      ;(perFunc[f.id].tipos[e.tipo_dia] ?? perFunc[f.id].tipos.util).add(e.data)

      // Acumula horas: se efetivo_diario já tem horas calculadas, usa. Senão usa marcações brutas.
      const horasEfetivo = Number(e.horas_normais ?? 0)
      const he50Efetivo = Number(e.horas_extras_50 ?? 0)
      const he100Efetivo = Number(e.horas_extras_100 ?? 0)

      if (horasEfetivo > 0 || he50Efetivo > 0 || he100Efetivo > 0) {
        perFunc[f.id].horas.normais += horasEfetivo
        perFunc[f.id].horas.he50 += he50Efetivo
        perFunc[f.id].horas.he100 += he100Efetivo
      } else if (modeloCobranca === 'hh_hora_efetiva') {
        // Fallback: calcula das marcações brutas
        const key = `${f.id}|${e.data}`
        const horasCalc = marcPorFuncDia.get(key) ?? 0
        const carga = Number(obraSel?.carga_horaria_dia ?? 8)
        if (e.tipo_dia === 'domingo_feriado') {
          perFunc[f.id].horas.he100 += horasCalc
        } else if (e.tipo_dia === 'sabado') {
          const normais = Math.min(horasCalc, carga)
          perFunc[f.id].horas.normais += normais
          perFunc[f.id].horas.he50 += Math.max(0, horasCalc - carga)
        } else {
          const normais = Math.min(horasCalc, carga)
          perFunc[f.id].horas.normais += normais
          perFunc[f.id].horas.he50 += Math.max(0, horasCalc - carga)
        }
      }
    })

    // Step 2: group funcionarios by função (cargo)
    const perFuncao: Record<string, {
      cargo: string
      funcs: Array<{ id: string; nome: string; dias_normais: number; dias_he70: number; dias_he100: number; datas: string[] }>
      horasReais: { normais: number; he50: number; he100: number }
    }> = {}

    Object.values(perFunc).forEach(g => {
      const cargo = g.func.cargo ?? 'OUTROS'
      const cargoKey = cargo.toUpperCase()

      let dias_normais: number, dias_he70: number, dias_he100: number
      let datas: string[]

      const allArr = ([] as string[])
        .concat(Array.from(g.tipos.util))
        .concat(Array.from(g.tipos.sabado))
        .concat(Array.from(g.tipos.domingo_feriado))
      if (diaUnico) {
        const all = new Set<string>(allArr)
        dias_normais = all.size
        dias_he70 = 0
        dias_he100 = 0
        datas = Array.from(all).sort()
      } else {
        dias_normais = g.tipos.util.size
        dias_he70 = g.tipos.sabado.size
        dias_he100 = g.tipos.domingo_feriado.size
        datas = Array.from(new Set<string>(allArr)).sort()
      }

      if (!perFuncao[cargoKey]) perFuncao[cargoKey] = { cargo, funcs: [], horasReais: { normais: 0, he50: 0, he100: 0 } }
      perFuncao[cargoKey].funcs.push({
        id: g.func.id,
        nome: g.func.nome_guerra ?? g.func.nome,
        dias_normais, dias_he70, dias_he100, datas
      })
      perFuncao[cargoKey].horasReais.normais += g.horas.normais
      perFuncao[cargoKey].horasReais.he50 += g.horas.he50
      perFuncao[cargoKey].horasReais.he100 += g.horas.he100
    })

    // Step 3: build rows - one per função
    const rows: PreviewRow[] = Object.entries(perFuncao).map(([cargoKey, group]) => {
      const comp = compMap[cargoKey]
      const cargaHoraDia = Number(comp?.carga_horaria_dia ?? 8)
      const totalNormais = group.funcs.reduce((s, f) => s + f.dias_normais, 0)
      const totalHe70 = group.funcs.reduce((s, f) => s + f.dias_he70, 0)
      const totalHe100 = group.funcs.reduce((s, f) => s + f.dias_he100, 0)

      return {
        funcao_nome: group.cargo,
        carga_horaria_dia: cargaHoraDia,
        efetivo: Number(comp?.quantidade_contratada ?? group.funcs.length),
        funcionarios_unicos: group.funcs.length,
        dias_normais: totalNormais,
        dias_he70: totalHe70,
        dias_he100: totalHe100,
        hh_normais_real: Math.round(group.horasReais.normais * 100) / 100,
        hh_he70_real: Math.round(group.horasReais.he50 * 100) / 100,
        hh_he100_real: Math.round(group.horasReais.he100 * 100) / 100,
        funcionarios: group.funcs.sort((a, b) => a.nome.localeCompare(b.nome)),
        valor_hh_normal: Number(comp?.custo_hora_contratado ?? 0),
        valor_hh_he70: Number(comp?.custo_hora_extra_70 ?? 0),
        valor_hh_he100: Number(comp?.custo_hora_extra_100 ?? 0),
        sem_contrato: !comp,
      }
    }).sort((a, b) => a.funcao_nome.localeCompare(b.funcao_nome))

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

  // Modelo de cobrança determina como calcular HH:
  // hh_diaria: dias × carga_horaria_dia (fatura por dia fixo)
  // hh_hora_efetiva: horas reais do ponto (fatura pelas horas efetivamente trabalhadas)
  // hh_220h: 220h/mês fixo (mensalista)
  const obraSelecionada = obras.find(o => o.id === form.obra_id)
  const modelo = obraSelecionada?.modelo_cobranca || 'hh_diaria'

  function rowHHNormal(r: PreviewRow) {
    if (modelo === 'hh_hora_efetiva') return r.hh_normais_real
    return r.dias_normais * r.carga_horaria_dia
  }
  function rowHHHe70(r: PreviewRow) {
    if (modelo === 'hh_hora_efetiva') return r.hh_he70_real
    return r.dias_he70 * r.carga_horaria_dia
  }
  function rowHHHe100(r: PreviewRow) {
    if (modelo === 'hh_hora_efetiva') return r.hh_he100_real
    return r.dias_he100 * r.carga_horaria_dia
  }
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
    if (!preview || preview.length === 0) {
      setError('O BM precisa ter pelo menos um registro de ponto no período selecionado.')
      return
    }
    // Valida que ao menos uma função tem dias > 0
    const temDias = preview.some(r => r.dias_normais + r.dias_he70 + r.dias_he100 > 0)
    if (!temDias) {
      setError('Nenhuma função tem dias-pessoa registrados. Verifique o ponto do período.')
      return
    }
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
    //    The preview shows by função but we save per-person for traceability
    const itens: any[] = []
    let ordem = 0
    preview.forEach(r => {
      r.funcionarios.forEach(f => {
        const tipos: Array<{ tipo: 'normal'|'extra_70'|'extra_100'; dias: number; valor_hh: number }> = [
          { tipo: 'normal',    dias: f.dias_normais, valor_hh: r.valor_hh_normal },
          { tipo: 'extra_70',  dias: f.dias_he70,    valor_hh: r.valor_hh_he70 },
          { tipo: 'extra_100', dias: f.dias_he100,   valor_hh: r.valor_hh_he100 },
        ]
        tipos.forEach(t => {
          if (t.dias <= 0) return
          itens.push({
            boletim_id: bmData.id,
            funcionario_id: f.id,
            funcionario_nome: f.nome,
            funcao_nome: r.funcao_nome,
            tipo_hora: t.tipo,
            efetivo: 1,
            dias: t.dias,
            carga_horaria_dia: r.carga_horaria_dia,
            // hh_total e valor_total são GENERATED ALWAYS no banco
            valor_hh: t.valor_hh,
            ordem: ordem++,
          })
        })
      })
    })

    if (itens.length > 0) {
      const { error: itErr } = await supabase.from('bm_itens').insert(itens)
      if (itErr) { setError(itErr.message); setSaving(false); return }
    }

    const totalFuncs = new Set(preview.flatMap(r => r.funcionarios.map(f => f.id))).size
    toast.success(
      `BM criado com sucesso com ${totalFuncs} funcionários e ${totalHH}h registradas`
    )
    router.push(`/boletins/${bmData.id}`)
    router.refresh()
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
            <p className="text-gray-600 font-medium text-sm mb-1">Nenhum registro de efetivo diario encontrado para esta obra no periodo selecionado.</p>
            <p className="text-gray-400 text-xs mb-4">Importe e calcule o ponto primeiro: Ponto &gt; Importar Secullum &gt; Calcular Efetivo.</p>
            <Link href="/ponto" className="text-brand text-sm font-medium hover:underline">
              Ir para Ponto para importar e calcular &rarr;
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold">Pré-visualização — Por Função</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {preview.length} funções · {preview.reduce((s, r) => s + r.funcionarios_unicos, 0)} funcionários · {totalHH}h totais
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

            {/* Tabela por função (formato Cesari) */}
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-200 bg-gray-50">
                    <th className="text-left px-3 py-2.5 text-xs font-bold text-gray-600 uppercase tracking-wide">Função</th>
                    <th className="text-center px-2 py-2.5 text-xs font-bold text-gray-600 uppercase tracking-wide w-16">Efetivo</th>
                    <th className="text-center px-2 py-2.5 text-xs font-bold text-blue-700 uppercase tracking-wide w-16" title="Dias-pessoa em Hora Normal">DIA HN</th>
                    <th className="text-center px-2 py-2.5 text-xs font-bold text-amber-700 uppercase tracking-wide w-16" title="Dias-pessoa em HE 70%">DIA HE 70%</th>
                    <th className="text-center px-2 py-2.5 text-xs font-bold text-red-700 uppercase tracking-wide w-16" title="Dias-pessoa em HE 100%">DIA HE 100%</th>
                    <th className="text-center px-2 py-2.5 text-xs font-bold text-blue-700 uppercase tracking-wide w-20" title="Horas normais">HH Normal</th>
                    <th className="text-center px-2 py-2.5 text-xs font-bold text-amber-700 uppercase tracking-wide w-20" title="Horas extras 70%">HH HE 70%</th>
                    <th className="text-center px-2 py-2.5 text-xs font-bold text-red-700 uppercase tracking-wide w-20" title="Horas extras 100%">HH HE 100%</th>
                    <th className="text-center px-2 py-2.5 text-xs font-bold text-blue-700 uppercase tracking-wide w-24">R$/HH N.</th>
                    <th className="text-center px-2 py-2.5 text-xs font-bold text-amber-700 uppercase tracking-wide w-24">R$/HH 70%</th>
                    <th className="text-center px-2 py-2.5 text-xs font-bold text-red-700 uppercase tracking-wide w-24">R$/HH 100%</th>
                    <th className="text-right px-3 py-2.5 text-xs font-bold text-brand uppercase tracking-wide w-32">Valor Total</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => {
                    const hhN = rowHHNormal(row)
                    const hh70 = rowHHHe70(row)
                    const hh100 = rowHHHe100(row)
                    return (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-3 py-2 font-semibold text-gray-800">
                          <details>
                            <summary className="cursor-pointer hover:text-brand">{row.funcao_nome}</summary>
                            <div className="mt-2 pl-3 space-y-1 text-[11px] font-normal text-gray-500">
                              {row.funcionarios.map(f => (
                                <div key={f.id}>
                                  • {f.nome}
                                  <span className="ml-2 text-gray-400">
                                    {f.dias_normais > 0 && `${f.dias_normais}d`}
                                    {f.dias_he70 > 0 && ` +${f.dias_he70}sáb`}
                                    {f.dias_he100 > 0 && ` +${f.dias_he100}dom`}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </details>
                        </td>
                        <td className="px-2 py-2 text-center text-gray-700 font-medium">{row.efetivo}</td>
                        <td className="px-2 py-2 text-center text-blue-700 font-bold">{row.dias_normais || '—'}</td>
                        <td className="px-2 py-2 text-center text-amber-700 font-medium">{row.dias_he70 || '—'}</td>
                        <td className="px-2 py-2 text-center text-red-700 font-medium">{row.dias_he100 || '—'}</td>
                        <td className="px-2 py-2 text-center text-blue-700 font-bold">{hhN ? hhN+'h' : '—'}</td>
                        <td className="px-2 py-2 text-center text-amber-700 font-bold">{hh70 ? hh70+'h' : '—'}</td>
                        <td className="px-2 py-2 text-center text-red-700 font-bold">{hh100 ? hh100+'h' : '—'}</td>
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
                  {(() => {
                    const totalHHN = preview.reduce((s, r) => s + rowHHNormal(r), 0)
                    const totalHH70 = preview.reduce((s, r) => s + rowHHHe70(r), 0)
                    const totalHH100 = preview.reduce((s, r) => s + rowHHHe100(r), 0)
                    return (
                      <tr className="border-t-2 border-gray-300 bg-brand/5">
                        <td className="px-3 py-3 font-black text-xs uppercase tracking-wide text-brand">Total Geral</td>
                        <td className="px-2 py-3 text-center font-bold text-gray-700">
                          {preview.reduce((s, r) => s + r.funcionarios_unicos, 0)}
                        </td>
                        <td className="px-2 py-3 text-center font-bold text-blue-700">{totalDiasNormais}</td>
                        <td className="px-2 py-3 text-center font-bold text-amber-700">{totalDiasHe70 || '—'}</td>
                        <td className="px-2 py-3 text-center font-bold text-red-700">{totalDiasHe100 || '—'}</td>
                        <td className="px-2 py-3 text-center font-bold text-blue-700">{totalHHN}h</td>
                        <td className="px-2 py-3 text-center font-bold text-amber-700">{totalHH70 || '—'}{totalHH70 ? 'h' : ''}</td>
                        <td className="px-2 py-3 text-center font-bold text-red-700">{totalHH100 || '—'}{totalHH100 ? 'h' : ''}</td>
                        <td colSpan={3}></td>
                        <td className="px-3 py-3 text-right font-black text-brand text-base">
                          R$ {totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    )
                  })()}
                </tbody>
              </table>
            </div>

            {/* Calendário visual por funcionário */}
            <details className="bg-gray-50 rounded-lg border border-gray-200 p-4">
              <summary className="cursor-pointer text-xs font-semibold text-gray-600 uppercase tracking-wide">
                📅 Calendário detalhado por funcionário (clique para expandir)
              </summary>
              <div className="mt-4 overflow-x-auto">
                {(() => {
                  const start = new Date(form.data_inicio + 'T12:00')
                  const end = new Date(form.data_fim + 'T12:00')
                  const dates: Date[] = []
                  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                    dates.push(new Date(d))
                  }
                  // Flatten all funcionarios across all função groups
                  const allFuncs = preview.flatMap(r => r.funcionarios.map(f => ({ ...f, funcao: r.funcao_nome })))
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
                        {allFuncs.map(f => {
                          const presentSet = new Set(f.datas)
                          return (
                            <tr key={f.id} className="border-t border-gray-100">
                              <td className="px-2 py-0.5 font-medium text-gray-700 sticky left-0 bg-white z-10 truncate max-w-[140px]" title={f.nome}>
                                {f.nome}
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
              <p className="text-[10px] text-gray-400 mt-2">P = Presente · · = Sem registro · Cinza = Fim de semana</p>
            </details>
          </div>
        )
      )}
    </div>
  )
}
