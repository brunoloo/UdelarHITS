import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { HomeComposer } from '../HomeComposer'
import { apiGet, apiPost } from '../../../api/client'

// Compositor unificado del Home: una caja con selector Comentario | Categoría.
// Se mockean red/auth/toast/navegación para aislar la UI.

const navigateMock = vi.fn()

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => navigateMock,
}))

vi.mock('../../../api/client', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}))

vi.mock('../../../hooks/useToast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}))

vi.mock('../../../hooks/useRequireAuth', () => ({
  useRequireAuth: () => () => true,
}))

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, nickname: 'yo', url_imagen: null } }),
}))

const TAGS = { General: [{ id: 7, nombre: 'cálculo' }] }

let queryClient

function renderComposer() {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  vi.spyOn(queryClient, 'invalidateQueries')
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <HomeComposer />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const commentTA = () => screen.getByPlaceholderText('Escribí tu comentario')
const titleInput = () => screen.getByPlaceholderText('Ej: Tips para aprobar cálculo')
const tab = name => screen.getByRole('tab', { name })

function openComposer() {
  fireEvent.click(screen.getByRole('button', { name: /En qué estás pensando/ }))
}

describe('HomeComposer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiGet.mockImplementation((url) => {
      if (url === '/categories/etiquetas') return Promise.resolve({ ok: true, data: TAGS })
      return Promise.resolve({ ok: true, data: [] })
    })
    apiPost.mockResolvedValue({ data: {} })
  })

  it('cerrado muestra la barra sin formulario', () => {
    renderComposer()
    expect(screen.getByText('¿En qué estás pensando?')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Escribí tu comentario')).toBeNull()
    expect(screen.queryByRole('tablist')).toBeNull()
  })

  it('al abrir arranca en Comentario', () => {
    renderComposer()
    openComposer()
    expect(tab(/Comentario/)).toHaveAttribute('aria-selected', 'true')
    expect(tab(/Categoría/)).toHaveAttribute('aria-selected', 'false')
    expect(commentTA()).toBeVisible()
    expect(titleInput()).not.toBeVisible()
  })

  it('la pestaña Categoría muestra título, Descripción y Etiquetas y oculta el comentario', () => {
    renderComposer()
    openComposer()
    fireEvent.click(tab(/Categoría/))
    expect(tab(/Categoría/)).toHaveAttribute('aria-selected', 'true')
    expect(titleInput()).toBeVisible()
    expect(screen.getByRole('button', { name: 'Abrir Descripción' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Abrir Etiquetas' })).toBeVisible()
    expect(commentTA()).not.toBeVisible()
  })

  it('lo escrito en Comentario se conserva al ir y volver de Categoría', () => {
    renderComposer()
    openComposer()
    fireEvent.change(commentTA(), { target: { value: 'hola foro' } })
    fireEvent.click(tab(/Categoría/))
    fireEvent.click(tab(/Comentario/))
    expect(commentTA()).toHaveValue('hola foro')
  })

  it('lo escrito en Categoría se conserva al ir y volver de Comentario', () => {
    renderComposer()
    openComposer()
    fireEvent.click(tab(/Categoría/))
    fireEvent.change(titleInput(), { target: { value: 'Mi categoría' } })
    fireEvent.click(tab(/Comentario/))
    fireEvent.click(tab(/Categoría/))
    expect(titleInput()).toHaveValue('Mi categoría')
  })

  it('Cancelar cierra y al reabrir ambas pestañas están vacías', () => {
    renderComposer()
    openComposer()
    fireEvent.change(commentTA(), { target: { value: 'borrador' } })
    fireEvent.click(tab(/Categoría/))
    fireEvent.change(titleInput(), { target: { value: 'Otro borrador' } })
    // getByRole ignora lo que está bajo [hidden]: es el Cancelar de Categoría.
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.getByText('¿En qué estás pensando?')).toBeInTheDocument()

    openComposer()
    expect(commentTA()).toHaveValue('')
    expect(titleInput()).toHaveValue('')
  })

  it('el evento open-create-category abre en Categoría', () => {
    renderComposer()
    act(() => { window.dispatchEvent(new Event('open-create-category')) })
    expect(tab(/Categoría/)).toHaveAttribute('aria-selected', 'true')
    expect(titleInput()).toBeVisible()
  })

  it('publicar un comentario llama a /replies/create, cierra e invalida el feed', async () => {
    renderComposer()
    openComposer()
    fireEvent.change(commentTA(), { target: { value: 'hola foro' } })
    fireEvent.click(screen.getByRole('button', { name: 'Comentar' }))

    await waitFor(() => expect(apiPost).toHaveBeenCalled())
    expect(apiPost.mock.calls[0][0]).toBe('/replies/create')
    const fd = apiPost.mock.calls[0][1]
    expect(fd.get('cuerpo')).toBe('hola foro')
    await waitFor(() => expect(screen.queryByRole('tablist')).toBeNull())
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['categories', 'feed'] })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['replies', 'home', 'count'] })
  })

  it('crear una categoría válida navega a la categoría creada', async () => {
    apiPost.mockResolvedValue({ data: { id: 42 } })
    renderComposer()
    openComposer()
    fireEvent.click(tab(/Categoría/))
    fireEvent.change(titleInput(), { target: { value: 'Mi categoría' } })
    fireEvent.change(screen.getByPlaceholderText('¿De qué va esta categoría?'), { target: { value: 'Una descripción' } })
    fireEvent.click(await screen.findByRole('button', { name: 'cálculo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }))

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/category/42'))
    expect(apiPost).toHaveBeenCalledWith('/categories/create', {
      titulo: 'Mi categoría',
      descripcion: 'Una descripción',
      etiquetas: [7],
    })
    expect(screen.queryByRole('tablist')).toBeNull()
  })
})
