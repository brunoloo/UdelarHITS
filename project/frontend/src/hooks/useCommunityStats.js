import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../api/client'
import { COMMUNITY_STATS_KEY } from '../api/queryKeys'

// Orden y rótulos compartidos por la tarjeta del sidebar y la franja de móvil.
export const COMMUNITY_ROWS = [
  { key: 'miembros', label: 'Miembros', singular: 'miembro', plural: 'miembros' },
  { key: 'categorias', label: 'Categorías', singular: 'categoría', plural: 'categorías' },
  { key: 'comentarios', label: 'Comentarios', singular: 'comentario', plural: 'comentarios' },
  { key: 'temas', label: 'Temas', singular: 'tema', plural: 'temas' },
]

export function useCommunityStats() {
  return useQuery({
    queryKey: COMMUNITY_STATS_KEY,
    queryFn: () => apiGet('/stats/community').then(r => r.data),
    staleTime: 60 * 1000,
  })
}
