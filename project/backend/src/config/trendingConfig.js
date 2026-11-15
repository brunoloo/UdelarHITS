// peso(item) = 0.5 ^ (edad_horas / HALF_LIFE_HOURS)
// score = Σ peso(temas)·W_TEMA + Σ peso(comentarios)·W_COMENTARIO
// La presencia en el ranking depende del conteo en la ventana, no del score.

export const TRENDING = {
  // A las 48 h un ítem pesa la mitad.
  HALF_LIFE_HOURS: Number(process.env.TRENDING_HALF_LIFE_HOURS) || 48,
  // Un tema nuevo aporta más señal de actividad que un comentario suelto.
  W_TEMA: 3,
  W_COMENTARIO: 1,
};

// Con poca actividad la ventana se amplía hasta juntar el mínimo; null = todo el historial.
export const VENTANAS_DIAS = [7, 30, 90, null];
export const MIN_POPULARES = 3;

// La vida media crece con la ventana: en 7 días es HALF_LIFE_HOURS. Sin escalarla,
// los scores de una ventana larga quedarían todos en cero.
export const halfLifeHours = (days) => TRENDING.HALF_LIFE_HOURS * ((days ?? 365) / 7);
