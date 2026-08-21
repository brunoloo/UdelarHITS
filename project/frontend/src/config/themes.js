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

// Paletas de color personalizadas. El orden acá es el orden de la grilla.
export const PALETTES = [
  { id: 'rosa',    label: 'Rosa',    bg: '#391320', swatch: '#e47d9f' },
  { id: 'coral',   label: 'Coral',   bg: '#391c13', swatch: '#e18b70' },
  { id: 'arena',   label: 'Arena',   bg: '#392e13', swatch: '#d6a73b' },
  { id: 'verde',   label: 'Verde',   bg: '#13391f', swatch: '#2bcc5b' },
  { id: 'celeste', label: 'Celeste', bg: '#132539', swatch: '#70a5e1' },
  { id: 'lavanda', label: 'Lavanda', bg: '#241339', swatch: '#af86e5' },
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
