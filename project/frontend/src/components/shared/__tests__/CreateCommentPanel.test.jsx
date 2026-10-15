import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CreateCommentPanel } from '../CreateCommentPanel'
import { CommentForm } from '../CommentForm'
import { apiGet } from '../../../api/client'

// Autocompletado de menciones (@) en el compositor de comentarios:
// - "@" solo abre la lista con 5 usuarios (endpoint /users/mentions?q=)
// - con letras filtra por prefijo; seleccionar inserta "@nick " y cierra
// - un espacio cierra; "mail@foo" y texto sin "@" no abren
// - la lista se renderiza en un portal en <body> (no la recorta la card)
// - mientras se escribe, el espejo pinta @nickname con .mention-hl
// Se mockean red/auth/toast para aislar la UI.

const RANDOM5 = [
  { id: 1, nickname: 'ana', nombre: 'Ana', url_imagen: null },
  { id: 2, nickname: 'bruno', nombre: 'Bruno', url_imagen: null },
  { id: 3, nickname: 'carla', nombre: 'Carla', url_imagen: null },
  { id: 4, nickname: 'diego', nombre: 'Diego', url_imagen: null },
  { id: 5, nickname: 'eva', nombre: 'Eva', url_imagen: null },
]

vi.mock('../../../api/client', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(() => Promise.resolve({ data: {} })),
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

function mockApi() {
  apiGet.mockImplementation((url) => {
    if (url === '/users/mentions?q=') return Promise.resolve({ ok: true, data: RANDOM5 })
    if (url === '/users/mentions?q=an') return Promise.resolve({ ok: true, data: [RANDOM5[0]] })
    return Promise.resolve({ ok: true, data: [] })
  })
}

function withClient(ui) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

// Abre el panel (arranca colapsado detrás de un botón) y devuelve el textarea.
function openPanel() {
  const utils = withClient(<CreateCommentPanel scopeFields={{ es_home: true }} invalidateKey={['feed']} />)
  fireEvent.click(screen.getByRole('button', { name: /Comentar/ }))
  return { ta: screen.getByPlaceholderText('Escribí tu comentario'), ...utils }
}

function type(ta, value) {
  fireEvent.change(ta, { target: { value, selectionStart: value.length, selectionEnd: value.length } })
}

describe('CreateCommentPanel — autocompletado de menciones', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi()
  })

  it('"@" solo muestra la lista con 5 usuarios', async () => {
    const { ta } = openPanel()
    type(ta, '@')

    // Mientras carga la lista muestra "Buscando..."; se espera a las opciones.
    const options = await screen.findAllByRole('option')
    expect(options).toHaveLength(5)
    expect(options.every(o => screen.getByRole('listbox').contains(o))).toBe(true)
    expect(apiGet).toHaveBeenCalledWith('/users/mentions?q=')
  })

  it('"@an" filtra por prefijo', async () => {
    const { ta } = openPanel()
    type(ta, '@an')

    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/users/mentions?q=an'))
    await waitFor(() => {
      const listbox = screen.getByRole('listbox')
      expect(within(listbox).getAllByRole('option')).toHaveLength(1)
    })
    expect(within(screen.getByRole('listbox')).getByText('@ana')).toBeInTheDocument()
  })

  it('mouseDown en la opción inserta "@ana " y cierra la lista', async () => {
    const { ta } = openPanel()
    type(ta, '@an')
    await waitFor(() => expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(1))

    fireEvent.mouseDown(within(screen.getByRole('listbox')).getByRole('option'))

    await waitFor(() => expect(ta.value).toBe('@ana '))
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('"@ " (espacio) cierra la lista', async () => {
    const { ta } = openPanel()
    type(ta, '@')
    await screen.findByRole('listbox')

    type(ta, '@ ')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('la lista se renderiza en un portal en body, fuera del contenedor', async () => {
    const { ta, container } = openPanel()
    type(ta, '@')

    const listbox = await screen.findByRole('listbox')
    expect(container.contains(listbox)).toBe(false)
    expect(document.body.contains(listbox)).toBe(true)
  })

  it('el espejo resalta "@ana" mientras se escribe', () => {
    const { ta, container } = openPanel()
    type(ta, 'hola @ana')

    const hl = container.querySelector('.mention-ta-mirror .mention-hl')
    expect(hl).not.toBeNull()
    expect(hl.textContent).toBe('@ana')
  })

  it('"mail@foo" no abre la lista', async () => {
    const { ta } = openPanel()
    type(ta, 'mail@foo')

    await new Promise(r => setTimeout(r, 250))
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(apiGet).not.toHaveBeenCalled()
  })

  it('texto sin "@" no abre la lista', async () => {
    const { ta } = openPanel()
    type(ta, 'hola mundo')

    await new Promise(r => setTimeout(r, 250))
    expect(screen.queryByRole('listbox')).toBeNull()
  })
})

describe('CommentForm — autocompletado de menciones', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi()
  })

  it('"@" muestra 5 opciones y seleccionar inserta la mención', async () => {
    withClient(<CommentForm onSubmit={vi.fn()} />)
    const ta = screen.getByPlaceholderText('Escribí tu respuesta')
    type(ta, '@')

    const options = await screen.findAllByRole('option')
    expect(options).toHaveLength(5)

    fireEvent.mouseDown(options[1])
    await waitFor(() => expect(ta.value).toBe('@bruno '))
    expect(screen.queryByRole('listbox')).toBeNull()
  })
})
