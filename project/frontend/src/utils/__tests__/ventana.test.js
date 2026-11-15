import { describe, it, expect } from 'vitest'
import { ventanaTexto, ventanaSubtitulo, heroLabel } from '../ventana'

describe('textos de la ventana del ranking', () => {
  it('nombra la ventana usada', () => {
    expect(ventanaTexto(7)).toBe('esta semana')
    expect(ventanaTexto(30)).toBe('en los últimos 30 días')
    expect(ventanaTexto(null)).toBe('desde siempre')
  })

  it('el subtítulo no habla de días en el histórico', () => {
    expect(ventanaSubtitulo(90)).toBe('Las categorías con más actividad en los últimos 90 días')
    expect(ventanaSubtitulo(null)).not.toMatch(/días/)
  })

  it('el hero solo dice "de la semana" con ventana semanal', () => {
    expect(heroLabel(7)).toBe('Categoría de la semana')
    expect(heroLabel(30)).toBe('Categoría del mes')
    expect(heroLabel(90)).toBe('Categoría destacada')
    expect(heroLabel(null)).toBe('Categoría destacada')
  })
})
