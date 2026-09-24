import { useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { HOME_FEED_KEY, HOME_COUNT_KEY } from '../api/queryKeys'

// Todos los accesos al inicio (logo del header, "Inicio" del LeftNav/BottomNav/
// drawer, breadcrumbs) son <Link to="/">. Estando ya en el home ese link era un
// no-op: no scrollea al tope, no refresca el feed y no limpia ?etiqueta=. Este
// hook le da el comportamiento que el usuario espera de "volver al inicio":
// feed desde la página 1, sin filtro y arriba de todo — todo en SPA, sin
// recargar la página.
//
// resetQueries y no invalidateQueries para el feed: invalidate refetchearía las
// N páginas acumuladas del infinite query y las seguiría mostrando (el usuario
// quedaría con 200 items cargados). reset lo devuelve a la página 1.
export function useGoHome() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()

  return useCallback((event) => {
    // Click "no simple" (middle-click, ctrl/cmd/shift/alt): es "abrir en pestaña
    // nueva". No lo interceptamos — el navegador sigue el href del <Link>.
    if (event) {
      if (event.defaultPrevented) return
      if (event.button != null && event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      // Si no, el <Link> navegaría por su cuenta y duplicaríamos la navegación.
      event.preventDefault()
    }

    queryClient.resetQueries({ queryKey: HOME_FEED_KEY })
    queryClient.invalidateQueries({ queryKey: HOME_COUNT_KEY })

    // Estando exactamente en "/" (sin querystring) navegar solo agregaría una
    // entrada de history idéntica. Desde "/?etiqueta=FING" sí navegamos: es lo
    // que limpia el filtro.
    if (location.pathname !== '/' || location.search) navigate('/')

    // ScrollToTop (AppLayout) depende solo de pathname, así que no dispara ni al
    // ir de "/?etiqueta=FING" a "/" ni al quedarse en "/". Mismo patrón que el
    // CTA del empty state del feed.
    window.scrollTo({ top: 0 })
  }, [navigate, location.pathname, location.search, queryClient])
}
