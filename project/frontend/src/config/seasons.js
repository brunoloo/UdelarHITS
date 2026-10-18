// ── FUENTE DE VERDAD DE TEMPORADAS ─────────────────────────────────────────
// Único lugar donde vive la lista de temas estacionales (decoración por fecha).
// La consume SeasonContext, que resuelve la temporada activa al montar la app y
// la expone vía useSeason(). Los componentes deciden qué cambiar según el id.
//
// Rangos en hora LOCAL, ambos extremos inclusive, sin año: se repiten cada año.
// `month` va de 1 a 12 (no como Date#getMonth).
//
// Agregar una temporada = una entrada acá + sus tokens en styles/tokens.css
// (sección "Temas estacionales") + los casos en los componentes que la usen
// (LikeIcon, SeasonalDecor, Header). Por ejemplo:
//
//   { id: 'navidad',  from: { month: 12, day: 15 }, to: { month: 12, day: 26 } },
//   // Rango que cruza el año: from > to, isInRange lo maneja solo.
//   { id: 'anio-nuevo', from: { month: 12, day: 28 }, to: { month: 1, day: 2 } },
//
// Override manual (para probar o apagar): ?season=<id> fuerza una temporada y
// ?season=none la apaga. Queda guardado en sessionStorage ('season-override')
// hasta cerrar la pestaña.
export const SEASONS = [
  { id: 'halloween', from: { month: 10, day: 15 }, to: { month: 11, day: 2 } },
]

export const SEASON_IDS = SEASONS.map(s => s.id)

const OVERRIDE_KEY = 'season-override'
const OVERRIDE_NONE = 'none'

export function isSeason(value) {
  return SEASON_IDS.includes(value)
}

// mes/día → número comparable (15/10 → 1015). Si from <= to el rango es normal;
// si no, cruza el fin de año (ej. 28/12 → 2/1) y vale "desde from O hasta to".
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

// Lectura/escritura tolerante: sessionStorage puede tirar (modo privado,
// storage bloqueado). Un fallo nunca rompe la app, solo pierde el override.
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

// Prioridad: ?season= en la URL > override guardado > fecha.
// Un ?season= con id desconocido se ignora (no pisa nada).
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
