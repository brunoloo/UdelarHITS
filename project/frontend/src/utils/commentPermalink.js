// Permalink de un comentario según su ámbito. Fuente ÚNICA — la usan CommentEntry
// (perfil, guardados) y la página/dropdown de búsqueda, para que el link se arme
// igual en todos lados.
//
//   · home      → tiene página propia (/comment/:id): el comentario de Home no
//                 cuelga de ningún contenedor, su permalink ES esa página.
//   · tema      → drill-down dentro del tema con ?commentId=.
//   · categoría → drill-down dentro del tab de comentarios de la categoría.
//
// `id` = contenido_id del comentario. `destino_id` = id del contenedor
// (tema/categoría); se ignora para home.
export function commentPermalink({ tipo, id, destino_id }) {
  if (tipo === 'home') return `/comment/${encodeURIComponent(id)}`
  const base = tipo === 'tema'
    ? `/topic/${encodeURIComponent(destino_id)}`
    : `/category/${encodeURIComponent(destino_id)}?tab=comentarios`
  const sep = base.includes('?') ? '&' : '?'
  return `${base}${sep}commentId=${encodeURIComponent(id)}`
}
