import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FollowButton } from '../FollowButton'

vi.mock('../../../hooks/useToast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}))

let resolveFollow
vi.mock('../../../api/client', () => ({
  apiPost: vi.fn(() => new Promise(r => { resolveFollow = r })),
  apiDelete: vi.fn(() => new Promise(r => { resolveFollow = r })),
}))

function renderWithClient(ui) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  )
}

describe('FollowButton optimistic update', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('changes label to "Siguiendo" immediately before server responds (public account)', async () => {
    renderWithClient(
      <FollowButton nickname="testuser" initialState="none" isPrivate={false} />
    )

    const btn = screen.getByRole('button', { name: 'Seguir' })
    fireEvent.click(btn)

    await waitFor(() => {
      expect(screen.getByRole('button').textContent).toBe('Siguiendo')
    })
  })

  it('changes label to "Solicitado" immediately for private accounts', async () => {
    renderWithClient(
      <FollowButton nickname="privateuser" initialState="none" isPrivate={true} />
    )

    const btn = screen.getByRole('button', { name: 'Seguir' })
    fireEvent.click(btn)

    await waitFor(() => {
      expect(screen.getByRole('button').textContent).toBe('Solicitado')
    })
  })

  it('reverts to "Seguir" on error', async () => {
    const { apiPost } = await import('../../../api/client')
    apiPost.mockImplementationOnce(() => Promise.reject(new Error('network error')))

    renderWithClient(
      <FollowButton nickname="failuser" initialState="none" isPrivate={false} />
    )

    const btn = screen.getByRole('button', { name: 'Seguir' })
    fireEvent.click(btn)

    await waitFor(() => {
      expect(screen.getByRole('button').textContent).toBe('Seguir')
    })
  })
})
