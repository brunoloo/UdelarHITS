import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { describe, it, expect } from 'vitest'
import { PALETTE_IDS } from '../config/themes'

// Verifica la cascada de tokens.css SIN depender del motor CSS de jsdom (que
// resuelve mal las custom properties). Parsea las reglas y resuelve el valor
// ganador por especificidad + orden de fuente, que es lo que hace el navegador.
//
// Lo que prueba, para cada paleta:
//   - un token PROPIO (--bg) gana con el valor de la paleta (bloque por tema).
//   - un token COMPARTIDO (--danger, --shadow-1, --modal-overlay,
//     --reaction-like-bg) resuelve al valor de la familia OSCURA, no al claro.

const __dirname = dirname(fileURLToPath(import.meta.url))
// Quitar comentarios /* ... */ antes de parsear: si no, quedan pegados al
// selector de la regla siguiente y rompen el match.
const css = readFileSync(resolve(__dirname, 'tokens.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')

// Parseo simple de reglas: "selectorList { body }"
const rules = []
const ruleRe = /([^{}]+)\{([^{}]*)\}/g
let m
while ((m = ruleRe.exec(css))) {
  const selectors = m[1].split(',').map(s => s.trim()).filter(Boolean)
  const decls = {}
  for (const d of m[2].split(';')) {
    const i = d.indexOf(':')
    if (i === -1) continue
    decls[d.slice(0, i).trim()] = d.slice(i + 1).trim()
  }
  rules.push({ selectors, decls, order: rules.length })
}

// ¿matchea el selector a :root con data-theme=theme? (theme null = sin atributo)
function matches(sel, theme) {
  if (sel === ':root') return true
  const mm = sel.match(/^:root\[data-theme="([^"]+)"\]$/)
  return mm ? mm[1] === theme : false
}
// Especificidad relevante: [data-theme] sube el peso sobre :root a secas.
function specificity(sel) {
  return sel === ':root' ? 1 : 2
}

// Valor ganador de una custom property para un theme dado.
function resolve_(prop, theme) {
  let best = null
  for (const rule of rules) {
    if (!(prop in rule.decls)) continue
    for (const sel of rule.selectors) {
      if (!matches(sel, theme)) continue
      const cand = { spec: specificity(sel), order: rule.order, value: rule.decls[prop] }
      if (!best || cand.spec > best.spec || (cand.spec === best.spec && cand.order > best.order)) {
        best = cand
      }
    }
  }
  return best ? best.value : undefined
}

const LIGHT_DANGER = '#d93025'
const DARK_DANGER = '#ff6b6b'

describe('cascada de tokens de tema', () => {
  it('el tema claro (:root, sin data-theme) rinde sus valores', () => {
    expect(resolve_('--bg', null)).toBe('#f6f7f8')
    expect(resolve_('--danger', null)).toBe(LIGHT_DANGER)
    expect(resolve_('--reaction-like-bg', null)).toBe('#fde7ee')
  })

  it('cada paleta: token PROPIO (--bg) gana con el valor de la paleta', () => {
    for (const id of PALETTE_IDS) {
      const bg = resolve_('--bg', id)
      expect(bg).toBeDefined()
      // No es el fondo del tema claro ni el del oscuro base.
      expect(bg).not.toBe('#f6f7f8')
      expect(bg).not.toBe('#0f1419')
    }
  })

  it('cada paleta: token COMPARTIDO resuelve a la familia oscura, no al claro', () => {
    for (const id of PALETTE_IDS) {
      expect(resolve_('--danger', id)).toBe(DARK_DANGER)
      expect(resolve_('--modal-overlay', id)).toBe('rgba(0, 0, 0, 0.75)')
      expect(resolve_('--reaction-like-bg', id)).toBe('#4a1c28')
      expect(resolve_('--shadow-1', id)).toContain('rgba(0, 0, 0, 0.30)')
    }
  })

  it('el bloque compartido va ANTES que los bloques por paleta', () => {
    const sharedIdx = rules.findIndex(
      r => r.selectors.includes(':root[data-theme="dark"]') &&
           r.selectors.includes(':root[data-theme="rosa"]')
    )
    const rosaOwnIdx = rules.findIndex(
      r => r.selectors.length === 1 && r.selectors[0] === ':root[data-theme="rosa"]'
    )
    expect(sharedIdx).toBeGreaterThanOrEqual(0)
    expect(rosaOwnIdx).toBeGreaterThan(sharedIdx)
  })
})
