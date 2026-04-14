import { describe, it, expect } from 'vitest'
import { calcularINSS, calcularIRRF, calcularDescontoVT, calcularDescontosCLT } from '../clt'

// ══════════════════════════════════════════════════════════════
// INSS — Tabela Progressiva 2025/2026
// Faixas: 7.5% até 1518 | 9% até 2793.88 | 12% até 4190.83 | 14% até 8157.41
// ══════════════════════════════════════════════════════════════
describe('calcularINSS', () => {
  it('salário mínimo R$1.518 → 7,5% = R$113,85', () => {
    expect(calcularINSS(1518)).toBe(113.85)
  })

  it('R$2.793,88 (topo da 2ª faixa) → progressivo', () => {
    // Faixa 1: 1518 * 0.075 = 113.85
    // Faixa 2: (2793.88 - 1518) * 0.09 = 1275.88 * 0.09 = 114.829…
    const esperado = Math.round((1518 * 0.075 + (2793.88 - 1518) * 0.09) * 100) / 100
    expect(calcularINSS(2793.88)).toBe(esperado)
  })

  it('R$5.000 → progressivo por 4 faixas', () => {
    // Faixa 1: 1518 * 0.075 = 113.85
    // Faixa 2: (2793.88 - 1518) * 0.09 = 114.8292
    // Faixa 3: (4190.83 - 2793.88) * 0.12 = 167.634
    // Faixa 4: (5000 - 4190.83) * 0.14 = 113.2838
    const esperado = Math.round(
      (1518 * 0.075 +
        (2793.88 - 1518) * 0.09 +
        (4190.83 - 2793.88) * 0.12 +
        (5000 - 4190.83) * 0.14) * 100
    ) / 100
    expect(calcularINSS(5000)).toBe(esperado)
  })

  it('R$10.000 (acima do teto R$8.157,41) → desconto limitado ao teto', () => {
    // Mesmo resultado que calcular com 8157.41
    expect(calcularINSS(10000)).toBe(calcularINSS(8157.41))
  })

  it('salário R$0 → R$0', () => {
    expect(calcularINSS(0)).toBe(0)
  })
})

// ══════════════════════════════════════════════════════════════
// IRRF — Tabela Progressiva 2025/2026
// Base = bruto - INSS - (dependentes * 189.59)
// ══════════════════════════════════════════════════════════════
describe('calcularIRRF', () => {
  it('base abaixo de R$2.259,20 → isento (R$0)', () => {
    // bruto 2500, INSS ~200 → base ~2300, but let's compute INSS precisely
    // Use a salary where base < 2259.20
    const inss = calcularINSS(2400)
    // base = 2400 - inss; if > 2259.20 use lower salary
    // Let's pick salary=2000, inss = calcularINSS(2000)
    const inss2 = calcularINSS(2000)
    // base = 2000 - inss2 ≈ 2000 - 150 = ~1850 → isento
    expect(calcularIRRF(2000, inss2)).toBe(0)
  })

  it('base R$3.000 → faixa 15%', () => {
    // We pass bruto and inss such that base = 3000
    // base = bruto - inss - deps*189.59
    // Let's set bruto=3000, inss=0, deps=0 → base=3000
    const imposto = Math.round((3000 * 0.15 - 381.44) * 100) / 100
    expect(calcularIRRF(3000, 0, 0)).toBe(imposto)
  })

  it('base R$5.000 → faixa 27,5%', () => {
    const imposto = Math.round((5000 * 0.275 - 896.00) * 100) / 100
    expect(calcularIRRF(5000, 0, 0)).toBe(imposto)
  })

  it('com 2 dependentes reduz a base de cálculo', () => {
    // bruto=5000, inss=0, deps=2 → base = 5000 - 0 - 2*189.59 = 4620.82
    // Faixa: até 4664.68 → 22,5% - 662.77
    const base = 5000 - 2 * 189.59
    const imposto = Math.round((base * 0.225 - 662.77) * 100) / 100
    expect(calcularIRRF(5000, 0, 2)).toBe(imposto)
  })
})

// ══════════════════════════════════════════════════════════════
// Desconto VT — 6% do salário base, limitado ao VT mensal
// ══════════════════════════════════════════════════════════════
describe('calcularDescontoVT', () => {
  it('salário R$2.000, VT R$200 → min(R$120, R$200) = R$120', () => {
    expect(calcularDescontoVT(2000, 200)).toBe(120)
  })

  it('salário R$2.000, VT R$100 → min(R$120, R$100) = R$100', () => {
    expect(calcularDescontoVT(2000, 100)).toBe(100)
  })
})

// ══════════════════════════════════════════════════════════════
// Cálculo completo CLT (holerite)
// ══════════════════════════════════════════════════════════════
describe('calcularDescontosCLT', () => {
  it('salário R$3.268, 20 dias, insalubridade 20% → bruto ≠ líquido', () => {
    const result = calcularDescontosCLT({
      salarioBase: 3268,
      diasTrabalhados: 20,
      diasMes: 30,
      insalubridadePct: 20,
    })
    // Salário proporcional = 3268 * 20/30 = 2178.67
    expect(result.salario_proporcional).toBeCloseTo(2178.67, 2)
    // Insalubridade = 1518 * 0.20 = 303.60
    expect(result.insalubridade).toBe(303.6)
    // Total proventos = 2178.67 + 303.60
    expect(result.total_proventos).toBeGreaterThan(0)
    // Líquido < bruto
    expect(result.valor_liquido).toBeLessThan(result.total_proventos)
    // Descontos are positive
    expect(result.desconto_inss).toBeGreaterThan(0)
    expect(result.total_descontos).toBeGreaterThan(0)
  })

  it('0 dias trabalhados → salário proporcional R$0', () => {
    const result = calcularDescontosCLT({
      salarioBase: 3000,
      diasTrabalhados: 0,
    })
    expect(result.salario_proporcional).toBe(0)
    expect(result.total_proventos).toBe(0)
    expect(result.desconto_inss).toBe(0)
    expect(result.valor_liquido).toBe(0)
  })

  it('salário no teto INSS → desconto INSS igual ao teto', () => {
    const result = calcularDescontosCLT({
      salarioBase: 10000,
      diasTrabalhados: 30,
    })
    // INSS sobre 10000 = INSS sobre teto 8157.41
    expect(result.desconto_inss).toBe(calcularINSS(8157.41))
  })

  it('mês completo (30/30) → salário proporcional = salário base', () => {
    const result = calcularDescontosCLT({
      salarioBase: 5000,
      diasTrabalhados: 30,
    })
    expect(result.salario_proporcional).toBe(5000)
  })
})
