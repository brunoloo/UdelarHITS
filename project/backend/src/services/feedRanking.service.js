import crypto from 'crypto';
import { countActiveUsers } from '../repositories/user.repository.js';
import {
  PERFIL_CHICO, PERFIL_GRANDE,
  feedUmbralCuentas, feedUmbralAncho, feedUmbralTtlSeg, feedIntensidadForzada,
} from '../config/feedConfig.js';

// Intensidad y semilla del feed rankeado del Home (ver config/feedConfig.js).
// Estado de módulo: cache del conteo de cuentas activas + hooks de test.

const clamp01 = (x) => Math.min(Math.max(x, 0), 1);
const round2 = (x) => Math.round(x * 100) / 100;

// Rampa lineal alrededor del umbral: (U − A) → 0, U → 0.5, (U + A) → 1.
export const computeIntensity = (n, umbral, ancho) => {
  if (!(ancho > 0)) return n >= umbral ? 1 : 0;
  return clamp01((n - (umbral - ancho)) / (2 * ancho));
};

let cache = null;       // { w, expiresAt }
let inFlight = null;    // promesa compartida mientras se cuenta
let lastKnown = null;   // último w calculado (fallback si el conteo falla)
let intensityOverride = null;
let seedOverride = null;

export const getFeedIntensity = async () => {
  if (intensityOverride !== null) return intensityOverride;
  const forced = feedIntensidadForzada();
  if (forced !== null) return round2(forced);

  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.w;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const n = await countActiveUsers();
      const w = round2(computeIntensity(n, feedUmbralCuentas(), feedUmbralAncho()));
      cache = { w, expiresAt: Date.now() + feedUmbralTtlSeg() * 1000 };
      lastKnown = w;
      return w;
    } catch (err) {
      // El feed no se rompe por el conteo: último valor conocido o perfil chico.
      if (process.env.NODE_ENV !== 'production') console.error('getFeedIntensity:', err.message);
      return lastKnown ?? 0;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
};

const lerp = (a, b, w) => a + (b - a) * w;

// Interpolación geométrica: para magnitudes que crecen por órdenes (la ventana
// pasa de días a años de forma gradual, no de golpe apenas w > 0).
const glerp = (a, b, w) => a * (b / a) ** w;

// Perfil {G, K, J, W_POP, EXPLORA_CADA, VENTANA_H} interpolado por intensidad w ∈ [0,1].
export const perfilDesdeIntensidad = (w) => {
  const t = clamp01(Number(w) || 0);
  return {
    G: lerp(PERFIL_CHICO.G, PERFIL_GRANDE.G, t),
    K: lerp(PERFIL_CHICO.K, PERFIL_GRANDE.K, t),
    J: lerp(PERFIL_CHICO.J, PERFIL_GRANDE.J, t),
    W_POP: lerp(PERFIL_CHICO.W_POP, PERFIL_GRANDE.W_POP, t),
    EXPLORA_CADA: Math.max(1, Math.round(lerp(PERFIL_CHICO.EXPLORA_CADA, PERFIL_GRANDE.EXPLORA_CADA, t))),
    VENTANA_H: glerp(PERFIL_CHICO.VENTANA_H, PERFIL_GRANDE.VENTANA_H, t),
  };
};

// Semilla de una visita: entero en [0, 2^31).
export const newFeedSeed = () =>
  (seedOverride !== null ? seedOverride : crypto.randomInt(0, 2 ** 31));

// ── Hooks de test ──
export const _setFeedIntensityOverride = (w) => { intensityOverride = w; };
export const _setFeedSeedOverride = (n) => { seedOverride = n; };
export const _resetFeedRanking = () => {
  cache = null; inFlight = null; lastKnown = null;
  intensityOverride = null; seedOverride = null;
};
