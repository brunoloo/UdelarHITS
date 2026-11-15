import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, act } from '@testing-library/react'
import { YouTubeEmbeds } from '../YouTubeEmbeds'

// IntersectionObserver falso: guarda el callback para dispararlo a mano.
let observerCallback = null

class FakeIntersectionObserver {
  constructor(cb) {
    observerCallback = cb
  }
  observe() {}
  disconnect() {}
}

function intersect() {
  act(() => {
    observerCallback([{ isIntersecting: true }])
  })
}

describe('YouTubeEmbeds', () => {
  beforeEach(() => {
    observerCallback = null
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reserva los contenedores y no crea iframes antes de entrar al viewport', () => {
    const text = 'Mirá https://youtu.be/dQw4w9WgXcQ y https://www.youtube.com/watch?v=9bZkp7q19f0'
    const { container } = render(<YouTubeEmbeds text={text} />)
    expect(container.querySelectorAll('.yt-embed')).toHaveLength(2)
    expect(container.querySelectorAll('iframe')).toHaveLength(0)
  })

  it('crea los iframes en orden con el dominio nocookie al intersectar', () => {
    const text = 'Uno https://youtu.be/dQw4w9WgXcQ dos https://www.youtube.com/shorts/9bZkp7q19f0 tres https://m.youtube.com/watch?v=kJQP7kiw5Fk'
    const { container } = render(<YouTubeEmbeds text={text} />)
    intersect()
    const iframes = container.querySelectorAll('iframe')
    expect(iframes).toHaveLength(3)
    const ids = ['dQw4w9WgXcQ', '9bZkp7q19f0', 'kJQP7kiw5Fk']
    iframes.forEach((iframe, i) => {
      const src = iframe.getAttribute('src')
      expect(src.startsWith(`https://www.youtube-nocookie.com/embed/${ids[i]}?`)).toBe(true)
      expect(src).toContain('autoplay=1&mute=1&controls=1')
    })
  })

  it('no renderiza nada con un ID inválido', () => {
    const { container } = render(<YouTubeEmbeds text="https://youtu.be/corto" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('no renderiza nada con solo una playlist', () => {
    const { container } = render(<YouTubeEmbeds text="https://www.youtube.com/playlist?list=PL1234567890" />)
    expect(container).toBeEmptyDOMElement()
  })
})
