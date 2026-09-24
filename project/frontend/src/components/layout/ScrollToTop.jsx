import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// Al cambiar de página, arrancar desde el tope (el navegador conserva el scroll
// entre rutas de una SPA).
//
// Excepción: las navegaciones marcadas con state.threadMove, que son las
// reescrituras de URL que hace el permalink mientras el usuario se mueve por el
// hilo (ver CommentPage). No cambia de página: mandarla al tope sería un salto de
// scroll en el medio de la lectura. La excepción se marca EN LA NAVEGACIÓN y no se
// infiere del patrón de ruta a propósito: /comment/A → /comment/B puede ser tanto
// una reescritura interna (no debe scrollear) como una navegación real desde una
// notificación (sí debe scrollear), y comparar rutas las confundiría.
export function ScrollToTop() {
  const { pathname, state } = useLocation()
  useEffect(() => {
    if (state?.threadMove) return
    window.scrollTo(0, 0)
  }, [pathname, state])
  return null
}
