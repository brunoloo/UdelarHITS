import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { describe, it, expect } from 'vitest'
import { PALETTES } from '../config/themes'

// Verifica la cascada de tokens.css SIN depender del motor CSS de jsdom (que
// resuelve mal las custom properties). Parsea las reglas y resuelve el valor
// ganador por especificidad + orden de fuente, que es lo que hace el navegador.
//
// Prueba, por paleta:
//   - un token PROPIO (--bg, --chrome-bg) gana con el valor de la paleta.
//   - un token no-de-matiz (--danger, --reaction-like-bg) resuelve a la familia
//     correcta: las OSCURAS al bloque compartido oscuro, las CLARAS a :root.

const __dirname = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(resolve(__dirname, 'tokens.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')

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

function matches(sel, theme) {
  if (sel === ':root') return true
  const mm = sel.match(/^:root\[data-theme="([^"]+)"\]$/)
  return mm ? mm[1] === theme : false
}
const specificity = sel => (sel === ':root' ? 1 : 2)

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
const lightIds = PALETTES.filter(p => p.family === 'claro').map(p => p.id)
const darkIds = PALETTES.filter(p => p.family === 'oscuro').map(p => p.id)

describe('cascada de tokens de tema', () => {
  it('el tema claro (:root) rinde sus valores', () => {
    expect(resolve_('--bg', null)).toBe('#f6f7f8')
    expect(resolve_('--danger', null)).toBe(LIGHT_DANGER)
    expect(resolve_('--reaction-like-bg', null)).toBe('#fde7ee')
  })

  it('--chrome-bg en claro y oscuro vale lo mismo que --surface (cero cambio)', () => {
    expect(resolve_('--chrome-bg', null)).toBe(resolve_('--surface', null))
    expect(resolve_('--chrome-bg', 'dark')).toBe(resolve_('--surface', 'dark'))
  })

  it('cada paleta: --bg y --chrome-bg son propios y distintos entre sí', () => {
    for (const p of PALETTES) {
      const bg = resolve_('--bg', p.id)
      const chrome = resolve_('--chrome-bg', p.id)
      expect(bg).toBe(p.bg)
      expect(chrome).toBeDefined()
      expect(chrome).not.toBe(bg) // el chrome se distingue del fondo del feed
    }
  })

  it('paletas OSCURAS: los no-de-matiz resuelven a la familia oscura', () => {
    for (const id of darkIds) {
      expect(resolve_('--danger', id)).toBe(DARK_DANGER)
      expect(resolve_('--reaction-like-bg', id)).toBe('#4a1c28')
      expect(resolve_('--modal-overlay', id)).toBe('rgba(0, 0, 0, 0.75)')
    }
  })

  it('paletas CLARAS: los no-de-matiz se heredan de :root (claro)', () => {
    for (const id of lightIds) {
      // No están en ningún bloque de la paleta ni en el compartido oscuro:
      // resuelven al valor de :root.
      expect(resolve_('--danger', id)).toBe(LIGHT_DANGER)
      expect(resolve_('--reaction-like-bg', id)).toBe('#fde7ee')
    }
  })

  it('el bloque compartido oscuro va ANTES que los bloques por paleta', () => {
    const sharedIdx = rules.findIndex(
      r => r.selectors.includes(':root[data-theme="dark"]') &&
           r.selectors.includes(':root[data-theme="rosa-oscuro"]')
    )
    const rosaOwnIdx = rules.findIndex(
      r => r.selectors.length === 1 && r.selectors[0] === ':root[data-theme="rosa-oscuro"]'
    )
    expect(sharedIdx).toBeGreaterThanOrEqual(0)
    expect(rosaOwnIdx).toBeGreaterThan(sharedIdx)
  })
})
