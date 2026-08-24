import { Link } from 'react-router-dom'
import { UserAvatar } from '../shared/UserAvatar'
import { SearchSnippet } from '../shared/SearchSnippet'
import { commentPermalink } from '../../utils/commentPermalink'

// Panel de sugerencias en vivo del buscador (categorías, temas, comentarios,
// usuarios). Compartido por la barra de desktop (Header) y el overlay de mobile
// (MobileSearch). Los datos vienen del buscador unificado del backend
// (GET /api/search, top 3 por sección); acá solo se renderizan.
//
// `results` = { categorias, temas, comentarios, usuarios }, cada una { items }.
// `query` es el texto actual (para el enlace "ver todos" y el estado vacío).
export function SearchDropdown({ results, query, onClose }) {
  const cats = results.categorias?.items ?? []
  const temas = results.temas?.items ?? []
  const coments = results.comentarios?.items ?? []
  const users = results.usuarios?.items ?? []
  const total = cats.length + temas.length + coments.length + users.length

  const seeAllHref = `/search?q=${encodeURIComponent(query)}`

  if (total === 0) {
    return (
      <div className="search-dropdown open">
        <div className="search-empty">No se encontraron resultados para "{query}"</div>
        <Link to={seeAllHref} className="search-see-all" onClick={onClose}>
          Ver la página de búsqueda
        </Link>
      </div>
    )
  }

  return (
    <div className="search-dropdown open">
      {cats.length > 0 && (
        <>
          <div className="search-section-title">Categorías</div>
          {cats.map(c => (
            <Link key={`cat-${c.id}`} to={`/category/${c.id}`} className="search-item" onClick={onClose}>
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
                <div className="search-item-sub">
                  <SearchSnippet before={c.snippet_before} match={c.snippet_match} after={c.snippet_after} />
                  {!c.snippet_match && `${Number(c.contador_temas) || 0} temas`}
                </div>
              </div>
            </Link>
          ))}
        </>
      )}

      {temas.length > 0 && (
        <>
          {cats.length > 0 && <div className="search-divider" />}
          <div className="search-section-title">Temas</div>
          {temas.map(t => (
            <Link key={`tema-${t.id}`} to={`/topic/${t.id}`} className="search-item" onClick={onClose}>
              <div className="search-item-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 6h16M4 12h16M4 18h10" />
                </svg>
              </div>
              <div className="search-item-info">
                <div className="search-item-title">{t.titulo}</div>
                <div className="search-item-sub">
                  <SearchSnippet before={t.snippet_before} match={t.snippet_match} after={t.snippet_after} />
                  {!t.snippet_match && `en ${t.categoria_titulo}`}
                </div>
              </div>
            </Link>
          ))}
        </>
      )}

      {coments.length > 0 && (
        <>
          {(cats.length > 0 || temas.length > 0) && <div className="search-divider" />}
          <div className="search-section-title">Comentarios</div>
          {coments.map(c => (
            <Link
              key={`com-${c.id}`}
              to={commentPermalink({ tipo: c.tipo, id: c.id, destino_id: c.destino_id })}
              className="search-item"
              onClick={onClose}
            >
              <UserAvatar
                className="search-item-avatar"
                url_imagen={c.autor_url_imagen && /^https?:\/\//i.test(c.autor_url_imagen) ? c.autor_url_imagen : null}
                nickname={c.autor_nickname}
                size={28}
              />
              <div className="search-item-info">
                <div className="search-item-title">@{c.autor_nickname}</div>
                <div className="search-item-sub">
                  <SearchSnippet before={c.snippet_before} match={c.snippet_match} after={c.snippet_after} />
                </div>
              </div>
            </Link>
          ))}
        </>
      )}

      {users.length > 0 && (
        <>
          {(cats.length > 0 || temas.length > 0 || coments.length > 0) && <div className="search-divider" />}
          <div className="search-section-title">Usuarios</div>
          {users.map(u => (
            <Link
              key={`user-${u.nickname}`}
              to={`/user/${u.nickname}`}
              className="search-item"
              onClick={onClose}
            >
              <UserAvatar
                className="search-item-avatar"
                url_imagen={u.url_imagen && /^https?:\/\//i.test(u.url_imagen) ? u.url_imagen : null}
                nickname={u.nickname}
                size={28}
              />
              <div className="search-item-info">
                <div className="search-item-title">@{u.nickname}</div>
                <div className="search-item-sub">{u.nombre}</div>
              </div>
            </Link>
          ))}
        </>
      )}

      <div className="search-divider" />
      <Link to={seeAllHref} className="search-see-all" onClick={onClose}>
        Ver todos los resultados para "{query}"
      </Link>
    </div>
  )
}
