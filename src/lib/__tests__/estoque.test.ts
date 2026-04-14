/**
 * estoque.ts — processarSaidaFIFO
 *
 * This module depends on Supabase client for DB operations.
 * Tests use a mock Supabase client to verify the FIFO logic
 * without requiring a real database connection.
 */
import { describe, it, expect, vi } from 'vitest'
import { processarSaidaFIFO } from '../estoque'

function createMockSupabase(lotes: Array<{ id: string; quantidade_disponivel: number; custo_unitario: number }>) {
  const updates: Array<{ id: string; data: any }> = []

  const mock: any = {
    from: vi.fn((table: string) => {
      if (table === 'estoque_lotes') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => Promise.resolve({ data: lotes })),
              })),
            })),
          })),
          update: vi.fn((data: any) => ({
            eq: vi.fn((col: string, id: string) => {
              updates.push({ id, data })
              return Promise.resolve({ error: null })
            }),
          })),
        }
      }
      if (table === 'estoque_itens') {
        return {
          update: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ error: null })),
          })),
        }
      }
      return {}
    }),
    _updates: updates,
  }
  return mock
}

describe('processarSaidaFIFO', () => {
  it('consome do primeiro lote (FIFO) quando suficiente', async () => {
    const supabase = createMockSupabase([
      { id: 'lote-1', quantidade_disponivel: 10, custo_unitario: 5.0 },
      { id: 'lote-2', quantidade_disponivel: 20, custo_unitario: 6.0 },
    ])

    const result = await processarSaidaFIFO(supabase, 'item-1', 5)

    expect(result.sucesso).toBe(true)
    expect(result.custo_total).toBe(25.0) // 5 * 5.0
    expect(result.custo_medio).toBe(5.0)
    expect(result.lotes).toHaveLength(1)
    expect(result.lotes[0].lote_id).toBe('lote-1')
    expect(result.lotes[0].qtd).toBe(5)
  })

  it('consome de múltiplos lotes quando necessário', async () => {
    const supabase = createMockSupabase([
      { id: 'lote-1', quantidade_disponivel: 3, custo_unitario: 10.0 },
      { id: 'lote-2', quantidade_disponivel: 5, custo_unitario: 12.0 },
    ])

    const result = await processarSaidaFIFO(supabase, 'item-1', 5)

    expect(result.sucesso).toBe(true)
    // 3*10 + 2*12 = 30 + 24 = 54
    expect(result.custo_total).toBe(54.0)
    expect(result.custo_medio).toBeCloseTo(10.8, 2)
    expect(result.lotes).toHaveLength(2)
    expect(result.lotes[0]).toEqual({ lote_id: 'lote-1', qtd: 3, custo: 10.0 })
    expect(result.lotes[1]).toEqual({ lote_id: 'lote-2', qtd: 2, custo: 12.0 })
  })

  it('retorna erro quando estoque insuficiente', async () => {
    const supabase = createMockSupabase([
      { id: 'lote-1', quantidade_disponivel: 2, custo_unitario: 10.0 },
    ])

    const result = await processarSaidaFIFO(supabase, 'item-1', 5)

    expect(result.sucesso).toBe(false)
    expect(result.erro).toContain('insuficiente')
  })

  it('retorna erro quando não há lotes disponíveis', async () => {
    const supabase = createMockSupabase([])

    const result = await processarSaidaFIFO(supabase, 'item-1', 1)

    expect(result.sucesso).toBe(false)
    expect(result.erro).toBe('Sem estoque disponível')
  })
})
