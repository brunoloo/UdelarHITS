import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { UserAvatar } from '../shared/UserAvatar'
import { useSiteSearch } from '../../hooks/useSiteSearch'
import { SearchDropdown } from './SearchDropdown'
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

  // La barra de búsqueda refleja la etiqueta activa del Home (?q=): así el
  // usuario ve escrito el nombre del filtro (desde una etiqueta, la sidebar,
  // explorar o la propia búsqueda) y sabe que está viendo el Home filtrado.
  // En cualquier otra página o sin filtro, la barra queda vacía.
  useEffect(() => {
    const q = new URLSearchParams(location.search).get('q')
    if (location.pathname === '/' && q) {
      setQueryFromFilter(q)
    } else {
      reset()
    }
  }, [location, setQueryFromFilter, reset])

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
        <input
          type="text"
          placeholder="Busca lo que quieras..."
          autoComplete="off"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              const q = query.trim()
              if (q) navigate(`/?q=${encodeURIComponent(q)}`)
            }
          }}
        />
        {results && (
          <SearchDropdown
            results={results}
            query={query.trim()}
            categories={categories}
            onClose={() => setResults(null)}
            onTagClick={tag => {
              // setQueryFromFilter (no setQuery) para que la barra quede con el
              // nombre de la etiqueta pero el dropdown no se reabra: así al
              // clickear la etiqueta se cierra el buscador para mejor visión.
              setQueryFromFilter(tag)
              setResults(null)
              navigate(`/?q=${encodeURIComponent(tag)}`)
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
