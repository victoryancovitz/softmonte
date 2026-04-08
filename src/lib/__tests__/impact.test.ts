import { describe, it, expect } from 'vitest'
import { calcularImpacto } from '../impact'

describe('calcularImpacto', () => {
  it('retorna lista vazia para entidade desconhecida', async () => {
    const mockSupabase = {} as any
    const result = await calcularImpacto(mockSupabase, 'entidade_inexistente', 'fake-id')
    expect(result).toEqual([])
  })

  it('lida com erro no cálculo silenciosamente', async () => {
    const mockSupabase = {
      from: () => { throw new Error('falha') },
    } as any
    const result = await calcularImpacto(mockSupabase, 'funcao', 'fake-id')
    expect(result).toEqual([])
  })
})
