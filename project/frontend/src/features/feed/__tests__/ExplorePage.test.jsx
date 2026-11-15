import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { ExplorePage } from '../ExplorePage'
import { apiGet } from '../../../api/client'

vi.mock('../../../api/client', () => ({ apiGet: vi.fn(), apiPost: vi.fn() }))
vi.mock('../../../hooks/useToast', () => ({ useToast: () => ({ showToast: vi.fn() }) }))

let session = { user: null, loading: false }
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => session }))

// jsdom no trae ResizeObserver y los carruseles lo usan.
globalThis.ResizeObserver = class { observe() {} disconnect() {} }

const categorias = [
  { id: 1, titulo: 'Cálculo 1', etiquetas: ['FING'], contador_temas: 0, contador_comentarios: 3 },
  { id: 2, titulo: 'Anatomía', etiquetas: ['FMED'], contador_temas: 0, contador_comentarios: 0 },
]

const respuestas = {
  '/categories/popular?limit=1': { data: [], ventana_dias: null },
  '/topics/trending': { data: null },
  '/categories/index': { data: categorias },
  '/users/suggested?limit=12': { data: [] },
  '/categories/me': { data: [] },
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ExplorePage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ExplorePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiGet.mockImplementation(path => Promise.resolve(respuestas[path] ?? { data: [] }))
  })

  it('sin sesión muestra las categorías por etiqueta, no solo un cartel de login', async () => {
    session = { user: null, loading: false }
    renderPage()

    expect(await screen.findByText('Cálculo 1')).toBeTruthy()
    expect(screen.getByText('Anatomía')).toBeTruthy()
    expect(screen.getByText('Categorías por etiqueta')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Crear cuenta' }).getAttribute('href')).toBe('/register')
    expect(apiGet).not.toHaveBeenCalledWith('/categories/me')
  })

  it('con sesión mantiene "Categorías para vos" sin el cartel de registro', async () => {
    session = { user: { id: 7, nickname: 'yo' }, loading: false }
    renderPage()

    expect(await screen.findByText('Categorías para vos')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Crear cuenta' })).toBeNull()
  })
})
