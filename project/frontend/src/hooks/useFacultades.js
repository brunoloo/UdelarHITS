import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../api/client'

// El endpoint es público: sirve también en el registro. Misma queryKey que el resto del
// catálogo de etiquetas, para compartir caché.
export function useFacultades({ enabled = true } = {}) {
  const { data = {} } = useQuery({
    queryKey: ['categories', 'etiquetas'],
    queryFn: () => apiGet('/categories/etiquetas').then(r => r.data),
    staleTime: 5 * 60 * 1000,
    enabled,
  })

  return data.Facultades || []
}
