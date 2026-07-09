// =========================================================
// Configuración de scoring de trending / actividad reciente
// =========================================================
// Centraliza los parámetros del ranking "de la semana" (populares, trending,
// etiquetas) para poder ajustarlos sin tocar las queries.
//
// El score de una categoría/tema pondera cada tema/comentario reciente por su
// recencia usando un decaimiento exponencial con vida media configurable: un
// contenido recién creado pesa 1.0 y va perdiendo peso a medida que envejece
// dentro de la ventana. Así, actividad reciente REAL manda sobre la fecha de
// creación de la categoría.
//
//   peso(item) = 0.5 ^ (edad_horas / HALF_LIFE_HOURS)
//   score      = Σ peso(temas)·W_TEMA + Σ peso(comentarios)·W_COMENTARIO
//
// La PRESENCIA en el ranking sigue dependiendo del conteo crudo dentro de la
// ventana (no del score), para que un ítem viejo-pero-dentro-de-ventana no
// quede excluido por redondeo del decaimiento.

export const TRENDING = {
  // Vida media del decaimiento, en horas. 48h => a los 2 días un ítem pesa la
  // mitad. Configurable por env para tuning en producción.
  HALF_LIFE_HOURS: Number(process.env.TRENDING_HALF_LIFE_HOURS) || 48,
  // Un tema nuevo aporta más señal de actividad que un comentario suelto.
  W_TEMA: 3,
  W_COMENTARIO: 1,
};
