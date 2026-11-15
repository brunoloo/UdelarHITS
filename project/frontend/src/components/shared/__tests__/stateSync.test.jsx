import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReadMore } from '../../ui/ReadMore'
import { IconPickerModal } from '../../../features/category/IconPickerModal'
import { PollDisplay } from '../PollDisplay'
import { ReactionButtons } from '../ReactionButtons'

vi.mock('../../../hooks/useToast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}))

vi.mock('../../../hooks/useRequireAuth', () => ({
  useRequireAuth: () => () => true,
}))

vi.mock('../../../api/client', () => ({
  apiPost: vi.fn(() => new Promise(() => {})),
}))

function withProviders(ui) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

const longText = (prefix) => Array.from({ length: 30 }, (_, i) => `${prefix} línea ${i + 1}`).join('\n')

describe('ReadMore', () => {
  it('vuelve al estado colapsado cuando cambia el texto', () => {
    const { container, rerender } = render(withProviders(<ReadMore text={longText('A')} />))
    expect(container.textContent).not.toContain('A línea 15')

    fireEvent.click(screen.getByRole('button', { name: 'Leer más' }))
    expect(container.textContent).toContain('A línea 15')

    rerender(withProviders(<ReadMore text={longText('B')} />))
    expect(container.textContent).toContain('B línea 8')
    expect(container.textContent).not.toContain('B línea 15')
    expect(screen.getByRole('button', { name: 'Leer más' })).toBeTruthy()
  })
})

describe('IconPickerModal', () => {
  const pressed = () => screen.getAllByRole('button', { pressed: true }).map((b) => b.title)

  it('al reabrirse vuelve a mostrar el ícono actual', () => {
    const props = { onClose: () => {}, onConfirm: () => {}, isPending: false, current: 'code' }
    const { rerender } = render(<IconPickerModal isOpen {...props} />)
    expect(pressed()).toEqual(['code'])

    fireEvent.click(screen.getByTitle('terminal'))
    expect(pressed()).toEqual(['terminal'])

    rerender(<IconPickerModal isOpen={false} {...props} />)
    rerender(<IconPickerModal isOpen {...props} />)
    expect(pressed()).toEqual(['code'])
  })

  it('sigue al ícono actual si cambia con el modal abierto', () => {
    const props = { onClose: () => {}, onConfirm: () => {}, isPending: false }
    const { rerender } = render(<IconPickerModal isOpen current="code" {...props} />)
    rerender(<IconPickerModal isOpen current="monitor" {...props} />)
    expect(pressed()).toEqual(['monitor'])
  })
})

describe('PollDisplay', () => {
  afterEach(() => { vi.useRealTimers() })

  const encuesta = (over = {}) => ({
    id: 1,
    cerrada: false,
    fecha_cierre: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    mi_voto: null,
    total_votos: 3,
    opciones: [
      { id: 10, texto: 'Opción uno', votos: 2 },
      { id: 11, texto: 'Opción dos', votos: 1 },
    ],
    ...over,
  })

  it('refleja la encuesta nueva cuando cambia la prop', () => {
    const { rerender } = render(withProviders(<PollDisplay encuesta={encuesta()} />))
    expect(screen.getByRole('button', { name: 'Opción uno' })).toBeTruthy()

    rerender(withProviders(<PollDisplay encuesta={encuesta({ mi_voto: 10 })} />))
    expect(screen.queryByRole('button', { name: 'Opción uno' })).toBeNull()
    expect(screen.getByText('67%')).toBeTruthy()
  })

  it('se muestra finalizada cuando vence mientras está en pantalla', () => {
    vi.useFakeTimers()
    const cierre = new Date(Date.now() + 2000).toISOString()
    render(withProviders(<PollDisplay encuesta={encuesta({ fecha_cierre: cierre })} />))
    expect(screen.queryByText('Finalizada')).toBeNull()

    act(() => { vi.advanceTimersByTime(3000) })
    expect(screen.getByText('Finalizada')).toBeTruthy()
  })
})

describe('ReactionButtons', () => {
  it('refleja el conteo y la reacción nuevos cuando cambian las props', () => {
    const { rerender } = render(withProviders(<ReactionButtons contenidoId={1} likes={2} mi_reaccion={null} />))
    const button = screen.getByRole('button', { name: 'Me gusta' })
    expect(button.textContent).toContain('2')
    expect(button.getAttribute('aria-pressed')).toBe('false')

    rerender(withProviders(<ReactionButtons contenidoId={1} likes={5} mi_reaccion="meGusta" />))
    expect(button.textContent).toContain('5')
    expect(button.getAttribute('aria-pressed')).toBe('true')
  })

  it('no pisa el estado optimista mientras hay un toggle en curso', () => {
    const { rerender } = render(withProviders(<ReactionButtons contenidoId={1} likes={2} mi_reaccion={null} />))
    const button = screen.getByRole('button', { name: 'Me gusta' })

    fireEvent.click(button)
    expect(button.textContent).toContain('3')

    rerender(withProviders(<ReactionButtons contenidoId={1} likes={9} mi_reaccion={null} />))
    expect(button.textContent).toContain('3')
    expect(button.getAttribute('aria-pressed')).toBe('true')
  })
})
