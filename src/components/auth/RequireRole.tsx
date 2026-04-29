'use client'
import { useUserRole, Role } from '@/lib/hooks/useUserRole'

export function RequireRole({ roles, children, fallback = null }: {
  roles: Role[]
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  const { role, loading } = useUserRole()
  if (loading) return null
  if (role === 'admin') return <>{children}</>
  if (role && roles.includes(role)) return <>{children}</>
  return <>{fallback}</>
}

export function HideForRole({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { role, loading } = useUserRole()
  if (loading) return null
  if (role && roles.includes(role)) return null
  return <>{children}</>
}
