// Transformaciones de entrega de Cloudinary (URL-level, cacheadas por su CDN).
// Los avatares se suben SIN transformación (uploadToCloudinary guarda la
// secure_url cruda del original 400×400); acá se pide un thumbnail cuadrado
// con formato/calidad automáticos (AVIF/WebP según navegador).

// Tamaños "bucket": en vez de pedir exactamente los px de cada render (28, 32,
// 36, 40, 88…), redondeamos hacia arriba a un conjunto chico y fijo. Cloudinary
// genera un derivado DISTINTO por cada string de transformación, así que sin
// buckets el mismo avatar se generaba en 5+ tamaños (cada uno con su primera
// carga lenta); con buckets, todos los avatares chicos (chat, listas, header,
// comentarios) comparten UN solo derivado (w_96), lo que además permite
// pre-generarlo desde el backend al subir el avatar. Cap en 400 = tamaño del
// original que exporta el cropper (pedir más solo upscalea).
export const AVATAR_BUCKETS = [96, 192, 400]

const bucketFor = (size) =>
  AVATAR_BUCKETS.find((b) => size <= b) ?? AVATAR_BUCKETS[AVATAR_BUCKETS.length - 1]

/**
 * Thumbnail cuadrado optimizado para una URL de avatar de Cloudinary.
 * REEMPLAZA cualquier transformación previa entre /upload/ y la versión (nunca
 * apila): pasar dos veces la misma URL, o una URL que ya venía transformada,
 * produce siempre una única cadena de transformación.
 * @param {string} url  URL de Cloudinary (…/upload/[transform/][vNNN/]public_id)
 * @param {number} size Lado en px físicos (ya multiplicado por DPR si aplica)
 * @returns {string} URL transformada, o la original si no es de Cloudinary.
 */
export function avatarThumbnail(url, size = 80) {
  if (!url || !url.includes('/upload/')) return url
  const px = bucketFor(Math.ceil(size))
  const t = `c_fill,w_${px},h_${px},f_auto,q_auto`
  // Formato canónico de Cloudinary: /upload/[transform/]vNNN/public_id.
  // Reemplaza el segmento de transformación si existe, o lo inserta antes de vNNN.
  if (/\/upload\/(?:.+?\/)?v\d+\//.test(url)) {
    return url.replace(/\/upload\/(?:.+?\/)?(v\d+\/)/, `/upload/${t}/$1`)
  }
  // Sin número de versión (defensivo): un segmento de transformación se
  // reconoce por contener "_" (c_fill, f_auto, w_80…); las carpetas no.
  return url.replace(/\/upload\/(?:[^/]*_[^/]*\/)?/, `/upload/${t}/`)
}
