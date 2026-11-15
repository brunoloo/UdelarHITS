// Lista de temas estacionales. Rangos en hora local, ambos extremos inclusive, sin año;
// `month` va de 1 a 12. Agregar una temporada: una entrada acá, sus tokens en
// styles/tokens.css y los casos en los componentes que la usen.
// ?season=<id> fuerza una temporada y ?season=none la apaga, hasta cerrar la pestaña.
export const SEASONS = [
  { id: 'halloween', from: { month: 10, day: 15 }, to: { month: 11, day: 2 } },
]

export const SEASON_IDS = SEASONS.map(s => s.id)

const OVERRIDE_KEY = 'season-override'
const OVERRIDE_NONE = 'none'

export function isSeason(value) {
  return SEASON_IDS.includes(value)
}

// Mes y día como número comparable (15/10 → 1015). Si from > to, el rango cruza el fin de año.
export function isInRange(date, from, to) {
  const md = (date.getMonth() + 1) * 100 + date.getDate()
  const a = from.month * 100 + from.day
  const b = to.month * 100 + to.day
  return a <= b ? md >= a && md <= b : md >= a || md <= b
}

export function getActiveSeason(date = new Date()) {
  const season = SEASONS.find(s => isInRange(date, s.from, s.to))
  return season ? season.id : null
}

// sessionStorage puede lanzar (modo privado): un fallo solo pierde el override.
function safeGet(storage) {
  try {
    return storage?.getItem(OVERRIDE_KEY) ?? null
  } catch {
    return null
  }
}

function safeSet(storage, value) {
  try {
    storage?.setItem(OVERRIDE_KEY, value)
  } catch {
    // sin storage: el override vale solo para esta carga
  }
}

// Prioridad: ?season= en la URL, override guardado, fecha. Un id desconocido se ignora.
export function resolveSeason({ date = new Date(), search = '', storage = null } = {}) {
  const param = new URLSearchParams(search ?? '').get('season')

  if (param === OVERRIDE_NONE) {
    safeSet(storage, OVERRIDE_NONE)
    return null
  }
  if (isSeason(param)) {
    safeSet(storage, param)
    return param
  }

  const stored = safeGet(storage)
  if (stored === OVERRIDE_NONE) return null
  if (isSeason(stored)) return stored

  return getActiveSeason(date)
}
