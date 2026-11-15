// Solo los contadores con valor: un "0 temas" repetido en cada tarjeta no informa nada.
// Devuelve '' cuando no hay nada que contar.
export function categoryStats(temas, comentarios) {
  const t = Number(temas) || 0
  const c = Number(comentarios) || 0
  const parts = []
  if (t > 0) parts.push(`${t} ${t === 1 ? 'tema' : 'temas'}`)
  if (c > 0) parts.push(`${c} ${c === 1 ? 'comentario' : 'comentarios'}`)
  return parts.join(' · ')
}
