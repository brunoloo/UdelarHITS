import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// Al cambiar de página se vuelve al tope. Excepción: las navegaciones con state.threadMove,
// que son reescrituras de URL dentro de un hilo (ver CommentPage). Se marca en la navegación
// porque la ruta sola no distingue una reescritura de una navegación real.
export function ScrollToTop() {
  const { pathname, state } = useLocation()
  useEffect(() => {
    if (state?.threadMove) return
    window.scrollTo(0, 0)
  }, [pathname, state])
  return null
}
