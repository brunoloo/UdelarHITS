// Lista de temas de color. Agregar una paleta: una entrada acá y un bloque
// [data-theme="id"] en styles/tokens.css. El script inline de index.html no conoce esta
// lista, así que no hay que tocar el hash del CSP. En localStorage solo se guarda el id.

// Temas base, excluyentes con las paletas.
export const BASE_THEMES = ['light', 'dark', 'system']

// `bg` es el fondo de la paleta y `swatch` su acento. `family` agrupa la grilla.
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

export const PALETTE_GROUPS = [
  { family: 'claro',  label: 'Claros',  items: PALETTES.filter(p => p.family === 'claro') },
  { family: 'oscuro', label: 'Oscuros', items: PALETTES.filter(p => p.family === 'oscuro') },
]

export const PALETTE_IDS = PALETTES.map(p => p.id)

// Valores válidos de la clave 'theme'.
export const THEME_IDS = [...BASE_THEMES, ...PALETTE_IDS]

export function isValidTheme(value) {
  return THEME_IDS.includes(value)
}

export function isPalette(value) {
  return PALETTE_IDS.includes(value)
}

// El badge "Nuevo" se muestra solo hasta esta fecha.
export const NEW_BADGE_UNTIL = new Date('2026-09-19T23:59:59')

export function isNewBadgeActive() {
  return Date.now() < NEW_BADGE_UNTIL.getTime()
}
