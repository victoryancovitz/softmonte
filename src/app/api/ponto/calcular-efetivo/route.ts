/**
 * POST /api/ponto/calcular-efetivo
 *
 * Lê ponto_marcacoes (batidas brutas do colaborador) e calcula efetivo_diario.
 *
 * Prioridade para definir a obra do dia:
 * 1. Atribuição manual existente em efetivo_diario (operador definiu via grid)
 * 2. Alocação ativa no período (fallback)
 * 3. Sem obra → não calcula (pula o dia)
 *
 * Quando recalcula, MANTÉM a obra_id que o operador escolheu e apenas
 * recalcula as horas baseado nas marcações + escala da obra.
 *
 * Body JSON: {
 *   dataInicio: "YYYY-MM-DD",
 *   dataFim: "YYYY-MM-DD",
 *   obraId?: string  // filtro opcional: só recalcula 1 obra
 * }
 *
 * Auth: admin | rh | CRON_SECRET
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { requireRoleApi } from '@/lib/require-role'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Marcacao = { funcionario_id: string; data: string; hora: string; sequencia: number }

type Obra = {
  id: string
  escala_entrada: string | null
  escala_saida_seg_qui: string | null
  escala_saida_sex: string | null
  escala_almoco_minutos: number | null
  escala_tolerancia_min: number | null
  carga_horaria_dia: number | null
  tem_adicional_noturno: boolean | null
  adicional_noturno_pct: number | null
  he_pct_domingo_feriado: number | null
}

type Alocacao = {
  id: string
  funcionario_id: string
  obra_id: string
  data_inicio: string | null
  data_fim: string | null
}

type EfetivoDiarioExistente = {
  funcionario_id: string
  data: string
  obra_id: string | null
  origem_registro: string | null
}

/** Converte HH:mm (ou HH:mm:ss) em minutos desde 00:00. */
function toMinutes(hhmm: string | null): number | null {
  if (!hhmm) return null
  const [h, m] = hhmm.split(':').map(Number)
  if (isNaN(h) || isNaN(m)) return null
  return h * 60 + m
}

/** Converte minutos de volta pra HH:mm:ss. */
function toHHMM(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
}

/** Dia da semana em pt-BR: 0=dom, 1=seg, ..., 6=sab. */
function diaSemana(date: string): number {
  return new Date(date + 'T12:00:00Z').getUTCDay()
}

/** Calcula horas noturnas (22h-05h) entre dois pontos em minutos (no mesmo dia). */
function minutosNoturnos(entradaMin: number, saidaMin: number): number {
  const NOITE_INI = 22 * 60
  const NOITE_FIM = 5 * 60
  let total = 0
  // Intersecção com [22:00, 24:00)
  if (saidaMin > NOITE_INI) {
    total += Math.min(saidaMin, 24 * 60) - Math.max(entradaMin, NOITE_INI)
  }
  // Intersecção com [00:00, 05:00)
  if (entradaMin < NOITE_FIM) {
    total += Math.min(saidaMin, NOITE_FIM) - Math.max(entradaMin, 0)
  }
  return Math.max(0, total)
}

