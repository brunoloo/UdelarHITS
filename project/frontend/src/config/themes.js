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
// `swatch` es el color de acento (la identidad visual del tema) y `bg` el fondo
// pastel; la grilla de muestras usa ambos. NO se guardan colores en ningún
// lado: en localStorage solo vive el `id`.

// Temas base, mutuamente excluyentes con las paletas (mismo selector, mismo
// localStorage). No llevan swatch: se muestran como opciones aparte.
export const BASE_THEMES = ['light', 'dark', 'system']

// Paletas de color personalizadas. El orden acá es el orden de la grilla.
export const PALETTES = [
  { id: 'rosa',    label: 'Rosa',    bg: '#FDF2F5', swatch: '#ba2c5b' },
  { id: 'coral',   label: 'Coral',   bg: '#FDF1ED', swatch: '#c54526' },
  { id: 'arena',   label: 'Arena',   bg: '#FDF6EA', swatch: '#8f6419' },
  { id: 'verde',   label: 'Verde',   bg: '#F1F8F1', swatch: '#257e34' },
  { id: 'celeste', label: 'Celeste', bg: '#EEF4FB', swatch: '#226bc3' },
  { id: 'lavanda', label: 'Lavanda', bg: '#F4F1FA', swatch: '#7341c8' },
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
