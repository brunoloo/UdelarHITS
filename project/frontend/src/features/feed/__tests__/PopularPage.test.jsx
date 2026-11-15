import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { PopularPage } from '../PopularPage'
import { apiGet } from '../../../api/client'

vi.mock('../../../api/client', () => ({ apiGet: vi.fn() }))

const cat = {
  id: 1,
  titulo: 'Cálculo 1',
  descripcion: null,
  etiquetas: [],
  contador_temas: 0,
  contador_comentarios: 9,
  temas_recientes: 0,
  comentarios_directos_recientes: 4,
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PopularPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('PopularPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('no pide una ventana fija y rotula la que usó el backend', async () => {
    apiGet.mockResolvedValue({ data: [cat], ventana_dias: 30 })
    renderPage()

    expect(await screen.findByText('Cálculo 1')).toBeTruthy()
    expect(apiGet).toHaveBeenCalledWith('/categories/popular?limit=20')
    expect(screen.getByText('Las categorías con más actividad en los últimos 30 días')).toBeTruthy()
    expect(screen.getByText('4 comentarios en los últimos 30 días')).toBeTruthy()
    expect(screen.queryByText(/esta semana/)).toBeNull()
    expect(screen.queryByText(/0 temas/)).toBeNull()
  })

  it('en el histórico no repite los totales como actividad reciente', async () => {
    apiGet.mockResolvedValue({ data: [cat], ventana_dias: null })
    const { container } = renderPage()

    expect(await screen.findByText('Cálculo 1')).toBeTruthy()
    expect(container.querySelector('.popular-activity')).toBeNull()
    expect(screen.getByText('9 comentarios')).toBeTruthy()
  })

  it('sin actividad ofrece una salida en vez de un hueco', async () => {
    apiGet.mockResolvedValue({ data: [], ventana_dias: null })
    renderPage()

    const cta = await screen.findByRole('link', { name: 'Explorar categorías' })
    expect(cta.getAttribute('href')).toBe('/explore')
  })
})
