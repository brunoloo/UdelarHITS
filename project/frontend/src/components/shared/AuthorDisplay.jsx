import { Link } from 'react-router-dom'
import { UserAvatar } from './UserAvatar'
import { FacultyBadge } from './FacultyBadge'
import { resolveAutor } from '../../utils/resolveAutor'
import './AuthorDisplay.css'

export function AuthorDisplay({ autor, size = 'sm', showAvatar = true }) {
  const { nickname, url_imagen, facultad, isInactive } = resolveAutor(autor)

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
      <FacultyBadge facultad={facultad} />
    </span>
  )
}
