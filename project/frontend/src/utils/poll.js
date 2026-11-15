export const POLL_MIN_OPC = 2
export const POLL_MAX_OPC = 5
export const POLL_MAX_TEXTO = 80
export const POLL_DUR_MIN = 60            // 1 minuto
export const POLL_DUR_MAX = 7 * 24 * 3600 // 1 semana

// Dos opciones, un día de duración.
export const nuevaEncuesta = () => ({ opciones: ['', ''], dias: 1, horas: 0, minutos: 0 })

export const pollDurationSeconds = ({ dias, horas, minutos }) =>
  (Number(dias) || 0) * 86400 + (Number(horas) || 0) * 3600 + (Number(minutos) || 0) * 60

export function pollValido(poll) {
  if (!poll) return false
  const ops = (poll.opciones || []).map(o => o.trim()).filter(Boolean)
  if (ops.length < POLL_MIN_OPC) return false
  if (ops.some(o => o.length > POLL_MAX_TEXTO)) return false
  const dur = pollDurationSeconds(poll)
  return dur >= POLL_DUR_MIN && dur <= POLL_DUR_MAX
}

export function buildPollPayload(poll) {
  return {
    opciones: poll.opciones.map(o => o.trim()).filter(Boolean),
    duracion_segundos: Math.min(pollDurationSeconds(poll), POLL_DUR_MAX),
  }
}

export function tiempoRestante(fechaCierre) {
  const ms = new Date(fechaCierre).getTime() - Date.now()
  if (ms <= 0) return 'Finalizada'
  const min = Math.floor(ms / 60000)
  if (min < 60) return `Termina en ${min || 1} ${min === 1 ? 'minuto' : 'minutos'}`
  const horas = Math.floor(min / 60)
  if (horas < 24) return `Termina en ${horas} ${horas === 1 ? 'hora' : 'horas'}`
  const dias = Math.floor(horas / 24)
  return `Termina en ${dias} ${dias === 1 ? 'día' : 'días'}`
}
