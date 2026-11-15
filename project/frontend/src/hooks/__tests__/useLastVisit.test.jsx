import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useLastVisit } from '../useLastVisit'

describe('useLastVisit', () => {
  beforeEach(() => localStorage.clear())

  it('en la primera visita no hay marca, y la deja guardada para la próxima', () => {
    const antes = Date.now()
    const { result } = renderHook(() => useLastVisit('recent'))

    expect(result.current).toBeNull()
    expect(Number(localStorage.getItem('last-visit:recent'))).toBeGreaterThanOrEqual(antes)
  })

  it('devuelve la visita anterior aunque ya haya registrado la actual', () => {
    localStorage.setItem('last-visit:recent', '1700000000000')
    const { result, rerender } = renderHook(() => useLastVisit('recent'))

    expect(result.current).toBe(1700000000000)
    rerender()
    expect(result.current).toBe(1700000000000)
    expect(Number(localStorage.getItem('last-visit:recent'))).toBeGreaterThan(1700000000000)
  })

  it('ignora un valor corrupto', () => {
    localStorage.setItem('last-visit:recent', 'no-es-una-fecha')
    const { result } = renderHook(() => useLastVisit('recent'))
    expect(result.current).toBeNull()
  })

  it('cada pantalla lleva su propia marca', () => {
    localStorage.setItem('last-visit:recent', '1700000000000')
    const { result } = renderHook(() => useLastVisit('otra'))
    expect(result.current).toBeNull()
  })
})
