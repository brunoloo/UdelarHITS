import { describe, test, expect, vi, afterEach } from 'vitest'
import { requestPushPermission } from '../push'

// jsdom no implementa Notification: cada test instala la variante que quiere
// simular. Lo que importa es cómo se comporta CADA navegador real, porque la
// diferencia entre ellos fue justamente el bug.
const original = globalThis.Notification

afterEach(() => {
  globalThis.Notification = original
})

describe('requestPushPermission', () => {
  test('Chrome/Edge/Firefox: llaman al callback Y resuelven la promesa, pero se procesa una sola vez', async () => {
    globalThis.Notification = {
      requestPermission: vi.fn(cb => {
        cb('granted')
        return Promise.resolve('granted')
      }),
    }
    const alResolver = vi.fn()

    await requestPushPermission().then(alResolver)
    // Un tick extra por si la segunda resolución llegara tarde.
    await Promise.resolve()

    // Antes del fix, el handler corría dos veces y lanzaba dos suscripciones.
    expect(alResolver).toHaveBeenCalledTimes(1)
    expect(alResolver).toHaveBeenCalledWith('granted')
  })

  test('Safari viejo: solo callback, devuelve undefined', async () => {
    globalThis.Notification = {
      requestPermission: vi.fn(cb => { cb('granted') }),
    }
    await expect(requestPushPermission()).resolves.toBe('granted')
  })

  test('solo promesa, sin llamar al callback', async () => {
    globalThis.Notification = {
      requestPermission: vi.fn(() => Promise.resolve('denied')),
    }
    await expect(requestPushPermission()).resolves.toBe('denied')
  })

  test('pide el permiso de forma sincrónica, sin perder el gesto del click', () => {
    const requestPermission = vi.fn(() => Promise.resolve('granted'))
    globalThis.Notification = { requestPermission }

    requestPushPermission()
    // Si hubiera un await antes, iOS descartaría el pedido en silencio.
    expect(requestPermission).toHaveBeenCalledTimes(1)
  })

  test('pasa tal cual el "default" (cartel cerrado o escondido por Chrome)', async () => {
    globalThis.Notification = {
      requestPermission: vi.fn(() => Promise.resolve('default')),
    }
    await expect(requestPushPermission()).resolves.toBe('default')
  })
})
