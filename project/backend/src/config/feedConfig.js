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
