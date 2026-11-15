import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useGoHome } from '../useGoHome'
import { HOME_FEED_KEY } from '../../api/queryKeys'

function Probe() {
  const goHome = useGoHome()
  const location = useLocation()
  return (
    <>
      <a href="/" onClick={goHome}>Inicio</a>
      <span data-testid="ruta">{location.pathname + location.search}</span>
    </>
  )
}

function renderAt(entry) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const reset = vi.spyOn(queryClient, 'resetQueries').mockImplementation(() => {})
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(() => {})
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="*" element={<Probe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
  return { reset, invalidate }
}

describe('useGoHome', () => {
  beforeEach(() => {
    window.scrollTo = vi.fn()
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('desde otra ruta navega al inicio, resetea el feed y scrollea al tope', () => {
    const { reset } = renderAt('/topic/1')

    const link = screen.getByRole('link', { name: 'Inicio' })
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    fireEvent(link, event)

    expect(event.defaultPrevented).toBe(true)
    expect(screen.getByTestId('ruta').textContent).toBe('/')
    expect(reset).toHaveBeenCalledWith({ queryKey: HOME_FEED_KEY })
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0 })
  })

  it('estando en el home con filtro, limpia la querystring', () => {
    const { reset } = renderAt('/?etiqueta=FING')

    fireEvent.click(screen.getByRole('link', { name: 'Inicio' }))

    expect(screen.getByTestId('ruta').textContent).toBe('/')
    expect(reset).toHaveBeenCalledWith({ queryKey: HOME_FEED_KEY })
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0 })
  })

  it('con ctrl/cmd no intercepta nada (abrir en pestaña nueva)', () => {
    const { reset, invalidate } = renderAt('/topic/1')

    const link = screen.getByRole('link', { name: 'Inicio' })
    const event = new MouseEvent('click', {
      bubbles: true, cancelable: true, button: 0, ctrlKey: true,
    })
    fireEvent(link, event)

    expect(event.defaultPrevented).toBe(false)
    expect(reset).not.toHaveBeenCalled()
    expect(invalidate).not.toHaveBeenCalled()
    expect(window.scrollTo).not.toHaveBeenCalled()
  })
})
