/**
 * Rate limiter simples em memória (in-process).
 * Funciona numa única instância Vercel serverless — adequado para tráfego baixo/médio.
 * Para escala maior, trocar por @upstash/ratelimit com Redis.
 */

const buckets = new Map<string, { count: number; resetAt: number }>()

export interface RateLimitOptions {
  /** Quantas requisições permitidas na janela */
  limit: number
  /** Janela em milissegundos (ex: 60_000 = 1 min) */
  windowMs: number
}

export function rateLimit(key: string, opts: RateLimitOptions): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs })
    return { allowed: true, remaining: opts.limit - 1, resetAt: now + opts.windowMs }
  }

  if (bucket.count >= opts.limit) {
    return { allowed: false, remaining: 0, resetAt: bucket.resetAt }
  }

  bucket.count++
  return { allowed: true, remaining: opts.limit - bucket.count, resetAt: bucket.resetAt }
}

/**
 * Limpa buckets expirados (pode ser chamado periodicamente).
 * Não é estritamente necessário porque entries expirados são reiniciados no próximo hit.
 */
export function cleanExpiredBuckets() {
  const now = Date.now()
  buckets.forEach((bucket, key) => {
    if (bucket.resetAt < now) buckets.delete(key)
  })
}
