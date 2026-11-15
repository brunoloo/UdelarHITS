// Un contenido se oculta si los reportes de participantes o los de visitantes
// cruzan su umbral. Los participantes de la categoría pesan más; el umbral de
// visitantes es más alto para que externos no oculten contenido de una comunidad activa.

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

  // Los comentarios de Home no tienen categoría: se usa un umbral plano de reportantes distintos.
  HOME: envInt('UMBRAL_HOME', 10),
};

// Umbral base, para categorías con pocos participantes.
export const UMBRAL_REPORTES = REPORT_THRESHOLD.MIN_PARTICIPANTES;

const clamp = (x, lo, hi) => Math.min(Math.max(x, lo), hi);

const umbralParticipantes = (n = 0) => {
  const { FACTOR_PARTICIPANTES, MIN_PARTICIPANTES, MAX_PARTICIPANTES } = REPORT_THRESHOLD;
  const base = Math.ceil((Number(n) || 0) * FACTOR_PARTICIPANTES);
  return clamp(base, MIN_PARTICIPANTES, MAX_PARTICIPANTES);
};

const umbralVisitantes = (n = 0) => {
  const { VISITANTE_MIN, VISITANTE_MULT } = REPORT_THRESHOLD;
  return Math.max(VISITANTE_MIN, Math.ceil(umbralParticipantes(n) * VISITANTE_MULT));
};

// Función pura, para testearla sin base.
const debeInactivar = ({ n = 0, p = 0, v = 0 } = {}) => {
  return p >= umbralParticipantes(n) || v >= umbralVisitantes(n);
};

const debeInactivarHome = (totalReportes = 0) => {
  return (Number(totalReportes) || 0) >= REPORT_THRESHOLD.HOME;
};

export { debeInactivar, debeInactivarHome, umbralParticipantes, umbralVisitantes };
