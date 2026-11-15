// Limiter en memoria por clave, con ventana deslizante. El estado se pierde al
// reiniciar y no se comparte entre instancias.
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
    // Consulta el cupo sin consumirlo, para registrar el intento solo si la operación
    // posterior tiene éxito.
    peek(key) {
      const now = Date.now();
      const prev = (store.get(key) || []).filter(t => now - t < windowMs);
      return prev.length < max;
    },
    reset(key) {
      if (key === undefined) store.clear();
      else store.delete(key);
    },
  };
}
