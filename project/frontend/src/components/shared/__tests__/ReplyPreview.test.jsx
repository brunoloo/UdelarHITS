import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { ReplyPreview } from '../ReplyPreview'
import { CommentCard } from '../CommentCard'
import { apiPost } from '../../../api/client'

vi.mock('../../../api/client', () => ({
  apiGet: vi.fn(), apiPost: vi.fn(), apiPatch: vi.fn(), apiDelete: vi.fn(),
}))
vi.mock('../../../hooks/useToast', () => ({ useToast: () => ({ showToast: vi.fn() }) }))
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 1, nickname: 'yo' } }) }))
vi.mock('../../../hooks/useRequireAuth', () => ({ useRequireAuth: () => () => true }))
vi.mock('../../../hooks/useSaved', () => ({
  useSaved: () => ({ isSaved: () => false, toggleSaved: vi.fn() }),
}))

const respuesta = (over = {}) => ({
  id: 10,
  texto: 'jaja yo conozco a alguien',
  autor_nickname: 'beto',
  autor_url_imagen: null,
  autor_estado: 'activo',
  likes: 0,
  mi_reaccion: null,
  tiene_imagen: false,
  tiene_adjunto: false,
  tiene_encuesta: false,
  ...over,
})

const comentario = (over = {}) => ({
  id: 1,
  estado: 'visible',
  cuerpo: '¿Conocen a alguien que necesite dejar de fumar?',
  autor_id: 2,
  autor_nickname: 'ana',
  autor_estado: 'activo',
  fecha_creacion: new Date().toISOString(),
  likes: 0,
  mi_reaccion: null,
  contador_respuestas: 2,
  adjuntos: [],
  encuesta: null,
  respuestas_preview: [respuesta(), respuesta({ id: 11, texto: 'sii yo conozco', autor_nickname: 'caro' })],
  ...over,
})

function wrap(ui) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ReplyPreview', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sin respuestas no dibuja nada', () => {
    const { container } = wrap(<ReplyPreview replies={[]} total={0} />)
    expect(container.querySelector('.reply-preview')).toBeNull()
  })

  it('muestra autor y texto de cada respuesta, sin "ver más" si están todas', () => {
    const { container } = wrap(<ReplyPreview replies={comentario().respuestas_preview} total={2} />)
    const filas = [...container.querySelectorAll('.reply-preview-text')].map(n => n.textContent)
    expect(filas).toEqual(['beto jaja yo conozco a alguien', 'caro sii yo conozco'])
    expect(screen.queryByRole('button', { name: /Ver las/ })).toBeNull()
  })

  it('con más respuestas que las mostradas ofrece abrir el hilo', () => {
    const onOpen = vi.fn()
    wrap(<ReplyPreview replies={comentario().respuestas_preview} total={7} onOpen={onOpen} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ver las 7 respuestas' }))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('colapsa los saltos de línea y marca con puntos suspensivos el texto recortado', () => {
    const { container } = wrap(
      <ReplyPreview replies={[respuesta({ texto: 'uno\n\ndos' }), respuesta({ id: 11, texto: 'x'.repeat(300) })]} total={2} />,
    )
    const filas = [...container.querySelectorAll('.reply-preview-text')].map(n => n.textContent)
    expect(filas[0]).toBe('beto uno dos')
    expect(filas[1].endsWith('…')).toBe(true)
  })

  it('una respuesta sin texto muestra marcadores en vez de los adjuntos', () => {
    const { container } = wrap(
      <ReplyPreview replies={[respuesta({ texto: '', tiene_imagen: true, tiene_encuesta: true })]} total={1} />,
    )
    expect(container.querySelector('.reply-preview-text').textContent).toBe('beto [foto] [encuesta]')
    expect(container.querySelector('img.comment-attachment, .poll')).toBeNull()
  })

  it('anonimiza al autor con la cuenta inactiva', () => {
    wrap(<ReplyPreview replies={[respuesta({ autor_estado: 'inactivo' })]} total={1} />)
    expect(screen.getByText('Usuario inactivo')).toBeTruthy()
    expect(screen.queryByText('beto')).toBeNull()
  })

  it('los links y menciones quedan como texto plano', () => {
    const { container } = wrap(
      <ReplyPreview replies={[respuesta({ texto: 'mirá https://youtu.be/abc @ana' })]} total={1} />,
    )
    expect(container.querySelector('.reply-preview a, .reply-preview iframe')).toBeNull()
  })
})

describe('CommentCard con vista previa de respuestas', () => {
  beforeEach(() => vi.clearAllMocks())

  it('la muestra bajo un comentario de un listado', () => {
    const { container } = wrap(<CommentCard comment={comentario()} role="reply" />)
    expect(container.querySelectorAll('.reply-preview-row')).toHaveLength(2)
  })

  it('no la muestra en el comentario abierto como cabecera del hilo', () => {
    const { container } = wrap(<CommentCard comment={comentario()} role="ancestor" />)
    expect(container.querySelector('.reply-preview')).toBeNull()
  })

  it('no la muestra en un comentario oculto', () => {
    const { container } = wrap(
      <CommentCard comment={comentario({ estado: 'oculto', cuerpo: null, respuestas_preview: [respuesta()] })} role="reply" />,
    )
    expect(container.querySelector('.reply-preview')).toBeNull()
  })

  it('el clic en una respuesta abre el hilo del comentario', () => {
    const onCardClick = vi.fn()
    wrap(<CommentCard comment={comentario()} role="reply" onCardClick={onCardClick} />)
    fireEvent.click(screen.getByText('caro'))
    expect(onCardClick).toHaveBeenCalledTimes(1)
    expect(onCardClick.mock.calls[0][0].id).toBe(1)
  })

  it('"Ver las N respuestas" abre el hilo; sin onCardClick usa el drill-down', () => {
    const onDrillDown = vi.fn()
    wrap(<CommentCard comment={comentario({ contador_respuestas: 5 })} role="reply" onDrillDown={onDrillDown} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ver las 5 respuestas' }))
    expect(onDrillDown).toHaveBeenCalledTimes(1)
  })

  it('el me gusta de una respuesta no abre el hilo y reacciona a esa respuesta', async () => {
    apiPost.mockResolvedValue({ data: { likes: 1, mi_reaccion: 'meGusta' } })
    const onCardClick = vi.fn()
    const { container } = wrap(<CommentCard comment={comentario()} role="reply" onCardClick={onCardClick} />)

    fireEvent.click(container.querySelector('.reply-preview-row .reaction-btn'))
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/reactions/10', { tipo: 'meGusta' }))
    expect(onCardClick).not.toHaveBeenCalled()
  })
})
