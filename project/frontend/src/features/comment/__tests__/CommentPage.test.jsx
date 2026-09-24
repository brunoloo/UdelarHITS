import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CommentPage } from '../CommentPage'
import { apiGet } from '../../../api/client'

// Acá se testea el desacople entre "dónde estás parado" (el id de la URL) y "qué
// comentario siembra el hilo" (el ancla): moverse por el hilo tiene que cambiar la
// URL SIN re-sembrar (sin refetch ni remount), y una navegación de verdad tiene que
// re-sembrar igual que siempre. CommentThread se stubea porque lo que importa no es
// el render del hilo sino con qué id lo siembra la página.
//
// El stub mantiene POSICIÓN INTERNA propia (como el `stack` real: se inicializa
// desde la prop al montar y después vive por su cuenta). Sin eso, `data-pos`
// reflejaría siempre el ancla y los tests no distinguirían "la vista se movió" de
// "la página re-sembró" — que es exactamente la desincronización a cubrir.
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

// Mismo patrón que hooks/__tests__/useGoHome.test.jsx: una sonda dentro del router
// para ver la URL real y poder disparar una navegación externa (push).
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
    // Lo importante: ni refetch ni remount. El ancla sigue siendo con el que entró.
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

    // El ref solo bloquea el id que escribimos nosotros (7), no cualquier otro.
    fireEvent.click(screen.getByRole('button', { name: 'ir a 9' }))

    await waitFor(() => {
      expect(screen.getByTestId('thread').dataset.anchor).toBe('9')
    })
    expect(apiGet).toHaveBeenCalledWith('/replies/9/context')
  })

  // Regresión: una navegación externa al PROPIO ancla, con el usuario ya movido
  // dentro del hilo. Comparando la URL contra el ancla (5 === 5) esto parecía "ya
  // estamos ahí" y no re-sembraba: la vista se quedaba en 7 con la URL diciendo 5,
  // o sea el click en la notificación no hacía nada visible.
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

  // Regresión encadenada de la anterior: una vez re-sembrado en 5, el usuario vuelve
  // a 5 dentro del hilo (movimiento que NO cambia la URL). Con el ref guardando "el
  // último id que navegamos" ese camino salía temprano sin actualizarlo y quedaba
  // stale en 7, así que la siguiente notificación legítima al 7 se bloqueaba. Con el
  // ref guardando la POSICIÓN, se actualiza siempre y la re-siembra ocurre.
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
