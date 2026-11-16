import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ContentSection } from '../ContentSection'
import { apiGet, apiDelete } from '../../../api/client'

vi.mock('../../../hooks/useToast', () => ({ useToast: () => ({ showToast: vi.fn() }) }))
vi.mock('../../../api/client', () => ({ apiGet: vi.fn(), apiDelete: vi.fn() }))

const comentario = (over = {}) => ({
  id: 1,
  estado: 'visible',
  cuerpo: 'Busco apuntes de Física',
  fecha_creacion: '2026-11-01T12:00:00Z',
  autor_nickname: 'ana',
  tipo: 'home',
  destino_id: null,
  destino_titulo: null,
  es_respuesta: false,
  adjuntos: 0,
  tiene_encuesta: false,
  ...over,
})

// Responde /admin/comments según los parámetros del pedido.
function mockComentarios(resolver) {
  apiGet.mockImplementation(path => {
    if (!path.startsWith('/admin/comments')) return Promise.resolve({ data: [] })
    const params = new URLSearchParams(path.split('?')[1])
    return Promise.resolve({ data: resolver(params) })
  })
}

const pagina = (items, total = items.length, offset = 0) => ({ items, total, limit: 30, offset })

async function abrirComentarios() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ContentSection />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Comentarios' }))
  return view
}

describe('ContentSection — comentarios', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiDelete.mockResolvedValue({ ok: true })
  })

  it('lista los comentarios con dónde están, su estado y el total', async () => {
    mockComentarios(() => pagina([
      comentario(),
      comentario({
        id: 2, cuerpo: '', autor_nickname: 'beto', tipo: 'categoria', destino_id: 7,
        destino_titulo: 'Cálculo', es_respuesta: true, adjuntos: 2, tiene_encuesta: true,
      }),
    ]))
    await abrirComentarios()

    expect(await screen.findByText('Busco apuntes de Física')).toBeTruthy()
    expect(screen.getByText('Inicio')).toBeTruthy()
    expect(screen.getByText('Categoría: Cálculo')).toBeTruthy()
    expect(screen.getByText('(sin texto)')).toBeTruthy()
    expect(screen.getByText('respuesta · 2 adjuntos · encuesta')).toBeTruthy()
    expect(screen.getByText('2', { selector: 'strong' })).toBeTruthy()
  })

  it('"Ver" lleva al comentario según su ámbito', async () => {
    mockComentarios(() => pagina([
      comentario(),
      comentario({ id: 2, tipo: 'tema', destino_id: 9, destino_titulo: 'Parcial' }),
    ]))
    await abrirComentarios()

    await screen.findByText('Tema: Parcial')
    const links = screen.getAllByRole('link', { name: 'Ver' }).map(a => a.getAttribute('href'))
    expect(links).toEqual(['/comment/1', '/topic/9?commentId=2'])
  })

  it('filtra por estado y busca al enviar el formulario', async () => {
    mockComentarios(() => pagina([comentario()]))
    await abrirComentarios()
    await screen.findByText('Busco apuntes de Física')

    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'oculto' } })
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/admin/comments?limit=30&offset=0&estado=oculto'))

    fireEvent.change(screen.getByLabelText('Buscar comentarios'), { target: { value: ' apuntes ' } })
    // Escribir no dispara pedidos: recién al enviar.
    expect(apiGet).not.toHaveBeenCalledWith(expect.stringContaining('q=apuntes'))
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith('/admin/comments?limit=30&offset=0&estado=oculto&q=apuntes'))
  })

  it('"Cargar más" pide la página siguiente y desaparece al llegar al total', async () => {
    mockComentarios(params => (
      params.get('offset') === '0'
        ? pagina([comentario({ id: 1, cuerpo: 'primero' })], 2, 0)
        : pagina([comentario({ id: 2, cuerpo: 'segundo' })], 2, 1)
    ))
    await abrirComentarios()

    await screen.findByText('primero')
    fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }))

    expect(await screen.findByText('segundo')).toBeTruthy()
    expect(apiGet).toHaveBeenCalledWith('/admin/comments?limit=30&offset=1')
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Cargar más' })).toBeNull())
  })

  it('eliminar pide confirmación antes de borrar', async () => {
    mockComentarios(() => pagina([comentario()]))
    await abrirComentarios()
    await screen.findByText('Busco apuntes de Física')

    // El diálogo de confirmación tiene su propio botón "Eliminar": se apunta al de la fila.
    fireEvent.click(document.querySelector('.admin-table .admin-btn--danger'))
    expect(apiDelete).not.toHaveBeenCalled()
    expect(screen.getByText('¿Eliminar comentario?')).toBeTruthy()

    fireEvent.click(document.querySelector('.confirm-btn-ok'))
    await waitFor(() => expect(apiDelete).toHaveBeenCalledWith('/replies/delete/1'))
  })

  it('un comentario oculto no ofrece eliminar', async () => {
    mockComentarios(() => pagina([comentario({ estado: 'oculto' })]))
    await abrirComentarios()

    await screen.findByText('oculto')
    expect(document.querySelector('.admin-table .admin-btn--danger')).toBeNull()
  })

  it('sin resultados lo dice', async () => {
    mockComentarios(() => pagina([]))
    await abrirComentarios()
    expect(await screen.findByText('No se encontraron comentarios.')).toBeTruthy()
  })
})
