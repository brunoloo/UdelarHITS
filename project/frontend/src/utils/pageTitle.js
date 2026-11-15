// Reproduce el formato de título que inyecta el servidor en la carga inicial
// (backend/src/services/seo.service.js). Si allá cambia, hay que actualizarlo acá.

export const SITE_NAME = 'UdelarHITS'

// Igual al <title> de index.html.
export const BASE_TITLE = SITE_NAME

// Categoría activa: "<titulo> · UdelarHITS".
export function categoryTitle(cat) {
  if (cat && cat.estado === 'activa' && cat.titulo) return `${cat.titulo} · ${SITE_NAME}`
  return BASE_TITLE
}

// Tema activo en categoría activa: "<titulo> · <categoria> · UdelarHITS".
export function topicTitle(topic) {
  if (topic && topic.estado === 'activo' && topic.categoria_estado === 'activa' && topic.titulo) {
    return `${topic.titulo} · ${topic.categoria_titulo} · ${SITE_NAME}`
  }
  return BASE_TITLE
}

// "Comentario en <contexto> · UdelarHITS"; el contexto es el tema, la categoría o el sitio.
export function commentTitle(comment) {
  if (comment && comment.estado === 'visible') {
    const context = comment.tema_titulo || comment.categoria_titulo || SITE_NAME
    return `Comentario en ${context} · ${SITE_NAME}`
  }
  return BASE_TITLE
}

// Cuenta activa, pública o privada: "<nickname> · UdelarHITS". Inactiva, baneada o
// inexistente: título genérico.
export function profileTitle(profile) {
  if (profile && profile.estado === 'activo' && profile.nickname) return `${profile.nickname} · ${SITE_NAME}`
  return `Perfil en ${SITE_NAME}`
}
