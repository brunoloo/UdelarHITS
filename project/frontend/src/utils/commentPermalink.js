// Permalink de un comentario según su ámbito: página propia para los de Home,
// ?commentId= dentro del tema o de la categoría.
export function commentPermalink({ tipo, id, destino_id }) {
  if (tipo === 'home') return `/comment/${encodeURIComponent(id)}`
  const base = tipo === 'tema'
    ? `/topic/${encodeURIComponent(destino_id)}`
    : `/category/${encodeURIComponent(destino_id)}?tab=comentarios`
  const sep = base.includes('?') ? '&' : '?'
  return `${base}${sep}commentId=${encodeURIComponent(id)}`
}
