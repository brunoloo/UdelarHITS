import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { LikeIcon } from '../LikeIcon'
import { SeasonContext } from '../../../context/seasonCtx'

describe('LikeIcon', () => {
  it('sin provider muestra el pulgar', () => {
    const { container } = render(<LikeIcon />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg.getAttribute('aria-hidden')).toBe('true')
    expect(container.querySelector('.pumpkin-icon')).toBeNull()
  })

  it('en Halloween sigue siendo el pulgar', () => {
    const { container } = render(
      <SeasonContext.Provider value="halloween">
        <LikeIcon />
      </SeasonContext.Provider>,
    )
    expect(container.querySelector('.pumpkin-icon')).toBeNull()
  })

  it('filled cambia el relleno', () => {
    const thumbOff = render(<LikeIcon />).container.querySelector('svg')
    const thumbOn = render(<LikeIcon filled />).container.querySelector('svg')
    expect(thumbOff.getAttribute('fill')).toBe('none')
    expect(thumbOn.getAttribute('fill')).toBe('currentColor')
  })

  it('respeta size', () => {
    const svg = render(<LikeIcon size={18} />).container.querySelector('svg')
    expect(svg.getAttribute('width')).toBe('18')
  })
})
