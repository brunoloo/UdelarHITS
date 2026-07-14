import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../api/client'
import { normSearch as norm } from '../utils/parseEtiquetas'

// Lógica de la búsqueda del sitio (categorías + etiquetas en vivo, usuarios con
// debounce de 250ms). Se extrajo del Header para reusarla tal cual tanto en la
// barra de desktop como en el overlay de búsqueda de mobile — misma query,
// mismos endpoints, mismo comportamiento.
export function useSiteSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', 'active'],
    queryFn: () => apiGet('/categories/active').then(r => r.data),
  })

  const { data: allTagsGrouped = {} } = useQuery({
    queryKey: ['categories', 'etiquetas'],
    queryFn: () => apiGet('/categories/etiquetas').then(r => r.data),
  })

  const allTags = useMemo(
    () => Object.values(allTagsGrouped).flat().map(t => t.nombre),
    [allTagsGrouped]
  )

  // Categorías/etiquetas al instante; usuarios con debounce de 250ms.
  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setResults(null)
      return
    }

    const catResults = categories
      .filter(c => norm(c.titulo).includes(norm(q)))
      .slice(0, 3)

    const tagResults = allTags
      .filter(t => norm(t).includes(norm(q)))
      .slice(0, 3)

    setResults({ cats: catResults, tags: tagResults, users: [] })

    if (q.length < 2) return
    const timer = setTimeout(() => {
      apiGet(`/users/search?q=${encodeURIComponent(q)}`)
        .then(r => setResults(prev => (prev ? { ...prev, users: r.data } : prev)))
        .catch(() => {})
    }, 250)
    return () => clearTimeout(timer)
  }, [query, categories, allTags])

  function reset() {
    setQuery('')
    setResults(null)
  }

  return { query, setQuery, results, setResults, categories, reset }
}
