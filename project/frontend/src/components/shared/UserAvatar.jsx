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

// Avatar del usuario.
//
// La imagen se muestra apenas el navegador la tiene — SIN gatear la visibilidad
// con onLoad. El patrón anterior (opacity 0 → 1 en onLoad) se rompía con
// imágenes cacheadas: el evento load puede dispararse antes de que React
// enganche el handler, así que onLoad no corría, la opacity quedaba en 0 y la
// foto no aparecía nunca (se veía la inicial "default" aunque hubiera foto).
//
// Mientras la foto carga se ve el fondo neutro del contenedor, NO la inicial:
// si el usuario tiene foto puesta, nunca mostramos el default. La inicial de
// color solo aparece cuando NO hay foto, o cuando ni el thumbnail ni la URL
// original cargan.
//
// Degradación: si el thumbnail transformado falla (p. ej. cuenta de Cloudinary
// con "strict transformations", que rechaza /upload/c_fill…/ con 4xx), se
// reintenta con la URL original cruda antes de rendirse.
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
  // failed: ni el thumbnail ni la URL original cargaron → recién ahí, la inicial.
  const [failed, setFailed] = useState(false)
  // useRaw: el thumbnail transformado falló → probamos la URL original.
  const [useRaw, setUseRaw] = useState(false)

  useEffect(() => {
    setFailed(false)
    setUseRaw(false)
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
  const src = useRaw ? url_imagen : avatarThumbnail(url_imagen, px * 2)

  function handleError() {
    // 1er fallo: el thumbnail transformado → probar la URL original cruda.
    // 2do fallo: tampoco cargó la original → mostrar la inicial.
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
