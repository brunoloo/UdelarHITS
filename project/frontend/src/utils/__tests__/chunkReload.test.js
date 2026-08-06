import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { isChunkLoadError, reloadOnceForChunkError } from '../chunkReload'

describe('isChunkLoadError', () => {
  test('detecta el mensaje de import dinámico fallido (Chrome)', () => {
    const err = new Error(
      'Failed to fetch dynamically imported module: /assets/ExplorePage-CEWS0kwk.js'
    )
    expect(isChunkLoadError(err)).toBe(true)
  })

  test('detecta el mensaje de Firefox/Safari', () => {
    expect(isChunkLoadError(new Error('Importing a module script failed.'))).toBe(true)
  })

  test('detecta el mensaje clásico de "Loading chunk"', () => {
    expect(isChunkLoadError(new Error('Loading chunk 42 failed.'))).toBe(true)
  })

  test('acepta un string plano', () => {
    expect(isChunkLoadError('Failed to fetch dynamically imported module')).toBe(true)
  })

  test('NO marca como chunk error un error de red genérico', () => {
    expect(isChunkLoadError(new Error('Network request failed'))).toBe(false)
  })

  test('es tolerante a null/undefined', () => {
    expect(isChunkLoadError(null)).toBe(false)
    expect(isChunkLoadError(undefined)).toBe(false)
  })
})

describe('reloadOnceForChunkError', () => {
  let reloadMock

  beforeEach(() => {
    sessionStorage.clear()
    reloadMock = vi.fn()
    // window.location.reload no es configurable directamente en jsdom; se
    // reemplaza el objeto location por uno con reload mockeado.
    vi.stubGlobal('location', { ...window.location, reload: reloadMock })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    sessionStorage.clear()
  })

  test('recarga en el primer disparo y devuelve true', () => {
    expect(reloadOnceForChunkError()).toBe(true)
    expect(reloadMock).toHaveBeenCalledTimes(1)
  })

  test('NO recarga de nuevo dentro de la ventana de 10 s (evita el bucle)', () => {
    expect(reloadOnceForChunkError()).toBe(true)
    expect(reloadOnceForChunkError()).toBe(false)
    expect(reloadMock).toHaveBeenCalledTimes(1)
  })

  test('vuelve a recargar pasada la ventana de 10 s', () => {
    const now = 1_000_000
    const spy = vi.spyOn(Date, 'now')
    spy.mockReturnValue(now)
    expect(reloadOnceForChunkError()).toBe(true)

    spy.mockReturnValue(now + 10_001)
    expect(reloadOnceForChunkError()).toBe(true)
    expect(reloadMock).toHaveBeenCalledTimes(2)
    spy.mockRestore()
  })
})
