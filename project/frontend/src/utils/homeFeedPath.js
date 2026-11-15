// Las páginas siguientes llevan solo el cursor. La primera reenvía la `visita` si la query ya
// tiene datos, para que el orden no cambie tras una invalidación; sin datos, el servidor
// arma una visita nueva.
export function homeFeedPath(pageSize, pageParam, cachedData) {
  let path = `/categories/feed?limit=${pageSize}`
  if (pageParam) return `${path}&cursor=${encodeURIComponent(pageParam)}`
  const visita = cachedData?.pages?.[0]?.visita
  if (visita) path += `&visita=${encodeURIComponent(visita)}`
  return path
}
