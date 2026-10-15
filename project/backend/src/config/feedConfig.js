// =========================================================
// Configuración del feed rankeado del Home (usuarios logueados)
// =========================================================
// Home responde "¿qué hay de nuevo/vivo en lo que me importa?" sin estancarse
// cuando hay poca actividad. Invitados: cronológico puro (como Recientes).
// Logueados: UN ranking en escala logarítmica por stream (categorías /
// comentarios de Home), con rotación por visita y cupo de exploración.
//
// Categorías:
//   L = ln(1 + K·A) + W_POP·ln(1 + 3·temas_7d + coms_7d)
//     − G·ln(edad_h + 2) + ln(1 + J·(2h − 1))
//   * edad_h: horas desde la ÚLTIMA ACTIVIDAD (creación, último tema activo o
//     último comentario visible de la categoría o de sus temas), medida contra
//     t0 (instante de la visita, congelado en el cursor), piso 0.
//   * A = min(A_MAX, W_PART·part + W_SUSC·susc + W_TAG·tag)
//       part = 2^(−días_desde_mi_última_actividad / VIDA_MEDIA_PART_DIAS) si
//              participo (decay: la afinidad vieja se apaga), 0 si no.
//       susc = 1 si tengo la campanita, 0 si no.
//       tag  = min(1, Σ_etiquetas min(likes_e, CAP) / CAP), likes de los
//              últimos AFINIDAD_VENTANA_DIAS días.
//   * h = hash(seed, id) ∈ [0,1): jitter determinístico por visita → rotación.
// Comentarios de Home:
//   L = ln(1 + K·S) + W_POP·ln(1 + likes + respuestas)
//     − G·ln(edad_h + 2) + ln(1 + J·(2h − 1))
//   S = 1 si sigo al autor; edad desde la última respuesta visible directa.
//
// En ambos, edad_h se topea en VENTANA_H (por perfil): lo que lleva más de esa
// ventana sin actividad compite parejo en frescura y lo decide la rotación. Sin
// el tope, en un foro chico la única categoría con algo de actividad reciente
// encabezaba siempre (el jitter no alcanza a compensar la brecha de frescura).
//
// score = ROUND(L·1e6)::bigint (puede ser negativo); cursor (score, id).
//
// Intensidad w ∈ [0,1]: interpola linealmente PERFIL_CHICO (w=0, foro con poca
// gente: más frescura, más jitter, más exploración) y PERFIL_GRANDE (w=1).
//   w = clamp((N − (UMBRAL − ANCHO)) / (2·ANCHO), 0, 1), N = cuentas activas.
// w se congela en el cursor (no cambia a mitad de scroll).
//
// Exploración: cada stream se parte en "afín" (categoría: participo o estoy
// suscripto; comentario: sigo al autor o es mío) y "exploración" (el resto).
// La posición k del stream sale de exploración si k % EXPLORA_CADA ==
// EXPLORA_CADA − 1 (si un sub-stream está vacío, sale del otro).

// Helpers de env (mismo patrón que reportConfig.js). Lectura PEREZOSA (funciones)
// para que los tests puedan cambiar process.env sin reimportar el módulo.
const envInt = (name, def) => {
  const v = parseInt(process.env[name], 10);
  return Number.isInteger(v) && v > 0 ? v : def;
};
const envNum = (name, def) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : def;
};

export const feedUmbralCuentas = () => envInt('FEED_UMBRAL_CUENTAS', 300);
export const feedUmbralAncho = () => envInt('FEED_UMBRAL_ANCHO', 50);
export const feedUmbralTtlSeg = () => envNum('FEED_UMBRAL_TTL_SEG', 600);
export const feedVisitaTtlHoras = () => envNum('FEED_VISITA_TTL_HORAS', 6);
// Intensidad forzada (0..1). Vacío / inválido = automática (por conteo). Parser
// propio porque envNum rechaza 0, que acá es un valor válido.
export const feedIntensidadForzada = () => {
  const raw = process.env.FEED_INTENSIDAD_FORZADA;
  if (raw == null || String(raw).trim() === '') return null;
  const v = Number(raw);
  return Number.isFinite(v) && v >= 0 && v <= 1 ? v : null;
};

export const FEED = {
  // Paginación
  PAGE_SIZE_DEFAULT: 20,
  PAGE_SIZE_MAX: 50,

  // Afinidad acotada
  A_MAX: 2,
  W_PART: 1,
  W_SUSC: 0.8,
  W_TAG: 0.6,
  AFINIDAD_CAP_ETIQUETA: 10,  // máx. de likes que cuenta una misma etiqueta
  AFINIDAD_VENTANA_DIAS: 90,  // likes más viejos no cuentan
  VIDA_MEDIA_PART_DIAS: 21,   // decay de la participación

  // Ventana de actividad reciente (misma que Populares)
  ACTIVIDAD_DIAS: 7,
};

// Perfiles por intensidad (w=0 chico, w=1 grande). Se interpolan linealmente,
// salvo VENTANA_H (geométrica: 7 días → ~10 años, o sea sin tope en la práctica).
// Chico: K bajo y J alto a propósito — con poca actividad la última categoría
// donde participaste ganaba el primer lugar en ~todas las visitas.
export const PERFIL_CHICO = { G: 1.6, K: 0.3, J: 0.7, EXPLORA_CADA: 3, W_POP: 0.3, VENTANA_H: 7 * 24 };
export const PERFIL_GRANDE = { G: 1.2, K: 2.0, J: 0.2, EXPLORA_CADA: 5, W_POP: 0.3, VENTANA_H: 3650 * 24 };

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
