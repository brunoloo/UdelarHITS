// =========================================================
// Configuración de moderación por reportes (Fase 4.A)
// =========================================================
// El umbral vive acá, en un solo lugar, para poder ajustarlo sin tocar
// la lógica de reportes. Hoy es un valor fijo configurable por env.
//
// PUNTO DE EXTENSIÓN: `calcularUmbral` recibe el contenido y devuelve el
// umbral aplicable. Hoy ignora el argumento y devuelve la constante, pero
// la firma ya está lista para una fórmula dinámica (proporcional a
// participantes de la categoría, ponderada por reputación, etc.) sin
// cambiar a quien la llama.

// Umbral fijo: cantidad de reportes DISTINTOS que inactiva un contenido.
// Configurable por env; default 5.
const UMBRAL_REPORTES = parseInt(process.env.UMBRAL_REPORTES, 10) || 5;

/**
 * Devuelve el umbral de reportes a partir del cual un contenido se inactiva.
 *
 * @param {object} [_ctx] - Contexto del contenido (categoria_id, tipo, autor, etc.).
 *                          Hoy no se usa; reservado para la fórmula dinámica futura.
 * @returns {number} Umbral (entero >= 1).
 */
const calcularUmbral = (_ctx = {}) => {
  // Futuro: switch por estrategia, o cálculo proporcional usando _ctx.
  return UMBRAL_REPORTES;
};

export { UMBRAL_REPORTES, calcularUmbral };