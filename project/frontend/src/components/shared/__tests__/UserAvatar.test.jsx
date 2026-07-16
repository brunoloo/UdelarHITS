import { describe, it, expect } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { UserAvatar } from '../UserAvatar'

const RAW = 'https://res.cloudinary.com/xx/image/upload/v1/udelarhits/avatars/a.jpg'

describe('UserAvatar', () => {
  it('sin foto muestra la inicial de color', () => {
    const { container } = render(<UserAvatar nickname="bruno" />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('.user-avatar-fallback').textContent).toBe('B')
  })

  it('con foto renderiza el <img> visible (sin gatear por onLoad)', () => {
    const { container } = render(<UserAvatar url_imagen={RAW} nickname="bruno" size="md" />)
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    // Debe pedir el thumbnail transformado, no la URL cruda.
    expect(img.getAttribute('src')).toContain('/upload/c_fill,w_96,h_96,f_auto,q_auto/')
    // Sin opacity:0 — el bug era que quedaba invisible con imágenes cacheadas.
    expect(img.style.opacity).toBe('')
    // No hay inicial mientras hay foto (no se muestra el "default").
    expect(container.querySelector('.user-avatar-fallback')).toBeNull()
  })

  it('si el thumbnail falla, reintenta con la URL original cruda', () => {
    const { container } = render(<UserAvatar url_imagen={RAW} nickname="bruno" />)
    let img = container.querySelector('img')
    expect(img.getAttribute('src')).toContain('c_fill')

    fireEvent.error(img)
    img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img.getAttribute('src')).toBe(RAW) // ya sin transformación
  })

  it('si también falla la original, recién ahí muestra la inicial', () => {
    const { container } = render(<UserAvatar url_imagen={RAW} nickname="bruno" />)
    fireEvent.error(container.querySelector('img')) // falla thumbnail → raw
    fireEvent.error(container.querySelector('img')) // falla raw → inicial
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('.user-avatar-fallback').textContent).toBe('B')
  })
})
