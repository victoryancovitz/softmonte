/**
 * Logger unificado para a plataforma.
 *
 * Hoje: grava no console do server (visível nos logs do Vercel).
 * Futuro: quando NEXT_PUBLIC_SENTRY_DSN estiver setado, exportar pro Sentry
 * via @sentry/nextjs (dependência não instalada ainda para manter bundle enxuto).
 *
 * Uso:
 *   import { logError, logInfo } from '@/lib/logger'
 *   try { ... } catch (e) { logError('folha-fechamento', e, { obra_id, ano, mes }) }
 */

type Context = Record<string, any>

export function logError(tag: string, error: unknown, context?: Context) {
  const msg = error instanceof Error ? error.message : String(error)
  const stack = error instanceof Error ? error.stack : undefined
  // eslint-disable-next-line no-console
  console.error(`[${tag}] ${msg}`, { context, stack })
  // TODO quando instalar @sentry/nextjs:
  //   Sentry.captureException(error, { tags: { source: tag }, extra: context })
}

export function logWarn(tag: string, message: string, context?: Context) {
  // eslint-disable-next-line no-console
  console.warn(`[${tag}] ${message}`, context)
}

export function logInfo(tag: string, message: string, context?: Context) {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.log(`[${tag}] ${message}`, context)
  }
}

export function logAudit(tag: string, action: string, context: Context) {
  // eslint-disable-next-line no-console
  console.log(`[AUDIT:${tag}] ${action}`, context)
  // TODO: persistir em tabela audit_log quando fizer sentido
}
