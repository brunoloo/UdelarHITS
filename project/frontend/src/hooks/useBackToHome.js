import { useCallback, useEffect, useRef } from 'react'
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { useGoHome } from './useGoHome'

// De dónde se llegó a cada entrada del historial: location.key → pathname de la
// página anterior. Vive a nivel módulo (sobrevive al desmontar páginas) y se
// alimenta desde AppLayout con useTrackNavOrigin.
const origins = new Map()

export function useTrackNavOrigin() {
  const location = useLocation()
  const navType = useNavigationType()
  const prevRef = useRef(null)

  useEffect(() => {
    const prev = prevRef.current
    if (prev && prev.key !== location.key && !origins.has(location.key)) {
      // PUSH: se vino de la página anterior. REPLACE: la entrada reemplazada
      // hereda su origen. POP: la entrada ya existía, su origen no cambia.
      if (navType === 'PUSH') origins.set(location.key, prev.pathname)
      else if (navType === 'REPLACE' && origins.has(prev.key)) origins.set(location.key, origins.get(prev.key))
    }
    prevRef.current = location
  }, [location, navType])
}

// "Inicio" de los breadcrumbs: si a esta página se llegó desde el home, se comporta
// como "volver" (el feed queda como estaba, sin resetear ni rotar). Si se llegó de
// otro lado (link directo, notificación, búsqueda), va al inicio como siempre.
export function useBackToHome() {
  const location = useLocation()
  const navigate = useNavigate()
  const goHome = useGoHome()

  return useCallback((event) => {
    if (origins.get(location.key) !== '/') return goHome(event)
    if (event) {
      // Mismo criterio que useGoHome: los clicks "no simples" abren pestaña nueva.
      if (event.defaultPrevented) return
      if (event.button != null && event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      event.preventDefault()
    }
    navigate(-1)
  }, [location.key, navigate, goHome])
}
