import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FollowersModal } from '../FollowersModal'

vi.mock('../../../hooks/useToast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}))

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ user: { nickname: 'me' } }),
}))

vi.mock('../../../api/client', () => ({
  apiPost: vi.fn(() => Promise.resolve({ data: { estado: 'aceptado' } })),
  apiDelete: vi.fn(() => Promise.resolve({ data: { seguidores: 0 } })),
}))

function renderModal(props) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <FollowersModal
          isOpen
          onClose={() => {}}
          title="Seguidores"
          users={[{ nickname: 'alice', nombre: 'Alice' }]}
          myFollowing={[]}
          {...props}
        />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('FollowersModal — remover seguidor', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('muestra la cruz de remover cuando canRemoveFollowers es true', () => {
    renderModal({ canRemoveFollowers: true })
    expect(screen.getByRole('button', { name: /Remover a @alice/ })).toBeTruthy()
  })

  it('NO muestra la cruz cuando canRemoveFollowers es false', () => {
    renderModal({ canRemoveFollowers: false })
    expect(screen.queryByRole('button', { name: /Remover a @alice/ })).toBeNull()
  })

  it('al confirmar, llama al endpoint de remover seguidor', async () => {
    const { apiDelete } = await import('../../../api/client')
    renderModal({ canRemoveFollowers: true })

    // Abre la confirmación
    fireEvent.click(screen.getByRole('button', { name: /Remover a @alice/ }))

    // El diálogo pide confirmación con su botón "Remover"
    const confirmBtn = await screen.findByRole('button', { name: 'Remover' })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(apiDelete).toHaveBeenCalledWith('/users/alice/follower')
    })
  })

  it('cancelar la confirmación no llama al endpoint', async () => {
    const { apiDelete } = await import('../../../api/client')
    renderModal({ canRemoveFollowers: true })

    fireEvent.click(screen.getByRole('button', { name: /Remover a @alice/ }))
    const cancelBtn = await screen.findByRole('button', { name: 'Cancelar' })
    fireEvent.click(cancelBtn)

    expect(apiDelete).not.toHaveBeenCalled()
  })
})
