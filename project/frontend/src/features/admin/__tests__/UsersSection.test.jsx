import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { UsersSection } from '../UsersSection'

vi.mock('../../../hooks/useToast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}))

const USERS = [
  { id: 1, nickname: 'ana', nombre: 'Ana', email: 'ana@x.com', rol: 'user', estado: 'activo', auth_provider: 'google', fecha_creacion: '2024-01-01' },
  { id: 2, nickname: 'beto', nombre: 'Beto', email: 'beto@x.com', rol: 'user', estado: 'activo', auth_provider: 'local', fecha_creacion: '2024-01-02' },
  { id: 3, nickname: 'ceci', nombre: 'Ceci', email: 'ceci@x.com', rol: 'admin', estado: 'activo', auth_provider: 'both', fecha_creacion: '2024-01-03' },
]

vi.mock('../../../api/client', () => ({
  apiGet: vi.fn(() => Promise.resolve({ data: USERS })),
  apiPatch: vi.fn(() => Promise.resolve({})),
}))

function renderSection() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <UsersSection />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('UsersSection — total y autenticación', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('muestra el total de usuarios', async () => {
    renderSection()
    await waitFor(() => {
      expect(screen.getByText('Usuarios total:').textContent).toContain('3')
    })
  })

  it('muestra la columna de autenticación con Google, Local y ambos', async () => {
    renderSection()
    await screen.findByText('@ana')
    expect(screen.getByText('Google')).toBeTruthy()
    expect(screen.getByText('Local')).toBeTruthy()
    expect(screen.getByText('Google + Local')).toBeTruthy()
    // El encabezado de la nueva columna
    expect(screen.getByRole('columnheader', { name: 'Autenticación' })).toBeTruthy()
  })
})
