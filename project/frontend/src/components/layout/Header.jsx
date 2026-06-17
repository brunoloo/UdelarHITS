import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { apiGet } from '../../api/client'
import './Header.css'

function parseEtiquetas(raw) {
  if (Array.isArray(raw)) return raw.filter(Boolean)
  if (typeof raw === 'string')
    return raw.replace(/[{}"]/g, '').split(',').map(e => e.trim()).filter(Boolean)
  return []
}

export function Header() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const searchRef = useRef(null)

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', 'active'],
    queryFn: () => apiGet('/categories/active').then(r => r.data),
  })

  const { data: tags = [] } = useQuery({
    queryKey: ['categories', 'etiquetas'],
    queryFn: () => apiGet('/categories/etiquetas').then(r => r.data),
  })

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
  }, [results])

  // Búsqueda: sync inmediato + users debounced 250ms
  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setResults(null)
      return
    }

    const catResults = categories
      .filter(c =>
        c.titulo.toLowerCase().split(/\s+/).some(w => w.startsWith(q.toLowerCase()))
      )
      .slice(0, 3)

    const tagResults = tags
      .filter(t => {
        if (!t.toLowerCase().split(/\s+/).some(w => w.startsWith(q.toLowerCase()))) return false
        return categories.some(c =>
          parseEtiquetas(c.etiquetas).some(e => e.toLowerCase() === t.toLowerCase())
        )
      })
      .slice(0, 3)

    setResults({ cats: catResults, tags: tagResults, users: [] })

    if (q.length < 2) return
    const timer = setTimeout(() => {
      apiGet(`/users/search?q=${encodeURIComponent(q)}`)
        .then(r => setResults(prev => (prev ? { ...prev, users: r.data } : prev)))
        .catch(() => {})
    }, 250)
    return () => clearTimeout(timer)
  }, [query, categories, tags])

  async function handleLogout() {
    await logout()
    navigate('/')
  }

  return (
    <header>
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
              setQuery(tag)
              setResults(null)
            }}
          />
        )}
      </div>

      <div className="header-actions">
        {user ? (
          <div className="user-menu-wrapper" ref={menuRef}>
            <button className="user-chip" onClick={() => setMenuOpen(o => !o)}>
              <img
                className="user-avatar"
                src={user.url_imagen || '/assets/default-user.jpg'}
                alt={user.nickname}
                onError={e => { e.currentTarget.style.display = 'none' }}
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

function SearchDropdown({ results, query, categories, onClose, onTagClick }) {
  const { cats, tags, users } = results
  const hasResults = cats.length || tags.length || users.length

  if (!hasResults) {
    return (
      <div className="search-dropdown open">
        <div className="search-empty">No se encontraron resultados para "{query}"</div>
      </div>
    )
  }

  return (
    <div className="search-dropdown open">
      {cats.length > 0 && (
        <>
          <div className="search-section-title">Categorías</div>
          {cats.map(c => (
            <Link key={c.id} to={`/category/${c.id}`} className="search-item" onClick={onClose}>
              <div className="search-item-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="3" width="7" height="7" rx="1.5" />
                  <rect x="3" y="14" width="7" height="7" rx="1.5" />
                  <rect x="14" y="14" width="7" height="7" rx="1.5" />
                </svg>
              </div>
              <div className="search-item-info">
                <div className="search-item-title">{c.titulo}</div>
                <div className="search-item-sub">{Number(c.contador_temas) || 0} temas</div>
              </div>
            </Link>
          ))}
        </>
      )}

      {tags.length > 0 && (
        <>
          {cats.length > 0 && <div className="search-divider" />}
          <div className="search-section-title">Etiquetas</div>
          {tags.map(tag => {
            const count = categories.filter(c =>
              parseEtiquetas(c.etiquetas).some(e => e.toLowerCase() === tag.toLowerCase())
            ).length
            return (
              <button key={tag} className="search-item" onClick={() => onTagClick(tag)}>
                <div className="search-item-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
                    <line x1="7" y1="7" x2="7.01" y2="7" />
                  </svg>
                </div>
                <div className="search-item-info">
                  <div className="search-item-title">{tag}</div>
                  <div className="search-item-sub">
                    {count} {count === 1 ? 'categoría' : 'categorías'}
                  </div>
                </div>
              </button>
            )
          })}
        </>
      )}

      {users.length > 0 && (
        <>
          {(cats.length > 0 || tags.length > 0) && <div className="search-divider" />}
          <div className="search-section-title">Usuarios</div>
          {users.map(u => {
            const avatarUrl =
              u.url_imagen && /^https?:\/\//i.test(u.url_imagen)
                ? u.url_imagen
                : '/assets/default-user.jpg'
            return (
              <Link
                key={u.nickname}
                to={`/user/${u.nickname}`}
                className="search-item"
                onClick={onClose}
              >
                <img
                  className="search-item-avatar"
                  src={avatarUrl}
                  alt={u.nickname}
                  onError={e => { e.currentTarget.src = '/assets/default-user.jpg' }}
                />
                <div className="search-item-info">
                  <div className="search-item-title">@{u.nickname}</div>
                  <div className="search-item-sub">{u.nombre}</div>
                </div>
              </Link>
            )
          })}
        </>
      )}
    </div>
  )
}
