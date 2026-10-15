import { describe, it, expect } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { homeFeedPath } from '../homeFeedPath'
import { HOME_FEED_KEY } from '../../api/queryKeys'

const cached = (visita) => ({ pages: [{ ok: true, data: [], nextCursor: 'c1', visita }], pageParams: [null] })

describe('homeFeedPath', () => {
  it('página 1 sin cache: sin visita (visita nueva → el feed rota)', () => {
    expect(homeFeedPath(20, null, undefined)).toBe('/categories/feed?limit=20')
  })

  it('página 1 con datos en cache: reenvía la visita (no reordena bajo el dedo)', () => {
    expect(homeFeedPath(20, null, cached('abc-_1'))).toBe('/categories/feed?limit=20&visita=abc-_1')
  })

  it('páginas siguientes: solo el cursor', () => {
    expect(homeFeedPath(20, 'cur', cached('abc'))).toBe('/categories/feed?limit=20&cursor=cur')
  })

  it('invitado (sin visita en la respuesta): nunca agrega visita', () => {
    expect(homeFeedPath(20, null, cached(undefined))).toBe('/categories/feed?limit=20')
  })

  it('con un QueryClient real: invalidate conserva la visita, reset la descarta', async () => {
    const qc = new QueryClient()
    qc.setQueryData(HOME_FEED_KEY, cached('v1'))
    // invalidateQueries no borra datos → el refetch de la página 1 lleva visita.
    await qc.invalidateQueries({ queryKey: HOME_FEED_KEY })
    expect(homeFeedPath(20, null, qc.getQueryData(HOME_FEED_KEY))).toContain('visita=v1')
    // resetQueries (Inicio/logo) vuelve al estado inicial sin datos → visita nueva.
    await qc.resetQueries({ queryKey: HOME_FEED_KEY })
    expect(homeFeedPath(20, null, qc.getQueryData(HOME_FEED_KEY))).toBe('/categories/feed?limit=20')
  })
})
