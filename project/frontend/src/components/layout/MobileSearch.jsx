import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSiteSearch } from '../../hooks/useSiteSearch'
import { trackSearch } from '../../utils/analytics'
import { SearchDropdown } from './SearchDropdown'

// Búsqueda en mobile: lupa a la izquierda del header que abre un overlay a
// pantalla completa con el mismo comportamiento que la barra de desktop
// (reusa useSiteSearch + SearchDropdown). Oculto en desktop vía CSS.
export function MobileSearch() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const inputRef = useRef(null)
  const { query, setQuery, setQueryFromFilter, results, setResults, categories, reset } = useSiteSearch()

  // Al abrir el overlay, si el Home está filtrado por una etiqueta (?q=),
  // precargamos su nombre en el input para que se vea qué filtro está activo
  // (mismo indicador que la barra de desktop).
  function openSearch() {
    const q = new URLSearchParams(location.search).get('q')
    if (location.pathname === '/' && q) setQueryFromFilter(q)
    setOpen(true)
  }

  function close() {
    setOpen(false)
    reset()
  }

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e) { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button
        className="mobile-search-btn"
        type="button"
        aria-label="Buscar"
        onClick={openSearch}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      </button>

      {/* El overlay se portalea a <body> para escapar del stacking context del
          header (z-index 100), que si no dejaría a la bottom-nav por encima. */}
      {open && createPortal(
        <div className="mobile-search-overlay" onClick={close}>
          <div className="mobile-search-panel" onClick={e => e.stopPropagation()}>
            <div className="mobile-search-head">
              <svg className="mobile-search-head-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                placeholder="Busca lo que quieras..."
                autoComplete="off"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const q = query.trim()
                    if (q) { trackSearch(q); navigate(`/?q=${encodeURIComponent(q)}`); close() }
                  }
                }}
              />
              <button className="mobile-search-close" type="button" aria-label="Cerrar" onClick={close}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {results && (
              <SearchDropdown
                results={results}
                query={query.trim()}
                categories={categories}
                onClose={close}
                onTagClick={tag => {
                  setQuery(tag)
                  setResults(null)
                  navigate(`/?q=${encodeURIComponent(tag)}`)
                  close()
                }}
              />
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
