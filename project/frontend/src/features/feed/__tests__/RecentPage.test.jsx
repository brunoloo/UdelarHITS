import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { RecentPage } from '../RecentPage'
import { apiGet } from '../../../api/client'

vi.mock('../../../api/client', () => ({ apiGet: vi.fn(), apiPost: vi.fn() }))
vi.mock('../../../hooks/useToast', () => ({ useToast: () => ({ showToast: vi.fn() }) }))
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }))
vi.mock('../../../hooks/useRequireAuth', () => ({ useRequireAuth: () => () => true }))
vi.mock('../../../hooks/useSaved', () => ({
  useSaved: () => ({ isSaved: () => false, toggleSaved: vi.fn() }),
}))

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

const pendiente = {
  id: 9,
  tipo: 'home',
  cuerpo: '¿Alguien tiene apuntes?',
  autor_nickname: 'ana',
  autor_estado: 'activo',
  fecha_creacion: new Date().toISOString(),
  likes: 0,
  contador_respuestas: 0,
  adjuntos: [],
  encuesta: null,
}

function renderPage(categorias = [], { ruta = '/recent', sinRespuesta = [] } = {}) {
  apiGet.mockImplementation(path => Promise.resolve({
    data: path === '/categories/index' ? categorias
      : path.startsWith('/replies/recent?sin_respuesta=1') ? sinRespuesta
      : [],
  }))
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[ruta]}>
        <RecentPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('RecentPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('marca lo publicado desde la última visita y dónde empieza lo ya visto', async () => {
    const hace = (h) => new Date(Date.now() - h * 3600 * 1000).toISOString()
    localStorage.setItem('last-visit:recent', String(Date.now() - 24 * 3600 * 1000))
    const { container } = renderPage([
      { ...categoria, id: 1, titulo: 'Nueva', fecha_creacion: hace(2) },
      { ...categoria, id: 2, titulo: 'Vista', fecha_creacion: hace(48) },
    ])

    expect(await screen.findByText('1 publicación nueva desde tu última visita')).toBeTruthy()
    const orden = [...container.querySelectorAll('.recent-cat-title, .recent-seen-divider')].map(n => n.textContent)
    expect(orden).toEqual(['Nueva', 'Ya lo viste', 'Vista'])
  })

  it('en la primera visita no marca nada', async () => {
    const { container } = renderPage([categoria])
    expect(await screen.findByText('Cálculo 1')).toBeTruthy()
    expect(screen.queryByText(/desde tu última visita/)).toBeNull()
    expect(container.querySelector('.recent-seen-divider')).toBeNull()
  })

  it('sin novedades no agrega avisos', async () => {
    localStorage.setItem('last-visit:recent', String(Date.now() + 1000))
    const { container } = renderPage([categoria])
    expect(await screen.findByText('Cálculo 1')).toBeTruthy()
    expect(screen.queryByText(/desde tu última visita/)).toBeNull()
    expect(container.querySelector('.recent-seen-divider')).toBeNull()
  })

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

  it('?tab=sin_respuesta abre esa pestaña y pide solo los comentarios pendientes', async () => {
    renderPage([categoria], { ruta: '/recent?tab=sin_respuesta', sinRespuesta: [pendiente] })

    expect(await screen.findByText('¿Alguien tiene apuntes?')).toBeTruthy()
    expect(apiGet).toHaveBeenCalledWith('/replies/recent?sin_respuesta=1&limit=30')
    expect(screen.queryByText('Cálculo 1')).toBeNull()
  })

  it('sin la pestaña activa no pide los pendientes', async () => {
    renderPage([categoria])
    expect(await screen.findByText('Cálculo 1')).toBeTruthy()
    expect(apiGet).not.toHaveBeenCalledWith('/replies/recent?sin_respuesta=1&limit=30')
  })

  it('una categoría sin contenido no muestra contadores en cero', async () => {
    const { container } = renderPage([categoria])
    expect(await screen.findByText('Cálculo 1')).toBeTruthy()
    expect(container.querySelector('.recent-cat-count')).toBeNull()
  })
})
