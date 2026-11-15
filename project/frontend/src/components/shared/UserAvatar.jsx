import { useState } from 'react'
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

// La imagen se muestra sin esperar a onLoad: con imágenes en caché el evento puede dispararse
// antes de enganchar el handler. La inicial aparece solo si no hay foto o si no cargan ni la
// miniatura ni la original.
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
  // Ni la miniatura ni la original cargaron.
  const [failed, setFailed] = useState(false)
  // La miniatura falló: se prueba la URL original.
  const [useRaw, setUseRaw] = useState(false)

  const [prevUrl, setPrevUrl] = useState(url_imagen)
  if (prevUrl !== url_imagen) {
    setPrevUrl(url_imagen)
    setFailed(false)
    setUseRaw(false)
  }

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
  const src = useRaw ? url_imagen : avatarThumbnail(url_imagen, px * 2)

  function handleError() {
    // Primer fallo: probar la URL original. Segundo: mostrar la inicial.
    if (!useRaw) setUseRaw(true)
    else setFailed(true)
  }

  return (
    <div
      className={cls}
      role="img"
      aria-label={nickname}
      onClick={onClick}
      style={{ ...sizeStyle, ...style }}
    >
      {showImg ? (
        <img
          className="user-avatar-img"
          src={src}
          alt=""
          width={px}
          height={px}
          loading={lazy ? 'lazy' : undefined}
          decoding="async"
          onError={handleError}
        />
      ) : (
        <span
          className="user-avatar-fallback"
          aria-hidden="true"
          style={{ background: hashColor(nickname), color: '#fff' }}
        >
          {getInitials(nickname)}
        </span>
      )}
    </div>
  )
}
