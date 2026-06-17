import { useState } from 'react'
import './UserAvatar.css'

function getInitials(nickname) {
  if (!nickname) return '?'
  return nickname.charAt(0).toUpperCase()
}

export function UserAvatar({ url_imagen, nickname, size = 'md', inactive = false }) {
  const [failed, setFailed] = useState(false)
  const cls = `user-avatar-${size}${inactive ? ' user-avatar-inactive' : ''}`

  if (!url_imagen || failed) {
    return (
      <div className={`user-avatar-fallback ${cls}`} aria-label={nickname}>
        {getInitials(nickname)}
      </div>
    )
  }

  return (
    <img
      className={`user-avatar-img ${cls}`}
      src={url_imagen}
      alt={nickname}
      onError={() => setFailed(true)}
    />
  )
}
