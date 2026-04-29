'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

export type Role = 'admin' | 'rh' | 'financeiro' | 'juridico' | 'engenharia' | 'compras' | 'visualizador'

const PODE_EDITAR: Record<string, Role[]> = {
  rh: ['rh'], folha: ['rh'], ponto: ['rh'],
  lancamentos: ['financeiro'], dividas: ['financeiro'], contas: ['financeiro'], dre: ['financeiro'],
  obras: ['engenharia'], bms: ['engenharia'], alocacoes: ['engenharia'],
  processos: ['juridico'], acordos: ['juridico'],
  fornecedores: ['compras', 'financeiro'], estoque: ['compras'],
  cadastros: ['rh', 'financeiro', 'juridico', 'engenharia', 'compras'],
}

export function useUserRole() {
  const [role, setRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('user_roles').select('role').eq('ativo', true).maybeSingle()
      .then(({ data }) => {
        setRole((data?.role as Role) ?? 'visualizador')
        setLoading(false)
      })
  }, [])

  return {
    role, loading,
    isAdmin: role === 'admin',
    canEdit: (modulo: string) => role === 'admin' || (role !== null && (PODE_EDITAR[modulo] ?? []).includes(role)),
    canRead: (modulo: string) => role !== null && !['audit_log', 'user_roles'].includes(modulo),
  }
}
