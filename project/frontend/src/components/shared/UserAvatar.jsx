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

export function UserAvatar({
  url_imagen,
  nickname,
  size = 'md',
  inactive = false,
  className = '',
  style,
  onClick,
}) {
  const [failed, setFailed] = useState(false)

  const isNumeric = typeof size === 'number'
  const sizeCls = isNumeric ? '' : `user-avatar-${size}`
  const sizeStyle = isNumeric
    ? { width: size, height: size, fontSize: Math.round(size * 0.4) }
    : null

  const cls = [
    sizeCls,
    inactive ? 'user-avatar-inactive' : '',
    onClick ? 'user-avatar-clickable' : '',
    className,
  ].filter(Boolean).join(' ')

  if (!url_imagen || failed) {
    return (
      <div
        className={`user-avatar-fallback ${cls}`}
        aria-label={nickname}
        onClick={onClick}
        style={{ ...sizeStyle, background: hashColor(nickname), color: '#fff', ...style }}
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
      onClick={onClick}
      style={{ ...sizeStyle, ...style }}
      onError={() => setFailed(true)}
    />
  )
}
