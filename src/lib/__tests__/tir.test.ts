import { describe, it, expect } from 'vitest'
import { calcularTIR, anualizarTaxa, interpretarTIR, interpretarRetorno, interpretarFCFY } from '../tir'

describe('calcularTIR', () => {
  it('fluxo [-1000, 200x6] → TIR mensal positiva ~5-6%', () => {
    const tir = calcularTIR([-1000, 200, 200, 200, 200, 200, 200])
    expect(tir).not.toBeNull()
    expect(tir!).toBeGreaterThan(0.04)
    expect(tir!).toBeLessThan(0.07)
  })

  it('fluxo [-1000, 1100] → TIR = 10%', () => {
    const tir = calcularTIR([-1000, 1100])
    expect(tir).not.toBeNull()
    expect(tir!).toBeCloseTo(0.10, 3)
  })

  it('fluxo [-1000, -500] → null ou negativo (sem retorno positivo)', () => {
    const tir = calcularTIR([-1000, -500])
    // Newton-Raphson won't converge or returns null for all-negative flows
    if (tir !== null) {
      expect(tir).toBeLessThan(0)
    }
  })

  it('fluxo com único valor [100] → null (precisa de ao menos 2)', () => {
    expect(calcularTIR([100])).toBeNull()
  })

  it('fluxo vazio [] → null', () => {
    expect(calcularTIR([])).toBeNull()
  })
})

describe('anualizarTaxa', () => {
  it('1% mensal → ~12,68% anual', () => {
    const anual = anualizarTaxa(0.01)
    expect(anual).toBeCloseTo(0.1268, 3)
  })

  it('0% mensal → 0% anual', () => {
    expect(anualizarTaxa(0)).toBe(0)
  })

  it('10% mensal → ~213,8% anual', () => {
    const anual = anualizarTaxa(0.10)
    expect(anual).toBeCloseTo(Math.pow(1.10, 12) - 1, 4)
  })
})

describe('interpretarTIR', () => {
  it('null → label "—"', () => {
    expect(interpretarTIR(null).label).toBe('—')
  })

  it('TIR negativa → "Negativa"', () => {
    expect(interpretarTIR(-0.05).label).toBe('Negativa')
  })

  it('TIR 5% (< 10.5%) → "Abaixo do CDI"', () => {
    expect(interpretarTIR(0.05).label).toBe('Abaixo do CDI')
  })

  it('TIR 20% → "Adequada"', () => {
    expect(interpretarTIR(0.20).label).toBe('Adequada')
  })

  it('TIR 50% → "Boa"', () => {
    expect(interpretarTIR(0.50).label).toBe('Boa')
  })

  it('TIR 150% → "Excelente"', () => {
    expect(interpretarTIR(1.50).label).toBe('Excelente')
  })
})

describe('interpretarRetorno', () => {
  it('null → "—"', () => {
    expect(interpretarRetorno(null).label).toBe('—')
  })

  it('negativo → "Negativo"', () => {
    expect(interpretarRetorno(-5).label).toBe('Negativo')
  })

  it('10% → "Baixo"', () => {
    expect(interpretarRetorno(10).label).toBe('Baixo')
  })
})

describe('interpretarFCFY', () => {
  it('null → "—"', () => {
    expect(interpretarFCFY(null).label).toBe('—')
  })

  it('negativo → "Negativo"', () => {
    expect(interpretarFCFY(-1).label).toBe('Negativo')
  })

  it('12% → "Atrativo"', () => {
    expect(interpretarFCFY(12).label).toBe('Atrativo')
  })
})
