import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import {
  renderBioWithLinks,
  getYouTubeVideoId,
  extractYouTubeVideoIds,
  YOUTUBE_ID_REGEX,
} from '../renderBioWithLinks'

function Wrapper({ text }) {
  return <MemoryRouter>{renderBioWithLinks(text)}</MemoryRouter>
}

describe('renderBioWithLinks', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      value: { hostname: 'udelarhits.com' },
      writable: true,
    })
  })

  it('renders internal absolute URL as <Link> without /redirect', () => {
    render(<Wrapper text="Visita https://udelarhits.com/topic/5 para ver" />)
    const link = screen.getByText('https://udelarhits.com/topic/5')
    expect(link.tagName).toBe('A')
    expect(link).toHaveAttribute('href', '/topic/5')
    expect(link.getAttribute('href')).not.toContain('/redirect')
  })

  it('renders external URL through /redirect', () => {
    render(<Wrapper text="Mira https://google.com/search?q=test" />)
    const link = screen.getByText('https://google.com/search?q=test')
    expect(link.tagName).toBe('A')
    expect(link.getAttribute('href')).toContain('/redirect?to=')
    expect(link.getAttribute('href')).toContain(encodeURIComponent('https://google.com/search?q=test'))
  })

  it('renders @mentions as internal Link', () => {
    render(<Wrapper text="Hola @bruno" />)
    const link = screen.getByText('@bruno')
    expect(link).toHaveAttribute('href', '/user/bruno')
  })

  it('returns null for falsy input', () => {
    expect(renderBioWithLinks('')).toBeNull()
    expect(renderBioWithLinks(null)).toBeNull()
  })
})

describe('getYouTubeVideoId', () => {
  const ID = 'dQw4w9WgXcQ'

  // (a) links de video → ID
  it.each([
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtube.com/watch?v=${ID}`,
    `https://m.youtube.com/watch?v=${ID}`,
    `http://www.youtube.com/watch?v=${ID}`,
    `https://youtu.be/${ID}`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/embed/${ID}`,
  ])('reconoce el video en %s', (url) => {
    expect(getYouTubeVideoId(url)).toBe(ID)
  })

  // (a) otros links de YouTube → null
  it.each([
    'https://www.youtube.com/',
    'https://www.youtube.com/playlist?list=PL1234567890abcdef',
    'https://www.youtube.com/@canal',
    'https://www.youtube.com/channel/UC1234567890abcdefghij',
    'https://www.youtube.com/results?search_query=udelar',
  ])('devuelve null para %s', (url) => {
    expect(getYouTubeVideoId(url)).toBeNull()
  })

  // (a) links cualquiera o engañosos → null
  it.each([
    `https://google.com/watch?v=${ID}`,
    `https://youtube.com.evil.com/watch?v=${ID}`,
    `https://notyoutu.be/${ID}`,
    `ftp://www.youtube.com/watch?v=${ID}`,
    'esto no es una url',
  ])('devuelve null para %s', (url) => {
    expect(getYouTubeVideoId(url)).toBeNull()
  })

  // (b) ID exacto con parámetros extra y barra final
  it.each([
    `https://www.youtube.com/watch?v=${ID}&t=30s`,
    `https://www.youtube.com/watch?feature=share&v=${ID}`,
    `https://youtu.be/${ID}?si=abcDEF123`,
    `https://youtu.be/${ID}/`,
    `https://www.youtube.com/shorts/${ID}/`,
    `https://www.youtube.com/embed/${ID}?start=10`,
  ])('extrae el ID exacto de %s', (url) => {
    expect(getYouTubeVideoId(url)).toBe(ID)
  })

  // (c) IDs inválidos → null
  it.each([
    'https://youtu.be/dQw4w9WgXc',
    'https://youtu.be/dQw4w9WgXcQQ',
    'https://youtu.be/dQw4w9WgX.Q',
    'https://www.youtube.com/watch?v=dQw4w9WgX%3CQ',
    'https://www.youtube.com/watch?v=',
  ])('devuelve null para el ID inválido en %s', (url) => {
    expect(getYouTubeVideoId(url)).toBeNull()
  })

  it('YOUTUBE_ID_REGEX exige exactamente 11 caracteres permitidos', () => {
    expect(YOUTUBE_ID_REGEX.test(ID)).toBe(true)
    expect(YOUTUBE_ID_REGEX.test('abc_-123456')).toBe(true)
    expect(YOUTUBE_ID_REGEX.test('abc')).toBe(false)
    expect(YOUTUBE_ID_REGEX.test('abc$1234567')).toBe(false)
  })
})

describe('extractYouTubeVideoIds', () => {
  it('devuelve los IDs en orden y saltea los links que no son video', () => {
    const text = [
      'Primero https://youtu.be/dQw4w9WgXcQ',
      'una playlist https://www.youtube.com/playlist?list=PL123',
      'después https://www.youtube.com/watch?v=9bZkp7q19f0&t=30s',
      'un link cualquiera https://google.com',
      'y un short https://www.youtube.com/shorts/kJQP7kiw5Fk fin',
    ].join('\n')
    expect(extractYouTubeVideoIds(text)).toEqual(['dQw4w9WgXcQ', '9bZkp7q19f0', 'kJQP7kiw5Fk'])
  })

  it('no deduplica', () => {
    const text = 'https://youtu.be/dQw4w9WgXcQ y otra vez https://youtu.be/dQw4w9WgXcQ'
    expect(extractYouTubeVideoIds(text)).toEqual(['dQw4w9WgXcQ', 'dQw4w9WgXcQ'])
  })

  it('devuelve [] con texto vacío', () => {
    expect(extractYouTubeVideoIds('')).toEqual([])
    expect(extractYouTubeVideoIds(null)).toEqual([])
    expect(extractYouTubeVideoIds(undefined)).toEqual([])
  })

  it('no rompe renderBioWithLinks: el link de YouTube sigue yendo por /redirect', () => {
    Object.defineProperty(window, 'location', {
      value: { hostname: 'udelarhits.com' },
      writable: true,
    })
    const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    extractYouTubeVideoIds(`Mirá ${url}`)
    render(<Wrapper text={`Mirá ${url}`} />)
    const link = screen.getByText(url)
    expect(link.tagName).toBe('A')
    expect(link.getAttribute('href')).toContain('/redirect?to=')
  })
})
