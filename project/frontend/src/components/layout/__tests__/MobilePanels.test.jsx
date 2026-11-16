import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { LeftNav } from '../LeftNav'
import { BottomNav } from '../BottomNav'

vi.mock('../../../api/client', () => ({
  apiGet: vi.fn(() => Promise.resolve({ data: [] })),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
}))
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ user: null, setUser: vi.fn() }) }))
vi.mock('../../../hooks/useToast', () => ({ useToast: () => ({ showToast: vi.fn() }) }))
vi.mock('../../../hooks/useSocket', () => ({ useSocket: () => null }))

// LeftNav es dueño de los paneles; BottomNav es la barra que en móvil queda visible con ellos abiertos.
function renderNav(ruta = '/explore') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  window.scrollTo = vi.fn()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[ruta]}>
        <LeftNav />
        <BottomNav />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const panel = (container) => container.querySelector('.notif-panel:not(.saved-panel)')
const footer = (container) => container.querySelector('.bottom-nav')
const footerItem = (container, texto) =>
  [...footer(container).querySelectorAll('.bottom-nav-item')].find(n => n.textContent.includes(texto))

async function abrirAlertas(container) {
  await act(async () => { fireEvent.click(footerItem(container, 'Alertas')) })
  await waitFor(() => expect(panel(container).classList.contains('open')).toBe(true))
}

describe('Paneles con la barra inferior visible', () => {
  beforeEach(() => vi.clearAllMocks())

  it('con las alertas abiertas, "Alertas" es el ítem marcado y no la ruta de fondo', async () => {
    const { container } = renderNav('/explore')
    expect(footerItem(container, 'Explorar').classList.contains('active')).toBe(true)

    await abrirAlertas(container)
    expect(footerItem(container, 'Alertas').classList.contains('active')).toBe(true)
    expect(footerItem(container, 'Explorar').classList.contains('active')).toBe(false)
  })

  it('tocar "Alertas" de nuevo cierra el panel y devuelve la marca a la ruta', async () => {
    const { container } = renderNav('/explore')
    await abrirAlertas(container)

    await act(async () => { fireEvent.click(footerItem(container, 'Alertas')) })
    expect(panel(container).classList.contains('open')).toBe(false)
    expect(footerItem(container, 'Explorar').classList.contains('active')).toBe(true)
  })

  it('tocar otro ítem de la barra cierra el panel y navega', async () => {
    const { container } = renderNav('/explore')
    await abrirAlertas(container)

    await act(async () => { fireEvent.click(footerItem(container, 'Recientes')) })
    expect(panel(container).classList.contains('open')).toBe(false)
    expect(footerItem(container, 'Recientes').classList.contains('active')).toBe(true)
  })

  it('tocar el ítem de la pantalla actual también cierra el panel', async () => {
    const { container } = renderNav('/explore')
    await abrirAlertas(container)

    await act(async () => { fireEvent.click(footerItem(container, 'Explorar')) })
    expect(panel(container).classList.contains('open')).toBe(false)
  })

  it('un clic dentro del panel no lo cierra', async () => {
    const { container } = renderNav('/explore')
    await abrirAlertas(container)

    await act(async () => { fireEvent.click(screen.getByText('Iniciá sesión para ver tus notificaciones')) })
    expect(panel(container).classList.contains('open')).toBe(true)
  })
})
