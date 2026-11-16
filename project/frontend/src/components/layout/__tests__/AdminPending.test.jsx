import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { LeftNav } from '../LeftNav'
import { MobileDrawer } from '../MobileDrawer'
import { Header } from '../Header'
import { formatPending } from '../../../hooks/useAdminPending'
import { apiGet } from '../../../api/client'

vi.mock('../../../api/client', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
}))

let session = { user: null, loading: false, setUser: vi.fn(), logout: vi.fn() }
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => session }))
vi.mock('../../../hooks/useToast', () => ({ useToast: () => ({ showToast: vi.fn() }) }))
vi.mock('../../../hooks/useSocket', () => ({ useSocket: () => null }))
vi.mock('../../../hooks/useSeason', () => ({ useSeason: () => null }))

const admin = { id: 1, nickname: 'admin', rol: 'admin', url_imagen: null }
const comun = { id: 2, nickname: 'ana', rol: 'user', url_imagen: null }

function mockPendientes(total) {
  apiGet.mockImplementation(path => Promise.resolve(
    path === '/admin/pending-count'
      ? { data: { apelaciones: total, reportes: 0, imagenes: 0, total } }
      : { data: { total: 0 } },
  ))
}

function renderNav(user) {
  session = { user, loading: false, setUser: vi.fn(), logout: vi.fn() }
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Header />
        <LeftNav />
        <MobileDrawer />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const adminLinks = (container) => [...container.querySelectorAll('a[href="/admin"]')]

describe('Indicador de pendientes de administración', () => {
  beforeEach(() => vi.clearAllMocks())

  it('formatea como las notificaciones: hasta 9 y después +9', () => {
    expect(formatPending(3)).toBe('3')
    expect(formatPending(9)).toBe('9')
    expect(formatPending(12)).toBe('+9')
  })

  it('un admin ve el acceso al panel en el menú de escritorio, en el drawer y en el header, con el contador', async () => {
    mockPendientes(3)
    const { container } = renderNav(admin)

    expect(adminLinks(container)).toHaveLength(3)
    await waitFor(() => {
      const textos = adminLinks(container).map(a => a.textContent.replace(/\s+/g, ' ').trim())
      expect(textos).toEqual(['3', 'Administración3', 'Administración3'])
    })
    expect(container.querySelector('.header-admin-link').getAttribute('aria-label')).toBe('Administración: 3 pendientes')
  })

  it('sin pendientes no muestra contador', async () => {
    mockPendientes(0)
    const { container } = renderNav(admin)

    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/admin/pending-count'))
    expect(container.querySelector('.header-admin-badge')).toBeNull()
    expect(adminLinks(container).map(a => a.textContent.trim())).toEqual(['', 'Administración', 'Administración'])
  })

  it('quien no es admin no ve el acceso ni consulta el contador', async () => {
    mockPendientes(5)
    const { container } = renderNav(comun)

    expect(adminLinks(container)).toHaveLength(0)
    await waitFor(() => expect(apiGet).toHaveBeenCalled())
    expect(apiGet).not.toHaveBeenCalledWith('/admin/pending-count')
  })
})
