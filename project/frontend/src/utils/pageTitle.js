// Títulos de página del cliente (document.title en la navegación de la SPA).
//
// El servidor inyecta el <title> real en la carga inicial de cada ruta de
// detalle (backend/utils/seo.js + services/seo.service.js). Al navegar dentro
// de la SPA no hay recarga, así que estos helpers reproducen EXACTAMENTE ese
// mismo formato para que el título no dependa de cómo se llegó a la página
// (F5/pestaña nueva vs. navegación en cliente). Igual que slug.js espeja el
// slugify del backend, este módulo espeja resolve*Seo: si allá cambia el
// formato, hay que actualizarlo acá también.

export const SITE_NAME = 'UdelarHITS'

// Título base: idéntico al <title> del index.html y al que el servidor deja
// para toda ruta sin metadata específica (home, feeds, about, auth, etc.).
export const BASE_TITLE = SITE_NAME

// Espeja resolveCategorySeo(): categoría activa → "<titulo> · UdelarHITS".
// Inexistente o inactiva (no indexable) → título base genérico.
export function categoryTitle(cat) {
  if (cat && cat.estado === 'activa' && cat.titulo) return `${cat.titulo} · ${SITE_NAME}`
  return BASE_TITLE
}

// Espeja resolveTopicSeo(): tema activo dentro de categoría activa →
// "<titulo> · <categoria> · UdelarHITS". Si no, genérico.
export function topicTitle(topic) {
  if (topic && topic.estado === 'activo' && topic.categoria_estado === 'activa' && topic.titulo) {
    return `${topic.titulo} · ${topic.categoria_titulo} · ${SITE_NAME}`
  }
  return BASE_TITLE
}

// Espeja resolveCommentSeo(): comentario visible →
// "Comentario en <contexto> · UdelarHITS" con contexto = tema || categoría ||
// UdelarHITS (los comentarios de Home no tienen ámbito). Si no es visible o no
// existe, genérico.
export function commentTitle(comment) {
  if (comment && comment.estado === 'visible') {
    const context = comment.tema_titulo || comment.categoria_titulo || SITE_NAME
    return `Comentario en ${context} · ${SITE_NAME}`
  }
  return BASE_TITLE
}

// Espeja resolveProfileSeo(): cuenta activa (pública O privada) →
// "<nickname> · UdelarHITS"; inactiva, baneada o inexistente →
// "Perfil en UdelarHITS". Mismo criterio de privacidad que la preview social:
// el único dato expuesto es el nickname, que la propia página de perfil muestra
// para toda cuenta activa, así que el título no filtra nada de un perfil privado.
export function profileTitle(profile) {
  if (profile && profile.estado === 'activo' && profile.nickname) return `${profile.nickname} · ${SITE_NAME}`
  return `Perfil en ${SITE_NAME}`
}