export async function POST(req: NextRequest) {
  const cronSecret = req.headers.get('x-cron-secret')
  const isCron = !!(process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET)
  if (!isCron) {
    const roleErr = await requireRoleApi(['admin', 'rh'])
    if (roleErr) return roleErr
  }

  let body: { dataInicio?: string; dataFim?: string; obraId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 })
  }

  const { dataInicio, dataFim, obraId } = body
  if (!dataInicio || !dataFim || !/^\d{4}-\d{2}-\d{2}$/.test(dataInicio) || !/^\d{4}-\d{2}-\d{2}$/.test(dataFim)) {
    return NextResponse.json(
      { error: 'dataInicio e dataFim obrigatórios (YYYY-MM-DD)' },
      { status: 400 },
    )
  }

  const supabase = createServerClient()

  // 1. Lê marcações do período (pagina pra superar o limite padrão de 1000 linhas do Supabase)
  const PAGE = 1000
  let allMarcacoes: Marcacao[] = []
  let offset = 0
  let keepFetching = true
  while (keepFetching) {
    const { data: page, error: mErr } = await supabase
      .from('ponto_marcacoes')
      .select('funcionario_id, data, hora, sequencia')
      .gte('data', dataInicio)
      .lte('data', dataFim)
      .order('funcionario_id')
      .order('data')
      .order('hora')
      .range(offset, offset + PAGE - 1)
    if (mErr) return NextResponse.json({ error: 'Erro lendo marcações: ' + mErr.message }, { status: 500 })
    const rows = (page ?? []) as Marcacao[]
    allMarcacoes = allMarcacoes.concat(rows)
    if (rows.length < PAGE) keepFetching = false
    else offset += PAGE
  }

  const marcacoes = allMarcacoes
  console.log('[calcular-efetivo] marcacoes:', marcacoes.length, 'periodo:', dataInicio, dataFim)

  if (marcacoes.length === 0) {
    return NextResponse.json({
      ok: true,
      mensagem: 'Nenhuma marcação no período. Sincronize o ponto primeiro.',
      criados: 0,
      atualizados: 0,
    })
  }

  const funcIds = Array.from(new Set((marcacoes as Marcacao[]).map(m => m.funcionario_id)))

  // 2. Lê atribuições manuais existentes em efetivo_diario (operador definiu a obra via grid)
  let allExistentes: EfetivoDiarioExistente[] = []
  {
    let efOffset = 0
    let efKeep = true
    while (efKeep) {
      let q = supabase
        .from('efetivo_diario')
        .select('funcionario_id, data, obra_id, origem_registro')
        .in('funcionario_id', funcIds)
        .gte('data', dataInicio)
        .lte('data', dataFim)
        .range(efOffset, efOffset + PAGE - 1)
      if (obraId) q = q.eq('obra_id', obraId)
      const { data: efPage, error: efErr } = await q
      if (efErr) {
        console.warn('[calcular-efetivo] Erro lendo efetivo_diario existente:', efErr.message)
        break
      }
      const rows = (efPage ?? []) as EfetivoDiarioExistente[]
      allExistentes = allExistentes.concat(rows)
      if (rows.length < PAGE) efKeep = false
      else efOffset += PAGE
    }
  }

  // Mapa: funcId|data -> obra_id (atribuicao manual existente)
  const existenteMap = new Map<string, string>()
  for (const e of allExistentes) {
    if (e.obra_id) {
      existenteMap.set(`${e.funcionario_id}|${e.data}`, e.obra_id)
    }
  }
  console.log('[calcular-efetivo] atribuicoes manuais existentes:', existenteMap.size)

  // 3. Lê alocações ativas que cobrem o período (fallback pra quem não tem atribuição manual)
  let allocsQ = supabase
    .from('alocacoes')
    .select('id, funcionario_id, obra_id, data_inicio, data_fim')
    .eq('ativo', true)
    .in('funcionario_id', funcIds)
  if (obraId) allocsQ = allocsQ.eq('obra_id', obraId)
  const { data: alocacoes, error: aErr } = await allocsQ
  if (aErr) return NextResponse.json({ error: 'Erro lendo alocações: ' + aErr.message }, { status: 500 })

  // 4. Lê obras com escalas — precisa de todas as obras referenciadas (atribuições + alocações)
  const obraIdsSet = new Set<string>()
  Array.from(existenteMap.values()).forEach(oId => obraIdsSet.add(oId))
  ;(alocacoes as Alocacao[] || []).forEach(a => obraIdsSet.add(a.obra_id))
  const obraIds = Array.from(obraIdsSet)

  if (obraIds.length === 0) {
    return NextResponse.json({
      ok: true,
      mensagem: 'Nenhuma obra encontrada (sem atribuição manual e sem alocação ativa). Atribua obras no grid de marcações primeiro.',
      criados: 0,
      atualizados: 0,
    })
  }

  const { data: obras, error: oErr } = await supabase
    .from('obras')
    .select('id, escala_entrada, escala_saida_seg_qui, escala_saida_sex, escala_almoco_minutos, escala_tolerancia_min, carga_horaria_dia, tem_adicional_noturno, adicional_noturno_pct, he_pct_domingo_feriado')
    .in('id', obraIds)
  if (oErr) return NextResponse.json({ error: 'Erro lendo obras: ' + oErr.message }, { status: 500 })

  const obraMap = new Map<string, Obra>()
  ;(obras as Obra[] || []).forEach(o => obraMap.set(o.id, o))

  // 5. Agrupa marcações por (funcionario, data)
  type DayKey = string // `${funcId}|${data}`
  const dayGroups = new Map<DayKey, Marcacao[]>()
  for (const m of marcacoes as Marcacao[]) {
    const key = `${m.funcionario_id}|${m.data}`
    if (!dayGroups.has(key)) dayGroups.set(key, [])
    dayGroups.get(key)!.push(m)
  }

  // 6. Pra cada grupo, encontra obra via:
  //    a) atribuição manual existente em efetivo_diario
  //    b) herança da atribuição manual do dia anterior mais recente
  //    c) alocação ativa no dia (fallback)
  function acharObraDoDia(funcId: string, data: string): string | null {
    // a) Atribuição manual explícita neste dia
    const manualKey = `${funcId}|${data}`
    if (existenteMap.has(manualKey)) {
      return existenteMap.get(manualKey)!
    }

    // b) Herança: busca atribuição manual do dia anterior mais recente
    let bestDate: string | null = null
    Array.from(existenteMap.entries()).forEach(([key, _oId]) => {
      const [fId, d] = key.split('|')
      if (fId === funcId && d < data && (!bestDate || d > bestDate)) {
        bestDate = d
      }
    })
    if (bestDate) {
      return existenteMap.get(`${funcId}|${bestDate}`)!
    }

    // c) Fallback: alocação ativa no dia
    const candidatas = (alocacoes as Alocacao[] || []).filter(a =>
      a.funcionario_id === funcId &&
      (!a.data_inicio || a.data_inicio <= data) &&
      (!a.data_fim || a.data_fim >= data),
    )
    if (candidatas.length === 0) return null
    candidatas.sort((a, b) => (b.data_inicio || '').localeCompare(a.data_inicio || ''))
    return candidatas[0].obra_id
  }

  // 7. Calcula e prepara upsert em efetivo_diario
  type Row = {
    funcionario_id: string
    obra_id: string
    data: string
    tipo_dia: string
    entrada: string | null
    saida_almoco: string | null
    volta_almoco: string | null
    saida: string | null
    horas_trabalhadas: number
    horas_normais: number
    horas_extras_50: number
    horas_extras_100: number
    horas_noturnas: number
    horas_previstas: number
    atraso_minutos: number
    origem_registro: string
  }
  const rows: Row[] = []
  const semObra: string[] = []
  const semEscala: string[] = []

  dayGroups.forEach((batidas, key) => {
    const [funcId, data] = key.split('|')
    const obraFinalId = acharObraDoDia(funcId, data)
    if (!obraFinalId) {
      semObra.push(`${funcId}|${data}`)
      return
    }
    const obra = obraMap.get(obraFinalId)
    if (!obra) {
      semObra.push(`${funcId}|${data}`)
      return
    }

    const carga = Number(obra.carga_horaria_dia ?? 8)
    const cargaMin = carga * 60

    // Ordena batidas por hora
    const ordenadas = [...batidas].sort((a, b) => a.hora.localeCompare(b.hora))
    const primeira = ordenadas[0].hora
    const ultima = ordenadas[ordenadas.length - 1].hora
    const entradaMin = toMinutes(primeira)!
    const saidaMin = toMinutes(ultima)!

    // Almoço: se 2 batidas, não há almoço registrado (usa configurado na escala)
    //         se 4 batidas, usa as batidas 2 e 3 como intervalo de almoço
    let almocoIni: string | null = null
    let almocoFim: string | null = null
    let intervaloMin = obra.escala_almoco_minutos ?? 60
    if (ordenadas.length >= 4) {
      almocoIni = ordenadas[1].hora
      almocoFim = ordenadas[2].hora
      const ai = toMinutes(almocoIni)!
      const af = toMinutes(almocoFim)!
      intervaloMin = Math.max(0, af - ai)
    } else if (ordenadas.length === 2) {
      // Só entrada/saída, desconta almoço da escala se jornada > 6h
      const bruto = saidaMin - entradaMin
      if (bruto > 6 * 60) {
        intervaloMin = obra.escala_almoco_minutos ?? 60
      } else {
        intervaloMin = 0
      }
    }

    const totalTrabMin = Math.max(0, (saidaMin - entradaMin) - intervaloMin)
    const tolerancia = obra.escala_tolerancia_min ?? 0

    // Horas previstas varia entre dias úteis e finais de semana
    const ds = diaSemana(data)
    let tipoDia = 'util'
    let previstasMin = cargaMin
    if (ds === 0) { // domingo
      tipoDia = 'domingo_feriado'
      previstasMin = 0
    } else if (ds === 6) { // sábado
      tipoDia = 'sabado'
      previstasMin = 0
    } else if (ds === 5 && obra.escala_saida_sex) { // sexta especial
      const entradaEscala = toMinutes(obra.escala_entrada)
      const saidaEscala = toMinutes(obra.escala_saida_sex)
      if (entradaEscala != null && saidaEscala != null) {
        previstasMin = (saidaEscala - entradaEscala) - (obra.escala_almoco_minutos ?? 60)
      }
    }

    // Atraso (em relação ao horário de entrada da escala)
    let atraso = 0
    if (tipoDia === 'util') {
      const entradaEscala = toMinutes(obra.escala_entrada)
      if (entradaEscala != null && entradaMin > entradaEscala + tolerancia) {
        atraso = entradaMin - entradaEscala
      }
    }

    // HE: o que passar de previstasMin é extra
    let heMin = 0
    let heDomFeriadoMin = 0
    let normaisMin = totalTrabMin

    if (tipoDia === 'util' || tipoDia === 'sabado') {
      if (totalTrabMin > previstasMin) {
        heMin = totalTrabMin - previstasMin
        normaisMin = previstasMin
      }
    } else if (tipoDia === 'domingo_feriado') {
      // Todo trabalho em domingo é HE 100%
      heDomFeriadoMin = totalTrabMin
      normaisMin = 0
    }

    // Adicional noturno (apenas contagem de minutos — aplicação do % fica pra folha)
    let noturnasMin = 0
    if (obra.tem_adicional_noturno && totalTrabMin > 0) {
      noturnasMin = minutosNoturnos(entradaMin, saidaMin)
    }

    rows.push({
      funcionario_id: funcId,
      obra_id: obraFinalId,
      data,
      tipo_dia: tipoDia,
      entrada: primeira.slice(0, 5) + ':00',
      saida_almoco: almocoIni ? almocoIni.slice(0, 5) + ':00' : null,
      volta_almoco: almocoFim ? almocoFim.slice(0, 5) + ':00' : null,
      saida: ultima.slice(0, 5) + ':00',
      horas_trabalhadas: Math.round((totalTrabMin / 60) * 100) / 100,
      horas_normais: Math.round((normaisMin / 60) * 100) / 100,
      horas_extras_50: Math.round((heMin / 60) * 100) / 100,
      horas_extras_100: Math.round((heDomFeriadoMin / 60) * 100) / 100,
      horas_noturnas: Math.round((noturnasMin / 60) * 100) / 100,
      horas_previstas: Math.round((previstasMin / 60) * 100) / 100,
      atraso_minutos: atraso,
      origem_registro: 'secullum_api',
    })

    if (!obra.escala_entrada) {
      semEscala.push(`obra ${obraFinalId}`)
    }
  })

  // 8. Upsert em efetivo_diario (em lotes)
  //    Para dias que já tinham atribuição manual com obra diferente, precisamos
  //    deletar o registro antigo antes de inserir o novo (pois a PK é obra_id+func+data)
  let criados = 0
  const erros: string[] = []

  if (rows.length > 0) {
    // Primeiro, para cada row, verificar se existe um registro com outra obra_id
    // e deletar se necessário (o operador pode ter atribuído via grid e a PK inclui obra_id)
    const deletarAntes: { funcionario_id: string; data: string; obra_id_antiga: string }[] = []
    for (const row of rows) {
      const existenteKey = `${row.funcionario_id}|${row.data}`
      const existenteObraId = existenteMap.get(existenteKey)
      // Se já existe com a MESMA obra, o upsert vai funcionar normalmente
      // Se existe com OUTRA obra, precisamos deletar o antigo
      if (existenteObraId && existenteObraId !== row.obra_id) {
        deletarAntes.push({
          funcionario_id: row.funcionario_id,
          data: row.data,
          obra_id_antiga: existenteObraId,
        })
      }
    }

    // Deletar registros com obra_id diferente que seriam conflitantes
    for (const del of deletarAntes) {
      await supabase
        .from('efetivo_diario')
        .delete()
        .eq('funcionario_id', del.funcionario_id)
        .eq('data', del.data)
        .eq('obra_id', del.obra_id_antiga)
    }

    const BATCH = 500
    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH)
      const { error, count } = await supabase
        .from('efetivo_diario')
        .upsert(chunk, {
          onConflict: 'obra_id,funcionario_id,data',
          count: 'exact',
        })
      if (error) erros.push(error.message)
      else criados += count || 0
    }
  }

  return NextResponse.json({
    ok: erros.length === 0,
    periodo: { dataInicio, dataFim },
    total_dias_calculados: rows.length,
    criados_ou_atualizados: criados,
    sem_obra_no_dia: semObra.length,
    amostra_sem_obra: semObra.slice(0, 10),
    atribuicoes_manuais_respeitadas: existenteMap.size,
    sem_escala_configurada: Array.from(new Set(semEscala)).slice(0, 10),
    erros,
  })
}
