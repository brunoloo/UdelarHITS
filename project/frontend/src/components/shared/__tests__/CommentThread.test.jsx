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
const D = { id: 4, cuerpo: 'D' }

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

// onPositionChange es lo que le permite al permalink mantener la URL sincronizada
// con el lugar del hilo donde está parado el usuario (ver CommentPage). Acá se
// testea el contrato: cuándo se dispara, con qué, y —sobre todo— cuándo NO.
describe('CommentThread — onPositionChange', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('no se dispara al montar (la posición inicial ya es la de la URL)', () => {
    const onPositionChange = vi.fn()
    renderThread({ initialStack: [A, B, C], onPositionChange })

    expect(onPositionChange).not.toHaveBeenCalled()
  })

  it('truncar por un ancestro avisa con el ancestro clickeado', () => {
    const onPositionChange = vi.fn()
    renderThread({ initialStack: [A, B, C], onPositionChange })

    fireEvent.click(screen.getByRole('button', { name: 'ir a 2' }))

    expect(onPositionChange).toHaveBeenCalledTimes(1)
    expect(onPositionChange).toHaveBeenCalledWith(B)
  })

  it('bajar a una respuesta avisa con la respuesta', () => {
    const onPositionChange = vi.fn()
    renderThread({ comments: [D], onPositionChange })

    fireEvent.click(screen.getByRole('button', { name: 'ir a 4' }))

    expect(onPositionChange).toHaveBeenCalledTimes(1)
    expect(onPositionChange).toHaveBeenCalledWith(D)
  })

  it('"Volver" con drill avisa con el nivel de arriba', () => {
    const onPositionChange = vi.fn()
    renderThread({ initialStack: [A, B, C], onExit: vi.fn(), onPositionChange })

    fireEvent.click(screen.getByRole('button', { name: 'ir a 2' }))
    fireEvent.click(screen.getByRole('button', { name: /Volver/ }))

    expect(onPositionChange).toHaveBeenLastCalledWith(A)
  })

  it('"Volver" en el piso sale de la página y no avisa posición', () => {
    const onExit = vi.fn()
    const onPositionChange = vi.fn()
    renderThread({ initialStack: [A], onExit, onPositionChange })

    fireEvent.click(screen.getByRole('button', { name: /Volver/ }))

    expect(onExit).toHaveBeenCalledTimes(1)
    expect(onPositionChange).not.toHaveBeenCalled()
  })
})
