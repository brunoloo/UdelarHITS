import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CommentAttachments } from '../CommentAttachments'

const URL_DOC = 'https://res.cloudinary.com/demo/raw/upload/s--abc--/fl_attachment/v1/udelarhits/adjuntos/apuntes_x1y2z3.pdf'

const adjuntos = [
  { id: 1, tipo: 'documento', url: URL_DOC, nombre_original: 'Apuntes de Teórico (1).pdf', tamano: 2048, estado: 'publicado' },
]

describe('CommentAttachments: descarga de documentos', () => {
  let clicks

  beforeEach(() => {
    clicks = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      clicks.push({ href: this.href, download: this.download })
    })
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:local-1')
    globalThis.URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete globalThis.fetch
  })

  it('guarda el archivo con el nombre original', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(new Blob(['%PDF'])) })
    render(<CommentAttachments adjuntos={adjuntos} />)

    fireEvent.click(screen.getByText('Apuntes de Teórico (1).pdf'))

    await waitFor(() => expect(clicks).toHaveLength(1))
    expect(globalThis.fetch).toHaveBeenCalledWith(URL_DOC, { credentials: 'omit' })
    expect(clicks[0]).toEqual({ href: 'blob:local-1', download: 'Apuntes de Teórico (1).pdf' })
  })

  it('muestra "Descargando…" mientras baja', async () => {
    let resolver
    globalThis.fetch = vi.fn(() => new Promise(r => { resolver = r }))
    render(<CommentAttachments adjuntos={adjuntos} />)

    fireEvent.click(screen.getByText('Apuntes de Teórico (1).pdf'))
    expect(await screen.findByText('Descargando…')).toBeInTheDocument()

    resolver({ ok: true, blob: () => Promise.resolve(new Blob(['%PDF'])) })
    await waitFor(() => expect(screen.queryByText('Descargando…')).not.toBeInTheDocument())
  })

  it('si la descarga falla, sigue el enlace de siempre', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 })
    render(<CommentAttachments adjuntos={adjuntos} />)

    fireEvent.click(screen.getByText('Apuntes de Teórico (1).pdf'))

    await waitFor(() => expect(clicks).toHaveLength(1))
    expect(clicks[0]).toEqual({ href: URL_DOC, download: '' })
    expect(globalThis.URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('con Ctrl/Cmd el enlace se comporta como siempre', () => {
    globalThis.fetch = vi.fn()
    render(<CommentAttachments adjuntos={adjuntos} />)

    fireEvent.click(screen.getByText('Apuntes de Teórico (1).pdf'), { ctrlKey: true })

    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})
