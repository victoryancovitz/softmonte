/**
 * Cálculos CLT — descontos do empregado
 * Tabelas vigentes 2025/2026 (atualizadas conforme Portaria MPS)
 */

// ══════ INSS EMPREGADO — Tabela Progressiva 2025/2026 ══════
// Faixas: alíquota aplica-se APENAS à parcela dentro da faixa
const INSS_FAIXAS = [
  { ate: 1518.00, aliquota: 0.075 },
  { ate: 2793.88, aliquota: 0.09 },
  { ate: 4190.83, aliquota: 0.12 },
  { ate: 8157.41, aliquota: 0.14 },
]
const TETO_INSS = 8157.41

export function calcularINSS(salarioBruto: number): number {
  const base = Math.min(salarioBruto, TETO_INSS)
  let desconto = 0
  let anterior = 0

  for (const faixa of INSS_FAIXAS) {
    if (base <= anterior) break
    const faixaMax = Math.min(base, faixa.ate)
    desconto += (faixaMax - anterior) * faixa.aliquota
    anterior = faixa.ate
  }

  return Math.round(desconto * 100) / 100
}

// ══════ IRRF — Tabela Progressiva 2025/2026 ══════
// Base de cálculo = Salário bruto - INSS - Dependentes (R$ 189,59/dep)
const DEDUCAO_DEPENDENTE = 189.59

const IRRF_FAIXAS = [
  { ate: 2259.20, aliquota: 0, deducao: 0 },
  { ate: 2826.65, aliquota: 0.075, deducao: 169.44 },
  { ate: 3751.05, aliquota: 0.15, deducao: 381.44 },
  { ate: 4664.68, aliquota: 0.225, deducao: 662.77 },
  { ate: Infinity, aliquota: 0.275, deducao: 896.00 },
]

export function calcularIRRF(salarioBruto: number, descontoINSS: number, dependentes: number = 0): number {
  const baseCalculo = salarioBruto - descontoINSS - (dependentes * DEDUCAO_DEPENDENTE)
  if (baseCalculo <= IRRF_FAIXAS[0].ate) return 0

  for (const faixa of IRRF_FAIXAS) {
    if (baseCalculo <= faixa.ate) {
      const imposto = baseCalculo * faixa.aliquota - faixa.deducao
      return Math.max(Math.round(imposto * 100) / 100, 0)
    }
  }

  // Última faixa (>4664.68)
  const ultima = IRRF_FAIXAS[IRRF_FAIXAS.length - 1]
  const imposto = baseCalculo * ultima.aliquota - ultima.deducao
  return Math.max(Math.round(imposto * 100) / 100, 0)
}

// ══════ DESCONTO VT — 6% do salário base ══════
export function calcularDescontoVT(salarioBase: number, vtMensal: number): number {
  // CLT: desconto máximo de 6% do salário base, limitado ao valor do VT
  const desconto6pct = salarioBase * 0.06
  return Math.round(Math.min(desconto6pct, vtMensal) * 100) / 100
}

// ══════ Cálculo completo do holerite ══════
export interface DescontosCLT {
  salario_proporcional: number
  insalubridade: number
  periculosidade: number
  total_proventos: number
  desconto_inss: number
  desconto_irrf: number
  desconto_vt: number
  total_descontos: number
  valor_liquido: number
}

export function calcularDescontosCLT(params: {
  salarioBase: number
  diasTrabalhados: number
  diasMes?: number
  insalubridadePct?: number
  periculosidadePct?: number
  vtMensal?: number
  horasExtras50Valor?: number
  horasExtras100Valor?: number
  adicionalNoturnoValor?: number
  dependentes?: number
}): DescontosCLT {
  const {
    salarioBase, diasTrabalhados, diasMes = 30,
    insalubridadePct = 0, periculosidadePct = 0,
    vtMensal = 0, horasExtras50Valor = 0, horasExtras100Valor = 0,
    adicionalNoturnoValor = 0, dependentes = 0,
  } = params

  // Salário proporcional aos dias trabalhados
  const salProporcional = diasTrabalhados < diasMes
    ? Math.round(salarioBase * diasTrabalhados / diasMes * 100) / 100
    : salarioBase

  // Adicionais (insalubridade sobre salário mínimo 2025 = R$1.518)
  const insalubridade = insalubridadePct > 0 ? Math.round(1518 * insalubridadePct / 100 * 100) / 100 : 0
  const periculosidade = periculosidadePct > 0 ? Math.round(salarioBase * periculosidadePct / 100 * 100) / 100 : 0

  // Total proventos (base para INSS)
  const totalProventos = salProporcional + insalubridade + periculosidade + horasExtras50Valor + horasExtras100Valor + adicionalNoturnoValor

  // Descontos
  const descontoINSS = calcularINSS(totalProventos)
  const descontoIRRF = calcularIRRF(totalProventos, descontoINSS, dependentes)
  const descontoVT = vtMensal > 0 ? calcularDescontoVT(salarioBase, vtMensal) : 0

  const totalDescontos = descontoINSS + descontoIRRF + descontoVT
  const valorLiquido = Math.round((totalProventos - totalDescontos) * 100) / 100

  return {
    salario_proporcional: salProporcional,
    insalubridade,
    periculosidade,
    total_proventos: Math.round(totalProventos * 100) / 100,
    desconto_inss: descontoINSS,
    desconto_irrf: descontoIRRF,
    desconto_vt: descontoVT,
    total_descontos: Math.round(totalDescontos * 100) / 100,
    valor_liquido: valorLiquido,
  }
}
