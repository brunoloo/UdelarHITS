// Textos para la ventana que el backend usó de verdad (null = todo el historial):
// la interfaz no promete "esta semana" si el ranking salió de un período más largo.
export function ventanaTexto(dias) {
  if (dias == null) return 'desde siempre'
  if (dias <= 7) return 'esta semana'
  return `en los últimos ${dias} días`
}

export function ventanaSubtitulo(dias) {
  if (dias == null) return 'Las categorías con más actividad de la comunidad'
  return `Las categorías con más actividad en los últimos ${dias} días`
}

export function heroLabel(dias) {
  if (dias == null || dias > 30) return 'Categoría destacada'
  if (dias > 7) return 'Categoría del mes'
  return 'Categoría de la semana'
}
