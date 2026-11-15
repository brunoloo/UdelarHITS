// El id resuelve el recurso y el slug es decorativo. Debe ser equivalente al slugify del
// backend (utils/seo.js).

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

// De "5-parciales-de-logica" extrae "5"; null si no empieza con dígitos.
export function parseId(param) {
  const m = /^(\d+)/.exec(String(param ?? ''))
  return m ? m[1] : null
}

// Si el título no da slug, se usa solo el id.
export function categoryPath(id, titulo) {
  const s = slugify(titulo)
  return s ? `/category/${id}-${s}` : `/category/${id}`
}

export function topicPath(id, titulo) {
  const s = slugify(titulo)
  return s ? `/topic/${id}-${s}` : `/topic/${id}`
}
