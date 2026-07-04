// =========================================================
// Configuración de moderación por reportes
// =========================================================
// El umbral de ocultamiento por reportes vive acá, en un solo lugar, para
// ajustarlo sin tocar la lógica. Ya no es un valor fijo: distingue dos
// poblaciones de reportantes con distinto peso.
//
//   * PARTICIPANTE: reportó y participa en la categoría (creó tema/comentario;
//     tiene fila en participacion_categoria). Su reporte tiene más contexto y
//     por lo tanto más peso → cota proporcional a la cantidad de participantes.
//   * VISITANTE: reportó pero no participa. Cota fija más amplia, para que un
//     puñado de externos no pueda tumbar contenido de una comunidad activa.
//
// Un contenido/categoría se oculta si se cruza CUALQUIERA de las dos cotas:
//   P >= umbralParticipantes(N)   ó   V >= umbralVisitantes(N)
// donde N = cantidad de participantes de la categoría, P/V = reportes de
// participantes/visitantes.

const envInt = (name, def) => {
  const v = parseInt(process.env[name], 10);
  return Number.isInteger(v) && v > 0 ? v : def;
};
const envNum = (name, def) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : def;
};

export const REPORT_THRESHOLD = {
  // Umbral de participantes = clamp(ceil(N * FACTOR), MIN, MAX).
  FACTOR_PARTICIPANTES: envNum('UMBRAL_FACTOR_PARTICIPANTES', 0.34),
  MIN_PARTICIPANTES: envInt('UMBRAL_MIN_PARTICIPANTES', 3),
  MAX_PARTICIPANTES: envInt('UMBRAL_MAX_PARTICIPANTES', 15),
  // Umbral de visitantes = max(VISITANTE_MIN, umbralParticipantes * VISITANTE_MULT).
  VISITANTE_MIN: envInt('UMBRAL_VISITANTE_MIN', 10),
  VISITANTE_MULT: envNum('UMBRAL_VISITANTE_MULT', 2),
};

// Compat: cota mínima de participantes. Representa "el umbral base": con una
// categoría chica (pocos participantes) esta es la cantidad de reportes de
// participantes que alcanza para ocultar.
export const UMBRAL_REPORTES = REPORT_THRESHOLD.MIN_PARTICIPANTES;

const clamp = (x, lo, hi) => Math.min(Math.max(x, lo), hi);

/**
 * Umbral de reportes de PARTICIPANTES para una categoría con N participantes.
 * Proporcional a N, acotado entre MIN y MAX.
 * @param {number} n - Cantidad de participantes de la categoría.
 * @returns {number} Umbral (entero >= MIN_PARTICIPANTES).
 */
const umbralParticipantes = (n = 0) => {
  const { FACTOR_PARTICIPANTES, MIN_PARTICIPANTES, MAX_PARTICIPANTES } = REPORT_THRESHOLD;
  const base = Math.ceil((Number(n) || 0) * FACTOR_PARTICIPANTES);
  return clamp(base, MIN_PARTICIPANTES, MAX_PARTICIPANTES);
};

/**
 * Umbral de reportes de VISITANTES. Cota fija más amplia, ligada al umbral de
 * participantes para que escale con el tamaño de la comunidad.
 * @param {number} n - Cantidad de participantes de la categoría.
 * @returns {number} Umbral (entero).
 */
const umbralVisitantes = (n = 0) => {
  const { VISITANTE_MIN, VISITANTE_MULT } = REPORT_THRESHOLD;
  return Math.max(VISITANTE_MIN, Math.ceil(umbralParticipantes(n) * VISITANTE_MULT));
};

/**
 * Decide si un contenido/categoría debe inactivarse por reportes.
 * Función PURA (sin BD) para poder testearla en aislamiento.
 *
 * @param {object} ctx
 * @param {number} ctx.n - Participantes de la categoría.
 * @param {number} ctx.p - Reportes de participantes.
 * @param {number} ctx.v - Reportes de visitantes.
 * @returns {boolean} true si se cruza alguna de las dos cotas.
 */
const debeInactivar = ({ n = 0, p = 0, v = 0 } = {}) => {
  return p >= umbralParticipantes(n) || v >= umbralVisitantes(n);
};

export { debeInactivar, umbralParticipantes, umbralVisitantes };
