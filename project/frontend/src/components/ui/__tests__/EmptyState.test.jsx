import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { EmptyState } from '../EmptyState'

const renderIn = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>)

describe('EmptyState', () => {
  it('muestra el mensaje y un enlace de salida', () => {
    renderIn(<EmptyState message="Nada por acá" to="/explore" label="Explorar" />)
    expect(screen.getByText('Nada por acá')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Explorar' }).getAttribute('href')).toBe('/explore')
  })

  it('sin destino solo informa', () => {
    renderIn(<EmptyState message="Nada por acá" />)
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('avisa al navegar, para que un panel pueda cerrarse', () => {
    const onNavigate = vi.fn()
    renderIn(<EmptyState message="x" to="/explore" label="Explorar" onNavigate={onNavigate} />)
    fireEvent.click(screen.getByRole('link', { name: 'Explorar' }))
    expect(onNavigate).toHaveBeenCalled()
  })

  it('conserva la clase del contenedor de cada pantalla', () => {
    const { container } = renderIn(<EmptyState message="x" className="notif-empty" />)
    expect(container.querySelector('.empty-state.notif-empty')).not.toBeNull()
  })
})
