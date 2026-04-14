'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'

interface QueryResult<T> {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => void
}

/**
 * Hook for client-side Supabase queries with loading/error/retry.
 *
 * Usage:
 *   const { data, loading, error, refetch } = useSupabaseQuery(
 *     (supabase) => supabase.from('table').select('*').eq('id', id),
 *     [id] // deps
 *   )
 */
export function useSupabaseQuery<T = any>(
  queryFn: (supabase: ReturnType<typeof createClient>) => PromiseLike<{ data: T | null; error: any }>,
  deps: any[] = []
): QueryResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const execute = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: result, error: err } = await queryFn(supabase)
      if (err) {
        setError(err.message || 'Erro ao carregar dados')
        setData(null)
      } else {
        setData(result)
      }
    } catch (e: any) {
      setError(e.message || 'Erro de conexão')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { execute() }, [execute])

  return { data, loading, error, refetch: execute }
}

/**
 * Hook for Supabase mutations with loading state and error handling.
 *
 * Usage:
 *   const { mutate, loading, error } = useSupabaseMutation()
 *   await mutate(async (supabase) => {
 *     await supabase.from('table').insert({ ... })
 *   })
 */
export function useSupabaseMutation() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mutate = useCallback(async (
    fn: (supabase: ReturnType<typeof createClient>) => Promise<any>
  ) => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const result = await fn(supabase)
      return result
    } catch (e: any) {
      setError(e.message || 'Erro ao salvar')
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  return { mutate, loading, error }
}
