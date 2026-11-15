import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { RecentPage } from '../RecentPage'
import { apiGet } from '../../../api/client'

vi.mock('../../../api/client', () => ({ apiGet: vi.fn(), apiPost: vi.fn() }))
vi.mock('../../../hooks/useToast', () => ({ useToast: () => ({ showToast: vi.fn() }) }))

const categoria = {
  id: 1,
  titulo: 'Cálculo 1',
  etiquetas: [],
  contador_temas: 0,
  contador_comentarios: 0,
  fecha_creacion: new Date().toISOString(),
  autor_nickname: 'ana',
  autor_estado: 'activo',
}

function renderPage(categorias = []) {
  apiGet.mockImplementation(path =>
    Promise.resolve({ data: path === '/categories/index' ? categorias : [] }))
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <RecentPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('RecentPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sin contenido ofrece explorar categorías', async () => {
    renderPage()
    const cta = await screen.findByRole('link', { name: 'Explorar categorías' })
    expect(cta.getAttribute('href')).toBe('/explore')
  })

  it('la pestaña Temas vacía explica dónde se crean', async () => {
    renderPage([categoria])
    expect(await screen.findByText('Cálculo 1')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Temas' }))
    expect(screen.getByText(/Se crean dentro de una categoría/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Elegir una categoría' }).getAttribute('href')).toBe('/explore')
  })

  it('una categoría sin contenido no muestra contadores en cero', async () => {
    const { container } = renderPage([categoria])
    expect(await screen.findByText('Cálculo 1')).toBeTruthy()
    expect(container.querySelector('.recent-cat-count')).toBeNull()
  })
})
