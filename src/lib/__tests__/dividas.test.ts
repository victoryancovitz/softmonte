import { describe, it, expect } from 'vitest'
import { gerarTabelaAmortizacao } from '../dividas'

const BASE_PARAMS = {
  valor: 10000,
  taxaMensal: 0.01,
  nParcelas: 12,
  dataInicio: '2025-01-15',
}

describe('gerarTabelaAmortizacao — PRICE', () => {
  const parcelas = gerarTabelaAmortizacao({ ...BASE_PARAMS, sistema: 'price' })

  it('gera 12 parcelas', () => {
    expect(parcelas).toHaveLength(12)
  })

  it('primeira parcela: saldo_antes = principal', () => {
    expect(parcelas[0].saldo_antes).toBe(10000)
  })

  it('última parcela: saldo_depois ≈ 0', () => {
    expect(parcelas[11].saldo_depois).toBeCloseTo(0, 0)
  })

  it('valor_total (PMT) é constante em todas as parcelas', () => {
    const pmt = parcelas[0].valor_total
    for (const p of parcelas) {
      expect(p.valor_total).toBeCloseTo(pmt, 2)
    }
  })

  it('juros diminuem ao longo do tempo', () => {
    expect(parcelas[0].valor_juros).toBeGreaterThan(parcelas[11].valor_juros)
  })

  it('amortização aumenta ao longo do tempo', () => {
    expect(parcelas[0].valor_amortizacao).toBeLessThan(parcelas[11].valor_amortizacao)
  })
})

describe('gerarTabelaAmortizacao — SAC', () => {
  const parcelas = gerarTabelaAmortizacao({ ...BASE_PARAMS, sistema: 'sac' })

  it('gera 12 parcelas', () => {
    expect(parcelas).toHaveLength(12)
  })

  it('primeira parcela: saldo_antes = principal', () => {
    expect(parcelas[0].saldo_antes).toBe(10000)
  })

  it('última parcela: saldo_depois ≈ 0', () => {
    expect(parcelas[11].saldo_depois).toBeCloseTo(0, 0)
  })

  it('amortização constante ≈ R$833,33', () => {
    const amortEsperada = Math.round(10000 / 12 * 100) / 100
    for (const p of parcelas) {
      expect(p.valor_amortizacao).toBeCloseTo(amortEsperada, 2)
    }
  })

  it('valor_total diminui ao longo do tempo (juros decrescentes)', () => {
    expect(parcelas[0].valor_total).toBeGreaterThan(parcelas[11].valor_total)
  })

  it('juros da primeira parcela = 1% do principal = R$100', () => {
    expect(parcelas[0].valor_juros).toBe(100)
  })
})

describe('gerarTabelaAmortizacao — Bullet', () => {
  const parcelas = gerarTabelaAmortizacao({ ...BASE_PARAMS, sistema: 'bullet' })

  it('gera 12 parcelas', () => {
    expect(parcelas).toHaveLength(12)
  })

  it('primeira parcela: saldo_antes = principal', () => {
    expect(parcelas[0].saldo_antes).toBe(10000)
  })

  it('última parcela: saldo_depois = 0', () => {
    expect(parcelas[11].saldo_depois).toBe(0)
  })

  it('parcelas 1-11: amortização = 0 (só juros)', () => {
    for (let i = 0; i < 11; i++) {
      expect(parcelas[i].valor_amortizacao).toBe(0)
    }
  })

  it('parcelas 1-11: valor_total = juros = R$100 cada', () => {
    for (let i = 0; i < 11; i++) {
      expect(parcelas[i].valor_juros).toBe(100)
      expect(parcelas[i].valor_total).toBe(100)
    }
  })

  it('parcela 12: amortiza o principal inteiro', () => {
    expect(parcelas[11].valor_amortizacao).toBe(10000)
  })

  it('parcela 12: valor_total = principal + juros', () => {
    expect(parcelas[11].valor_total).toBe(10100)
  })
})

describe('gerarTabelaAmortizacao — datas', () => {
  it('datas incrementam mês a mês', () => {
    const parcelas = gerarTabelaAmortizacao({ ...BASE_PARAMS, sistema: 'price' })
    const mes0 = new Date(parcelas[0].data_vencimento)
    const mes1 = new Date(parcelas[1].data_vencimento)
    expect(mes1.getMonth() - mes0.getMonth()).toBe(1)
  })

  it('respeita diaVencimento customizado', () => {
    const parcelas = gerarTabelaAmortizacao({
      ...BASE_PARAMS,
      sistema: 'sac',
      diaVencimento: 5,
    })
    for (const p of parcelas) {
      const dia = new Date(p.data_vencimento + 'T12:00:00').getDate()
      expect(dia).toBe(5)
    }
  })
})
