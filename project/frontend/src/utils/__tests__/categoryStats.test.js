import { describe, it, expect } from 'vitest'
import { categoryStats } from '../categoryStats'

describe('categoryStats', () => {
  it('omite los contadores en cero', () => {
    expect(categoryStats(0, 12)).toBe('12 comentarios')
    expect(categoryStats(3, 0)).toBe('3 temas')
  })

  it('devuelve vacío si no hay nada que contar', () => {
    expect(categoryStats(0, 0)).toBe('')
    expect(categoryStats(null, undefined)).toBe('')
  })

  it('une ambos contadores y respeta el singular', () => {
    expect(categoryStats(1, 1)).toBe('1 tema · 1 comentario')
    expect(categoryStats('2', '5')).toBe('2 temas · 5 comentarios')
  })
})
