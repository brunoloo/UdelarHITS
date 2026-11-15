import { useCallback, useEffect, useRef, useState } from 'react'
import { apiGet } from '../api/client'

// Búsqueda en vivo del header, compartida entre escritorio y mobile.
// El debounce evita un pedido por tecla sin que se note al leer.
const DEBOUNCE_MS = 350
const MIN_CHARS = 2
const DROPDOWN_LIMIT = 3

export function useSiteSearch() {
  const [query, setQueryState] = useState('')
  const [results, setResults] = useState(null)

  // Cuando el input refleja el filtro activo del inicio no se abre el desplegable;
  // se apaga al volver a escribir.
  const filterModeRef = useRef(false)

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
