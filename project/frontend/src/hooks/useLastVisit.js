import { useEffect, useState } from 'react'

const PREFIX = 'last-visit:'

function read(key) {
  try {
    const ts = Number(localStorage.getItem(PREFIX + key))
    return Number.isFinite(ts) && ts > 0 ? ts : null
  } catch {
    return null
  }
}

// Momento (ms) de la visita anterior a una pantalla en este navegador, o null si es la
// primera. La visita actual se registra al montar; el valor devuelto no cambia hasta
// que la pantalla se vuelve a montar.
export function useLastVisit(key) {
  // Lectura perezosa: tiene que ocurrir antes de que el efecto guarde la visita actual.
  const [previous] = useState(() => read(key))

  useEffect(() => {
    try {
      localStorage.setItem(PREFIX + key, String(Date.now()))
    } catch { /* almacenamiento bloqueado: no hay marca, y no es un error */ }
  }, [key])

  return previous
}
