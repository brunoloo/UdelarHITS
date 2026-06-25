// Rate limiter en memoria por clave (p. ej. un email). Permite como máximo `max`
// eventos dentro de una ventana deslizante de `windowMs`. Pensado para acotar el
// envío de mails sin depender de infraestructura externa (single-instance).
//
// Nota: el estado vive en memoria, así que se reinicia con el proceso y no se
// comparte entre instancias. Suficiente como mitigación básica de abuso/bombing.
export function createRateLimiter({ windowMs, max }) {
  const store = new Map(); // key -> number[] (timestamps)

  return {
    // Registra un intento. Devuelve true si está permitido, false si excede.
    check(key) {
      const now = Date.now();
      const prev = (store.get(key) || []).filter(t => now - t < windowMs);
      if (prev.length >= max) {
        store.set(key, prev);
        return false;
      }
      prev.push(now);
      store.set(key, prev);
      return true;
    },
    // Limpia la clave (p. ej. al completar el flujo). Útil en tests.
    reset(key) {
      if (key === undefined) store.clear();
      else store.delete(key);
    },
  };
}
