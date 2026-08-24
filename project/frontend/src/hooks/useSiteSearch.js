import { useCallback, useEffect, useRef, useState } from 'react'
import { apiGet } from '../api/client'

// Lógica de la búsqueda en vivo del header (dropdown de sugerencias). Se comparte
// tal cual entre la barra de desktop (Header) y el overlay de mobile
// (MobileSearch): misma query, mismo endpoint, mismo comportamiento.
//
// Todo pasa por el buscador unificado del backend: GET /api/search con limit
// chico (top 3 por sección) y debounce. El resultado trae las cuatro secciones
// (categorías, temas, comentarios, usuarios), cada una { items, hasMore }.
//
// Debounce de 350ms: alto para que tipear una palabra larga no dispare un request
// por tecla (y no agote el rate limit del endpoint), pero imperceptible al leer.
const DEBOUNCE_MS = 350
const MIN_CHARS = 2
const DROPDOWN_LIMIT = 3

export function useSiteSearch() {
  const [query, setQueryState] = useState('')
  const [results, setResults] = useState(null)

  // Cuando el input refleja el filtro activo del Home (?q=/?etiqueta=), no
  // queremos abrir el dropdown de sugerencias: solo mostrar el texto/píldora del
  // filtro. Este ref marca ese modo y se apaga en cuanto el usuario vuelve a
  // escribir.
  const filterModeRef = useRef(false)

  // setQuery para input del usuario: reactiva la búsqueda en vivo.
  const setQuery = useCallback(value => {
    filterModeRef.current = false
    setQueryState(value)
  }, [])

  // Refleja el filtro activo sin disparar el dropdown.
  const setQueryFromFilter = useCallback(value => {
    filterModeRef.current = true
    setQueryState(value)
  }, [])

  useEffect(() => {
    const q = query.trim()
    if (!q || filterModeRef.current || q.length < MIN_CHARS) {
      setResults(null)
      return
    }
    const timer = setTimeout(() => {
      apiGet(`/search?q=${encodeURIComponent(q)}&limit=${DROPDOWN_LIMIT}`)
        .then(r => setResults(r.data))
        .catch(() => {})
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query])

  const reset = useCallback(() => {
    filterModeRef.current = false
    setQueryState('')
    setResults(null)
  }, [])

  return { query, setQuery, setQueryFromFilter, results, setResults, reset }
}
