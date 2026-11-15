import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CommentPage } from '../CommentPage'
import { apiGet } from '../../../api/client'

// Se prueba que moverse por el hilo cambie la URL sin reabrirlo, y que una navegación real
// sí lo reabra. El stub de CommentThread mantiene su propia posición interna, como el stack real.
vi.mock('../../../components/shared/CommentThread', () => ({
  CommentThread: ({ initialHighlightId, onPositionChange }) => {
    const [pos, setPos] = useState(String(initialHighlightId))
    const mover = (n) => { setPos(String(n)); onPositionChange({ id: n }) }
    return (
      <div data-testid="thread" data-anchor={String(initialHighlightId)} data-pos={pos}>
        <button type="button" onClick={() => mover(7)}>bajar a 7</button>
        <button type="button" onClick={() => mover(5)}>volver a 5</button>
      </div>
    )
  },
}))

vi.mock('../../../api/client', () => ({
  apiGet: vi.fn((path) => {
    const id = path.match(/^\/replies\/(\d+)\/context$/)?.[1]
    return Promise.resolve({ data: [{ id: Number(id), estado: 'visible', tema_titulo: 'T' }] })
  }),
}))

// Sonda dentro del router para ver la URL y disparar una navegación externa.
function Probe() {
  const location = useLocation()
  const navigate = useNavigate()
  return (
    <>
      <span data-testid="ruta">{location.pathname}</span>
      <span data-testid="thread-move">{String(!!location.state?.threadMove)}</span>
      <button type="button" onClick={() => navigate('/comment/9')}>ir a 9</button>
      <button type="button" onClick={() => navigate('/comment/5')}>ir a 5</button>
      <button type="button" onClick={() => navigate('/comment/7')}>ir a 7</button>
    </>
  )
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/comment/5']}>
        <Routes>
          <Route path="comment/:id" element={<><CommentPage /><Probe /></>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('CommentPage — la URL sigue la posición en el hilo', () => {
  beforeEach(() => { vi.clearAllMocks() })
  afterEach(() => { cleanup() })

  it('moverse por el hilo reescribe la URL sin re-sembrar el hilo', async () => {
    renderPage()
    await screen.findByTestId('thread')
    expect(apiGet).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'bajar a 7' }))

    expect(screen.getByTestId('ruta').textContent).toBe('/comment/7')
    expect(screen.getByTestId('thread-move').textContent).toBe('true')
    // Ni refetch ni remount: el ancla no cambia.
    expect(apiGet).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('thread').dataset.anchor).toBe('5')
  })

  it('una navegación externa sí re-siembra el hilo', async () => {
    renderPage()
    await screen.findByTestId('thread')

    fireEvent.click(screen.getByRole('button', { name: 'ir a 9' }))

    await waitFor(() => {
      expect(screen.getByTestId('thread').dataset.anchor).toBe('9')
    })
    expect(apiGet).toHaveBeenCalledWith('/replies/9/context')
  })

  it('re-siembra aunque el usuario ya se haya movido dentro del hilo', async () => {
    renderPage()
    await screen.findByTestId('thread')

    fireEvent.click(screen.getByRole('button', { name: 'bajar a 7' }))
    expect(screen.getByTestId('thread').dataset.anchor).toBe('5')

    // El ref solo bloquea el id que escribió la página (7).
    fireEvent.click(screen.getByRole('button', { name: 'ir a 9' }))

    await waitFor(() => {
      expect(screen.getByTestId('thread').dataset.anchor).toBe('9')
    })
    expect(apiGet).toHaveBeenCalledWith('/replies/9/context')
  })

  // Navegación externa al propio ancla con la vista ya movida: debe reabrir el hilo.
  it('una navegación externa al propio ancla re-siembra si la vista ya se movió', async () => {
    renderPage()
    await screen.findByTestId('thread')

    fireEvent.click(screen.getByRole('button', { name: 'bajar a 7' }))
    expect(screen.getByTestId('thread').dataset.pos).toBe('7')
    expect(screen.getByTestId('ruta').textContent).toBe('/comment/7')

    // Notificación/link al comentario 5, que es el ancla pero NO donde está la vista.
    fireEvent.click(screen.getByRole('button', { name: 'ir a 5' }))

    await waitFor(() => {
      expect(screen.getByTestId('thread').dataset.pos).toBe('5')
    })
    expect(screen.getByTestId('thread').dataset.anchor).toBe('5')
    expect(screen.getByTestId('ruta').textContent).toBe('/comment/5')
  })

  // Tras volver dentro del hilo al comentario que marca la URL, la posición debe actualizarse igual.
  it('re-siembra tras volver dentro del hilo al comentario que ya marca la URL', async () => {
    renderPage()
    await screen.findByTestId('thread')

    fireEvent.click(screen.getByRole('button', { name: 'bajar a 7' }))
    fireEvent.click(screen.getByRole('button', { name: 'ir a 5' }))
    await waitFor(() => {
      expect(screen.getByTestId('thread').dataset.pos).toBe('5')
    })

    // Movimiento dentro del hilo hacia el comentario que la URL ya muestra.
    fireEvent.click(screen.getByRole('button', { name: 'volver a 5' }))
    expect(screen.getByTestId('ruta').textContent).toBe('/comment/5')

    // Ahora sí, notificación al 7.
    fireEvent.click(screen.getByRole('button', { name: 'ir a 7' }))

    await waitFor(() => {
      expect(screen.getByTestId('thread').dataset.pos).toBe('7')
    })
    expect(screen.getByTestId('thread').dataset.anchor).toBe('7')
    expect(screen.getByTestId('ruta').textContent).toBe('/comment/7')
  })
})
