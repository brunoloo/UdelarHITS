import { useCallback, useEffect, useRef } from 'react'
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { useGoHome } from './useGoHome'

// Origen de cada entrada del historial (location.key → pathname anterior). Vive a nivel módulo.
const origins = new Map()

export function useTrackNavOrigin() {
  const location = useLocation()
  const navType = useNavigationType()
  const prevRef = useRef(null)

  useEffect(() => {
    const prev = prevRef.current
    if (prev && prev.key !== location.key && !origins.has(location.key)) {
      // PUSH: se vino de la página anterior. REPLACE: hereda el origen. POP: no cambia.
      if (navType === 'PUSH') origins.set(location.key, prev.pathname)
      else if (navType === 'REPLACE' && origins.has(prev.key)) origins.set(location.key, origins.get(prev.key))
    }
    prevRef.current = location
  }, [location, navType])
}

// Si se llegó desde el inicio, "Inicio" se comporta como volver y el feed queda como estaba.
export function useBackToHome() {
  const location = useLocation()
  const navigate = useNavigate()
  const goHome = useGoHome()

  return useCallback((event) => {
    if (origins.get(location.key) !== '/') return goHome(event)
    if (event) {
      // Los clics no simples abren pestaña nueva.
      if (event.defaultPrevented) return
      if (event.button != null && event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      event.preventDefault()
    }
    navigate(-1)
  }, [location.key, navigate, goHome])
}
