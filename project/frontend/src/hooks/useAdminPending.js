import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../api/client'
import { useAuth } from './useAuth'

export const ADMIN_PENDING_KEY = ['admin', 'pending-count']

// Igual que el contador de notificaciones: como máximo dos caracteres.
export const formatPending = (n) => (n > 9 ? '+9' : String(n))

// Cuántas cosas esperan a un administrador (apelaciones, reportes de usuario e imágenes
// en revisión). Solo se consulta con rol admin; para el resto, total 0.
export function useAdminPending() {
  const { user } = useAuth()
  const isAdmin = user?.rol === 'admin'

  const { data } = useQuery({
    queryKey: ADMIN_PENDING_KEY,
    queryFn: () => apiGet('/admin/pending-count').then(r => r.data),
    enabled: isAdmin,
    refetchInterval: 60000,
    // El indicador debe reflejar el estado real: sin frescura de cache.
    staleTime: 0,
  })

  return {
    isAdmin,
    total: isAdmin ? (data?.total ?? 0) : 0,
    counts: isAdmin ? data ?? null : null,
  }
}
