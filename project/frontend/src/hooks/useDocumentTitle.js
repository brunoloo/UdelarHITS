import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { BASE_TITLE } from '../utils/pageTitle'
import { reportPageView } from '../utils/analytics'

// Fija el título al navegar en la SPA; el servidor solo lo inyecta en la carga inicial.
// `ready`: las vistas con datos async pasan !isLoading para que el page_view salga con el título definitivo.
export function useDocumentTitle(title, ready = true) {
  const location = useLocation()
  const path = location.pathname + location.search
  const resolved = title || BASE_TITLE

  // Se fija apenas se conoce, para no arrastrar el de la vista anterior.
  useEffect(() => {
    document.title = resolved
  }, [resolved])

  // Reporta el título ya resuelto para que RootLayout emita el page_view con él.
  useEffect(() => {
    if (ready) reportPageView(path, resolved)
  }, [ready, resolved, path])
}
