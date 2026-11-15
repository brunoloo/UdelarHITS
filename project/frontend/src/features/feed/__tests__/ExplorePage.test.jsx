import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { ExplorePage } from '../ExplorePage'
import { apiGet } from '../../../api/client'

vi.mock('../../../api/client', () => ({ apiGet: vi.fn(), apiPost: vi.fn() }))
vi.mock('../../../hooks/useToast', () => ({ useToast: () => ({ showToast: vi.fn() }) }))
vi.mock('../../../hooks/useRequireAuth', () => ({ useRequireAuth: () => () => true }))
vi.mock('../../../hooks/useSaved', () => ({
  useSaved: () => ({ isSaved: () => false, toggleSaved: vi.fn() }),
}))

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
  '/topics/trending': { data: null, ventana_dias: null },
  '/replies/trending': { data: null, ventana_dias: null },
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

  it('destaca un hilo de comentarios y rotula la ventana real', async () => {
    session = { user: null, loading: false }
    apiGet.mockImplementation(path => Promise.resolve(
      path === '/replies/trending'
        ? {
            data: {
              id: 42, tipo: 'home', destino_id: null, cuerpo: '¿Alguien cursa Física 2?',
              autor_nickname: 'ana', autor_estado: 'activo',
              fecha_creacion: new Date().toISOString(), respuestas_recientes: 3,
              respuestas_preview: [{ texto: 'Yo', autor: 'beto', autor_estado: 'inactivo', fecha: new Date().toISOString() }],
            },
            ventana_dias: 30,
          }
        : respuestas[path] ?? { data: [] },
    ))
    renderPage()

    expect(await screen.findByText('¿Alguien cursa Física 2?')).toBeTruthy()
    expect(screen.getByText('Conversación destacada')).toBeTruthy()
    expect(screen.getByText('3 respuestas en los últimos 30 días')).toBeTruthy()
    expect(screen.getByText('Usuario inactivo')).toBeTruthy()
    expect(screen.queryByText('beto')).toBeNull()
    expect(screen.getByRole('link', { name: 'Ver conversación completa →' }).getAttribute('href')).toBe('/comment/42')
  })

  it('ofrece los comentarios que esperan respuesta y enlaza al listado completo', async () => {
    session = { user: null, loading: false }
    apiGet.mockImplementation(path => Promise.resolve(
      path === '/replies/recent?sin_respuesta=1&limit=3'
        ? {
            data: [{
              id: 9, tipo: 'home', cuerpo: '¿Alguien tiene apuntes?',
              autor_nickname: 'ana', autor_estado: 'activo',
              fecha_creacion: new Date().toISOString(),
              likes: 0, contador_respuestas: 0, adjuntos: [], encuesta: null,
            }],
          }
        : respuestas[path] ?? { data: [] },
    ))
    renderPage()

    expect(await screen.findByText('¿Alguien tiene apuntes?')).toBeTruthy()
    expect(screen.getByText('Esperan respuesta')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ver todos' }).getAttribute('href')).toBe('/recent?tab=sin_respuesta')
  })

  it('sin comentarios pendientes la sección no aparece', async () => {
    session = { user: null, loading: false }
    renderPage()

    expect(await screen.findByText('Cálculo 1')).toBeTruthy()
    expect(screen.queryByText('Esperan respuesta')).toBeNull()
  })

  it('con sesión mantiene "Categorías para vos" sin el cartel de registro', async () => {
    session = { user: { id: 7, nickname: 'yo' }, loading: false }
    renderPage()

    expect(await screen.findByText('Categorías para vos')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Crear cuenta' })).toBeNull()
  })
})
