import { useState } from 'react'
import './UserAvatar.css'

function getInitials(nickname) {
  if (!nickname) return '?'
  return nickname.charAt(0).toUpperCase()
}

function hashColor(str) {
  if (!str) return '#6b7280'
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const h = Math.abs(hash) % 360
  return `hsl(${h}, 55%, 42%)`
}

export function UserAvatar({ url_imagen, nickname, size = 'md', inactive = false }) {
  const [failed, setFailed] = useState(false)
  const cls = `user-avatar-${size}${inactive ? ' user-avatar-inactive' : ''}`

  if (!url_imagen || failed) {
    return (
      <div
        className={`user-avatar-fallback ${cls}`}
        aria-label={nickname}
        style={{ background: hashColor(nickname), color: '#fff' }}
      >
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
