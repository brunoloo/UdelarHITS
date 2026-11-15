// Ranking del Home para usuarios logueados, en escala logarítmica por stream:
// L = ln(1 + K·afinidad) + W_POP·ln(1 + popularidad) − G·ln(edad_h + 2) + ln(1 + J·(2h − 1))
// h es un hash determinístico por visita (rotación) y edad_h se topea en VENTANA_H.
// Los perfiles CHICO y GRANDE se interpolan según la cantidad de cuentas activas.

// Lectura perezosa: los tests cambian process.env sin reimportar el módulo.
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
// Parser propio: acá 0 es un valor válido.
export const feedIntensidadForzada = () => {
  const raw = process.env.FEED_INTENSIDAD_FORZADA;
  if (raw == null || String(raw).trim() === '') return null;
  const v = Number(raw);
  return Number.isFinite(v) && v >= 0 && v <= 1 ? v : null;
};

export const FEED = {
  PAGE_SIZE_DEFAULT: 20,
  PAGE_SIZE_MAX: 50,

  A_MAX: 2,
  W_PART: 1,
  W_SUSC: 0.8,
  W_TAG: 0.6,
  AFINIDAD_CAP_ETIQUETA: 10,  // máx. de likes que cuenta una misma etiqueta
  AFINIDAD_VENTANA_DIAS: 90,  // likes más viejos no cuentan
  VIDA_MEDIA_PART_DIAS: 21,   // decay de la participación

  // Misma ventana que Populares.
  ACTIVIDAD_DIAS: 7,
};

// En el perfil chico K es bajo y J alto: con poca actividad, la categoría donde
// participaste encabezaba casi todas las visitas.
export const PERFIL_CHICO = { G: 1.6, K: 0.3, J: 0.7, EXPLORA_CADA: 3, W_POP: 0.3, VENTANA_H: 7 * 24 };
export const PERFIL_GRANDE = { G: 1.2, K: 2.0, J: 0.2, EXPLORA_CADA: 5, W_POP: 0.3, VENTANA_H: 3650 * 24 };

// Categorías y comentarios se ordenan por separado y se intercalan con esta
// cadencia; si un stream se agota, el otro completa.
export const CADENCIA_HOME = { categorias: 2, comentarios: 3 };
