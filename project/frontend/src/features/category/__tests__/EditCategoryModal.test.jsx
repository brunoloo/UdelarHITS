import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { EditCategoryModal } from '../CategoryPage'
import { apiGet } from '../../../api/client'

vi.mock('../../../hooks/useToast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}))

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 1, rol: 'admin' } }),
}))

vi.mock('../../../api/client', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
}))

const cat = { id: 5, descripcion: 'Descripción actual', etiquetas: ['FING'] }

function renderModal(isOpen) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <EditCategoryModal cat={cat} isOpen={isOpen} onClose={() => {}} onSaved={() => {}} />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('EditCategoryModal', () => {
  beforeEach(() => { apiGet.mockReset() })

  it('cerrado y con el catálogo de etiquetas cargando no entra en un bucle de renders', () => {
    apiGet.mockReturnValue(new Promise(() => {}))
    expect(() => renderModal(false)).not.toThrow()
  })

  it('al abrirse carga la descripción actual de la categoría', async () => {
    apiGet.mockResolvedValue({ data: { Facultades: [{ id: 1, nombre: 'FING', nombre_display: 'Ingeniería' }] } })
    renderModal(true)
    await waitFor(() => {
      expect(screen.getByPlaceholderText('¿De qué va esta categoría?').value).toBe('Descripción actual')
    })
  })
})
