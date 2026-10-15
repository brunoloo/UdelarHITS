// Path del feed del Home para una página.
//
// Páginas siguientes: solo el cursor (que ya congela t0/semilla/intensidad).
// Página 1: si la query YA tiene datos (invalidateQueries tras like/comentario/
// pin, o un refetch por foco), se reenvía la `visita` que devolvió el servidor
// para que el orden rankeado NO cambie bajo el dedo. Sin datos en cache
// (primer montaje, resetQueries de "Inicio"/logo, reload) no hay visita → el
// servidor arma una nueva y el feed rota. "Atrás" conserva la cache → no rota.
export function homeFeedPath(pageSize, pageParam, cachedData) {
  let path = `/categories/feed?limit=${pageSize}`
  if (pageParam) return `${path}&cursor=${encodeURIComponent(pageParam)}`
  const visita = cachedData?.pages?.[0]?.visita
  if (visita) path += `&visita=${encodeURIComponent(visita)}`
  return path
}
