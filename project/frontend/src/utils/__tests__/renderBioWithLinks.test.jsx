import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { renderBioWithLinks } from '../renderBioWithLinks'

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
