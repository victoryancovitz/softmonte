import { describe, it, expect, beforeEach } from 'vitest'
import { rateLimit, cleanExpiredBuckets } from '../rate-limit'

describe('rateLimit', () => {
  beforeEach(() => cleanExpiredBuckets())

  it('permite requisições dentro do limite', () => {
    const key = 'test-basic-' + Date.now()
    const r1 = rateLimit(key, { limit: 3, windowMs: 60_000 })
    const r2 = rateLimit(key, { limit: 3, windowMs: 60_000 })
    const r3 = rateLimit(key, { limit: 3, windowMs: 60_000 })

    expect(r1.allowed).toBe(true)
    expect(r1.remaining).toBe(2)
    expect(r2.allowed).toBe(true)
    expect(r2.remaining).toBe(1)
    expect(r3.allowed).toBe(true)
    expect(r3.remaining).toBe(0)
  })

  it('bloqueia após atingir o limite', () => {
    const key = 'test-block-' + Date.now()
    rateLimit(key, { limit: 2, windowMs: 60_000 })
    rateLimit(key, { limit: 2, windowMs: 60_000 })
    const r3 = rateLimit(key, { limit: 2, windowMs: 60_000 })

    expect(r3.allowed).toBe(false)
    expect(r3.remaining).toBe(0)
  })

  it('isola buckets por chave diferente', () => {
    const key1 = 'user-1-' + Date.now()
    const key2 = 'user-2-' + Date.now()
    rateLimit(key1, { limit: 1, windowMs: 60_000 })
    const r = rateLimit(key2, { limit: 1, windowMs: 60_000 })
    expect(r.allowed).toBe(true)
  })
})
