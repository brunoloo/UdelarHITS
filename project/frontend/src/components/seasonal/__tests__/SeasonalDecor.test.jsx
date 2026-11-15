import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { SeasonalDecor } from '../SeasonalDecor'
import { SeasonContext } from '../../../context/seasonCtx'

describe('SeasonalDecor', () => {
  it('sin temporada no renderiza nada', () => {
    const { container } = render(<SeasonalDecor />)
    expect(container.innerHTML).toBe('')
  })

  it('en Halloween renderiza la capa decorativa oculta a lectores', () => {
    const { container } = render(
      <SeasonContext.Provider value="halloween">
        <SeasonalDecor />
      </SeasonContext.Provider>
    )
    const decor = container.querySelector('.seasonal-decor')
    expect(decor).not.toBeNull()
    expect(decor.getAttribute('aria-hidden')).toBe('true')
    expect(decor.querySelectorAll('svg')).toHaveLength(2)
  })
})
