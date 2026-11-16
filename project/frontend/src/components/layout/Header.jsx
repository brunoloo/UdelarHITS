import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useAdminPending, formatPending } from '../../hooks/useAdminPending'
import { UserAvatar } from '../shared/UserAvatar'
import { useSiteSearch } from '../../hooks/useSiteSearch'
import { useGoHome } from '../../hooks/useGoHome'
import { trackSearch } from '../../utils/analytics'
import { SearchDropdown } from './SearchDropdown'
import { SearchPill } from './SearchPill'
import { MobileSearch } from './MobileSearch'
import { PumpkinIcon } from '../seasonal/PumpkinIcon'
import { useSeason } from '../../hooks/useSeason'
import './Header.css'

export function Header() {
  const { user, loading, logout } = useAuth()
  const { isAdmin, total: adminPending } = useAdminPending()
  const navigate = useNavigate()
  const location = useLocation()
  const goHome = useGoHome()
  const season = useSeason()

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  const { query, setQuery, setQueryFromFilter, results, setResults, reset } = useSiteSearch()
  const searchRef = useRef(null)

  // La URL es la fuente de verdad del filtro: el input refleja `q` y la píldora, `etiqueta`.
  const isHome = location.pathname === '/'
  const isSearchPage = location.pathname === '/search'
  const reflectsFilter = isHome || isSearchPage
  const params = new URLSearchParams(location.search)
  const activeEtiqueta = reflectsFilter ? params.get('etiqueta') : null
  const activeQ = reflectsFilter ? params.get('q') : null

  // Con texto la búsqueda va a /search; solo con etiqueta sigue siendo el filtro del inicio.
  function goSearch({ q, etiqueta }) {
    const p = new URLSearchParams()
    if (etiqueta) p.set('etiqueta', etiqueta)
    if (q) p.set('q', q)
    const qs = p.toString()
    if (q) navigate(`/search?${qs}`)
    else navigate(qs ? `/?${qs}` : '/')
  }

  useEffect(() => {
    if (reflectsFilter && (activeQ || activeEtiqueta)) {
      setQueryFromFilter(activeQ || '')
    } else {
      reset()
    }
  }, [location, reflectsFilter, activeQ, activeEtiqueta, setQueryFromFilter, reset])

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
    // Navegar al inicio antes de cerrar la sesión: si no, una página que requiere auth redirige a /login.
    navigate('/')
    await logout()
  }

  return (
    <header className="site-header">
      <MobileSearch />

      <Link to="/" className="logo" onClick={goHome}>
        Udelar<span>HITS</span>
        {season === 'halloween' && <PumpkinIcon className="logo-season-badge" />}
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
            placeholder="Busca lo que quieras..."
            autoComplete="off"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                const q = query.trim()
                if (q || activeEtiqueta) {
                  if (q) trackSearch(q)
                  // Cerrar el desplegable antes de navegar: si no, queda flotando sobre /search.
                  setResults(null)
                  goSearch({ q: q || null, etiqueta: activeEtiqueta })
                }
              } else if (e.key === 'Escape') {
                setResults(null)
                e.currentTarget.blur()
              } else if (e.key === 'Backspace' && query === '' && activeEtiqueta) {
                // Backspace con el input vacío borra la píldora.
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
            onClose={() => setResults(null)}
          />
        )}
      </div>

      <div className="header-actions">
        {/* En móvil no hay menú lateral fijo: el acceso al panel y su indicador van acá. */}
        {isAdmin && (
          <Link
            to="/admin"
            className="header-admin-link"
            aria-label={adminPending > 0 ? `Administración: ${adminPending} pendientes` : 'Administración'}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            {adminPending > 0 && <span className="header-admin-badge">{formatPending(adminPending)}</span>}
          </Link>
        )}
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
