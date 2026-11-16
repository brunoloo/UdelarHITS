import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { OnboardingPage } from '../OnboardingPage'
import { apiGet, apiPost, apiDelete } from '../../../api/client'

vi.mock('../../../api/client', () => ({ apiGet: vi.fn(), apiPost: vi.fn(), apiDelete: vi.fn() }))
vi.mock('../../../hooks/useToast', () => ({ useToast: () => ({ showToast: vi.fn() }) }))
vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 1, nickname: 'yo', facultad: 'FING' }, loading: false }),
}))

const categorias = [
  { id: 1, titulo: 'Anatomía', etiquetas: ['FMED'], contador_temas: 0, contador_comentarios: 20, fecha_creacion: '2026-01-01T00:00:00Z' },
  { id: 2, titulo: 'Cálculo 1', etiquetas: ['FING'], contador_temas: 0, contador_comentarios: 0, fecha_creacion: '2026-01-02T00:00:00Z' },
]

function renderPage({ cats = categorias, usuarios = [] } = {}) {
  apiGet.mockImplementation(path => Promise.resolve({
    data: path === '/categories/index' ? cats : path.startsWith('/users/suggested') ? usuarios : [],
  }))
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('OnboardingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiPost.mockResolvedValue({ ok: true, suscrito: true })
    apiDelete.mockResolvedValue({ ok: true, suscrito: false })
  })

  it('ofrece primero las categorías de la facultad del usuario', async () => {
    const { container } = renderPage()

    expect(await screen.findByText('Cálculo 1')).toBeTruthy()
    const titulos = [...container.querySelectorAll('.onboarding-item-title')].map(n => n.textContent)
    expect(titulos).toEqual(['Cálculo 1', 'Anatomía'])
    expect(screen.getByText('De tu facultad')).toBeTruthy()
    expect(screen.getByText('20 comentarios')).toBeTruthy()
  })

  it('seguir una categoría la suscribe y el botón permite deshacerlo', async () => {
    renderPage()
    await screen.findByText('Cálculo 1')

    fireEvent.click(screen.getAllByRole('button', { name: 'Seguir' })[0])
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/categories/2/subscribe', {}))

    const siguiendo = await screen.findByRole('button', { name: 'Siguiendo' })
    fireEvent.click(siguiendo)
    await waitFor(() => expect(apiDelete).toHaveBeenCalledWith('/categories/2/subscribe'))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Siguiendo' })).toBeNull())
  })

  it('siempre se puede saltear yendo al inicio', async () => {
    renderPage({ cats: [] })

    expect(await screen.findByText(/Todavía no hay categorías/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ir al inicio' }).getAttribute('href')).toBe('/')
  })

  it('muestra personas para seguir solo si hay sugerencias', async () => {
    renderPage({ usuarios: [{ nickname: 'ana', nombre: 'Ana', url_imagen: null }] })

    expect(await screen.findByText('@ana')).toBeTruthy()
    expect(screen.getByText('Personas de la comunidad')).toBeTruthy()
  })
})
