import { Link } from 'react-router-dom'
import { UserAvatar } from './UserAvatar'
import './AuthorDisplay.css'

// Port of getAutorDisplay() from vanilla header.js.
// Accepts an autor object whose fields may be prefixed (autor_nickname) or not (nickname).
function resolveAutor(autor) {
  if (!autor) return { nickname: 'Usuario desconocido', url_imagen: null, isInactive: true }

  const estado = autor.autor_estado || autor.estado
  const nickname = autor.autor_nickname || autor.nickname || ''
  const url_imagen = autor.autor_url_imagen || autor.url_imagen || null

  if (estado === 'inactivo') {
    return { nickname: 'Usuario inactivo', url_imagen: null, isInactive: true }
  }

  return { nickname, url_imagen, isInactive: false }
}

// Renders the author avatar + name row.
// Props:
//   autor   — raw autor object (from API)
//   size    — avatar size: 'sm' | 'md' | 'lg'
//   showAvatar — boolean (default true)
export function AuthorDisplay({ autor, size = 'sm', showAvatar = true }) {
  const { nickname, url_imagen, isInactive } = resolveAutor(autor)

  const avatarEl = showAvatar && (
    <UserAvatar url_imagen={url_imagen} nickname={nickname} size={size} inactive={isInactive} />
  )

  if (isInactive) {
    return (
      <span className="author-display">
        {avatarEl}
        <span className="inactive-author">{nickname}</span>
      </span>
    )
  }

  return (
    <span className="author-display">
      {avatarEl}
      <Link className="author-display-link" to={`/user/${encodeURIComponent(nickname)}`}>
        {nickname}
      </Link>
    </span>
  )
}

// Export the resolver separately so cards can call it directly.
export { resolveAutor }
