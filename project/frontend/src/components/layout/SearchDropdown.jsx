import { Link } from 'react-router-dom'
import { UserAvatar } from '../shared/UserAvatar'
import { parseEtiquetas, normSearch as norm } from '../../utils/parseEtiquetas'

// Panel de resultados de búsqueda (categorías, etiquetas, usuarios). Compartido
// por la barra de desktop (Header) y el overlay de mobile (MobileSearch).
export function SearchDropdown({ results, query, categories, onClose, onTagClick }) {
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
                <div className="search-item-sub">{Number(c.contador_comentarios) || 0} comentarios</div>
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
              parseEtiquetas(c.etiquetas).some(e => norm(e) === norm(tag))
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
                : null
            return (
              <Link
                key={u.nickname}
                to={`/user/${u.nickname}`}
                className="search-item"
                onClick={onClose}
              >
                <UserAvatar
                  className="search-item-avatar"
                  url_imagen={avatarUrl}
                  nickname={u.nickname}
                  size={28}
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
