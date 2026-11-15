import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CommunityStrip } from '../CommunityStrip'
import { apiGet } from '../../../api/client'

vi.mock('../../../api/client', () => ({ apiGet: vi.fn() }))

function renderStrip() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <CommunityStrip />
    </QueryClientProvider>,
  )
}

describe('CommunityStrip', () => {
  beforeEach(() => vi.clearAllMocks())

  it('muestra los totales reales y omite los que están en cero', async () => {
    apiGet.mockResolvedValue({ data: { miembros: 123, categorias: 37, comentarios: 302, temas: 0 } })
    const { container } = renderStrip()

    expect(await screen.findByText('123')).toBeTruthy()
    expect(apiGet).toHaveBeenCalledWith('/stats/community')
    expect(container.textContent).toContain('123 miembros')
    expect(container.textContent).toContain('302 comentarios')
    expect(container.textContent).not.toContain('temas')
  })

  it('usa el singular con un solo elemento', async () => {
    apiGet.mockResolvedValue({ data: { miembros: 1, categorias: 0, comentarios: 0, temas: 0 } })
    const { container } = renderStrip()

    expect(await screen.findByText('1')).toBeTruthy()
    expect(container.textContent).toContain('1 miembro')
    expect(container.textContent).not.toContain('miembros')
  })

  it('sin datos no ocupa lugar', async () => {
    apiGet.mockResolvedValue({ data: { miembros: 0, categorias: 0, comentarios: 0, temas: 0 } })
    const { container } = renderStrip()

    await vi.waitFor(() => expect(apiGet).toHaveBeenCalled())
    expect(container.querySelector('.community-strip')).toBeNull()
  })
})
