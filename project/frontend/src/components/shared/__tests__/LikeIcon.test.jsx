import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { LikeIcon } from '../LikeIcon'
import { SeasonContext } from '../../../context/seasonCtx'

function renderWithSeason(ui, season) {
  return render(<SeasonContext.Provider value={season}>{ui}</SeasonContext.Provider>)
}

describe('LikeIcon', () => {
  it('sin provider muestra el pulgar', () => {
    const { container } = render(<LikeIcon />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg.getAttribute('aria-hidden')).toBe('true')
    expect(container.querySelector('.pumpkin-icon')).toBeNull()
  })

  it('en Halloween muestra la calabaza', () => {
    const { container } = renderWithSeason(<LikeIcon />, 'halloween')
    expect(container.querySelector('.pumpkin-icon')).not.toBeNull()
    expect(container.querySelector('.pumpkin-icon--decorative')).toBeNull()
  })

  it('filled cambia el relleno (pulgar y calabaza)', () => {
    const thumbOff = render(<LikeIcon />).container.querySelector('svg')
    const thumbOn = render(<LikeIcon filled />).container.querySelector('svg')
    expect(thumbOff.getAttribute('fill')).toBe('none')
    expect(thumbOn.getAttribute('fill')).toBe('currentColor')

    const pumpOff = renderWithSeason(<LikeIcon />, 'halloween').container.querySelector('.pumpkin-body')
    const pumpOn = renderWithSeason(<LikeIcon filled />, 'halloween').container.querySelector('.pumpkin-body')
    expect(pumpOff.getAttribute('fill')).toBe('none')
    expect(pumpOn.getAttribute('fill')).toBe('currentColor')
  })

  it('respeta size', () => {
    const svg = render(<LikeIcon size={18} />).container.querySelector('svg')
    expect(svg.getAttribute('width')).toBe('18')
  })
})
