import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { FacultyBadge } from '../FacultyBadge'
import { resolveAutor } from '../AuthorDisplay'

describe('FacultyBadge', () => {
  it('renderiza la abreviatura de la facultad', () => {
    const { container } = render(<FacultyBadge facultad="FING" />)
    const badge = container.querySelector('.faculty-badge')
    expect(badge).not.toBeNull()
    expect(badge.textContent).toBe('FING')
  })

  it('no renderiza nada sin facultad', () => {
    const { container } = render(<FacultyBadge facultad={null} />)
    expect(container.querySelector('.faculty-badge')).toBeNull()
    expect(container.innerHTML).toBe('')
  })

  it('resolveAutor toma autor_facultad y la anula si el autor está inactivo', () => {
    expect(resolveAutor({ autor_nickname: 'bruno', autor_facultad: 'FING' }).facultad).toBe('FING')
    expect(resolveAutor({ nickname: 'bruno', facultad: 'FCIEN' }).facultad).toBe('FCIEN')
    expect(resolveAutor({ autor_nickname: 'bruno', autor_facultad: 'FING', autor_estado: 'inactivo' }).facultad).toBeNull()
    expect(resolveAutor(null).facultad).toBeNull()
  })
})
