import { useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { HOME_FEED_KEY, HOME_COUNT_KEY } from '../api/queryKeys'

// Estando en el inicio, el <Link to="/"> no hace nada: este hook vuelve a la página 1, sin
// filtro y arriba. resetQueries y no invalidate: invalidate refetchearía todas las páginas acumuladas.
export function useGoHome() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()

  return useCallback((event) => {
    // Un clic no simple abre una pestaña nueva: no se intercepta.
    if (event) {
      if (event.defaultPrevented) return
      if (event.button != null && event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      // Si no, el <Link> navegaría por su cuenta y duplicaríamos la navegación.
      event.preventDefault()
    }

    queryClient.resetQueries({ queryKey: HOME_FEED_KEY })
    queryClient.invalidateQueries({ queryKey: HOME_COUNT_KEY })

    // En "/" sin querystring navegar solo duplicaría la entrada del historial.
    if (location.pathname !== '/' || location.search) navigate('/')

    // ScrollToTop depende solo del pathname y acá no se dispara.
    window.scrollTo({ top: 0 })
  }, [navigate, location.pathname, location.search, queryClient])
}
