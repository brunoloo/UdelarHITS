import { useEffect, useState } from 'react'
import { avatarThumbnail } from '../../utils/cloudinaryUrl'
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

// px de cada tamaño nombrado (en sync con UserAvatar.css)
const SIZE_PX = { sm: 28, md: 36, lg: 48, xl: 80 }

// Avatar con crossfade: el fallback (inicial + color) queda SIEMPRE como capa
// base y la imagen se superpone con opacity 0 hasta que su onLoad dispara.
// Así nunca hay flash inicial→foto ni hueco si la imagen falla o tarda.
// `lazy` difiere la descarga (para listas largas); los avatares above-the-fold
// (header, chat, sidebars) se dejan eager, que es el default.
export function UserAvatar({
  url_imagen,
  nickname,
  size = 'md',
  inactive = false,
  className = '',
  style,
  onClick,
  lazy = false,
}) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  // Reset al cambiar la URL: sin esto, al navegar de un perfil a otro la foto
  // del usuario anterior quedaría marcada como "cargada" y se vería un frame
  // de la imagen vieja mientras baja la nueva.
  useEffect(() => {
    setLoaded(false)
    setFailed(false)
  }, [url_imagen])

  const isNumeric = typeof size === 'number'
  const sizeCls = isNumeric ? '' : `user-avatar-${size}`
  const sizeStyle = isNumeric
    ? { width: size, height: size, fontSize: Math.round(size * 0.4) }
    : null

  const cls = [
    'user-avatar-box',
    sizeCls,
    inactive ? 'user-avatar-inactive' : '',
    onClick ? 'user-avatar-clickable' : '',
    className,
  ].filter(Boolean).join(' ')

  const px = isNumeric ? size : (SIZE_PX[size] || SIZE_PX.md)
  const showImg = !!url_imagen && !failed

  return (
    <div
      className={cls}
      role="img"
      aria-label={nickname}
      onClick={onClick}
      style={{ ...sizeStyle, ...style }}
    >
      <span
        className="user-avatar-fallback"
        aria-hidden="true"
        style={{ background: hashColor(nickname), color: '#fff' }}
      >
        {getInitials(nickname)}
      </span>
      {showImg && (
        <img
          className="user-avatar-img"
          src={avatarThumbnail(url_imagen, px * 2)}
          alt=""
          loading={lazy ? 'lazy' : undefined}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          style={{ opacity: loaded ? 1 : 0 }}
        />
      )}
    </div>
  )
}
