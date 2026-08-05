import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { UserAvatar } from '../shared/UserAvatar'
import { useSiteSearch } from '../../hooks/useSiteSearch'
import { trackSearch } from '../../utils/analytics'
import { SearchDropdown } from './SearchDropdown'
import { SearchPill } from './SearchPill'
import { MobileSearch } from './MobileSearch'
import './Header.css'

export function Header() {
  const { user, loading, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  // Búsqueda de desktop: misma lógica que el overlay de mobile (hook compartido).
  const { query, setQuery, setQueryFromFilter, results, setResults, categories, reset } = useSiteSearch()
  const searchRef = useRef(null)

  // Fuente de verdad del filtro = la URL. En el Home, `etiqueta` se muestra como
  // píldora dentro del buscador y `q` es el texto libre que va en el <input>.
  const isHome = location.pathname === '/'
  const params = new URLSearchParams(location.search)
  const activeEtiqueta = isHome ? params.get('etiqueta') : null
  const activeQ = isHome ? params.get('q') : null

  // Navega al Home con el filtro dado (q/etiqueta), armando el query string.
  // Fuente única para Enter, quitar píldora y click de etiqueta.
  function goSearch({ q, etiqueta }) {
    const p = new URLSearchParams()
    if (etiqueta) p.set('etiqueta', etiqueta)
    if (q) p.set('q', q)
    const qs = p.toString()
    navigate(qs ? `/?${qs}` : '/')
  }

  // El <input> refleja el texto libre `q` (no la etiqueta). Con un filtro activo
  // —sea etiqueta o q— reflejamos sin reabrir el dropdown; en cualquier otra
  // página o sin filtro, la barra queda vacía.
  useEffect(() => {
    if (isHome && (activeQ || activeEtiqueta)) {
      setQueryFromFilter(activeQ || '')
    } else {
      reset()
    }
  }, [location, isHome, activeQ, activeEtiqueta, setQueryFromFilter, reset])

  // Cerrar menú de usuario al click afuera
  useEffect(() => {
    if (!menuOpen) return
    function handle(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('click', handle)
    return () => document.removeEventListener('click', handle)
  }, [menuOpen])

  // Cerrar dropdown de búsqueda al click afuera
  useEffect(() => {
    if (!results) return
    function handle(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) setResults(null)
    }
    document.addEventListener('click', handle)
    return () => document.removeEventListener('click', handle)
  }, [results, setResults])

  async function handleLogout() {
    // Navigate home BEFORE clearing the session. Otherwise, if we're on a page
    // that requires auth (e.g. a user profile), setUser(null) fires that page's
    // redirect-to-login effect — bouncing us to /login with a "Debes iniciar
    // sesión" toast instead of landing cleanly on the home feed.
    navigate('/')
    await logout()
  }

  return (
    <header>
      {/* Búsqueda mobile (lupa a la izquierda + overlay). Oculta en desktop. */}
      <MobileSearch />

      <Link to="/" className="logo">
        Udelar<span>HITS</span>
      </Link>

      <div className="search-bar" ref={searchRef}>
        <div className="search-field">
          <svg
            className="search-icon"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          {activeEtiqueta && (
            <SearchPill
              etiqueta={activeEtiqueta}
              // Quitar la píldora conserva el texto ya escrito como búsqueda.
              onRemove={() => goSearch({ q: query.trim() || null, etiqueta: null })}
            />
          )}
          <input
            type="text"
            className="search-field-input"
            // El placeholder solo se muestra cuando no hay texto (React lo maneja
            // solo: con la píldora puesta pero sin texto, se sigue viendo).
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
                }
              } else if (e.key === 'Backspace' && query === '' && activeEtiqueta) {
                // Patrón estándar de campos con tokens: backspace con el input
                // vacío borra la píldora.
                e.preventDefault()
                goSearch({ q: null, etiqueta: null })
              }
            }}
          />
        </div>
        {results && (
          <SearchDropdown
            results={results}
            query={query.trim()}
            categories={categories}
            onClose={() => setResults(null)}
            onTagClick={tag => {
              // Click en una etiqueta = aplicar el filtro exacto por etiqueta.
              setResults(null)
              goSearch({ etiqueta: tag })
            }}
          />
        )}
      </div>

      <div className="header-actions">
        {loading ? null : user ? (
          <div className="user-menu-wrapper" ref={menuRef}>
            <button className="user-chip" onClick={() => setMenuOpen(o => !o)}>
              <UserAvatar
                className="user-avatar"
                url_imagen={user.url_imagen}
                nickname={user.nickname}
                size={28}
              />
              {user.nickname}
            </button>
            {menuOpen && (
              <div className="user-menu">
                <Link
                  to={`/user/${user.nickname}`}
                  className="user-menu-item"
                  onClick={() => setMenuOpen(false)}
                >
                  Ver perfil
                </Link>
                <button
                  className="user-menu-item user-menu-item--saved-mobile"
                  onClick={e => {
                    e.stopPropagation()
                    setMenuOpen(false)
                    window.dispatchEvent(new CustomEvent('toggle-saved-panel'))
                  }}
                >
                  Guardados
                </button>
                <Link
                  to="/settings"
                  className="user-menu-item"
                  onClick={() => setMenuOpen(false)}
                >
                  Configuración
                </Link>
                <button
                  className="user-menu-item user-menu-item--danger"
                  onClick={handleLogout}
                >
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <Link to="/login" className="btn-ghost">Iniciar sesión</Link>
            <Link to="/register" className="btn-primary">Registrarse</Link>
          </>
        )}
      </div>
    </header>
  )
}
