/**
 * Utilitário central de dias úteis brasileiros.
 * Usado por: forecast, ponto, folha, BM.
 */

/** Páscoa pelo algoritmo de Meeus/Jones/Butcher */
function calcularPascoa(ano: number): Date {
  const a = ano % 19
  const b = Math.floor(ano / 100)
  const c = ano % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(ano, mes - 1, dia)
}

/** Feriados nacionais brasileiros (fixos + móveis) */
export function feriadosNacionais(ano: number): Date[] {
  const pascoa = calcularPascoa(ano)
  const carnaval = new Date(pascoa)
  carnaval.setDate(carnaval.getDate() - 47) // terça de carnaval
  const carnavalSeg = new Date(carnaval)
  carnavalSeg.setDate(carnavalSeg.getDate() - 1) // segunda
  const sextaSanta = new Date(pascoa)
  sextaSanta.setDate(sextaSanta.getDate() - 2)
  const corpusChristi = new Date(pascoa)
  corpusChristi.setDate(corpusChristi.getDate() + 60)

  return [
    new Date(ano, 0, 1),    // Ano Novo
    carnavalSeg,             // Segunda de Carnaval
    carnaval,                // Terça de Carnaval
    sextaSanta,              // Sexta-feira Santa
    new Date(ano, 3, 21),   // Tiradentes
    new Date(ano, 4, 1),    // Dia do Trabalho
    corpusChristi,           // Corpus Christi
    new Date(ano, 8, 7),    // Independência
    new Date(ano, 9, 12),   // Nossa Senhora Aparecida
    new Date(ano, 10, 2),   // Finados
    new Date(ano, 10, 15),  // Proclamação da República
    new Date(ano, 11, 25),  // Natal
  ]
}

export interface DiasUteisOpcoes {
  consideraSabado?: boolean
  consideraDomingo?: boolean
  consideraFeriados?: boolean // true = conta feriados como dia útil
}

/**
 * Conta dias úteis entre duas datas (inclusive).
 * Por padrão: seg-sex, descontando feriados.
 */
export function contarDiasUteis(
  inicio: Date,
  fim: Date,
  opcoes: DiasUteisOpcoes = {}
): number {
  const {
    consideraSabado = false,
    consideraDomingo = false,
    consideraFeriados = false,
  } = opcoes

  if (inicio > fim) return 0

  // Coleta feriados dos anos envolvidos
  const anos = new Set<number>()
  const cur = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate())
  const fimNorm = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate())
  let temp = new Date(cur)
  while (temp <= fimNorm) {
    anos.add(temp.getFullYear())
    temp.setMonth(temp.getMonth() + 1)
  }
  anos.add(fimNorm.getFullYear())

  const feriadosSet = new Set<string>()
  Array.from(anos).forEach(a => {
    feriadosNacionais(a).forEach(f => {
      feriadosSet.add(f.toDateString())
    })
  })

  let count = 0
  const atual = new Date(cur)
  while (atual <= fimNorm) {
    const dow = atual.getDay() // 0=dom, 6=sab
    const ehFeriado = feriadosSet.has(atual.toDateString())

    const contabilizar =
      (dow >= 1 && dow <= 5) ||
      (dow === 6 && consideraSabado) ||
      (dow === 0 && consideraDomingo)

    const descontar = ehFeriado && !consideraFeriados

    if (contabilizar && !descontar) count++

    atual.setDate(atual.getDate() + 1)
  }
  return count
}

/**
 * Calcula fator pro-rata de um mês para uma obra com início/fim parcial.
 * Retorna fator (0-1), dias úteis totais do mês, e dias úteis ativos.
 */
export function calcularFatorMes(
  dataInicioObra: Date,
  dataFimObra: Date,
  mes: number,
  ano: number,
  opcoes: DiasUteisOpcoes = {}
): {
  fator: number
  diasUteisMes: number
  diasUteisAtivos: number
} {
  const primeiroDia = new Date(ano, mes - 1, 1)
  const ultimoDia = new Date(ano, mes, 0)

  const diasUteisMes = contarDiasUteis(primeiroDia, ultimoDia, opcoes)

  const inicioEfetivo = dataInicioObra > primeiroDia ? dataInicioObra : primeiroDia
  const fimEfetivo = dataFimObra < ultimoDia ? dataFimObra : ultimoDia

  const diasUteisAtivos = inicioEfetivo <= fimEfetivo
    ? contarDiasUteis(inicioEfetivo, fimEfetivo, opcoes)
    : 0

  return {
    fator: diasUteisMes > 0 ? diasUteisAtivos / diasUteisMes : 0,
    diasUteisMes,
    diasUteisAtivos,
  }
}
