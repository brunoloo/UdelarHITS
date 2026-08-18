import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSiteSearch } from '../../hooks/useSiteSearch'
import { trackSearch } from '../../utils/analytics'
import { SearchDropdown } from './SearchDropdown'
import { SearchPill } from './SearchPill'

// Búsqueda en mobile: lupa a la izquierda del header que abre un overlay a
// pantalla completa con el mismo comportamiento que la barra de desktop
// (reusa useSiteSearch + SearchDropdown). Oculto en desktop vía CSS.
export function MobileSearch() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const inputRef = useRef(null)
  const { query, setQuery, setQueryFromFilter, results, reset } = useSiteSearch()

  // Fuente de verdad = URL. `etiqueta` se muestra como píldora y `q` como texto
  // del input, tanto en el Home (solo-etiqueta) como en /search (mismo indicador
  // que la barra de desktop).
  const isHome = location.pathname === '/'
  const isSearchPage = location.pathname === '/search'
  const reflectsFilter = isHome || isSearchPage
  const params = new URLSearchParams(location.search)
  const activeEtiqueta = reflectsFilter ? params.get('etiqueta') : null
  const activeQ = reflectsFilter ? params.get('q') : null

  // Con texto libre (`q`) la búsqueda vive en /search; solo-etiqueta sigue siendo
  // el filtro del Home (?etiqueta=).
  function goSearch({ q, etiqueta }) {
    const p = new URLSearchParams()
    if (etiqueta) p.set('etiqueta', etiqueta)
    if (q) p.set('q', q)
    const qs = p.toString()
    if (q) navigate(`/search?${qs}`)
    else navigate(qs ? `/?${qs}` : '/')
  }

  // Al abrir el overlay, reflejamos el texto libre `q` activo (la etiqueta se ve
  // como píldora, no como texto).
  function openSearch() {
    if (reflectsFilter && (activeQ || activeEtiqueta)) setQueryFromFilter(activeQ || '')
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
              {activeEtiqueta && (
                <SearchPill
                  etiqueta={activeEtiqueta}
                  onRemove={() => goSearch({ q: query.trim() || null, etiqueta: null })}
                />
              )}
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
                    if (q || activeEtiqueta) {
                      if (q) trackSearch(q)
                      goSearch({ q: q || null, etiqueta: activeEtiqueta })
                      close()
                    }
                  } else if (e.key === 'Backspace' && query === '' && activeEtiqueta) {
                    e.preventDefault()
                    goSearch({ q: null, etiqueta: null })
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
                onClose={close}
              />
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
