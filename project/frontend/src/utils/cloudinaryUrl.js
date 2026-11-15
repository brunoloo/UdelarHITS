// Transformaciones de entrega por URL. Los avatares se suben sin transformación.

// Los tamaños se redondean a un conjunto fijo: cada transformación distinta genera un
// derivado nuevo, y con buckets todos los avatares chicos comparten uno.
// 400 es el tamaño del original.
export const AVATAR_BUCKETS = [96, 192, 400]

const bucketFor = (size) =>
  AVATAR_BUCKETS.find((b) => size <= b) ?? AVATAR_BUCKETS[AVATAR_BUCKETS.length - 1]

// Reemplaza cualquier transformación previa en vez de apilar otra.
export function avatarThumbnail(url, size = 80) {
  if (!url || !url.includes('/upload/')) return url
  const px = bucketFor(Math.ceil(size))
  const t = `c_fill,w_${px},h_${px},f_auto,q_auto`
  // Formato /upload/[transform/]vNNN/public_id.
  if (/\/upload\/(?:.+?\/)?v\d+\//.test(url)) {
    return url.replace(/\/upload\/(?:.+?\/)?(v\d+\/)/, `/upload/${t}/$1`)
  }
  // Sin número de versión: un segmento de transformación se reconoce por contener "_".
  return url.replace(/\/upload\/(?:[^/]*_[^/]*\/)?/, `/upload/${t}/`)
}

// Limita el ancho sin agrandar la imagen. Reemplaza la transformación previa, igual que avatarThumbnail.
export function cloudinaryResize(url, maxWidth = 1200) {
  if (!url || !url.includes('/upload/')) return url
  const t = `c_limit,w_${maxWidth},f_auto,q_auto`
  if (/\/upload\/(?:.+?\/)?v\d+\//.test(url)) {
    return url.replace(/\/upload\/(?:.+?\/)?(v\d+\/)/, `/upload/${t}/$1`)
  }
  return url.replace(/\/upload\/(?:[^/]*_[^/]*\/)?/, `/upload/${t}/`)
}
