// ── FUENTE DE VERDAD DE TEMAS ──────────────────────────────────────────────
// Único lugar donde vive la lista de temas de color. La consumen el selector de
// la pantalla de Apariencia, la validación del contexto y cualquier otro
// consumidor de React.
//
// Agregar una paleta nueva = una entrada acá + un bloque [data-theme="id"] en
// styles/tokens.css. Nada más: el script anti-flash de index.html NO conoce
// esta lista (deja pasar cualquier id y el CSS degrada al tema claro si no hay
// bloque), así que no hay que tocar el hash CSP para sumar un color.
//
// `bg` es el fondo oscuro teñido de la paleta (el color de la muestra) y
// `swatch` su acento (el anillo/check de la muestra). La grilla usa ambos. NO
// se guardan colores en ningún lado: en localStorage solo vive el `id`.

// Temas base, mutuamente excluyentes con las paletas (mismo selector, mismo
// localStorage). No llevan swatch: se muestran como opciones aparte.
export const BASE_THEMES = ['light', 'dark', 'system']

// Paletas de color personalizadas: cuatro claras + cuatro oscuras. `family`
// agrupa la grilla en dos secciones ("Claros"/"Oscuros"). `bg` es el fondo de
// la paleta (y la muestra del swatch); `swatch` su acento (anillo/check).
export const PALETTES = [
  // Claras
  { id: 'rosa-claro',    label: 'Rosa',    family: 'claro',  bg: '#FCCAE6', swatch: '#C62F85' },
  { id: 'verde-claro',   label: 'Verde',   family: 'claro',  bg: '#D9EDCF', swatch: '#3F801E' },
  { id: 'celeste-claro', label: 'Celeste', family: 'claro',  bg: '#C9D8EE', swatch: '#2F6DCA' },
  { id: 'lavanda-claro', label: 'Lavanda', family: 'claro',  bg: '#CFB1F1', swatch: '#8541D2' },
  // Oscuras
  { id: 'rosa-oscuro',    label: 'Rosa',    family: 'oscuro', bg: '#391320', swatch: '#e47d9f' },
  { id: 'verde-oscuro',   label: 'Verde',   family: 'oscuro', bg: '#13391f', swatch: '#2bcc5b' },
  { id: 'celeste-oscuro', label: 'Celeste', family: 'oscuro', bg: '#132539', swatch: '#70a5e1' },
  { id: 'lavanda-oscuro', label: 'Lavanda', family: 'oscuro', bg: '#241339', swatch: '#af86e5' },
]

// Grilla agrupada por familia (el selector de la UI lee de acá).
export const PALETTE_GROUPS = [
  { family: 'claro',  label: 'Claros',  items: PALETTES.filter(p => p.family === 'claro') },
  { family: 'oscuro', label: 'Oscuros', items: PALETTES.filter(p => p.family === 'oscuro') },
]

export const PALETTE_IDS = PALETTES.map(p => p.id)

// Todos los valores válidos que pueden vivir bajo la clave 'theme'.
export const THEME_IDS = [...BASE_THEMES, ...PALETTE_IDS]

export function isValidTheme(value) {
  return THEME_IDS.includes(value)
}

export function isPalette(value) {
  return PALETTE_IDS.includes(value)
}

// Badge "Nuevo" en la opción "Personalizada" del selector de tema. Es temporal:
// se muestra solo mientras la fecha actual es anterior a esta. Pasada la fecha
// desaparece solo y el código queda inerte hasta borrarlo. NO usa localStorage:
// es una comparación de fecha, sin flag persistido.
export const NEW_BADGE_UNTIL = new Date('2026-09-19T23:59:59')

export function isNewBadgeActive() {
  return Date.now() < NEW_BADGE_UNTIL.getTime()
}
