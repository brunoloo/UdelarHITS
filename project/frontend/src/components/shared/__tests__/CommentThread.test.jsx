import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CommentThread } from '../CommentThread'

// Acá se testea la LÓGICA DE STACK del hilo (qué ancestros son clickeables, qué
// pasa al truncar y dónde queda el piso de "Volver"), no el render de la card:
// CommentCard se stubea para no arrastrar auth, router, guardados ni reacciones.
vi.mock('../CommentCard', () => ({
  CommentCard: ({ comment, role, onDrillDown }) => (
    <div data-testid={`card-${role}-${comment.id}`}>
      <span data-testid={`clickable-${role}-${comment.id}`}>
        {onDrillDown ? 'si' : 'no'}
      </span>
      {onDrillDown && (
        <button type="button" onClick={() => onDrillDown(comment)}>
          ir a {comment.id}
        </button>
      )}
    </div>
  ),
}))

vi.mock('../../../hooks/useToast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}))

vi.mock('../../../api/client', () => ({
  apiGet: vi.fn(() => Promise.resolve({ data: [] })),
  apiPost: vi.fn(() => Promise.resolve({ data: {} })),
}))

const A = { id: 1, cuerpo: 'A' }
const B = { id: 2, cuerpo: 'B' }
const C = { id: 3, cuerpo: 'C' }

function renderThread(props = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <CommentThread comments={[]} invalidateKey={['comment', '3']} {...props} />
    </QueryClientProvider>
  )
}

function ancestorIds() {
  return screen.getAllByTestId(/^card-ancestor-/).map(el => el.dataset.testid)
}

describe('CommentThread — ancestros clickeables', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('los ancestros de arriba reciben onDrillDown y el último no', () => {
    renderThread({ initialStack: [A, B, C] })

    expect(screen.getByTestId('clickable-ancestor-1').textContent).toBe('si')
    expect(screen.getByTestId('clickable-ancestor-2').textContent).toBe('si')
    expect(screen.getByTestId('clickable-ancestor-3').textContent).toBe('no')
  })

  it('clickear un ancestro trunca el stack hasta él', () => {
    renderThread({ initialStack: [A, B, C] })

    fireEvent.click(screen.getByRole('button', { name: 'ir a 2' }))

    expect(ancestorIds()).toEqual(['card-ancestor-1', 'card-ancestor-2'])
    expect(screen.queryByTestId('card-ancestor-3')).toBeNull()
  })

  it('después de truncar, "Volver" sube un nivel en vez de salir de la página', () => {
    const onExit = vi.fn()
    renderThread({ initialStack: [A, B, C], onExit })

    fireEvent.click(screen.getByRole('button', { name: 'ir a 2' }))
    fireEvent.click(screen.getByRole('button', { name: /Volver/ }))

    expect(ancestorIds()).toEqual(['card-ancestor-1'])
    expect(onExit).not.toHaveBeenCalled()
  })

  it('sin truncar, el piso del permalink sigue igual que antes', () => {
    const onExit = vi.fn()
    renderThread({ initialStack: [A], onExit })

    fireEvent.click(screen.getByRole('button', { name: /Volver/ }))

    expect(onExit).toHaveBeenCalledTimes(1)
    expect(ancestorIds()).toEqual(['card-ancestor-1'])
  })
})
