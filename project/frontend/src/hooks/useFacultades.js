import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../api/client'

// Catálogo de facultades de la Udelar: el grupo 'Facultades' de las etiquetas.
// El endpoint es público (no pasa por `protect`), así que también sirve en el
// registro y en el alta con Google, que corren sin sesión.
//
// Misma queryKey y staleTime que el resto de los consumidores del catálogo de
// etiquetas (CategoryPage, CreateCategoryPanel) para compartir caché.
export function useFacultades({ enabled = true } = {}) {
  const { data = {} } = useQuery({
    queryKey: ['categories', 'etiquetas'],
    queryFn: () => apiGet('/categories/etiquetas').then(r => r.data),
    staleTime: 5 * 60 * 1000,
    enabled,
  })

  return data.Facultades || []
}
