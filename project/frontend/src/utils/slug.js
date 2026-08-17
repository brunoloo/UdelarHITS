// Slugs decorativos en las URLs de detalle: /category/5-parciales-de-logica.
// El id numérico líder es lo que resuelve el lookup; el slug es cosmético pero
// pesa en el ranking de Google y hace legibles los links compartidos. El backend
// (utils/seo.js) genera el MISMO slug para el canónico y el sitemap, y redirige
// 301 al canónico cuando no coincide, así que estas dos implementaciones deben
// mantenerse equivalentes.

// Título → slug: minúsculas, sin tildes, no-alfanuméricos a guiones.
export function slugify(text) {
  if (!text) return ''
  return String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
}

// De "5" o "5-parciales-de-logica" extrae el id numérico líder ("5"). Devuelve
// null si el segmento no empieza con dígitos (→ la SPA muestra su 404).
export function parseId(param) {
  const m = /^(\d+)/.exec(String(param ?? ''))
  return m ? m[1] : null
}

// Construye el path canónico con slug. Si el título no da slug (solo símbolos),
// cae al path sin slug, que igual resuelve por el id.
export function categoryPath(id, titulo) {
  const s = slugify(titulo)
  return s ? `/category/${id}-${s}` : `/category/${id}`
}

export function topicPath(id, titulo) {
  const s = slugify(titulo)
  return s ? `/topic/${id}-${s}` : `/topic/${id}`
}
