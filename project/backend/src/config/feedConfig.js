// =========================================================
// Configuración del feed personalizado del Home
// =========================================================
// Home responde "¿qué hay de nuevo en lo que me importa?": cada categoría
// activa recibe un puntaje por usuario y el feed se ordena por ese puntaje.
// Centraliza señales y pesos para poder ajustarlos sin tocar las queries.
//
//   score = participación + suscripción + afinidad_etiquetas
//         + actividad_reciente + novedad
//
// Jerarquía buscada (de más a menos señal):
//   1. Señal explícita: participo o estoy suscripto        (~400-500)
//   2. Afinidad por etiquetas según mis likes               (30 por like,
//      cap por etiqueta para que una sola no domine)        (típico 30-300)
//   3. Actividad real de la última semana                   (15/tema, 5/com)
//   4. Novedad: boost lineal que decae por día              (max 112)
//
// Todos los componentes son ENTEROS y estables dentro del día (la novedad
// usa días enteros de edad): así el cursor de paginación (score, id) no
// cambia entre página y página de una misma sesión de scroll.
//
// Sin usuario (o usuario sin señales — cold start), Home cae a orden
// cronológico puro (fecha_creacion DESC), igual que Recientes.

export const FEED = {
  // Paginación
  PAGE_SIZE_DEFAULT: 20,
  PAGE_SIZE_MAX: 50,

  // 1. Señales explícitas
  W_PARTICIPACION: 500, // participo (comenté / soy moderador) en la categoría
  W_SUSCRIPCION: 400,   // tengo la campanita activada

  // 2. Afinidad por etiquetas (likes previos del usuario en contenido de
  //    categorías con esa etiqueta)
  W_ETIQUETA: 30,           // puntos por cada like "heredado" vía etiqueta
  AFINIDAD_CAP_ETIQUETA: 10, // máx. de likes que cuenta una misma etiqueta

  // 3. Actividad reciente (misma ventana que Populares)
  ACTIVIDAD_DIAS: 7,
  W_ACT_TEMA: 15,       // cada tema activo creado en la ventana
  W_ACT_COMENTARIO: 5,  // cada comentario visible creado en la ventana

  // 4. Novedad: W_NOVEDAD_DIA * (NOVEDAD_DIAS - edad_en_días), piso 0.
  NOVEDAD_DIAS: 14,
  W_NOVEDAD_DIA: 8,     // máx. 8*14 = 112 el día de creación
};

// =========================================================
// Feed del Home: dos streams intercalados por cadencia
// =========================================================
// El Home mezcla DOS tipos de ítem: categorías (stream A) y comentarios de Home
// (stream B). No compiten en un único ranking — cada stream se ordena SOLO
// contra ítems de su mismo tipo y luego se INTERCALAN con una cadencia fija.
// Ventaja: el score de cada tipo solo tiene que ordenar bien dentro de su tipo
// (no hay que calibrar magnitudes entre categorías y comentarios), y el balance
// del feed se ajusta con un único valor —la cadencia— en vez de con pesos.
//
// Patrón: CADENCIA_HOME.categorias categorías, luego CADENCIA_HOME.comentarios
// comentarios, y se repite. Si un stream se agota, el otro llena los slots
// restantes sin dejar huecos (foro solo con comentarios → feed de comentarios,
// y viceversa).
export const CADENCIA_HOME = { categorias: 2, comentarios: 3 };

// Score del stream B (comentarios de Home). Como no compite con las categorías,
// sus pesos NO necesitan ser comparables con FEED.* — solo ordenar comentarios
// entre sí. Igual que el score de categorías, es ENTERO y estable dentro del día
// (novedad por días enteros) para que el cursor (score, id) pagine sin repetir.
//
//   score = novedad + popularidad + sigue_al_autor
//
// Sin usuario (o cold start) el stream B cae a orden cronológico, igual que el A.
export const FEED_COMENTARIO_HOME = {
  // Novedad: boost lineal que decae por día, piso 0.
  NOVEDAD_DIAS: 14,
  W_NOVEDAD_DIA: 8,      // máx. 8*14 = 112 el día de creación

  // Popularidad: interacción acumulada (likes + respuestas directas visibles).
  W_POPULARIDAD: 5,      // puntos por cada like o respuesta

  // Interés/participación: el viewer sigue (aceptado) al autor del comentario.
  W_SIGUE_AUTOR: 500,
};
