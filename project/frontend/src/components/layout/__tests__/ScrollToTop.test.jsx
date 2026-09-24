import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom'
import { ScrollToTop } from '../ScrollToTop'

// Sonda con las dos navegaciones que hay que distinguir: una común (cambio de
// página real) y una reescritura de URL dentro del hilo de un permalink, que va
// marcada con state.threadMove.
function Probe() {
  const navigate = useNavigate()
  return (
    <>
      <button type="button" onClick={() => navigate('/topic/1')}>navegar</button>
      <button
        type="button"
        onClick={() => navigate('/comment/7', { replace: true, state: { threadMove: true } })}
      >
        mover en el hilo
      </button>
    </>
  )
}

function renderAt(entry) {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <ScrollToTop />
      <Routes>
        <Route path="*" element={<Probe />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ScrollToTop', () => {
  beforeEach(() => {
    window.scrollTo = vi.fn()
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('una navegación normal manda la página al tope', () => {
    renderAt('/')
    window.scrollTo.mockClear()

    fireEvent.click(screen.getByRole('button', { name: 'navegar' }))

    expect(window.scrollTo).toHaveBeenCalledWith(0, 0)
  })

  it('una reescritura de URL dentro del hilo no scrollea', () => {
    renderAt('/comment/5')
    window.scrollTo.mockClear()

    fireEvent.click(screen.getByRole('button', { name: 'mover en el hilo' }))

    expect(window.scrollTo).not.toHaveBeenCalled()
  })
})
