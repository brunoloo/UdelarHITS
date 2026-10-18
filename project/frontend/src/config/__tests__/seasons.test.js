import { describe, it, expect } from 'vitest'
import { getActiveSeason, isInRange, isSeason, resolveSeason } from '../seasons'

// Fechas en hora local (new Date(y, m-1, d)), igual que la app.
const d = (y, m, day) => new Date(y, m - 1, day)

function fakeStorage(initial = {}) {
  const data = { ...initial }
  return {
    data,
    getItem: k => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v) },
  }
}

const throwingStorage = {
  getItem: () => { throw new Error('bloqueado') },
  setItem: () => { throw new Error('bloqueado') },
}

describe('getActiveSeason (Halloween 15/10–2/11 inclusive)', () => {
  it('fuera del rango → null', () => {
    expect(getActiveSeason(d(2026, 10, 14))).toBeNull()
    expect(getActiveSeason(d(2026, 11, 3))).toBeNull()
  })

  it('extremos inclusive → halloween', () => {
    expect(getActiveSeason(d(2026, 10, 15))).toBe('halloween')
    expect(getActiveSeason(d(2026, 10, 31))).toBe('halloween')
    expect(getActiveSeason(d(2026, 11, 2))).toBe('halloween')
  })
})

describe('isInRange con rango que cruza el año', () => {
  const from = { month: 12, day: 28 }
  const to = { month: 1, day: 2 }

  it('30/12 y 1/1 caen dentro', () => {
    expect(isInRange(d(2026, 12, 30), from, to)).toBe(true)
    expect(isInRange(d(2027, 1, 1), from, to)).toBe(true)
  })

  it('3/1 y 27/12 caen fuera', () => {
    expect(isInRange(d(2027, 1, 3), from, to)).toBe(false)
    expect(isInRange(d(2026, 12, 27), from, to)).toBe(false)
  })
})

describe('isSeason', () => {
  it('valida ids conocidos', () => {
    expect(isSeason('halloween')).toBe(true)
    expect(isSeason('none')).toBe(false)
    expect(isSeason('navidad')).toBe(false)
    expect(isSeason(null)).toBe(false)
  })
})

describe('resolveSeason', () => {
  const fuera = d(2026, 6, 1)
  const dentro = d(2026, 10, 20)

  it('sin query ni override usa la fecha', () => {
    expect(resolveSeason({ date: dentro, search: '', storage: fakeStorage() })).toBe('halloween')
    expect(resolveSeason({ date: fuera, search: '', storage: fakeStorage() })).toBeNull()
  })

  it('?season=<id> válido gana sobre la fecha y se persiste', () => {
    const storage = fakeStorage()
    expect(resolveSeason({ date: fuera, search: '?season=halloween', storage })).toBe('halloween')
    expect(storage.data['season-override']).toBe('halloween')
  })

  it('?season=none apaga la temporada y se persiste', () => {
    const storage = fakeStorage()
    expect(resolveSeason({ date: dentro, search: '?season=none', storage })).toBeNull()
    expect(storage.data['season-override']).toBe('none')
  })

  it('sin query aplica el override guardado', () => {
    expect(resolveSeason({ date: fuera, search: '', storage: fakeStorage({ 'season-override': 'halloween' }) })).toBe('halloween')
    expect(resolveSeason({ date: dentro, search: '', storage: fakeStorage({ 'season-override': 'none' }) })).toBeNull()
  })

  it('un id inválido en la query se ignora y no pisa el storage', () => {
    const storage = fakeStorage({ 'season-override': 'none' })
    expect(resolveSeason({ date: dentro, search: '?season=xmas', storage })).toBeNull()
    expect(storage.data['season-override']).toBe('none')
    expect(resolveSeason({ date: dentro, search: '?season=xmas', storage: fakeStorage() })).toBe('halloween')
  })

  it('un override guardado inválido cae a la fecha', () => {
    expect(resolveSeason({ date: dentro, search: '', storage: fakeStorage({ 'season-override': 'basura' }) })).toBe('halloween')
  })

  it('un storage que tira no rompe', () => {
    expect(resolveSeason({ date: dentro, search: '', storage: throwingStorage })).toBe('halloween')
    expect(resolveSeason({ date: fuera, search: '?season=halloween', storage: throwingStorage })).toBe('halloween')
    expect(resolveSeason({ date: dentro, search: '?season=none', storage: throwingStorage })).toBeNull()
  })

  it('sin storage funciona igual', () => {
    expect(resolveSeason({ date: dentro, search: '' })).toBe('halloween')
  })
})
