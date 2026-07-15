// Transformaciones de entrega de Cloudinary (URL-level, cacheadas por su CDN).
// Los avatares se suben SIN transformación (uploadToCloudinary guarda la
// secure_url cruda del original 400×400); acá se pide el tamaño justo para el
// render + formato/calidad automáticos (AVIF/WebP según navegador).

// El cropper del frontend exporta avatares de 400px: pedir más que eso solo
// upscalea. Tope para que los tamaños grandes (perfil, modal) usen el original.
const MAX_AVATAR_PX = 400

/**
 * Thumbnail cuadrado optimizado para una URL de avatar de Cloudinary.
 * @param {string} url  URL original (https://res.cloudinary.com/.../upload/v.../archivo.jpg)
 * @param {number} size Lado en px físicos (ya multiplicado por DPR si aplica)
 * @returns {string} URL con c_fill,w,h,f_auto,q_auto — o la original si no es
 *   una URL de Cloudinary transformable (data:, otra CDN, ya transformada).
 */
export function avatarThumbnail(url, size = 80) {
  if (!url || !url.includes('/upload/')) return url
  // Idempotencia: si la URL ya trae una transformación (p. ej. adjuntos con
  // f_auto,q_auto, o una llamada repetida), no encadenar otra.
  if (/\/upload\/[^/]*[a-z]+_[^/]*\//.test(url)) return url
  const px = Math.min(Math.ceil(size), MAX_AVATAR_PX)
  return url.replace('/upload/', `/upload/c_fill,w_${px},h_${px},f_auto,q_auto/`)
}
